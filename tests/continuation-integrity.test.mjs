import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, mkdir, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import sample from '../examples/happyclaw-site/experience.json' with {type: 'json'};
import {createRun, loadRun, saveCapture, saveOnboarding, saveVisualReview} from '../packages/harness-core/store.js';
import {inspectRepository} from '../packages/harness-core/onboard.js';
import {continueReview} from '../packages/harness-core/continue-review.js';
import {selectResource, selectedReferenceContext} from '../packages/harness-core/reference-resources.js';

const execute = promisify(execFile);

async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'hh-continue-integrity-')));
  const repo = join(root, 'product');
  await mkdir(repo);
  const git = (...args) => execute('git', args, {cwd: repo});
  await git('init', '-q');
  await git('config', 'user.name', 'Synthetic reviewer');
  await git('config', 'user.email', 'review@example.invalid');
  await writeFile(join(repo, 'index.html'), '<h1>Original fixture</h1>');
  await git('add', '.');
  await git('commit', '-qm', 'Synthetic baseline');
  const server = createServer((_request, response) => response.end('<h1>Fixture preview</h1>'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  });
  const url = `http://127.0.0.1:${server.address().port}/`;
  const outputRoot = join(root, 'runs');
  await mkdir(outputRoot);
  const parent = await createRun({spec: structuredClone(sample), url, outputRoot});
  await saveOnboarding(parent.directory, {status: 'ready', repository: await inspectRepository(repo)});
  await mkdir(join(parent.directory, 'before'));
  await writeFile(join(parent.directory, 'before/desktop.png'), 'Synthetic original bytes');
  await saveCapture(parent.directory, 'before', {viewports: {desktop: {screenshot: 'before/desktop.png'}}});
  const specPath = join(root, 'experience.json');
  const configPath = join(root, 'project.json');
  await writeFile(specPath, JSON.stringify(sample));
  const config = {version: '0.1', mode: 'review', repo, spec: specPath, url};
  await writeFile(configPath, JSON.stringify(config));
  return {root, repo, git, parent, config, configPath, outputRoot, reason: 'Correct the unresolved synthetic task'};
}

test('a changed historical review cannot be rehashed into a trusted continuation', async t => {
  const f = await fixture(t);
  await saveVisualReview(f.parent.directory, {
    schemaVersion: '0.1', skillId: 'visual-hierarchy-reviewer',
    reviewer: {type: 'human', name: 'Synthetic reviewer', version: '1'},
    reviewedAt: new Date().toISOString(), verdict: 'needs-evidence',
    screenshotRefs: ['before/desktop.png'], findings: [],
    rationale: 'Synthetic inspection still lacks a task state.', limitations: ['Fixture only.']
  });
  const parent = await loadRun(f.parent.directory);
  const reviewPath = join(parent.directory, parent.manifest.visualReviews[0].path);
  const review = JSON.parse(await readFile(reviewPath, 'utf8'));
  await writeFile(reviewPath, JSON.stringify({...review, rationale: 'Changed after the original review was bound.'}));
  await assert.rejects(continueReview({...f, directory: parent.directory}), /Visual review artifact changed/);
  await assert.rejects(readFile(join(parent.directory, 'continuation-next.json')), {code: 'ENOENT'});
});

test('a committed linked worktree can continue with fresh gates and intact reference metadata', async t => {
  const f = await fixture(t);
  const referencePath = join(f.root, 'reference.md');
  await writeFile(referencePath, '# Existing direction\nPreserve task labels.\n');
  await selectResource({directory: f.parent.directory, file: referencePath});
  const originalReferences = await selectedReferenceContext(await loadRun(f.parent.directory));
  const worktree = join(f.root, 'continued-product');
  await f.git('worktree', 'add', '-qb', 'continued-fixture', worktree);
  await writeFile(join(worktree, 'index.html'), '<h1>Corrected fixture</h1>');
  await execute('git', ['add', '.'], {cwd: worktree});
  await execute('git', ['commit', '-qm', 'Synthetic correction'], {cwd: worktree});
  const changed = await inspectRepository(worktree);
  await writeFile(f.configPath, JSON.stringify({...f.config, repo: worktree}));
  const child = await loadRun(await continueReview({...f, directory: f.parent.directory}));
  assert.equal(child.manifest.onboarding.repository.root, worktree);
  assert.equal(child.manifest.onboarding.repository.commit, changed.commit);
  assert.notEqual(changed.commit, (await loadRun(f.parent.directory)).manifest.onboarding.repository.commit);
  assert.equal(child.manifest.captures.before, null);
  assert.equal(child.manifest.execution, null);
  assert.equal(child.manifest.judgment, null);
  assert.deepEqual(await selectedReferenceContext(child), originalReferences);
  await f.git('worktree', 'remove', worktree);
});
