import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJobs } from '../packages/workbench/jobs.js';

test('concurrent submissions reserve queue capacity before persisting jobs', { timeout: 5000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'job-capacity-'));
  const jobs = createJobs(root);
  t.after(async () => { jobs.close(); await rm(root, { recursive: true, force: true }); });
  const { promise, resolve } = Promise.withResolvers();
  const submitted = await Promise.allSettled(Array.from({ length: 8 }, () => jobs.start({}, () => promise)));
  try {
    const admitted = submitted.filter(result => result.status === 'fulfilled');
    const refused = submitted.filter(result => result.status === 'rejected');
    assert.equal(admitted.length, 3);
    assert.equal(refused.length, 5);
    assert.ok(refused.every(result => /queue is full/.test(result.reason.message)));
  } finally {
    resolve();
    for (const result of submitted.filter(item => item.status === 'fulfilled')) {
      while (['queued', 'running'].includes((await jobs.get(result.value.id)).status)) {
        await new Promise(done => setTimeout(done, 10));
      }
    }
  }
});

test('rapid polling cannot overlap progress replacement or lose the terminal job result', async t => {
  const root = await mkdtemp(join(tmpdir(), 'job-polling-'));
  const jobs = createJobs(root);
  t.after(async () => { jobs.close(); await rm(root, { recursive: true, force: true }); });
  const job = await jobs.start({ kind: 'polling-fixture' }, async ({ update }) => {
    for (let index = 0; index < 25; index++) await update({ stage: `step-${index}` });
    return { runId: 'verified-fixture' };
  });
  let final;
  for (let index = 0; index < 200; index++) {
    const [current, listed] = await Promise.all([jobs.get(job.id), jobs.list()]);
    assert.equal(listed.some(item => item.id === job.id), true);
    if (!['queued', 'running'].includes(current.status)) { final = current; break; }
  }
  assert.equal(final?.status, 'succeeded', final?.error);
  assert.equal(final.result.runId, 'verified-fixture');
  assert.equal((await jobs.get(job.id)).stage, 'complete');
});
