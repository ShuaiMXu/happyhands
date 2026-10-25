import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRun} from '../../packages/harness-core/store.js';
import {assertCapturePlan,captureKey} from '../../packages/harness-core/capture-state.js';
import {readVerificationFile,verificationHash} from '../../packages/harness-core/verification.js';
import {designSystemContext} from '../../packages/skill-core/design-system.js';

// Inspect a completed collector record, never mutate it or accept its UI.
export async function verifyComponentEvidence(directory){
 const run=await loadRun(resolve(directory));
 const plan=assertCapturePlan(JSON.parse(await readFile(join(run.directory,'component-plan.json'),'utf8')));
 const summary=JSON.parse(await readFile(join(run.directory,'component-summary.json'),'utf8'));
 const capture=run.manifest.captures.before,extraction=(await designSystemContext(run)).before;
 assert.ok(capture&&extraction,'A completed capture and bound extraction are required.');
 assert.equal(capture.designSystemSource.status,'capture-scan-match');
 assert.deepEqual(summary.source,capture.designSystemSource);
 assert.equal(capture.verificationSource.commit,capture.designSystemSource.repositoryCommit);
 assert.equal(capture.verificationSource.dirty,capture.designSystemSource.dirty);
 assert.match(capture.verificationPreviewFingerprint,/^[a-f0-9]{64}$/);
 const expected=new Map();
 for(const state of plan.states)for(const config of plan.configurations.filter(item=>!state.configurations||state.configurations.includes(item.id)))expected.set(captureKey(state.id,config.id),{state,config});
 assert.equal(capture.states.length,expected.size);assert.equal(summary.total,expected.size);assert.equal(summary.successful,expected.size);assert.deepEqual(summary.failures,[]);
 const seen=new Set(),components=new Set();let assertions=0;
 for(const entry of capture.states){
  const key=captureKey(entry.stateId,entry.configurationId),target=expected.get(key);assert.ok(target,`Unexpected capture ${key}`);assert.ok(!seen.has(key),`Duplicate capture ${key}`);seen.add(key);
  assert.equal(entry.reached,true,key);assert.equal(entry.width,target.config.viewport.width);assert.equal(entry.height,target.config.viewport.height);assert.deepEqual(entry.actions,target.state.actions);
  assert.equal(entry.region.verification,'unique-visible-selector-and-shared-source-anchor');assert.equal(entry.region.selector,target.state.region.selector);
  assert.equal(entry.region.source.file,target.state.region.source.file);assert.equal(entry.region.source.anchor,target.state.region.source.anchor);
  const component=extraction.components.find(item=>item.source===entry.region.source.file);assert.ok(component,key);components.add(component.source);assert.equal(entry.region.source.fileHash,component.sourceHash);
  assert.equal(entry.componentInstance.id,target.state.region.instance.id);assert.equal(entry.componentInstance.verification,'declared-root-instance-stable-at-screenshot-boundary');
  assert.deepEqual(entry.componentInstance.variants.map(({observed,...variant})=>variant),target.state.region.instance.variants);
  assert.ok(entry.componentInstance.variants.every(item=>item.observed===item.value));
  const terminal=[];for(let index=target.state.actions.length-1;index>=0&&target.state.actions[index].type==='assert-state';index--)terminal.unshift(target.state.actions[index]);
  assert.equal(entry.finalStateEvidence.length,terminal.length,key);
  for(const [index,assertion] of terminal.entries()){
   const {verified,verification,...action}=entry.finalStateEvidence[index];assert.equal(verified,true);assert.equal(verification,'instantaneous-boundary-check');assert.deepEqual(action,assertion);assertions++;
  }
  assert.equal(verificationHash(await readVerificationFile(run.directory,entry.screenshot,24*1024*1024)),capture.verificationOriginalHashes[entry.screenshot],key);
 }
 assert.equal(components.size,15);
 assert.equal(summary.components.length,components.size);
 const summarized=new Set();
 for(const component of summary.components){
  assert.ok(components.has(component.source));assert.ok(!summarized.has(component.source),'Duplicate component summary');summarized.add(component.source);
  assert.deepEqual(component.coverage,extraction.components.find(item=>item.source===component.source).renderedCoverage);
  assert.equal(component.coverage.plannedTargets,component.coverage.capturedInstances);assert.deepEqual(component.coverage.missingTargets,[]);
 }
 return {runId:run.manifest.id,targets:seen.size,components:components.size,terminalAssertions:assertions,source:capture.designSystemSource,interactive:summary.interactive||false,
  judgment:run.manifest.judgment,foundationApproval:run.manifest.foundationApproval,limitations:['Data integrity and explicitly asserted capture states only; not independent visual approval, complete interaction coverage or human acceptance.','The preview fingerprint binds a captured response, not a cryptographic deployment identity.']};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{run:{type:'string'}}});if(!values.run)throw Error('Provide --run for a completed component collector record.');
 console.log(JSON.stringify(await verifyComponentEvidence(values.run),null,2));
}
