import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import sample from '../examples/bootstrap-surface/experience.json' with { type: 'json' };
import approvalSample from '../examples/bootstrap-surface/foundation-approval.json' with { type: 'json' };
import { loadProjectConfig } from '../packages/harness-core/onboard.js';
import { resolveMode } from '../packages/harness-core/entry.js';
import { createRun, loadRun, recordAbsentBaseline, saveCapture, savePlan, saveExecution, saveEvaluation, saveJudgment, saveVisualReview, saveFoundationApproval } from '../packages/harness-core/store.js';
import { evaluateFirstRender } from '../packages/harness-core/evaluate.js';
import { assertVisualReview } from '../packages/harness-core/visual-review.js';
import { workflowState } from '../packages/harness-core/workflow.js';

async function temporaryRoot(t, prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  t.after(async () => {
    if (!root.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

async function serve(t, handler) {
  const server = createServer(handler);
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}`;
}

function firstRender(width = 1280) {
  return {
    at: '2026-09-21T00:00:00.000Z',
    url: 'http://127.0.0.1:4321/jobs',
    viewports: {
      desktop: {
        width, height: 800, status: 200, screenshot: 'after/desktop.png',
        dom: { h1: ['Jobs'], actions: [{ label: 'Start a job', href: '/jobs/new' }], horizontalOverflow: false }
      }
    }
  };
}

const execution = { at: '2026-09-21T00:01:00.000Z', repo: '/tmp/app', baseCommit: 'a'.repeat(40), branch: 'pd/case0001', worktree: '/tmp/worktree', head: 'b'.repeat(40), dirty: false, exitCode: 0, log: 'agent-events.jsonl', lastMessage: 'agent-last-message.md' };

function visualQa(verdict = 'pass') {
  return {
    schemaVersion: '0.1',
    skillId: 'visual-qa-evaluator',
    reviewer: { type: 'human', name: 'Reviewer', version: '1' },
    reviewedAt: '2026-09-21T00:02:00.000Z',
    verdict,
    screenshotRefs: ['after/desktop.png'],
    findings: [],
    rationale: 'Looked at the rendered surface against the critical user task.',
    limitations: ['A first render has no baseline to compare against.']
  };
}

test('mode follows the entry routes, not the project', async t => {
  const base = await serve(t, (request, response) => {
    if (request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<body><h1>Home</h1></body>');
      return;
    }
    response.writeHead(404, { 'content-type': 'text/html' });
    response.end('<body></body>');
  });
  const review = await resolveMode({ url: `${base}/`, routes: ['/'] });
  assert.equal(review.mode, 'review');
  const bootstrap = await resolveMode({ url: `${base}/`, routes: ['/jobs'] });
  assert.equal(bootstrap.mode, 'bootstrap');
  assert.match(bootstrap.reason, /missing/);
  const mixed = await resolveMode({ url: `${base}/`, routes: ['/', '/jobs'] });
  assert.equal(mixed.mode, 'review');
  assert.match(mixed.reason, /bootstrap run for/);
  assert.equal((await resolveMode({ url: null })).mode, 'bootstrap');
  assert.equal((await resolveMode({ mode: 'bootstrap', url: `${base}/`, routes: ['/'] })).mode, 'bootstrap');
});

test('a route that redirects elsewhere is not counted as rendered', async t => {
  // A host that answers every unknown path with the homepage is the exact case this probe
  // exists to catch: the route does not exist, but following the redirect shows a real page.
  const base = await serve(t, (request, response) => {
    if (request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<body><h1>Home</h1></body>');
      return;
    }
    response.writeHead(302, { location: '/' });
    response.end();
  });
  await assert.rejects(resolveMode({ url: `${base}/`, routes: ['/jobs'] }), /did not serve itself/);
  await assert.rejects(resolveMode({ url: `${base}/`, routes: ['/jobs'] }), /Set "mode"/);
  const entry = (await resolveMode({ mode: 'bootstrap', url: `${base}/`, routes: ['/jobs'] })).entries[0];
  assert.equal(entry.state, 'redirected');
  assert.equal(entry.finalUrl, `${base}/`);
});

test('a redirect that keeps the path is normalisation, and the preview URL may move freely', async t => {
  const base = await serve(t, (request, response) => {
    if (request.url === '/jobs') {
      response.writeHead(301, { location: '/jobs/' });
      return void response.end();
    }
    if (request.url === '/jobs/' || request.url === '/home') {
      response.writeHead(200, { 'content-type': 'text/html' });
      return void response.end('<body><h1>Jobs</h1></body>');
    }
    response.writeHead(302, { location: '/home' });
    response.end();
  });
  // /jobs → /jobs/ is the same route.
  assert.equal((await resolveMode({ url: `${base}/`, routes: ['/jobs'] })).mode, 'review');
  // The bare preview URL is exempt: following the app to where it lives is ordinary.
  assert.equal((await resolveMode({ url: `${base}/` })).mode, 'review');
});

test('a client-rendered shell is reported as ambiguous instead of guessed', async t => {
  const base = await serve(t, (request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<body><div id="root"></div><script src="/app.js"></script></body>');
  });
  await assert.rejects(resolveMode({ url: `${base}/`, routes: ['/'] }), /Set "mode"/);
  assert.equal((await resolveMode({ mode: 'review', url: `${base}/`, routes: ['/'] })).mode, 'review');
});

test('project config makes url optional and keeps review honest', async t => {
  const root = await temporaryRoot(t, 'pd-bootstrap-config-');
  const path = join(root, 'project.json');
  await writeFile(path, JSON.stringify({ version: '0.1', spec: 'experience.json', repo: '.', mode: 'bootstrap' }));
  const config = await loadProjectConfig(path);
  assert.equal(config.url, null);
  assert.equal(config.mode, 'bootstrap');
  await writeFile(path, JSON.stringify({ version: '0.1', spec: 'a', repo: 'b', mode: 'review' }));
  await assert.rejects(loadProjectConfig(path), /Review mode requires url/);
  await writeFile(path, JSON.stringify({ version: '0.1', spec: 'a', repo: 'b', routes: ['/jobs'] }));
  await assert.rejects(loadProjectConfig(path), /routes requires url/);
  await writeFile(path, JSON.stringify({ version: '0.1', spec: 'a', repo: 'b', start: { command: 'npm', args: [] } }));
  await assert.rejects(loadProjectConfig(path), /start requires url/);
});

test('a bootstrap run is gated by an approved foundation instead of a confirmed finding', async t => {
  const root = await temporaryRoot(t, 'pd-bootstrap-run-');
  const { directory } = await createRun({ spec: structuredClone(sample), url: null, outputRoot: root, mode: 'bootstrap', id: 'case0001' });
  await assert.rejects(saveCapture(directory, 'before', firstRender()), /no baseline/i);
  await assert.rejects(savePlan(directory, null), /absent/i);
  await recordAbsentBaseline(directory, 'No entry route renders: /jobs (missing).', [{ url: 'http://127.0.0.1:4321/jobs', status: 404, state: 'missing' }]);
  await assert.rejects(savePlan(directory, 'F1'), /no findings to plan against/i);
  await assert.rejects(saveCapture(directory, 'after', firstRender()), /Plan the first render/);
  await assert.rejects(savePlan(directory, null), /Foundation Approval/i);
  await saveFoundationApproval(directory, structuredClone(approvalSample));
  await savePlan(directory, null);
  const brief = await readFile(join(directory, 'codex-brief.md'), 'utf8');
  assert.match(brief, /Foundation version: 1\.0\.0/);
  assert.match(brief, /Approved by: Example product designer/);
  assert.match(brief, /error-surface=#FDE7E7/);
  assert.match(brief, /JobCard/);
  assert.match(brief, /Do not describe the result as an improvement/);
  assert.equal((await loadRun(directory)).manifest.plan.kind, 'bootstrap');
  await saveExecution(directory, execution);
  await saveCapture(directory, 'after', firstRender());
  const run = await loadRun(directory);
  const evaluation = evaluateFirstRender(run.manifest.captures.after);
  assert.equal(evaluation.kind, 'first-render');
  assert.equal(evaluation.views.desktop.checks.pageResponded, true);
  assert.match(evaluation.conclusion, /cannot claim an improvement/);
  await saveEvaluation(directory, evaluation);
  // A first render has less structural evidence than a comparison, not more, so the independent
  // visual review still gates the decision.
  await assert.rejects(saveJudgment(directory, 'accept', 'Looks right.'), /Visual QA/i);
  await mkdir(join(directory,'after'),{recursive:true});await writeFile(join(directory,'after','desktop.png'),Buffer.from('Synthetic first-render image bytes'));
  await saveVisualReview(directory, assertVisualReview(visualQa(), (await loadRun(directory)).manifest));
  await saveJudgment(directory, 'accept', 'The operator can start a job and recover from a failed step.');
  assert.equal((await loadRun(directory)).spec.review.judgment, 'accept');
  assert.equal(workflowState((await loadRun(directory)).manifest).stage, 'complete');
});

test('the workflow points a bootstrap run at its own next step, never at a baseline capture', async t => {
  const root = await temporaryRoot(t, 'pd-bootstrap-workflow-');
  const { directory } = await createRun({ spec: structuredClone(sample), url: null, outputRoot: root, mode: 'bootstrap', id: 'case0005' });
  const stageNow = async () => workflowState((await loadRun(directory)).manifest);
  const start = await stageNow();
  assert.equal(start.mode, 'bootstrap');
  assert.equal(start.stage, 'needs-absent-baseline');
  assert.equal(start.next, 'baseline --reason TEXT');
  await recordAbsentBaseline(directory, 'No preview URL is configured.');
  assert.equal((await stageNow()).stage, 'needs-foundation-approval');
  await saveFoundationApproval(directory, structuredClone(approvalSample));
  assert.equal((await stageNow()).stage, 'needs-first-render-plan');
  await savePlan(directory, null);
  assert.equal((await stageNow()).stage, 'needs-execution');
  await saveExecution(directory, execution);
  assert.equal((await stageNow()).stage, 'needs-after-capture');
  await saveCapture(directory, 'after', firstRender());
  assert.equal((await stageNow()).stage, 'needs-structural-evaluation');
  await saveEvaluation(directory, evaluateFirstRender((await loadRun(directory)).manifest.captures.after));
  assert.equal((await stageNow()).stage, 'needs-visual-qa');
});

test('an unapproved foundation cannot constrain a first render', async t => {
  const root = await temporaryRoot(t, 'pd-bootstrap-foundation-');
  const spec = structuredClone(sample);
  spec.designFoundation.status = 'observed';
  const { directory } = await createRun({ spec, url: null, outputRoot: root, mode: 'bootstrap', id: 'case0002' });
  await recordAbsentBaseline(directory, 'No preview URL is configured.');
  const approval = structuredClone(approvalSample);
  approval.foundation.tokens[0].status = 'observed';
  await assert.rejects(saveFoundationApproval(directory, approval), /observed entries cannot constrain generation/i);
  await assert.rejects(savePlan(directory, null), /Foundation Approval/i);
});

test('foundation approval is versioned, updates the run snapshot and freezes when planning begins', async t => {
  const root = await temporaryRoot(t, 'pd-foundation-approval-');
  const spec = structuredClone(sample);
  spec.designFoundation.status = 'observed';
  spec.designFoundation.tokens.forEach(item => { item.status = 'observed'; });
  const { directory } = await createRun({ spec, url: null, outputRoot: root, mode: 'bootstrap', id: 'case0006' });
  await recordAbsentBaseline(directory, 'No preview URL is configured.');
  const manifest = await saveFoundationApproval(directory, structuredClone(approvalSample));
  assert.equal(manifest.foundationApproval.foundationVersion, '1.0.0');
  assert.equal(manifest.foundationApproval.path, 'foundation-1.0.0.json');
  assert.equal((await loadRun(directory)).spec.designFoundation.status, 'approved');
  assert.equal(JSON.parse(await readFile(join(directory, manifest.foundationApproval.path), 'utf8')).reviewer.name, 'Example product designer');
  await savePlan(directory, null);
  await assert.rejects(saveFoundationApproval(directory, structuredClone(approvalSample)), /after page planning begins/i);
});

test('review runs keep their own gates and cannot record an absent baseline', async t => {
  const root = await temporaryRoot(t, 'pd-bootstrap-review-');
  await assert.rejects(createRun({ spec: structuredClone(sample), url: null, outputRoot: root, mode: 'review', id: 'case0003' }), /review run requires a capture URL/i);
  const { directory } = await createRun({ spec: structuredClone(sample), url: 'http://127.0.0.1:4321/', outputRoot: root, mode: 'review', id: 'case0004' });
  await assert.rejects(recordAbsentBaseline(directory, 'Nothing here.'), /Only a bootstrap run/);
  await assert.rejects(savePlan(directory, 'F1'), /baseline/i);
});
