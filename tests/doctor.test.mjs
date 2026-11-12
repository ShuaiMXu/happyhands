import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {preflight} from '../skills/happyhands/lib/preflight.mjs';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('../skills/happyhands/bin/happyhands.mjs', import.meta.url));

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'hh-doctor-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const repo = join(root, 'product');
  await mkdir(repo);
  const git = (...args) => exec('git', args, {cwd: repo});
  await git('init', '-q');
  await writeFile(join(repo, '.gitignore'), 'node_modules/\n');
  await writeFile(join(repo, 'package.json'), JSON.stringify({name: 'doctor-fixture', scripts: {dev: 'vite --host 127.0.0.1'}, devDependencies: {vite: '8.3.5'}}));
  await git('add', '.');
  await git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Fixture');
  const browser = join(root, 'browser');
  await writeFile(browser, 'fixture', {mode: 0o755});
  const execute = (command, args, options) => args[0] === '--version'
    ? Promise.resolve({stdout: command + ' fixture'}) : exec(command, args, options);
  const dependencies = {execute, browserPaths: async () => [{channel: 'chrome', path: browser}]};
  return {root, repo, git, dependencies};
}

async function framework(parent) {
  const directory = join(parent, 'node_modules', 'vite');
  await mkdir(join(directory, 'bin'), {recursive: true});
  await writeFile(join(directory, 'package.json'), JSON.stringify({name: 'vite', version: '8.3.5', bin: {vite: 'bin/vite.js'}}));
  await writeFile(join(directory, 'bin', 'vite.js'), 'throw Error("Doctor must never execute package code");\n');
}

test('doctor resolves declared target tools and reports clean state without executing project code', async t => {
  const f = await fixture(t);
  await framework(f.repo);
  const before = (await f.git('status', '--porcelain')).stdout;
  const report = await preflight({repo: f.repo, agent: 'claude-code'}, f.dependencies);
  assert.equal(report.tools.executor.available, true);
  assert.equal(report.agent, 'claude-code');
  assert.equal(report.checks.repository.status, 'pass');
  assert.equal(report.checks.dependencies.status, 'pass');
  assert.equal(report.checks.dependencies.framework, 'vite');
  assert.equal(report.checks.browser.status, 'pass');
  assert.equal(report.checks.model.status, 'unverified');
  assert.equal(report.status, 'unverified');
  assert.equal((await f.git('status', '--porcelain')).stdout, before);
  await writeFile(join(f.repo, 'draft.txt'), 'Existing work');
  const dirty = await preflight({repo: f.repo}, f.dependencies);
  assert.equal(dirty.checks.repository.dirty, true);
  assert.equal(dirty.checks.repository.status, 'fail');
  assert.equal(dirty.status, 'fail');
});

test('doctor rejects parent dependency fallback and missing framework executables', async t => {
  const f = await fixture(t);
  await framework(f.root);
  const fallback = await preflight({repo: f.repo}, f.dependencies);
  assert.equal(fallback.checks.dependencies.status, 'fail');
  assert.match(fallback.checks.dependencies.reason, /outside the target checkout/);
  await framework(f.repo);
  await rm(join(f.repo, 'node_modules', 'vite', 'bin', 'vite.js'));
  const broken = await preflight({repo: f.repo}, f.dependencies);
  assert.equal(broken.checks.dependencies.status, 'fail');
});

test('doctor keeps unsupported projects unverified and marks unavailable browsers as failures', async t => {
  const f = await fixture(t);
  await writeFile(join(f.repo, 'package.json'), JSON.stringify({scripts: {dev: 'next dev'}}));
  const report = await preflight({repo: f.repo}, {...f.dependencies, browserPaths: async () => [{channel: 'chrome', path: join(f.root, 'absent')}]});
  assert.equal(report.checks.dependencies.status, 'unverified');
  assert.equal(report.checks.browser.status, 'fail');
  await assert.rejects(preflight({url: 'file:///tmp/example'}), /HTTP/);
  await assert.rejects(preflight({url: 'http://user:password@localhost/'}), /credentials/);
});

test('doctor checks the exact requested preview and preserves HTTP failures', async t => {
  const f = await fixture(t);
  const paths = [];
  const server = createServer((request, response) => {
    paths.push(request.url);
    response.writeHead(request.url === '/actual-preview' ? 200 : 401);
    response.end('fixture');
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(() => server.close());
  const base = 'http://127.0.0.1:' + server.address().port;
  const ok = await preflight({url: base + '/actual-preview'}, f.dependencies);
  assert.equal(ok.checks.preview.status, 'pass');
  const blocked = await preflight({url: base + '/private'}, f.dependencies);
  assert.equal(blocked.checks.preview.httpStatus, 401);
  assert.equal(blocked.status, 'fail');
  assert.deepEqual(paths, ['/actual-preview', '/private']);
});

test('doctor CLI validates scoped options and keeps model smoke calls explicit', async () => {
  await assert.rejects(exec(process.execPath, [cli, 'doctor', '--model', 'unrequested']), /Doctor supports/);
  await assert.rejects(exec(process.execPath, [cli, 'doctor', '--agent', 'unknown']), /Select --agent/);
});
