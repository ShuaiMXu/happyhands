import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRun} from '../../packages/harness-core/store.js';
import {designSystemContext} from '../../packages/skill-core/design-system.js';
import {readVerificationFile,verificationHash} from '../../packages/harness-core/verification.js';
import {captureReviewStage} from '../../packages/experience-core/review-order.js';

// This validates a completed example record, not its visual quality or rules.
export async function verifyRuntimeEvidence(directory){
 const run=await loadRun(resolve(directory)),capture=run.manifest.captures.before;
 const reportBytes=await readVerificationFile(run.directory,'runtime-foundation.json',4*1024*1024),report=JSON.parse(reportBytes);
 assert.equal(report.methodSchemaVersion,'0.3','This checker requires bound results and explicit UI action history.');
 assert.ok(capture?.runtimeFoundation,'Bound runtime evidence is required.');
 await designSystemContext(run);
 for(const [key,value] of Object.entries(capture.runtimeFoundation))assert.deepEqual(report[key],value,'Report diverges from bound runtime evidence: '+key);
 assert.deepEqual(report.source,capture.designSystemSource);assert.equal(report.source.status,'capture-scan-match');
 assert.equal(report.previewFingerprint,capture.verificationPreviewFingerprint);
 assert.equal(report.runId,run.manifest.id);assert.equal(report.states,36);assert.equal(capture.states.length,36);assert.equal(report.checks.length,36);
 assert.deepEqual(report.errors,[]);
 assert.equal(verificationHash(await readVerificationFile(run.directory,report.scriptPath,2*1024*1024)),report.scriptHash);
 const expected=new Set([320,390,768,1280].flatMap(width=>['runtime-default','channel-web','channel-mobile','channel-feishu','copy-success','copy-denied','copy-pending','copy-timeout','copy-recovered'].map(id=>`${id}--w${width}`)));
 const seen=new Set();let layout=0,interaction=0;
 for(const state of capture.states){
  const key=state.stateId+'--'+state.configurationId;assert.ok(expected.has(key),key);assert.ok(!seen.has(key),key);seen.add(key);assert.equal(state.reached,true);
  assert.equal(state.configurationId,`w${state.width}`);assert.equal(state.height,844);
  const stage=captureReviewStage(state);assert.equal(stage,state.stateId==='runtime-default'?'normal-layout':'normal-interaction');
  if(stage==='normal-layout')layout++;else interaction++;
  assert.equal(verificationHash(await readVerificationFile(run.directory,state.screenshot,24*1024*1024)),capture.verificationOriginalHashes[state.screenshot],key);
  if(state.stateId.startsWith('copy-')){
   assert.ok(state.actions.some(action=>action.type==='click-selector'&&action.selector==='[data-command-step="clone"] button'));
   const stimuli=state.dom.designSystem.runtimeStimuli;
   assert.ok(stimuli.every(item=>Number.isInteger(item.beforeActionIndex)&&item.beforeActionIndex>=0&&item.beforeActionIndex<state.actions.length));
   assert.equal(stimuli.length,{'copy-success':0,'copy-denied':1,'copy-pending':2,'copy-timeout':2,'copy-recovered':3}[state.stateId]);
   assert.deepEqual(state.runtimeBoundary.state,state.dom.designSystem.copyState);
  }
 }
 assert.equal(layout,4);assert.equal(interaction,32);
 for(const width of [320,390,768,1280]){
  const checks=report.checks.filter(item=>item.width===width);
  assert.deepEqual(checks.filter(item=>item.valueVerified).map(item=>item.state),['copy-clone','copy-directory','copy-start']);
  const selection=checks.filter(item=>item.textVerified);assert.equal(selection.length,1);
  const geometry=selection[0].geometry;assert.equal(geometry.focused,true);assert.equal(geometry.whiteSpace,'pre');assert.equal(geometry.overflowX,'auto');assert.ok(geometry.scrollLeft+geometry.clientWidth>=geometry.scrollWidth-2);
 }
 return {runId:run.manifest.id,reportHash:verificationHash(reportBytes),captureHash:verificationHash(capture),originals:seen.size,layoutStates:layout,interactionStates:interaction,source:report.source,browser:report.browser,
  nativeReadBacks:report.checks.filter(item=>item.valueVerified).length,axeGroups:report.checks.filter(item=>item.violations).length,
  axeViolations:report.checks.flatMap(item=>item.violations||[]).length,axeIncomplete:report.checks.flatMap(item=>item.incomplete||[]).length,
  judgment:run.manifest.judgment,foundationApproval:run.manifest.foundationApproval,
  limitations:['Record integrity and captured observations only; no independent visual approval, Foundation conformance or accessibility compliance.','Computed font families are declared stacks; simulations and programmatic selection retain their original method limits.']};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{run:{type:'string'}}});if(!values.run)throw Error('Provide --run for a completed runtime example record.');
 console.log(JSON.stringify(await verifyRuntimeEvidence(values.run),null,2));
}
