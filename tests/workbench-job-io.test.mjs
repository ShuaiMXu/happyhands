import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJobs } from '../packages/workbench/jobs.js';

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
