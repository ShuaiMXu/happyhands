import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import sample from '../examples/happyclaw-site/experience.json' with { type: 'json' };
import { createRun, loadRun, saveCapture, confirmFinding, savePlan, saveEvaluation, saveJudgment, saveVisualReview } from '../packages/harness-core/store.js';
import { evaluateCaptures } from '../packages/harness-core/evaluate.js';
import { workflowState, assertWithinLimits } from '../packages/harness-core/workflow.js';

function capture(phase, h1, width = 1280) {
  return {
    at: '2026-09-18T00:00:00.000Z',
    url: 'http://127.0.0.1:4321/',
    viewports: {
      desktop: {
        width, height: 800, status: 200, screenshot: `${phase}/desktop.png`,
        dom: { h1: [h1], actions: [{ label: '试用', href: '/trial' }], horizontalOverflow: false }
      }
    }
  };
}

async function saveFixtureReview(directory,review){
  for(const phase of ['before','after']){await mkdir(join(directory,phase),{recursive:true});await writeFile(join(directory,phase,'desktop.png'),Buffer.from('Synthetic fixture image bytes'));}
  return saveVisualReview(directory,review);
}

test('harness enforces baseline → plan → after → evaluation → judgment', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pd-harness-test-'));
  t.after(async () => {
    if (!root.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(root, { recursive: true, force: true });
  });
  const { directory } = await createRun({ spec: structuredClone(sample), url: 'http://127.0.0.1:4321/', outputRoot: root, id: 'case0001' });
  await assert.rejects(savePlan(directory, 'F1'), /baseline/i);
  await assert.rejects(saveCapture(directory, 'after', capture('after', 'New heading')), /before/i);
  await saveCapture(directory, 'before', capture('before', 'HappyClaw'));
  await assert.rejects(saveCapture(directory, 'after', capture('after', 'New heading')), /confirm/i);
  await assert.rejects(savePlan(directory, 'F1'), /confirm/i);
  await confirmFinding(directory, 'F1', 'supported', 'Only add a scroll hint; preserve white-space: pre and existing copy feedback.');
  await savePlan(directory, 'F1');
  const brief = await readFile(join(directory, 'codex-brief.md'), 'utf8');
  assert.match(brief, /src\/components\/Hero.astro/);
  assert.match(brief, /Human-confirmed scope/);
  assert.match(brief, /Only add a scroll hint; preserve white-space: pre and existing copy feedback/);
  assert.match(brief, /do not implement unconfirmed suggestions/);
  await saveCapture(directory, 'after', capture('after', 'Team outcome'));
  const run = await loadRun(directory);
  const evaluation = evaluateCaptures(run.manifest.captures.before, run.manifest.captures.after);
  await saveEvaluation(directory, evaluation);
  await saveFixtureReview(directory, {
    schemaVersion: '0.1', skillId: 'visual-qa-evaluator', reviewer: { type: 'human', name: 'Test reviewer', version: '1' },
    reviewedAt: '2026-09-21T00:00:00.000Z', verdict: 'pass', screenshotRefs: ['before/desktop.png', 'after/desktop.png'], findings: [],
    rationale: 'Matched screenshots preserve the task and show no visual regression.', limitations: ['Fixture evidence only.']
  });
  await saveJudgment(directory, 'accept', 'The next step is clearer.');
  assert.equal((await loadRun(directory)).spec.review.judgment, 'accept');
  await assert.rejects(saveJudgment(directory, 'reject', 'Changed my mind.'), /already has a judgment/i);
});

