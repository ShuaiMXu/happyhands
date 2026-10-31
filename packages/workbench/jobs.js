import { spawn, execFile } from 'node:child_process';
import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function writeJson(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2));
  for (let attempt=0;;attempt++) {
    try { await rename(temporary,file); break; } catch(error) {
      if (!['EPERM','EACCES','EBUSY'].includes(error.code) || attempt>=10) throw error;
      await new Promise(resolve=>setTimeout(resolve,20*(attempt+1)));
    }
  }
}
export function runLocal(command, args, { cwd, input = '', signal, timeoutMs = 600000, onOutput = () => {}, stdoutOnly = false } = {}) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    let tail = '', stdout = '', timedOut = false;
    const kill = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') {
        // Restricted Windows environments may refuse to launch taskkill. Stop
        // the process we own immediately, then use taskkill to clean descendants.
        try { child.kill('SIGKILL'); } catch {}
        execFile('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true }, () => {});
      }
      else { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
    };
    const timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs);
    signal?.addEventListener('abort', kill, { once: true });
    const clean = () => { clearTimeout(timer); signal?.removeEventListener('abort', kill); };
    const output = data => { tail = (tail + data).slice(-16000); onOutput(String(data)); };
    child.stdout.on('data', data => { stdout=(stdout+data).slice(-16000);output(data); }); child.stderr.on('data', output);
    child.stdin.on('error', () => {});
    child.on('error', error => { clean(); reject(error); });
    child.on('close', code => { clean(); if (signal?.aborted) reject(new Error('Cancelled')); else if (timedOut) reject(new Error('Execution timed out')); else if (code !== 0) reject(new Error(`Process exited ${code}: ${tail.slice(-2000)}`)); else resolve(stdoutOnly ? stdout : tail); });
    child.stdin.end(input);
  });
}

export function createJobs(root) {
  const directory = join(root, '.harness', 'workbench-jobs');
  const active = new Map();
  // On Windows, a polling read can keep the destination open during replacement.
  // Serialize this service's reads and writes without weakening atomic persistence.
  let io = Promise.resolve();
  const withIo = operation => {
    const result = io.then(operation);
    io = result.catch(() => {});
    return result;
  };
  let serial = Promise.resolve(), persistenceError = null;
  const ready = mkdir(directory, { recursive: true }).then(async () => {
    for (const name of await readdir(directory)) {
      if (!/^[a-f0-9-]{36}$/.test(name)) continue;
      const file = join(directory, name, 'job.json');
      const job = JSON.parse(await readFile(file, 'utf8').catch(() => 'null'));
      if (job && ['queued', 'running', 'cancelling'].includes(job.status)) await writeJson(file, { ...job, status: 'interrupted', error: 'Local service restarted. Review saved results before retrying.', updatedAt: new Date().toISOString() });
    }
  });
  async function list() {
    await ready;
    if(persistenceError)throw persistenceError;
    const jobs = await withIo(async () => Promise.all((await readdir(directory)).filter(name => /^[a-f0-9-]{36}$/.test(name)).map(name => readFile(join(directory, name, 'job.json'), 'utf8').then(JSON.parse).catch(() => null))));
    return jobs.filter(Boolean).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }
  async function get(id) {
    await ready;
    if (!/^[a-f0-9-]{36}$/.test(id || '')) throw new Error('Invalid job ID');
    return withIo(async () => JSON.parse(await readFile(join(directory, id, 'job.json'), 'utf8')));
  }
  async function start(context, operation) {
    await ready;
    if (active.size >= 3) throw new Error('Task queue is full; wait or cancel a task.');
    const id = randomUUID(), cwd = join(directory, id), controller = new AbortController();
    await mkdir(cwd);
    const job = { id, ...context, status: 'queued', stage: 'queued', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const persist = () => {
      const snapshot = structuredClone(job);
      return withIo(() => writeJson(join(cwd, 'job.json'), snapshot));
    };
    await persist(); active.set(id, controller);
    const update = async values => { Object.assign(job, values, { updatedAt: new Date().toISOString() }); await persist(); };
    const work = async () => {
      try {
        controller.signal.throwIfAborted();
        await update({ status: 'running' });
        const result = await operation({ id, cwd, signal: controller.signal, update });
        controller.signal.throwIfAborted();
        await update({ status: 'succeeded', result, stage: 'complete' });
      } catch (error) { await update({ status: controller.signal.aborted ? 'cancelled' : 'failed', error: error.message }); }
      finally { active.delete(id); }
    };
    serial = serial.catch(() => {}).then(work);
    serial.catch(error => { persistenceError = error; });
    return { ...job };
  }
  async function cancel(id) { await get(id); const controller = active.get(id); if (controller) controller.abort(); return { cancelled: Boolean(controller) }; }
  return { list, get, start, cancel, directory, close: () => { for (const controller of active.values()) controller.abort(); } };
}
