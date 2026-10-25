import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {createRun,loadRun,saveOnboarding,confirmFinding,savePlan,saveEvaluation,saveVisualReview,saveJudgment,withdrawJudgment} from '../packages/harness-core/store.js';
import {captureWithDesignSystem} from '../packages/harness-core/design-system.js';
import {verifiedIncrementalDelta,incrementalReviewPlan} from '../packages/harness-core/incremental.js';
import {repositoryFingerprint,repositoryInputHash} from '../packages/harness-core/repository-fingerprint.js';
import {readRepositoryInputs} from '../packages/harness-core/repository-inputs.js';
import {exportRun} from '../packages/harness-core/export.js';
import {createWorkbench} from '../packages/workbench/service.js';
import {captureEntries,configurationsForState,captureKey} from '../packages/harness-core/capture-state.js';
import {readIncrementalCapturePlan,assertIncrementalRecapture,selectedCapturePlan} from '../packages/harness-core/incremental-capture.js';
import {runAiVisualReview} from '../packages/workbench/ai-review.js';
import {verificationHash} from '../packages/harness-core/verification.js';
import {executeWithAgent} from '../packages/harness-core/runner.js';
const exec=promisify(execFile),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
async function plannedFixtureCapture({directory,phase,plan}){
  await mkdir(join(directory,phase),{recursive:true});const states=[];
  for(const state of plan.states)for(const configuration of configurationsForState(plan,state)){
    const screenshot=`${phase}/${captureKey(state.id,configuration.id)}.png`;await writeFile(join(directory,screenshot),png);
    states.push({stateId:state.id,configurationId:configuration.id,...configuration.viewport,reached:true,screenshot,start:state.start,actions:state.actions,plannedState:structuredClone(state)});
  }
  return {states};
}
async function fixture(t,{plan,packageConfig=false}={}){
  const root=await mkdtemp(join(tmpdir(),'incremental-source-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const repo=join(root,'project');await mkdir(join(repo,'src','components'),{recursive:true});await mkdir(join(repo,'public'));
  const git=async(...args)=>(await exec('git',args,{cwd:repo,windowsHide:true})).stdout.trim();
  await git('init','-q');await git('config','user.email','fixture@example.invalid');await git('config','user.name','Fixture');
  await writeFile(join(repo,'src','components','Button.js'),'export const Button = "Original";');await writeFile(join(repo,'config.json'),'{"flag":true}');await writeFile(join(repo,'public','logo.bin'),Buffer.from([0,1,2]));
  await mkdir(join(repo,'src','pages'));await writeFile(join(repo,'src','pages','index.js'),"import {Button} from '../components/Button.js'; export const page = Button;");
  await writeFile(join(repo,'src','pages','about.js'),'export const about = "Independent";');
  if(packageConfig){
    await writeFile(join(repo,'.gitignore'),'node_modules/\n');await writeFile(join(repo,'tsconfig.json'),'{"extends":"preset"}');
    await mkdir(join(repo,'node_modules','preset'),{recursive:true});await writeFile(join(repo,'node_modules','preset','package.json'),'{"name":"preset","version":"1"}');await writeFile(join(repo,'node_modules','preset','tsconfig.json'),'{}');
  }
  await git('add','.');await git('commit','-qm','Original');const original=await git('rev-parse','HEAD');
  await mkdir(join(root,'.harness','runs'),{recursive:true});
  const run=await createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:join(root,'.harness','runs'),id:'accepted-source'});
  await saveOnboarding(run.directory,{repository:{root:repo,commit:original}});
  async function capture(phase){return captureWithDesignSystem({directory:run.directory,repo,phase,capture:async()=>{
    if(plan)return plannedFixtureCapture({directory:run.directory,phase,plan});
    await mkdir(join(run.directory,phase),{recursive:true});await writeFile(join(run.directory,phase,'desktop.png'),png);
    return {viewports:{desktop:{width:1280,height:800,status:200,screenshot:`${phase}/desktop.png`,dom:{h1:['Fixture'],actions:[],horizontalOverflow:false}}}};
  }});}
  await capture('before');await confirmFinding(run.directory,'F1','supported','Synthetic scope');await savePlan(run.directory,'F1');
  await writeFile(join(repo,'src','components','Button.js'),'export const Button = "Accepted";');await capture('after');
  await saveEvaluation(run.directory,{status:'fixture'});
  const capturedRun=await loadRun(run.directory),refs=['before','after'].flatMap(phase=>captureEntries(capturedRun.manifest.captures[phase]).map(entry=>entry.screenshot));
  await saveVisualReview(run.directory,{schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'model',name:'Synthetic fixture only',version:'test'},reviewedAt:new Date().toISOString(),verdict:'pass',screenshotRefs:refs,findings:[],rationale:'Synthetic fixture only',limitations:['No real model or product assessment']});
  await saveJudgment(run.directory,'accept','Synthetic test decision');
  await git('add','.');await git('commit','-qm','Apply accepted fixture');
  return {root,repo,git,parent:await loadRun(run.directory)};
}

