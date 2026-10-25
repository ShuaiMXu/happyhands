import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import sample from '../examples/happyclaw-site/experience.json' with { type: 'json' };
import { createRun, saveCapture, confirmFinding, savePlan, saveEvaluation, saveExecution, saveJudgment, saveVisualReview } from '../packages/harness-core/store.js';
import { evaluateCaptures } from '../packages/harness-core/evaluate.js';
import { exportRun, readIndex, reindex } from '../packages/harness-core/export.js';

function capture(phase, h1) {
  return {
    at: '2026-09-19T00:00:00.000Z',
    url: 'http://127.0.0.1:4321/',
    viewports: {
      desktop: {
        width: 1280, height: 800, status: 200, screenshot: `${phase}/desktop.png`,
        dom: { h1: [h1], actions: [{ label: '试用', href: '/trial' }], horizontalOverflow: false }
      }
    }
  };
}

async function temporaryRoot(t) {
  const root = await mkdtemp(join(tmpdir(), 'pd-export-test-'));
  t.after(async () => {
    if (!root.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

async function completeRun(root, id) {
  const runs = join(root, 'runs');
  await mkdir(runs, { recursive: true });
  const { directory } = await createRun({ spec: structuredClone(sample), url: 'http://127.0.0.1:4321/', outputRoot: runs, id });
  await mkdir(join(directory, 'before'), { recursive: true });
  await mkdir(join(directory, 'after'), { recursive: true });
  await writeFile(join(directory, 'before', 'desktop.png'), 'before-bytes');
  await writeFile(join(directory, 'after', 'desktop.png'), 'after-bytes');
  await saveCapture(directory, 'before', capture('before', 'HappyClaw'));
  await confirmFinding(directory, 'F1', 'supported', 'Baseline matches the cited source.');
  await savePlan(directory, 'F1');
  await saveExecution(directory, {
    at: '2026-09-19T00:05:00.000Z',
    branch: `pd/${id}`,
    worktree: join(directory, 'worktree'),
    log: 'agent-events.jsonl',
    head: 'abc1234'
  });
  await saveCapture(directory, 'after', capture('after', 'Team outcome'));
  await saveEvaluation(directory, evaluateCaptures(capture('before', 'HappyClaw'), capture('after', 'Team outcome')));
  await saveVisualReview(directory, {
    schemaVersion: '0.1', skillId: 'visual-qa-evaluator', reviewer: { type: 'human', name: 'Export test', version: '1' },
    reviewedAt: '2026-09-19T00:10:00.000Z', verdict: 'pass', screenshotRefs: ['before/desktop.png', 'after/desktop.png'], findings: [],
    rationale: 'Matched fixture screenshots pass.', limitations: ['Fixture only.']
  });
  await saveJudgment(directory, 'accept', 'The next step reads more clearly on both sizes.');
  return directory;
}

test('export publishes an allow-list and never the worktree or the agent log', async t => {
  const root = await temporaryRoot(t);
  const directory = await completeRun(root, 'exp00001');
  // Files that must not travel into a statically served folder.
  await mkdir(join(directory, 'worktree', 'src'), { recursive: true });
  await writeFile(join(directory, 'worktree', 'src', 'secret.txt'), 'repository content');
  await writeFile(join(directory, 'agent-events.jsonl'), '{"event":"local path /Users/someone"}\n');

  const out = join(root, 'public', 'runs');
  const result = await exportRun({ directory, outputRoot: out });

  assert.ok(result.files.includes('run.json'));
  assert.ok(result.files.includes('before/desktop.png'));
  assert.ok(result.files.includes('after/desktop.png'));
  assert.ok(result.files.includes('evaluation.json'));
  assert.ok(!result.files.some(name => name.includes('worktree')), 'worktree must not be exported');
  assert.ok(!result.files.some(name => name.includes('agent-events')), 'agent log must not be exported');

  await assert.rejects(readFile(join(out, 'exp00001', 'agent-events.jsonl'), 'utf8'), /ENOENT/);
  await assert.rejects(readFile(join(out, 'exp00001', 'worktree', 'src', 'secret.txt'), 'utf8'), /ENOENT/);

  const published = JSON.parse(await readFile(join(out, 'exp00001', 'run.json'), 'utf8'));
  assert.equal(published.execution.worktree, 'worktree', 'absolute worktree path must be reduced to a name');
  assert.equal(published.execution.log, undefined);
  assert.equal(published.execution.logRetained, true);
  assert.equal(published.judgment.decision, 'accept');
});

test('export redacts onboarding paths and environment values', async t => {
  const root = await temporaryRoot(t);
  await mkdir(join(root, 'runs'));
  const run = await createRun({ spec: structuredClone(sample), url: 'http://127.0.0.1:4321/', outputRoot: join(root, 'runs'), id: 'casepath' });
  await saveCapture(run.directory, 'before', capture('before'));
  const manifestPath = join(run.directory, 'run.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.onboarding = {
    status: 'ready',
    config: { configPath: 'C:/private/project.json', repo: 'C:/private/app', start: { command: 'npm', args: ['run', 'dev'], cwd: 'C:/private/app', env: { SECRET_TOKEN: 'hidden' } } },
    repository: { root: 'C:/private/app', commit: 'abc', dirty: false }
  };
  await writeFile(manifestPath, JSON.stringify(manifest));
  const exported = await exportRun({ directory: run.directory, outputRoot: join(root, 'public') });
  const published = JSON.parse(await readFile(join(exported.directory, 'run.json'), 'utf8'));
  assert.equal(published.onboarding.config.configPath, 'project.json');
  assert.equal(published.onboarding.config.repo, 'app');
  assert.equal(published.onboarding.repository.root, 'app');
  assert.deepEqual(published.onboarding.config.start.envKeys, ['SECRET_TOKEN']);
  assert.equal('env' in published.onboarding.config.start, false);
  assert.doesNotMatch(JSON.stringify(published), /C:\/private|hidden/);
});

test('export refuses a screenshot reference it does not publish', async t => {
  const root = await temporaryRoot(t);
  const directory = await completeRun(root, 'guard001');
  const manifestPath = join(directory, 'run.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.captures.before.viewports.desktop.screenshot = '../../../../etc/passwd';
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  const out = join(root, 'public', 'runs');
  await assert.rejects(exportRun({ directory, outputRoot: out }), /unexpected screenshot reference/i);
  const index = await readIndex(out);
  assert.equal(index.runs.length, 0, 'a rejected run must not reach the index');
});

test('export refuses a skill id that is not a single path segment', async t => {
  const root = await temporaryRoot(t);
  const directory = await completeRun(root, 'skill001');
  const outside = join(root, 'outside.json');
  await writeFile(outside, '{"leaked":true}', 'utf8');
  const manifestPath = join(directory, 'run.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  // Resolves to `<root>/outside.json` from the run's skills folder.
  manifest.skills = [{ id: '../../../outside', version: '1', status: 'ok', path: 'x', runAt: '2026-09-19T00:00:00.000Z' }];
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  const out = join(root, 'public', 'runs');
  await assert.rejects(exportRun({ directory, outputRoot: out }), /unusable skill id/i);
  await assert.rejects(readFile(join(out, 'outside.json'), 'utf8'), /ENOENT/);
  assert.equal((await readIndex(out)).runs.length, 0);
});

test('a corrupt index blocks the export before any run file is written', async t => {
  const root = await temporaryRoot(t);
  const directory = await completeRun(root, 'corr0001');
  const out = join(root, 'public', 'runs');
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'index.json'), '{ this is not json', 'utf8');

  await assert.rejects(exportRun({ directory, outputRoot: out }), /pnpm harness reindex/);
  await assert.rejects(readFile(join(out, 'corr0001', 'run.json'), 'utf8'), /ENOENT/);
});

test('export refuses a run without a baseline and keeps the index current', async t => {
  const root = await temporaryRoot(t);
  const out = join(root, 'public', 'runs');
  await mkdir(join(root, 'runs'), { recursive: true });
  const { directory: empty } = await createRun({ spec: structuredClone(sample), url: 'http://127.0.0.1:4321/', outputRoot: join(root, 'runs'), id: 'empty001' });
  await assert.rejects(exportRun({ directory: empty, outputRoot: out }), /capture the baseline/i);

  const first = await completeRun(root, 'idx00001');
  const second = await completeRun(root, 'idx00002');
  await exportRun({ directory: first, outputRoot: out });
  await exportRun({ directory: second, outputRoot: out });
  await exportRun({ directory: second, outputRoot: out }); // Re-export must not duplicate.

  const index = await readIndex(out);
  assert.equal(index.runs.length, 2);
  assert.deepEqual(index.runs.map(item => item.id).sort(), ['idx00001', 'idx00002']);
  const summary = index.runs.find(item => item.id === 'idx00001');
  assert.equal(summary.judgment, 'accept');
  assert.equal(summary.findingId, 'F1');
  assert.equal(summary.captured.after, true);

  await rm(join(out, 'idx00001'), { recursive: true, force: true });
  const rebuilt = await reindex(out);
  assert.deepEqual(rebuilt.map(item => item.id), ['idx00002']);
});
