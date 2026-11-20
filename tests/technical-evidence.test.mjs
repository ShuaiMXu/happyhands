import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {technicalProject} from './helpers/technical-project.mjs';
import {createRun, confirmFinding, saveCapture, saveEvaluation, saveJudgment} from '../packages/harness-core/store.js';
import {workflowState} from '../packages/harness-core/workflow.js';

test('source repair verifies a failed syntax check and its isolated fix with no preview or visual judgment', async t => {
  const p = await technicalProject(t, {'feature.mjs': 'export const label = ;'});
  const run = await p.start({evidencePolicy: {kind: 'node-syntax', file: 'feature.mjs'}});
  const next = async () => JSON.parse(await p.invoke('next', '--run', run));
  const upcoming = await next();
  assert.equal(upcoming.level, 'source');
  assert.equal(upcoming.stage, 'needs-technical-before');
  const baseline = JSON.parse(await p.invoke(...upcoming.cli.steps[0].argv));
  assert.equal(baseline.status, 'fail');
  assert.match(baseline.checks[0].diagnostic, /SyntaxError:/);
  assert.equal((await next()).stage, 'needs-technical-after');
  await assert.rejects(p.invoke('verify', '--run', run, '--phase', 'after', '--repo', p.repo), /isolated worktree/);
  await p.fix({'feature.mjs': 'export const label = "Save";'});
  const result = JSON.parse(await p.invoke('verify', '--run', run, '--phase', 'after', '--repo', p.candidate));
  assert.equal(result.status, 'pass');
  assert.notEqual(result.source.contentHash, baseline.source.contentHash);
  const status = JSON.parse(await p.invoke('status', '--run', run));
  assert.deepEqual(status.captures, {before: null, after: null});
  assert.equal(status.workflow.stage, 'technical-verified');
  assert.equal(status.workflow.visual, 'not-reviewed');
  assert.equal(status.judgment, null);
  await assert.rejects(p.invoke('verify', '--run', run, '--phase', 'after', '--repo', p.candidate), /already recorded/);
  const report = JSON.parse(await p.invoke('report', '--run', run));
  assert.match(await readFile(report.path, 'utf8'), /not-reviewed/);
});

test('a visual Hero Run cannot switch to technical verification or accept a structural pass', async t => {
  const p = await technicalProject(t, {'index.html': '<main><h1>Hero</h1></main>'});
  const {directory} = await createRun({spec:p.spec, url:'http://127.0.0.1:3000/', outputRoot:p.root, evidencePolicy:{kind:'visual'}});
  await saveCapture(directory, 'before', {viewports:{desktop:{screenshot:'before/desktop.png'}}});
  await confirmFinding(directory,p.spec.findings[0].id,'supported','Synthetic visual contract scope');
  await saveCapture(directory, 'after', {viewports:{desktop:{screenshot:'after/desktop.png'}}});
  const manifest = await saveEvaluation(directory, {status:'synthetic-structural-pass', views:{desktop:{checks:{noHorizontalOverflow:true,hasHeading:true}}}});
  assert.equal(workflowState(manifest).stage, 'needs-visual-qa');
  await assert.rejects(p.invoke('verify', '--run', directory, '--phase', 'before'), /Visual Runs/);
  await assert.rejects(saveJudgment(directory, 'accept'), /Independent Visual QA/);
});

test('a passing baseline cannot become a verified technical repair', async t => {
  const p = await technicalProject(t, {'feature.mjs': 'export const label = "Save";'});
  const run = await p.start({evidencePolicy:{kind:'node-syntax',file:'feature.mjs'}});
  await assert.rejects(p.invoke('verify','--run',run,'--phase','before'), /"status": "pass"/);
  const next = JSON.parse(await p.invoke('next','--run',run));
  assert.equal(next.stage, 'technical-baseline-unconfirmed');
  assert.equal(next.blocked, true);
  await assert.rejects(p.invoke('verify','--run',run,'--phase','after'), /Reproduce the declared defect/);
});