test('current delta compares the accepted source contents instead of the old execution file list',async t=>{
  const {repo,git,parent}=await fixture(t);parent.manifest.execution={changedFiles:['old/unrelated.css']};
  const unchanged=await verifiedIncrementalDelta(parent,repo);assert.equal(unchanged.status,'verified');assert.deepEqual(unchanged.changes,[]);
  assert.equal(incrementalReviewPlan(parent,{},unchanged).reasonCode,'unchanged-source');
  await writeFile(join(repo,'src','components','Button.js'),'export const Button = "Current";');await git('add','.');await git('commit','-qm','Current change');
  const delta=await verifiedIncrementalDelta(parent,repo,{plan:{states:[{id:'home',start:{url:'http://localhost/'},actions:[],region:{source:{file:'src/pages/index.js'}}}]}});assert.deepEqual(delta.changes.map(item=>[item.path,item.kind]),[['src/components/Button.js','modified']]);
  assert.deepEqual(delta.impact.changes[0].stateIds,['home']);
  assert.ok(delta.impact.changes[0].references.some(item=>item.revision==='baseline'&&item.file==='src/pages/index.js'));
  assert.ok(delta.impact.changes[0].references.some(item=>item.revision==='current'&&item.file==='src/pages/index.js'));
  assert.notEqual(delta.baseline.commit,delta.current.commit);assert.match(delta.diffHash,/^[a-f0-9]{64}$/);
  const plan=incrementalReviewPlan(parent,{},delta);assert.equal(plan.mode,'incremental');assert.deepEqual(plan.changedFiles,['src/components/Button.js']);
  assert.match(plan.scope,/no route or state is marked reviewed/);
});

