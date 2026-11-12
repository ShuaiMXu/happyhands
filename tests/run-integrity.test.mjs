import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import sample from '../examples/happyclaw-site/experience.json' with { type: 'json' };
import { captureOnce, createRun, loadRun, runFilePath, saveCapture, saveSkillResult, withRunLock } from '../packages/harness-core/store.js';

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

for (const legacy of [false, true]) {
  test(`concurrent reclaimers of a dead ${legacy ? 'legacy' : 'current'} writer keep owners exclusive`, async t => {
    const { directory } = await fixture(t, 'integ005');
    const lock = join(directory, 'run.lock');
    if (legacy) await writeFile(lock, '999999999\n');
    else {
      await mkdir(lock);
      await writeFile(join(lock, '999999999-11111111-1111-1111-1111-111111111111'), '');
    }
    let active = 0;
    let peak = 0;
    const requests = Array.from({ length: 32 }, () => withRunLock(directory, async () => {
      peak = Math.max(peak, ++active);
      await delay(2);
      active--;
    }, { maxAttempts: 500, intervalMs: 1 }));
    await Promise.all(requests);
    assert.equal(peak, 1);
  });
}

test('an empty legacy lock is left in place while its owner may be writing', async t => {
  const { directory } = await fixture(t, 'integ006');
  const lock = join(directory, 'run.lock');
  await writeFile(lock, '');
  await assert.rejects(withRunLock(directory, () => assert.fail('entered a live lock'), { maxAttempts: 3, intervalMs: 1 }), /Another harness writer/);
  assert.equal(await readFile(lock, 'utf8'), '');
});

test('an empty current lock cannot be reclaimed before its owner publishes its marker', async t => {
  const { directory } = await fixture(t, 'empty-current');
  const lock = join(directory, 'run.lock');
  await mkdir(lock);
  await assert.rejects(withRunLock(directory, () => assert.fail('entered an unpublished lock'), {maxAttempts: 3, intervalMs: 1}), /Another harness writer/);
  // Publish after the refused contender, then make sure the active owner is
  // still protected. Neither attempt may remove or replace its directory.
  const marker = `${process.pid}-11111111-1111-1111-1111-111111111111`;
  await writeFile(join(lock, marker), '');
  await assert.rejects(withRunLock(directory, () => assert.fail('entered a live current lock'), {maxAttempts: 3, intervalMs: 1}), /Another harness writer/);
  assert.equal(await readFile(join(lock, marker), 'utf8'), '');
});

test('a live reclaimer marker is protected and a dead reclaimer can be recovered', async t => {
  const { directory } = await fixture(t, 'reclaim-owner');
  const lock = join(directory, 'run.lock');
  await mkdir(lock);
  const marker = `reaping-${process.pid}-11111111-1111-1111-1111-111111111111`;
  await writeFile(join(lock, marker), '');
  await assert.rejects(withRunLock(directory, () => assert.fail('entered a live reclaimer'), {maxAttempts: 3, intervalMs: 1}), /Another harness writer/);
  assert.equal(await readFile(join(lock, marker), 'utf8'), '');
  await rm(lock, {recursive: true});
  await mkdir(lock);
  await writeFile(join(lock, 'reaping-999999999-11111111-1111-1111-1111-111111111111'), '');
  assert.equal(await withRunLock(directory, () => 'recovered'), 'recovered');
});

test('an unrecognized current lock fails closed and retains its contents', async t => {
  const { directory } = await fixture(t, 'unknown-owner');
  const lock = join(directory, 'run.lock');
  await mkdir(lock);
  await writeFile(join(lock, 'unknown-owner'), 'preserve');
  await assert.rejects(withRunLock(directory, () => assert.fail('entered an unknown owner')), /Unrecognized run lock contents/);
  assert.equal(await readFile(join(lock, 'unknown-owner'), 'utf8'), 'preserve');
});

