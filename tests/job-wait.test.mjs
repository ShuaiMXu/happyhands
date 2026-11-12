import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForJob} from './helpers/wait-for-job.mjs';

test('job waiting preserves every terminal outcome instead of treating failure as success', async () => {
  for (const status of ['succeeded', 'failed', 'cancelled', 'interrupted']) {
    const job = {status, error: status === 'failed' ? 'actual failure' : undefined};
    const service = {jobs: {get: async () => job}};
    assert.equal(await waitForJob(service, 'fixture'), job);
  }
});

test('job waiting uses one elapsed deadline across queue and stage changes', async () => {
  let elapsed = 0, reads = 0;
  const service = {jobs: {get: async () => { reads++; elapsed += 20; return {status: reads === 1 ? 'queued' : 'running', stage: `stage-${reads}`}; }}};
  await assert.rejects(waitForJob(service, 'fixture', {timeoutMs: 100, intervalMs: 30, now: () => elapsed, sleep: async ms => { elapsed += ms; }}), /within 100ms; last state:.*stage-3/);
  assert.equal(reads, 3, 'a different stage cannot reset the deadline');
  assert.equal(elapsed, 120, 'polling reads count toward the same bounded deadline');
});

test('job waiting propagates persistence errors and rejects unknown states immediately', async () => {
  await assert.rejects(waitForJob({jobs: {get: async () => { throw Error('Unreadable job'); }}}, 'fixture'), /Unreadable job/);
  await assert.rejects(waitForJob({jobs: {get: async () => ({status: 'invented'})}}, 'fixture'), /Unexpected job state/);
});