test('onboarding captures only declared affected states and later changes cannot escape that scope',async t=>{
  const plan={schemaVersion:'0.1',adapter:'web',configurations:[{id:'desktop',viewport:{width:1280,height:800}},{id:'mobile',viewport:{width:390,height:844}}],states:[{id:'home',sourceEntries:['src/pages/index.js'],start:{url:'http://localhost:4321/'},actions:[]},{id:'about',sourceEntries:['src/pages/about.js'],start:{url:'http://localhost:4321/about'},actions:[]}]};
  const {root,repo,git,parent}=await fixture(t,{plan,packageConfig:true}),configPath=join(root,'project.json');
  await writeFile(join(root,'experience.json'),JSON.stringify(sample));await writeFile(join(root,'capture-plan.json'),JSON.stringify(plan));
  const approval={proposalId:'synthetic-existing-plan'};
  await writeFile(configPath,JSON.stringify({version:'0.1',repo,spec:'experience.json',url:'http://localhost:4321',capturePlan:'capture-plan.json',reviewPlanApproval:approval}));
  await saveOnboarding(parent.directory,{...parent.manifest.onboarding,config:{capturePlanDigest:verificationHash(JSON.stringify(plan)),reviewPlanApproval:approval}});
  await writeFile(join(repo,'src','components','Button.js'),'export const Button = "Current";');await git('add','.');await git('commit','-qm','Current source');
  const requested=[];let driftAtPreview=false;
  const service=createWorkbench(root,{generate:async()=>{throw Error('Synthetic test: no external model process');},waitForPreview:async()=>{if(driftAtPreview)await writeFile(join(repo,'node_modules','preset','tsconfig.json'),'{"compilerOptions":{"strict":true}}');return {status:200};},captureBrowserPlan:async options=>{requested.push(options.plan);return plannedFixtureCapture(options);}});t.after(()=>service.close());
  const job=await service.onboard({configPath,originRunId:parent.manifest.id});let terminal;
  for(let attempt=0;attempt<500;attempt++){terminal=await service.jobs.get(job.id);if(!['queued','running'].includes(terminal.status))break;await new Promise(resolve=>setTimeout(resolve,30));}
  assert.equal(terminal.status,'succeeded',terminal.error);
  assert.deepEqual(requested[0].states.map(state=>state.id),['home']);assert.equal(requested[0].configurations.length,2);
  let next=await loadRun(join(root,'.harness','runs',terminal.result.runId));const record=await readIncrementalCapturePlan(next,plan);
  assert.deepEqual(record.selection.excludedStateIds,['about']);assert.deepEqual(record.selection.reviewedStateIds,[]);
  const exported=await exportRun({directory:next.directory,outputRoot:join(root,'selected-export')});assert.ok(exported.files.includes('incremental-capture-plan.json'));
  assert.deepEqual(await readIncrementalCapturePlan({...next,directory:exported.directory}),record);
  await confirmFinding(next.directory,'F1','supported','Synthetic incremental correction');await savePlan(next.directory,'F1');next=await loadRun(next.directory);
  const fingerprintBeforePackage=await repositoryFingerprint(repo),installedConfig=join(repo,'node_modules','preset','tsconfig.json');
  await writeFile(installedConfig,'{"compilerOptions":{"strict":true}}');assert.deepEqual(await repositoryFingerprint(repo),fingerprintBeforePackage);
  await assert.rejects(assertIncrementalRecapture(next,repo,record),/Installed config inputs changed/);
  await assert.rejects(executeWithAgent({directory:next.directory,repo,agent:'codex'}),/Installed config inputs changed/);
  await assert.rejects(readFile(join(next.directory,'worktree','.git')),error=>error.code==='ENOENT');assert.equal((await loadRun(next.directory)).manifest.execution,null);
  await writeFile(installedConfig,'{}');
  const fullJob=await service.onboard({configPath,originRunId:parent.manifest.id,fullReview:true});let fullTerminal;
  for(let attempt=0;attempt<500;attempt++){fullTerminal=await service.jobs.get(fullJob.id);if(!['queued','running'].includes(fullTerminal.status))break;await new Promise(resolve=>setTimeout(resolve,30));}
  assert.equal(fullTerminal.status,'succeeded',fullTerminal.error);assert.deepEqual(requested[1].states.map(state=>state.id),['home','about']);
  assert.equal((await loadRun(join(root,'.harness','runs',fullTerminal.result.runId))).manifest.onboarding.fullReviewRequested,true);
  driftAtPreview=true;const driftJob=await service.onboard({configPath,originRunId:parent.manifest.id});let driftTerminal;
  for(let attempt=0;attempt<500;attempt++){driftTerminal=await service.jobs.get(driftJob.id);if(!['queued','running'].includes(driftTerminal.status))break;await new Promise(resolve=>setTimeout(resolve,30));}
  assert.equal(driftTerminal.status,'failed');assert.match(driftTerminal.error,/Installed config inputs changed after incremental planning/);
  driftAtPreview=false;await writeFile(installedConfig,'{}');
  await writeFile(join(repo,'src','components','Button.js'),'export const Button = "Correction";');await assertIncrementalRecapture(next,repo,record);
  assert.deepEqual(next.manifest.plan.incrementalCapturePlan,next.manifest.onboarding.incrementalCapturePlan);
  await captureWithDesignSystem({directory:next.directory,repo,phase:'after',capture:()=>plannedFixtureCapture({directory:next.directory,phase:'after',plan:selectedCapturePlan(plan,record.selection)})});
  await saveEvaluation(next.directory,{status:'fixture'});const cwd=join(root,'incremental-qa');await mkdir(cwd);
  const review=await runAiVisualReview(next.directory,{cwd,signal:new AbortController().signal,generate:async(_command,_args,options)=>{
    const context=JSON.parse(await readFile(join(cwd,'review-context.json')));assert.deepEqual(context.incrementalCaptureScope.excludedStateIds,['about']);assert.match(options.input,/excludedStateIds remain unreviewed/);
    await writeFile(join(cwd,'review-result.json'),JSON.stringify({verdict:'needs-evidence',screenshotRefs:context.evidence.map(item=>item.reference),findings:[],rationale:'Synthetic images are not a product assessment.',limitations:['Fixture only']}));
  }});
  assert.ok(review.limitations.some(item=>item.includes('excluded states remain unreviewed: about')));assert.equal((await loadRun(next.directory)).manifest.judgment,null);
  await writeFile(join(repo,'src','pages','about.js'),'export const about = "Changed outside scope";');await assert.rejects(assertIncrementalRecapture(next,repo,record),/excluded or unknown states/);
  await writeFile(join(next.directory,'incremental-capture-plan.json'),'{}');await assert.rejects(readIncrementalCapturePlan(next,plan),/artifact changed/);
  await assert.rejects(exportRun({directory:next.directory,outputRoot:join(root,'invalid-scope-export')}),/artifact changed/);
});

