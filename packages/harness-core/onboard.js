import {validateVerificationChecks} from './verification.js';
import {designGuidanceProfile} from '../skill-core/design-guidance.js';
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { promisify } from 'node:util';
import { assertCapturePlan } from './capture-state.js';

const execFileAsync = promisify(execFile);

// The preview lifecycle lives next to its validation on purpose. start.command
// is a bare name and start.args reject Windows shell metacharacters precisely
// because spawning a preview needs shell:true on Windows to reach .cmd shims
// like npm. Changing either side without the other would quietly undo the other's
// guarantee; tests pin them together below.
export function spawnPreview(start) {
  const child = spawn(start.command, start.args, {
    cwd: start.cwd,
    env: { ...process.env, ...start.env },
    windowsHide: true,
    stdio: 'ignore',
    shell: process.platform === 'win32',
    detached: process.platform !== 'win32'
  });
  child.unref();
  child.on('error', () => {});
  return child;
}

export function stopPreview(child) {
  if (!child || child.killed || !child.pid) return;
  if (process.platform === 'win32') {
    execFile('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], () => {});
  } else {
    // The child was spawned detached, so it leads its own process group and the
    // negative pid terminates the whole tree — `npm run dev` wraps a dev server
    // that would otherwise survive the death of its wrapper.
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch { /* already gone */ } }
  }
}

function resolveFrom(base, value) {
  return isAbsolute(value) ? resolve(value) : resolve(base, value);
}

export async function loadProjectConfig(path) {
  const configPath = resolve(path);
  const base = dirname(configPath);
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  if (config.version !== '0.1') throw new Error('Project config version must be 0.1.');
  for (const key of ['spec', 'repo']) if (!config[key]?.trim()) throw new Error(`Project config requires ${key}.`);
  validateVerificationChecks(config.verificationChecks);
  const mode = config.mode || 'auto';
  if (!['auto', 'review', 'bootstrap'].includes(mode)) throw new Error('Project mode must be auto, review or bootstrap.');
  let capturePlanPath = null;
  let capturePlanDocument = null, capturePlanDigest = null;
  if (config.capturePlan !== undefined) {
    if (typeof config.capturePlan !== 'string' || !config.capturePlan.trim()) throw new Error('capturePlan must be a non-empty file path.');
    capturePlanPath = resolveFrom(base, config.capturePlan);
    const bytes = await readFile(capturePlanPath);
    capturePlanDigest = createHash('sha256').update(bytes).digest('hex');
    capturePlanDocument = assertCapturePlan(JSON.parse(bytes));
    const ids = new Set(capturePlanDocument.states.map(state=>state.id));
    for(const check of config.verificationChecks || []) {
      const missing = check.stateIds.filter(id=>!ids.has(id));
      if(missing.length)throw new Error(`Verification check ${check.id} names states missing from capture plan: ${missing.join(', ')}. Align the verification scope before starting review.`);
    }
  }
  // A surface that has not been built yet has nothing to serve, so url is optional.
  const parsed = config.url?.trim() ? new URL(config.url) : null;
  if (parsed && !['http:', 'https:'].includes(parsed.protocol)) throw new Error('Project URL must use http or https.');
  const planUrl = capturePlanDocument ? new URL(capturePlanDocument.states[0].start.url) : null;
  const effectiveUrl = parsed || planUrl;
  if (!effectiveUrl && mode === 'review') throw new Error('Review mode requires url or capturePlan; without a preview there is no baseline to capture.');
  if (!effectiveUrl && config.start) throw new Error('start requires url or capturePlan; the Harness needs an address to wait for.');
  if (config.routes !== undefined) {
    if (!Array.isArray(config.routes) || config.routes.length === 0) throw new Error('routes must be a non-empty array when it is set.');
    if (config.routes.some(value => typeof value !== 'string' || !value.trim())) throw new Error('Every route must be a non-empty string.');
    if (!effectiveUrl) throw new Error('routes requires url or capturePlan; routes are resolved against it.');
  }
  const routes = config.routes || [];
  if (capturePlanDocument && effectiveUrl) {
    const routeKey = value => {
      const url = new URL(value, effectiveUrl);
      return `${url.origin}${url.pathname.replace(/\/+$/, '') || '/'}${url.search}`;
    };
    const planUrls = capturePlanDocument.states.flatMap(state => [state.start.url, ...state.actions.filter(action => action.type === 'navigate').map(action => action.url)]);
    const foreign = planUrls.find(value => new URL(value).origin !== effectiveUrl.origin);
    if (foreign) throw new Error(`Capture plan URL ${foreign} must use the configured preview origin ${effectiveUrl.origin}.`);
    const plannedRoutes = new Set(planUrls.map(routeKey));
    const missingRoutes = routes.map(route => new URL(route, effectiveUrl).href).filter(route => !plannedRoutes.has(routeKey(route)));
    if (missingRoutes.length) throw new Error(`Capture plan is missing configured routes: ${missingRoutes.join(', ')}.`);
  }
  if (config.start) {
    if (!config.start.command?.trim()) throw new Error('start.command is required when start is configured.');
    if (!/^[a-zA-Z0-9_.-]+$/.test(config.start.command)) throw new Error('start.command must be a bare executable name.');
    if (config.start.args && !Array.isArray(config.start.args)) throw new Error('start.args must be an array.');
    if (config.start.args?.some(value => typeof value !== 'string')) throw new Error('Every start argument must be a string.');
    if (config.start.env && (typeof config.start.env !== 'object' || Array.isArray(config.start.env))) throw new Error('start.env must be an object.');
    if (config.start.env && Object.entries(config.start.env).some(([key, value]) => !/^[A-Z_][A-Z0-9_]*$/i.test(key) || typeof value !== 'string')) {
      throw new Error('start.env keys must be environment variable names and values must be strings.');
    }
    if (process.platform === 'win32' && config.start.args?.some(value => /[&|<>^%\r\n]/.test(value))) {
      throw new Error('Start arguments cannot contain Windows shell control characters.');
    }
  }
  return {
    ...config,
    configPath,
    spec: resolveFrom(base, config.spec),
    repo: resolveFrom(base, config.repo),
    url: effectiveUrl ? effectiveUrl.href : null,
    capturePlanPath,
    capturePlanDocument,
    capturePlanDigest,
    mode,
    routes,
    browser: config.browser || 'chrome',
    ...(config.designGuidance !== undefined ? {designGuidance:designGuidanceProfile(config.designGuidance)} : {}),
    start: config.start ? {
      command: config.start.command,
      args: config.start.args || [],
      cwd: resolveFrom(base, config.start.cwd || config.repo),
      env: config.start.env || {}
    } : null
  };
}

