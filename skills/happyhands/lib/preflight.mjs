import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {access, readFile, realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createRequire} from 'node:module';
import {isAbsolute, join, relative, resolve, sep} from 'node:path';

const exec = promisify(execFile);

function within(root, path) {
  const delta = relative(root, path);
  return delta !== '..' && !delta.startsWith('..' + sep) && !isAbsolute(delta);
}

async function installedBrowsers() {
  // Match the channels used by the capture adapter using the pinned Playwright registry.
  const {default: bundle} = await import('playwright-core/lib/coreBundle');
  return ['chrome', 'msedge'].map(channel => ({
    channel,
    path: bundle.registry.registry.findExecutable(channel)?.executablePath() || null
  }));
}

async function checkDependencies(directory, repositoryRoot) {
  let pkg;
  try {
    pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  } catch {
    return {status: 'unverified', reason: 'No readable package.json. Check this project’s preview command and dependencies separately.'};
  }
  const script = pkg.scripts?.dev;
  const framework = typeof script === 'string' && !/[;&|<>$`\r\n]/.test(script)
    ? /^vite(?:\s|$)/.test(script) ? 'vite' : /^astro\s+dev(?:\s|$)/.test(script) ? 'astro' : null
    : null;
  if (!framework) return {status: 'unverified', reason: 'Automatic dependency checks cover direct Vite and Astro dev scripts. Check the declared preview command separately.'};
  if (!(pkg.dependencies?.[framework] || pkg.devDependencies?.[framework])) {
    return {status: 'fail', framework, reason: `${framework} is used by dev but is not declared in this package. Check the target manifest and install its declared dependencies.`};
  }
  try {
    const require = createRequire(join(directory, 'package.json'));
    const manifest = await realpath(require.resolve(framework + '/package.json'));
    if (!within(repositoryRoot, manifest)) {
      return {status: 'fail', framework, reason: `${framework} resolves outside the target checkout. Install the target’s own declared dependencies before running its preview.`};
    }
    const installed = JSON.parse(await readFile(manifest, 'utf8'));
    const bin = typeof installed.bin === 'string' ? installed.bin : installed.bin?.[framework];
    if (installed.name !== framework || typeof bin !== 'string') throw new Error('Missing framework executable.');
    const executable = await realpath(resolve(manifest, '..', bin));
    if (!within(repositoryRoot, executable)) throw new Error('Framework executable resolves outside the checkout.');
    await access(executable, constants.R_OK);
    return {status: 'pass', framework, version: installed.version, manifest, executable};
  } catch {
    return {status: 'fail', framework, reason: `${framework} is not usable from the target’s dependency tree. Install the target’s declared dependencies and check its framework package.`};
  }
}

export async function preflight({agent = 'codex', repo, url} = {}, {execute = exec, request = fetch, browserPaths = installedBrowsers} = {}) {
  if (!['codex', 'claude-code'].includes(agent)) throw new Error('Select --agent codex or claude-code.');
  let previewUrl;
  if (url !== undefined) {
    previewUrl = new URL(url);
    if (!['http:', 'https:'].includes(previewUrl.protocol) || previewUrl.username || previewUrl.password) {
      throw new Error('Preview URL must use HTTP(S) without embedded credentials.');
    }
  }
  const tools = {};
  for (const [key, binary] of [['git', 'git'], ['executor', agent === 'codex' ? 'codex' : 'claude']]) {
    try {
      tools[key] = {available: true, version: (await execute(binary, ['--version'], {timeout: 10000, maxBuffer: 65536})).stdout.trim()};
    } catch {
      tools[key] = {available: false};
    }
  }
  const browsers = [];
  for (const candidate of await browserPaths()) {
    if (!candidate.path) continue;
    try {
      await access(candidate.path, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
      browsers.push(candidate);
    } catch { /* An absent channel is reported by the combined browser check. */ }
  }
  const checks = {
    browser: browsers.length ? {status: 'pass', installed: browsers, reason: 'Installed capture executable found. Browser launch is still unverified.'}
      : {status: 'fail', installed: [], reason: 'Install Chrome or Edge for the supported capture channels, then rerun doctor.'},
    model: {status: 'unverified', reason: 'Executable presence does not verify model configuration or authentication. Make a read-only model attempt with the selected executor before repair.'}
  };
  if (repo !== undefined) {
    try {
      const directory = await realpath(resolve(repo));
      const git = (...args) => execute('git', args, {cwd: directory, timeout: 10000, maxBuffer: 1024 * 1024});
      const root = await realpath((await git('rev-parse', '--show-toplevel')).stdout.trim());
      const commit = (await git('rev-parse', 'HEAD')).stdout.trim();
      const dirty = Boolean((await git('status', '--porcelain')).stdout.trim());
      checks.repository = {status: dirty ? 'fail' : 'pass', root, directory, commit, dirty,
        ...(dirty ? {reason: 'Save the current work and select a clean source before isolated execution.'} : {})};
      checks.dependencies = await checkDependencies(directory, root);
    } catch {
      checks.repository = {status: 'fail', reason: 'Select an existing Git checkout with a committed revision.'};
      checks.dependencies = {status: 'unverified', reason: 'Dependency checks require a readable target checkout.'};
    }
  }
  if (previewUrl) {
    try {
      const response = await request(previewUrl.href, {method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(5000)});
      await response.body?.cancel().catch(() => {});
      checks.preview = {status: response.ok ? 'pass' : 'fail', httpStatus: response.status,
        reason: response.ok ? 'The configured URL responded. Screenshot state and source binding remain unverified.'
          : 'The configured URL returned an HTTP error. Check the exact preview entry and any required login.'};
    } catch {
      checks.preview = {status: 'fail', reason: 'The preview did not respond within five seconds. Start its actual server and check the exact URL.'};
    }
  }
  const failed = Object.values(tools).some(tool => !tool.available) || Object.values(checks).some(check => check.status === 'fail');
  return {node: process.version, agent, tools, checks, status: failed ? 'fail' : 'unverified', workbenchRequired: false,
    limitations: ['These read-only checks do not establish model access, a rendered UI state or source-bound screenshots.']};
}