test('binary assets, JSON, additions and deletions remain in the full input diff',async t=>{
  const {repo,git,parent}=await fixture(t);
  await writeFile(join(repo,'public','logo.bin'),Buffer.from([5,6,7]));await writeFile(join(repo,'config.json'),'{"flag":false}');
  await rm(join(repo,'src','components','Button.js'));await writeFile(join(repo,'src','new.css'),'body{color:red}');await git('add','-A');await git('commit','-qm','Mixed changes');
  const delta=await verifiedIncrementalDelta(parent,repo);
  assert.deepEqual(delta.changes.map(item=>[item.path,item.kind]),[['config.json','modified'],['public/logo.bin','modified'],['src/components/Button.js','deleted'],['src/new.css','added']]);
  assert.equal(incrementalReviewPlan(parent,{},delta).reasonCode,'unsupported-changes');
});

test('dirty current sources, foreign projects, withdrawn and legacy baselines cannot narrow review',async t=>{
  const {root,repo,parent}=await fixture(t),other=join(root,'other');await mkdir(other);
  assert.equal((await verifiedIncrementalDelta(parent,other)).reasonCode,'different-project');
  assert.equal((await verifiedIncrementalDelta(parent,repo,{source:'different-project'})).reasonCode,'different-project');
  const legacy=structuredClone(parent);delete legacy.manifest.captures.after.incrementalSource;
  assert.equal((await verifiedIncrementalDelta(legacy,repo)).reasonCode,'baseline-inputs-missing');
  await writeFile(join(repo,'config.json'),'{}');assert.equal((await verifiedIncrementalDelta(parent,repo)).reasonCode,'current-source-dirty');
  await withdrawJudgment(parent.directory,'Synthetic withdrawal');assert.equal((await verifiedIncrementalDelta(parent,repo)).reasonCode,'unaccepted-parent');
});

test('input inventories export intact and reject tampering and unsafe references',async t=>{
  const {root,repo,parent}=await fixture(t),reference=parent.manifest.captures.after.incrementalSource;
  const fingerprint=await repositoryFingerprint(repo,{includeFiles:true});assert.equal(repositoryInputHash(fingerprint.files),fingerprint.contentHash);
  assert.equal((await repositoryFingerprint(repo)).files,undefined);
  const exported=await exportRun({directory:parent.directory,outputRoot:join(root,'public-test')});assert.ok(exported.files.includes(reference.path));
  const copy={...parent,directory:exported.directory};assert.deepEqual(await readRepositoryInputs(copy,'after'),await readRepositoryInputs(parent,'after'));
  const unsafe=structuredClone(parent);unsafe.manifest.captures.after.incrementalSource.path='../outside.json';assert.equal((await verifiedIncrementalDelta(unsafe,repo)).status,'unavailable');
  await writeFile(join(parent.directory,reference.path),'{}');assert.equal((await verifiedIncrementalDelta(parent,repo)).reasonCode,'source-binding-unavailable');
  await assert.rejects(exportRun({directory:parent.directory,outputRoot:join(root,'invalid-export')}),/artifact changed/);
});

