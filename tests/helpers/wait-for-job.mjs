import {setTimeout as delay} from 'node:timers/promises';

// Disk-backed jobs can be slower on Windows runners. Bound the total elapsed
// time, not the count of polling reads, and retain the last state on timeout.
export async function waitForJob(service, id, {timeoutMs = process.platform === 'win32' ? 120000 : 30000, intervalMs = 25, now = () => performance.now(), sleep = delay} = {}) {
  const deadline = now() + timeoutMs;
  let job;
  for (;;) {
    job = await service.jobs.get(id);
    if (['succeeded', 'failed', 'cancelled', 'interrupted'].includes(job.status)) return job;
    if (!['queued', 'running', 'cancelling'].includes(job.status)) throw Error(`Unexpected job state: ${JSON.stringify(job)}`);
    const remaining = deadline - now();
    if (remaining <= 0) throw Error(`Job ${id} did not finish within ${timeoutMs}ms; last state: ${JSON.stringify(job)}`);
    await sleep(Math.min(intervalMs, remaining));
  }
}
