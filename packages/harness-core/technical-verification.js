import {execFile} from 'node:child_process';
import {readFile, realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {captureBrowserPlan} from './browser.js';
import {assertCapturePlan, captureKey} from './capture-state.js';
import {evidenceLevel} from './evidence-policy.js';
import {verificationPreviewFingerprint} from './preview-fingerprint.js';
import {repositoryFingerprint, sameRepositoryFingerprint} from './repository-fingerprint.js';
import {loadRun, withRunLock, writeJson} from './store.js';
import {verificationHash} from './verification.js';

const exec = promisify(execFile);

function localUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) {
    throw Error('Technical runtime verification requires a local HTTP preview.');
  }
  return url;
}

function route(value) {
  const url = localUrl(value);
  return url.pathname + url.search + url.hash;
}

function rebasePlan(plan, initialUrl, url) {
  const origin = localUrl(initialUrl).origin;
  const remap = value => {
    if (localUrl(value).origin !== origin) throw Error('Use one preview origin in the technical capture plan.');
    return new URL(route(value), localUrl(url).origin).href;
  };
  return assertCapturePlan({...plan, states: plan.states.map(state => ({
    ...state, start: {...state.start, url: remap(state.start.url)},
    actions: state.actions.map(action => action.type === 'navigate' ? {...action, url: remap(action.url)} : action)
  }))});
}

async function readRuntimePlan(run, url) {
  const config = run.manifest.onboarding.config;
  const planBytes = await readFile(config.capturePlan);
  if (verificationHash(planBytes) !== config.capturePlanDigest) throw Error('Technical capture plan changed after start.');
  const plan = assertCapturePlan(JSON.parse(planBytes));
  if (plan.states.some(state => (state.captureMode && state.captureMode !== 'viewport') || state.region || state.scrollSurface)) {
    throw Error('Technical browser checks use the viewport and action replay. Use visual review for regions or full-page capture.');
  }
  if (route(url) !== route(config.url)) throw Error('Use the same preview entry path, query and fragment in both phases.');
  return rebasePlan(plan, config.url, url);
}

async function checkSyntax(repo, file) {
  // Check the syntax of one declared JavaScript source file without executing it.
  await exec('git', ['--literal-pathspecs', 'ls-files', '--error-unmatch', '--', file], {cwd: repo});
  const path = join(repo, file);
  if (await realpath(path) !== path) throw Error('The syntax check requires a regular source path.');
  try {
    await exec(process.execPath, ['--check', path], {cwd: repo, timeout: 10000});
    return [{file, status: 'pass'}];
  } catch (error) {
    if (error.code !== 1 || !/\bSyntaxError:/.test(error.stderr || '')) throw error;
    return [{file, status: 'fail', diagnostic: error.stderr.trim().slice(0, 1000)}];
  }
}

async function measurePage(page, policy) {
  if (policy.kind === 'horizontal-overflow') {
    const measurement = await page.evaluate(() => {
      const root = document.scrollingElement || document.documentElement;
      return {viewportWidth: root.clientWidth, contentWidth: root.scrollWidth};
    });
    return {...measurement, status: measurement.contentWidth > measurement.viewportWidth + 1 ? 'fail' : 'pass'};
  }
  const target = page.locator(policy.selector);
  const buttons = page.getByRole('button');
  if (await target.count() !== 1 || !await target.isVisible() || await target.and(buttons).count() !== 1) {
    throw Error('The configured selector must identify exactly one visible, accessible button.');
  }
  const named = target.and(page.getByRole('button', {name: policy.name, exact: true}));
  return {selector: policy.selector, expectedName: policy.name, status: await named.count() === 1 ? 'pass' : 'fail'};
}

async function checkRuntime({run, repo, url, phase}) {
  const plan = await readRuntimePlan(run, url);
  const capture = await captureBrowserPlan({
    plan, directory: join(run.directory, 'technical'), phase, sourceRoot: repo,
    channel: run.manifest.onboarding.config.browser,
    measureRuntime: page => measurePage(page, run.manifest.evidencePolicy)
  });
  return capture.states.map(state => {
    const reached = state.reached && new URL(state.finalUrl).origin === localUrl(url).origin;
    return {
      key: captureKey(state.stateId, state.configurationId),
      viewport: {width: state.width, height: state.height},
      route: reached ? route(state.finalUrl) : null,
      ...(reached ? state.measurement : {status: 'needs-evidence', diagnostic: state.error || 'Preview left the local origin.'})
    };
  });
}