test('non-design input changes during a capture reject the source binding',async t=>{
  const {root,repo}=await fixture(t);const run=await createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:join(root,'.harness','runs'),id:'capture-race'});
  await writeFile(join(repo,'config.json'),'{"pending":true}'); // dirty remains true across the binary change
  await assert.rejects(captureWithDesignSystem({directory:run.directory,repo,phase:'before',capture:async()=>{await writeFile(join(repo,'public','logo.bin'),Buffer.from([9]));return {viewports:{}};}}),/Repository inputs changed/);
  assert.equal((await loadRun(run.directory)).manifest.captures.before,null);
  await assert.rejects(repositoryFingerprint(join(repo,'src'),{includeFiles:true}),/requires the Git root/);
});

test('optional inventory limits preserve complete strict verification metadata',async t=>{
  const {root,repo}=await fixture(t),run=await createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:join(root,'.harness','runs'),id:'limited-index'});
  const metadata=await repositoryFingerprint(repo);let indexRequests=0;
  const result=await captureWithDesignSystem({directory:run.directory,repo,phase:'before',bindVerificationSource:true,verificationUrl:'http://localhost',fingerprintPreview:async()=> 'stable-preview',fingerprint:async(_repo,options)=>{
    if(options?.includeFiles){indexRequests++;throw Object.assign(Error('Fixture index limit'),{code:'REPOSITORY_INDEX_LIMIT'});}return metadata;
  },capture:async()=>({states:[]})});
  assert.equal(indexRequests,1);assert.equal(result.incrementalSource.status,'unavailable');assert.deepEqual(result.verificationSource,metadata);
});

test('workbench onboarding records the current verified delta and binds it to the new capture',async t=>{
  const {root,repo,git,parent}=await fixture(t),configPath=join(root,'project.json');
  await writeFile(join(root,'experience.json'),JSON.stringify(sample));await writeFile(configPath,JSON.stringify({version:'0.1',repo,spec:'experience.json',url:'http://localhost:4321'}));
  await writeFile(join(repo,'src','components','Button.js'),'export const Button = "Next task";');await git('add','.');await git('commit','-qm','Next task change');
  let captures=0;
  const service=createWorkbench(root,{generate:async()=>{throw Error('Synthetic test: no external model process');},waitForPreview:async()=>({status:200}),captureBrowser:async({directory,phase})=>{captures++;await mkdir(join(directory,phase),{recursive:true});await writeFile(join(directory,phase,'desktop.png'),png);return {viewports:{desktop:{screenshot:`${phase}/desktop.png`,reached:true,dom:{h1:['Fixture'],actions:[],horizontalOverflow:false}}}};}});t.after(()=>service.close());
  const job=await service.onboard({configPath,originRunId:parent.manifest.id});let terminal;
  for(let attempt=0;attempt<400;attempt++){terminal=await service.jobs.get(job.id);if(!['queued','running'].includes(terminal.status))break;await new Promise(resolve=>setTimeout(resolve,30));}
  assert.equal(terminal.status,'succeeded',terminal.error);
  const next=await loadRun(join(root,'.harness','runs',terminal.result.runId)),plan=next.manifest.onboarding.incrementalReview;
  assert.equal(plan.mode,'incremental');assert.deepEqual(plan.changedFiles,['src/components/Button.js']);
  assert.deepEqual(plan.delta.current,next.manifest.captures.before.incrementalSource.fingerprint);assert.equal(captures,1);
  assert.ok(next.manifest.skills.some(skill=>skill.id==='content-design-reviewer'));
});