export async function inspectRepository(repo) {
  const options = { cwd: repo, windowsHide: true, encoding: 'utf8' };
  const [{ stdout: root }, { stdout: commit }, { stdout: status }] = await Promise.all([
    execFileAsync('git', ['-c', 'safe.directory=*', 'rev-parse', '--show-toplevel'], options),
    execFileAsync('git', ['-c', 'safe.directory=*', 'rev-parse', 'HEAD'], options),
    execFileAsync('git', ['-c', 'safe.directory=*', 'status', '--porcelain'], options)
  ]);
  return { root: root.trim(), commit: commit.trim(), dirty: Boolean(status.trim()) };
}

export async function waitForPreview(url, { timeoutMs = 30000, intervalMs = 250 } = {}) {
  const started = Date.now();
  let lastError = 'no response';
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(Math.min(5000, timeoutMs)) });
      if (response.status < 400) return { status: response.status, finalUrl: response.url };
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise(resolveWait => setTimeout(resolveWait, intervalMs));
  }
  throw new Error(`Preview did not become ready within ${timeoutMs}ms (${lastError}).`);
}

export function publicProjectConfig(config) {
  return {
    version: config.version,
    configPath: config.configPath,
    repo: config.repo,
    url: config.url,
    mode: config.mode,
    ...(config.designSources?.length?{designSources:config.designSources,designSourcePaths:config.designSourcePaths}:{}),
    ...(config.siteHandoff?{siteHandoff:config.siteHandoff}:{}),
    routes: config.routes,
    browser: config.browser,
    ...(config.verificationChecks?.length ? {verificationChecks:config.verificationChecks} : {}),
    ...(config.designGuidance ? {designGuidance:config.designGuidance} : {}),
    capturePlan: config.capturePlanPath,
    capturePlanDigest: config.capturePlanDigest,
    ...(config.reviewPlanApproval ? {reviewPlanApproval:config.reviewPlanApproval} : {}),
    // Environment names only. A preview command is often handed tokens, and this
    // object is written into run.json — the file the docs tell people to read and
    // the natural thing to attach to a bug report. The export layer redacts too;
    // this keeps the value out of the run directory in the first place.
    start: config.start ? { command: config.start.command, args: config.start.args, cwd: config.start.cwd, envKeys: Object.keys(config.start.env || {}) } : null
  };
}
