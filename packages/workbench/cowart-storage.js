import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { captureEntries, safeScreenshot } from '../../apps/designer/canvas/nodes.js';

const identifier = /^[a-zA-Z0-9_-]{1,100}$/;
export async function resolveCanvasTarget(root, runId, captureId) {
  if (!identifier.test(runId || '') || !/^(before|after):[a-zA-Z0-9_-]{1,180}$/.test(captureId || '')) throw new Error('Invalid canvas target');
  const base = join(root, 'public', 'runs', runId);
  const manifest = JSON.parse(await readFile(join(base, 'run.json'), 'utf8'));
  const [phase, key] = captureId.split(':');
  const entry = captureEntries(manifest.captures?.[phase]).find(item => `${item.stateId}--${item.configurationId}` === key);
  const screenshot = entry && safeScreenshot(phase, entry);
  if (!screenshot || entry.reached === false) throw new Error('Capture is unavailable');
  const bytes = await readFile(join(base, screenshot));
  const fingerprint = createHash('sha256').update(bytes).digest('hex');
  const directory = join(root, '.harness', 'cowart', runId, `${phase}-${key}-${fingerprint.slice(0, 12)}`);
  return { directory, source: { runId, captureId, screenshot, fingerprint, width: entry.width, height: entry.height } };
}
async function readState(directory) {
  try { return JSON.parse(await readFile(join(directory, 'canvas.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { revision: 0, snapshot: null, notes: '' }; throw error; }
}
function validateDraft(input) {
  if (!input || !Number.isInteger(input.revision) || input.revision < 0 || typeof input.notes !== 'string' || input.notes.length > 20000) throw new Error('Invalid draft');
  if (input.requestNotes !== undefined && (typeof input.requestNotes !== 'string' || input.requestNotes.length > 20000)) throw new Error('Invalid request notes');
  if (!input.snapshot || typeof input.snapshot !== 'object' || !input.snapshot.document?.store || !input.snapshot.document.schema) throw new Error('Invalid canvas snapshot');
}
async function atomicJson(directory, name, value) {
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `${name}.${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(value, null, 2));
  await rename(temporary, join(directory, name));
}
export function createCowartStorage(root) {
  const writes = new Map();
  return {
    async read(runId, captureId) {
      const target = await resolveCanvasTarget(root, runId, captureId);
      return { ...await readState(target.directory), source: target.source };
    },
    async write(runId, captureId, input, task = false) {
      validateDraft(input);
      const target = await resolveCanvasTarget(root, runId, captureId);
      if (input.fingerprint !== target.source.fingerprint) throw Object.assign(new Error('Capture changed; reopen its canvas'), { status: 409 });
      const previous = writes.get(target.directory) || Promise.resolve();
      const operation = previous.catch(() => {}).then(async () => {
        const current = await readState(target.directory);
        if (current.revision !== input.revision) throw Object.assign(new Error('Canvas changed in another tab; reload before saving'), { status: 409 });
        const state = { revision: current.revision + 1, source: target.source, snapshot: input.snapshot, notes: input.notes, updatedAt: new Date().toISOString() };
        if (task) {
          const requestNotes = input.requestNotes ?? input.notes;
          if (!requestNotes.trim()) throw new Error('A written change request is required');
          // A saved brief is a draft, never a claim that an agent ran or that code changed.
          const id = randomUUID();
          const request = { ...state, notes: requestNotes, id, status: 'draft', kind: 'ui-change-request' };
          await atomicJson(target.directory, `request-${id}.json`, request);
          state.request = { id, status: 'draft', path: relative(root, join(target.directory, `request-${id}.json`)).replaceAll('\\', '/') };
        }
        await atomicJson(target.directory, 'canvas.json', state);
        return { revision: state.revision, source: target.source, request: state.request || null };
      });
      writes.set(target.directory, operation);
      try { return await operation; } finally { if (writes.get(target.directory) === operation) writes.delete(target.directory); }
    }
  };
}

export function cowartWorkbenchPlugin(root) {
  const storage = createCowartStorage(root);
  const middleware = async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/workbench/cowart') return next();
    const reply = (code, value) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(value)); };
    try {
      const host = req.headers.host || '';
      if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return reply(403, { error: 'Local requests only' });
      if (req.headers.origin && req.headers.origin !== `http://${host}`) return reply(403, { error: 'Origin mismatch' });
      const run = url.searchParams.get('run'), capture = url.searchParams.get('capture');
      if (req.method === 'GET') return reply(200, await storage.read(run, capture));
      if (req.method !== 'PUT' && req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
      if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, { error: 'JSON required' });
      let size = 0, chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 8 * 1024 * 1024) return reply(413, { error: 'Canvas too large' }); chunks.push(chunk); }
      const result = await storage.write(run, capture, JSON.parse(Buffer.concat(chunks).toString('utf8')), req.method === 'POST');
      reply(200, result);
    } catch (error) { reply(error.status || 400, { error: error.message }); }
  };
  return { name: 'workbench-cowart', configureServer(server) { server.middlewares.use(middleware); }, configurePreviewServer(server) { server.middlewares.use(middleware); } };
}