async function commonGitDir(repo) {
  const {stdout} = await exec('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {cwd: repo});
  return realpath(stdout.trim());
}

function resultStatus(checks) {
  if (!checks.length || checks.some(check => check.status === 'needs-evidence')) return 'needs-evidence';
  return checks.some(check => check.status === 'fail') ? 'fail' : 'pass';
}

function comparableStates(before, after) {
  const scope = entries => entries.map(({key, viewport, route}) => ({key, viewport, route}));
  return JSON.stringify(scope(before)) === JSON.stringify(scope(after));
}

export async function verifyTechnicalRepair({directory, phase, repo, url}) {
  if (!['before', 'after'].includes(phase)) throw Error('Technical verification requires --phase before|after.');
  return withRunLock(directory, async () => {
    const run = await loadRun(directory);
    const {manifest} = run;
    const level = evidenceLevel(manifest.evidencePolicy);
    if (level === 'visual') throw Error('Visual Runs use capture, verify and independent visual review.');
    if (manifest.technicalEvidence?.[phase]) throw Error('This phase is already recorded. Start a new Run for another attempt.');
    const before = manifest.technicalEvidence?.before;
    if (phase === 'after' && before?.status !== 'fail') throw Error('Reproduce the declared defect before verifying a candidate.');
    const original = await realpath(manifest.onboarding.repository.root);
    const checkout = await realpath(repo || original);
    if (phase === 'before' && checkout !== original) throw Error('Baseline verification must use the checkout from start.');
    const source = await repositoryFingerprint(checkout);
    if (source.dirty) throw Error('Commit the intended version before technical verification.');
    if (phase === 'before' && source.commit !== manifest.onboarding.repository.commit) throw Error('Baseline commit changed after start.');
    if (phase === 'after') {
      if (checkout === original || await commonGitDir(checkout) !== await commonGitDir(original) ||
          source.contentHash === before.source.contentHash || source.commit === before.source.commit) {
        throw Error('Use a changed, committed candidate in an isolated worktree of the same Git repository.');
      }
      await exec('git', ['merge-base', '--is-ancestor', before.source.commit, source.commit], {cwd: checkout});
    }
    if (level === 'source' && url !== undefined) throw Error('A source check does not use a preview URL.');
    if (phase === 'before' && url !== undefined && localUrl(url).href !== manifest.url) throw Error('Baseline preview URL changed after start.');
    const previewUrl = level === 'runtime' ? localUrl(url || manifest.url).href : null;
    if (phase === 'after' && previewUrl && localUrl(previewUrl).origin === localUrl(before.preview.url).origin) throw Error('Provide the isolated candidate’s own preview URL.');
    const preview = previewUrl ? {url: previewUrl, fingerprint: await verificationPreviewFingerprint(previewUrl)} : null;
    const checks = level === 'source'
      ? await checkSyntax(checkout, manifest.evidencePolicy.file)
      : await checkRuntime({run, repo: checkout, url: previewUrl, phase});
    if (!sameRepositoryFingerprint(source, await repositoryFingerprint(checkout))) throw Error('Repository inputs changed during technical verification.');
    if (preview && preview.fingerprint !== await verificationPreviewFingerprint(preview.url)) throw Error('Preview changed during technical verification.');
    const scopeChanged = phase === 'after' && level === 'runtime' && !comparableStates(before.checks, checks);
    const record = {
      status: scopeChanged ? 'needs-evidence' : resultStatus(checks),
      level, phase, source, preview, checks, visual: 'not-reviewed',
      ...(scopeChanged ? {diagnostic:'The final routes or viewport states differ from the baseline.'} : {})
    };
    manifest.technicalEvidence = {...manifest.technicalEvidence, [phase]: record};
    await writeJson(join(directory, 'run.json'), manifest);
    return record;
  });
}