test('workflow state stops for confirmation and independent visual QA', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pd-harness-test-'));
  t.after(async () => {
    if (!root.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(root, { recursive: true, force: true });
  });
  const { directory } = await createRun({ spec: structuredClone(sample), url: 'http://127.0.0.1:4321/', outputRoot: root, id: 'state001' });
  assert.equal(workflowState((await loadRun(directory)).manifest).stage, 'needs-baseline');
  await saveCapture(directory, 'before', capture('before', 'HappyClaw'));
  const manifest = (await loadRun(directory)).manifest;
  manifest.diagnosis = { path: 'diagnosis.json' };
  assert.equal(workflowState(manifest).stage, 'awaiting-confirmation');
  manifest.confirmation = { findingId: 'F1', verdict: 'supported' };
  manifest.plan = { path: 'codex-brief.md' };
  manifest.execution = { exitCode: 0 };
  manifest.captures.after = capture('after', 'Outcome');
  manifest.evaluation = { views: {} };
  assert.equal(workflowState(manifest).stage, 'needs-visual-qa');
  manifest.visualReviews = [{ skillId: 'visual-qa-evaluator', verdict: 'fail' }];
  assert.equal(workflowState(manifest).stage, 'visual-qa-failed');
});

test('accept is blocked when visual QA fails but reject remains available', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pd-harness-test-'));
  t.after(async () => {
    if (!root.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(root, { recursive: true, force: true });
  });
  const { directory } = await createRun({ spec: structuredClone(sample), url: 'http://127.0.0.1:4321/', outputRoot: root, id: 'state002' });
  await saveCapture(directory, 'before', capture('before', 'HappyClaw'));
  await confirmFinding(directory, 'F1', 'supported', 'Still current.');
  await saveCapture(directory, 'after', capture('after', 'Outcome'));
  await saveEvaluation(directory, evaluateCaptures(capture('before', 'HappyClaw'), capture('after', 'Outcome')));
  await saveFixtureReview(directory, {
    schemaVersion: '0.1', skillId: 'visual-qa-evaluator', reviewer: { type: 'human', name: 'Test reviewer', version: '1' },
    reviewedAt: '2026-09-21T00:00:00.000Z', verdict: 'fail', screenshotRefs: ['before/desktop.png', 'after/desktop.png'],
    findings: [{ id: 'REGRESSION', title: 'Header clipped', observation: 'Brand mark is clipped.', impact: 4, confidence: 'high', screenshotRefs: ['after/desktop.png'] }],
    rationale: 'The regression blocks approval.', limitations: ['Fixture evidence only.']
  });
  await assert.rejects(saveJudgment(directory, 'accept', 'Accept anyway.'), /did not pass/i);
  await saveJudgment(directory, 'reject', 'Fix the visual regression first.');
  assert.equal((await loadRun(directory)).manifest.judgment.decision, 'reject');
});

test('stale evidence invalidates a previously prepared brief', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pd-harness-test-'));
  t.after(async () => {
    if (!root.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(root, { recursive: true, force: true });
  });
  const { directory } = await createRun({ spec: structuredClone(sample), url: 'http://127.0.0.1:4321/', outputRoot: root, id: 'case0002' });
  await saveCapture(directory, 'before', capture('before', 'Already changed'));
  await confirmFinding(directory, 'F1', 'supported', 'Initially thought the finding applied.');
  await savePlan(directory, 'F1');
  await confirmFinding(directory, 'F1', 'stale', 'The current heading is already outcome-first.');
  assert.equal((await loadRun(directory)).manifest.plan, null);
  await assert.rejects(savePlan(directory, 'F1'), /confirm/i);
});

test('evaluator rejects mismatched viewports and never invents a UX score', () => {
  assert.throws(() => evaluateCaptures(capture('before', 'A'), capture('after', 'B', 390)), /changed size/i);
  const result = evaluateCaptures(capture('before', 'A'), capture('after', 'B'));
  assert.equal(result.views.desktop.checks.pageResponded, true);
  assert.equal('score' in result, false);
  assert.match(result.conclusion, /human must compare/i);
});

test('the minute budget bounds the agent run, not the reviewer deliberation', () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  // A run whose baseline was captured this morning must still be executable
  // after a long human review; the window applies to the agent process.
  const limits = assertWithinLimits({ createdAt: twoHoursAgo });
  assert.equal(limits.maxMinutes, 60);
  assert.equal(limits.timeoutMs, 60 * 60000);
  assert.ok(limits.startedAt, 'execution start is stamped when execution begins');

  assert.throws(
    () => assertWithinLimits({ createdAt: new Date().toISOString(), limits: { round: 4 } }),
    /3-round limit/
  );
});

