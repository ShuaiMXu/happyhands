import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import sample from '../examples/happyclaw-site/experience.json' with { type: 'json' };
import { createRun, loadRun, runFilePath, saveCapture, saveSkillResult, withRunLock } from '../packages/harness-core/store.js';

async function fixture(t, id) {
  const root = await mkdtemp(join(tmpdir(), 'pd-integrity-test-'));
  t.after(async () => {
    if (!root.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(root, { recursive: true, force: true });
  });
  const runs = join(root, 'runs');
  await mkdir(runs);
  const run = await createRun({ spec: structuredClone(sample), url: 'http://127.0.0.1:4321/', outputRoot: runs, id });
  return { root, directory: run.directory };
}

function skillResult(id) {
  return {
    skill: { id, version: '0.1.0', role: 'review' },
    runAt: new Date().toISOString(),
    status: 'complete', evidence: [], findings: [], proposedUpdates: [], limitations: []
  };
}

test('runFilePath accepts ledger paths that name a file inside the run directory', () => {
  const directory = '/runs/abc123';
  assert.equal(runFilePath(directory, 'diagnosis.json'), join(directory, 'diagnosis.json'));
  assert.equal(runFilePath(directory, 'skills/foundation-extractor.json'), join(directory, 'skills', 'foundation-extractor.json'));
  assert.equal(runFilePath(directory, 'foundation-1.0.0.json'), join(directory, 'foundation-1.0.0.json'));
});

test('runFilePath refuses traversal, absolute and malformed ledger paths', () => {
  for (const bad of ['../run.json', '..\\..\\secret.json', 'skills/../../run.json', '/etc/passwd', 'C:/boot.ini', 'skills/', '', null, undefined, 'a b/c.json']) {
    assert.throws(() => runFilePath('/runs/abc123', bad), /must name a file inside the run directory/, JSON.stringify(bad));
  }
});

test('a stale lock from a dead process is reclaimed and the write proceeds', async t => {
  const { directory } = await fixture(t, 'integ001');
  await writeFile(join(directory, 'run.lock'), '999999999\n');
  await saveCapture(directory, 'before', { at: '2026-09-27T00:00:00.000Z', url: 'http://127.0.0.1:4321/', viewports: {} });
  const manifest = (await loadRun(directory)).manifest;
  assert.ok(manifest.captures.before, 'the write landed despite the stale lock');
});

test('a live lock from another process blocks the writer and fails loudly', async t => {
  const { directory } = await fixture(t, 'integ002');
  const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' });
  t.after(() => holder.kill());
  await new Promise(ready => holder.on('spawn', ready));
  await writeFile(join(directory, 'run.lock'), `${holder.pid}\n`);
  await assert.rejects(
    withRunLock(directory, async () => 'ran', { maxAttempts: 3, intervalMs: 10 }),
    /Another harness writer \(pid \d+\)/
  );
  // The holder's lock survives the refused writer.
  assert.equal((await readFile(join(directory, 'run.lock'), 'utf8')).trim(), String(holder.pid));
});

test('the lock serialises concurrent writers instead of dropping a stage record', async t => {
  const { directory } = await fixture(t, 'integ003');
  await Promise.all([
    saveSkillResult(directory, skillResult('alpha-reviewer')),
    saveSkillResult(directory, skillResult('beta-reviewer'))
  ]);
  const manifest = (await loadRun(directory)).manifest;
  // Without the lock, the second manifest rename would erase the first skill's entry.
  assert.deepEqual(manifest.skills.map(item => item.id).sort(), ['alpha-reviewer', 'beta-reviewer']);
});

test('a skill result with an unsafe id cannot write outside the run directory', async t => {
  const { directory } = await fixture(t, 'integ004');
  await assert.rejects(saveSkillResult(directory, skillResult('../escape')), /must name a file inside the run directory/);
});
