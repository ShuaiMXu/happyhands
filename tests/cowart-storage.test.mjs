import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createCowartStorage, resolveCanvasTarget, cowartWorkbenchPlugin } from '../packages/workbench/cowart-storage.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'cowart-workbench-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const base = join(root, 'public/runs/test-run');
  await mkdir(join(base, 'before'), { recursive: true });
  await writeFile(join(base, 'before/desktop.png'), 'original-screen');
  await writeFile(join(base, 'run.json'), JSON.stringify({ id: 'test-run', captures: { before: { viewports: { desktop: { width: 100, height: 100, screenshot: 'before/desktop.png' } } } } }));
  const store = createCowartStorage(root);
  const initial = await store.read('test-run', 'before:page--desktop');
  const input = { revision: 0, fingerprint: initial.source.fingerprint, notes: 'Move CTA higher', snapshot: { document: { store: {}, schema: {} } } };
  return { root, base, store, input };
}
test('annotations persist independently of immutable captured evidence', async t => {
  const { base, store, input } = await fixture(t);
  const saved = await store.write('test-run', 'before:page--desktop', input);
  assert.equal(saved.revision, 1);
  const loaded = await store.read('test-run', 'before:page--desktop');
  assert.equal(loaded.notes, input.notes);
  assert.deepEqual(loaded.snapshot, input.snapshot);
  assert.equal(await readFile(join(base, 'before/desktop.png'), 'utf8'), 'original-screen');
});
test('parallel or stale writers cannot silently overwrite another tab', async t => {
  const { store, input } = await fixture(t);
  const results = await Promise.allSettled([store.write('test-run', 'before:page--desktop', input), store.write('test-run', 'before:page--desktop', { ...input, notes: 'other tab' })]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
});
test('replaced captures start a separate draft and reject writes from the old screen', async t => {
  const { store, input, base } = await fixture(t);
  await store.write('test-run', 'before:page--desktop', input);
  await writeFile(join(base, 'before/desktop.png'), 'new-screen');
  const fresh = await store.read('test-run', 'before:page--desktop');
  assert.equal(fresh.revision, 0); assert.equal(fresh.snapshot, null);
  await assert.rejects(store.write('test-run', 'before:page--desktop', { ...input, revision: 1 }), { status: 409 });
});
test('path traversal and captures not in the manifest are rejected', async t => {
  const { root, store } = await fixture(t);
  await assert.rejects(resolveCanvasTarget(root, '../test-run', 'before:page--desktop'));
  await assert.rejects(store.read('test-run', 'before:../../secret'));
  await assert.rejects(store.read('test-run', 'after:page--desktop'));
  await assert.rejects(store.read('test-run', 'before:page--missing'));
});
test('change requests require instructions and retain source provenance without executing', async t => {
  const { store, input, root } = await fixture(t);
  await assert.rejects(store.write('test-run', 'before:page--desktop', { ...input, notes: ' ' }, true));
  const result = await store.write('test-run', 'before:page--desktop', { ...input, notes: '', requestNotes: 'Region 1: Increase contrast' }, true);
  assert.equal(result.request.status, 'draft');
  const { directory } = await resolveCanvasTarget(root, 'test-run', 'before:page--desktop');
  const request = JSON.parse(await readFile(join(directory, `request-${result.request.id}.json`), 'utf8'));
  assert.equal(request.source.fingerprint, input.fingerprint);
  assert.equal(request.notes, 'Region 1: Increase contrast');
  assert.equal(request.kind, 'ui-change-request');
  assert.equal((await store.read('test-run', 'before:page--desktop')).notes, '');
  assert.equal((await readdir(directory)).length, 2);
});

test('local write endpoint rejects cross-origin and non-JSON writes', async t => {
  const { root, input } = await fixture(t);
  let middleware;
  cowartWorkbenchPlugin(root).configureServer({ middlewares: { use(fn) { middleware = fn; } } });
  const server = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const url = `${base}/api/workbench/cowart?run=test-run&capture=before:page--desktop`;
  assert.equal((await fetch(url, { method: 'PUT', headers: { Origin: 'https://external.example', 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).status, 403);
  assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(input) })).status, 415);
  assert.equal((await fetch(url, { method: 'PUT', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).status, 200);
});