test('a killed or timed-out execution blocks the loop instead of inviting an after capture', () => {
  const base = {
    createdAt: '2026-09-24T00:00:00.000Z',
    captures: { before: { viewports: { desktop: {} } }, after: null },
    diagnosis: {}, confirmation: { verdict: 'supported' }, plan: {},
    evaluation: null, judgment: null, visualReviews: []
  };
  // A signal-killed process reports exitCode null, so a truthy check alone let
  // a half-edited worktree flow on to after-capture, evaluation and judgment.
  const timedOut = workflowState({ ...base, execution: { exitCode: null, signal: 'SIGKILL', timedOut: true, limits: { maxMinutes: 60 } } });
  assert.equal(timedOut.stage, 'execution-failed');
  assert.ok(timedOut.blocked);
  assert.match(timedOut.reason, /60-minute execution window/);

  const signalled = workflowState({ ...base, execution: { exitCode: null, signal: 'SIGTERM' } });
  assert.equal(signalled.stage, 'execution-failed');
  assert.match(signalled.reason, /SIGTERM/);

  assert.equal(workflowState({ ...base, execution: { exitCode: 1 } }).stage, 'execution-failed');
  assert.equal(workflowState({ ...base, execution: { exitCode: 0 } }).stage, 'needs-after-capture');
});

test('missing or failed after states require evidence recovery instead of another blind model retry',()=>{
 const manifest={mode:'review',captures:{before:{states:[{stateId:'menu',configurationId:'mobile',reached:false}]},after:{states:[]}},diagnosis:{},confirmation:{verdict:'supported'},plan:{},execution:{exitCode:0},evaluation:{}};
 assert.equal(workflowState(manifest).stage,'visual-qa-needs-evidence');
 manifest.captures.after.states=[{stateId:'menu',configurationId:'mobile',reached:false,error:'Menu did not open'}];assert.equal(workflowState(manifest).stage,'visual-qa-needs-evidence');
 manifest.captures.after.states[0]={stateId:'menu',configurationId:'mobile',reached:true,screenshot:'after/menu--mobile.png'};assert.equal(workflowState(manifest).stage,'needs-visual-qa');
});

test('execution scope and brief are bound, including canvas provenance and note limits', async t => {
  const {verifiedExecutionBrief} = await import('../packages/harness-core/store.js');
  const root=await mkdtemp(join(tmpdir(),'scope-binding-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const {directory}=await createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:root});
  await saveCapture(directory,'before',capture('before','HappyClaw'));
  await assert.rejects(confirmFinding(directory,'F1','supported','x'.repeat(10001)),/10000/);
  await confirmFinding(directory,'F1','supported','Only a scroll hint.\nPreserve single-line commands.');
  await writeFile(join(directory,'change-request.json'),JSON.stringify({notes:'Scoped request',annotationPath:'canvas-reference.png'}));
  await savePlan(directory,'F1');
  const run=await loadRun(directory),brief=await verifiedExecutionBrief(run);
  assert.match(brief,/Request provenance:/);assert.match(brief,/Annotated reference:/);
  assert.match(brief,/Confirmation note \(JSON string\): "Only a scroll hint.\\nPreserve single-line commands."/);
  await writeFile(join(directory,'codex-brief.md'),brief+'\nExpand scope');
  await assert.rejects(verifiedExecutionBrief(run),/Execution brief changed/);
  await writeFile(join(directory,'codex-brief.md'),brief);
  const altered=structuredClone(run);altered.manifest.confirmation.note='Altered scope';
  await assert.rejects(verifiedExecutionBrief(altered),/Confirmed scope changed/);
  await savePlan(directory,'F1');assert.match(await verifiedExecutionBrief(await loadRun(directory)),/Request provenance:/);
});