test('separate processes reclaim a stale owner and release to new owners without overlapping', async t => {
  const { root, directory } = await fixture(t, 'process-contention');
  const lock = join(directory, 'run.lock');
  await mkdir(lock);
  await writeFile(join(lock, '999999999-11111111-1111-1111-1111-111111111111'), '');
  const events = join(root, 'owners.ndjson');
  const worker = join(root, 'contender.mjs');
  await writeFile(worker, `
import {withRunLock} from ${JSON.stringify(new URL('../packages/harness-core/store.js', import.meta.url).href)};
import {appendFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
for(let index=0;index<3;index++)await withRunLock(process.argv[2],async()=>{
 await appendFile(process.argv[3],JSON.stringify({pid:process.pid,event:'enter'})+'\\n');
 await delay(3);
 await appendFile(process.argv[3],JSON.stringify({pid:process.pid,event:'exit'})+'\\n');
},{maxAttempts:2000,intervalMs:2});
`);
  const processes = await Promise.allSettled(Array.from({length: 6}, async () => {
    const started = performance.now();
    try {
      const result = await promisify(execFile)(process.execPath, [worker, directory, events], {timeout: 30000, windowsHide: true});
      return {...result, elapsed: performance.now() - started};
    } catch (error) { error.elapsed = performance.now() - started; throw error; }
  }));
  try {
    for (const result of processes) assert.equal(result.status, 'fulfilled', result.reason?.stack);
    const records = (await readFile(events, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(records.length, 36);
    assert.equal(new Set(records.map(record => record.pid)).size, 6);
    let owner = null;
    for (const record of records) {
      if (record.event === 'enter') { assert.equal(owner, null, 'no other process owns the critical section'); owner = record.pid; }
      else { assert.equal(owner, record.pid, 'only the current owner releases'); owner = null; }
    }
    assert.equal(owner, null);
  } catch (error) {
    // All children have reached a terminal state. Read the failure scene only
    // now; successful runs add no polling or filesystem work to the contention.
    const inspectFile = async path => {
      try { return {contents: await readFile(path, 'utf8')}; }
      catch (failure) { return {code: failure.code, error: failure.message}; }
    };
    let currentLock;
    try {
      const entries = await readdir(lock);
      const owners = {};
      for (const entry of entries) owners[entry] = await inspectFile(join(lock, entry));
      currentLock = {entries, owners};
    } catch (failure) { currentLock = {code: failure.code, error: failure.message}; }
    const children = processes.map(result => {
      const value = result.status === 'fulfilled' ? result.value : result.reason;
      return {status: result.status, code: result.status === 'fulfilled' ? 0 : value.code ?? null, signal: value.signal ?? null, killed: value.killed ?? false, stdout: value.stdout ?? '', stderr: value.stderr ?? '', elapsed: value.elapsed};
    });
    error.message += '\nSix-process failure diagnostics: ' + JSON.stringify({children, events: await inspectFile(events), lock: currentLock});
    throw error;
  }
});

test('a skill result with an unsafe id cannot write outside the run directory', async t => {
  const { directory } = await fixture(t, 'integ004');
  await assert.rejects(saveSkillResult(directory, skillResult('../escape')), /must name a file inside the run directory/);
});

test('concurrent captures cannot replace the original before its manifest is committed', async t => {
  const {directory} = await fixture(t, 'capture-lock');
  const before = join(directory, 'before');
  await mkdir(before);
  const original = join(before, 'desktop.png');
  let started, release;
  const recording = new Promise(resolve => { started = resolve; });
  const proceed = new Promise(resolve => { release = resolve; });
  const first = captureOnce(directory, 'before', async () => {
    await writeFile(original, 'first original');
    started();
    await proceed;
    await saveCapture(directory, 'before', {viewports:{desktop:{screenshot:'before/desktop.png'}}});
  });
  await recording;
  try {
    await assert.rejects(captureOnce(directory, 'before', () => writeFile(original, 'second original')), /writing to this run/);
  } finally {
    release();
    await first;
  }
  await assert.rejects(captureOnce(directory, 'before', () => writeFile(original, 'third original')), /already captured/);
  assert.equal(await readFile(original, 'utf8'), 'first original');
});
