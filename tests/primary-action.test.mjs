import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createWorkbench} from '../packages/workbench/service.js';
import {createRun,saveCapture,saveDiagnosis,saveExecution,saveVisualReview,saveFoundationApproval} from '../packages/harness-core/store.js';
import {primaryActionForStage} from '../packages/harness-core/primary-action.js';
import {exportRun} from '../packages/harness-core/export.js';
import {loadProjectConfig} from '../packages/harness-core/onboard.js';
import {messages} from '../apps/designer/messages.js';
const spec=JSON.parse(await readFile(new URL('../examples/happyclaw-site/experience.json',import.meta.url),'utf8'));
export const capture=phase=>({viewports:{desktop:{screenshot:`${phase}/desktop.png`,width:1280,height:800,status:200,dom:{h1:['Fixture'],actions:[],controls:[],horizontalOverflow:false}}}});
export const visualQa=(verdict='pass')=>({schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'human',name:'Deterministic test fixture',version:'fixture@1'},reviewedAt:'2026-10-13T00:00:00Z',verdict,screenshotRefs:['before/desktop.png','after/desktop.png'],findings:verdict==='fail'?[{id:'UNRESOLVED',title:'Fixture issue',observation:'Test-only regression',impact:4,confidence:'high',screenshotRefs:['after/desktop.png']}]:[],rationale:'Test-only record to verify judgment gates.',limitations:['Fixture, not a model assessment.']});
async function fixture(t,mode='review'){
 const root=await mkdtemp(join(tmpdir(),'primary-action-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'.harness','runs'),{recursive:true});
 const run=await createRun({spec,url:'http://127.0.0.1:4321',mode,outputRoot:join(root,'.harness','runs'),id:'stage-test'});
 for(const phase of ['before','after']){await mkdir(join(run.directory,phase));await writeFile(join(run.directory,phase,'desktop.png'),'fixture');}
 const specPath=join(root,'experience.json'),configPath=join(root,'project.json');await writeFile(specPath,JSON.stringify(spec));await writeFile(configPath,JSON.stringify({version:'0.1',spec:specPath,repo:root,url:'http://127.0.0.1:4321',mode}));
 const service=createWorkbench(root,{inspectRepository:async()=>({root,commit:'a'.repeat(40),dirty:false}),previewReachable:async()=>false});t.after(()=>service.close());await service.bind(run.manifest.id,configPath);
 if(mode==='review'){await saveCapture(run.directory,'before',capture('before'));await saveDiagnosis(run.directory,{schemaVersion:'0.1',evaluatorVersion:'fixture@1',experienceScore:{status:'insufficient-evidence'},findings:[{id:'TEST_FINDING',title:'Fixture action',evidenceRefs:['E'],impact:3,confidence:4,effort:1,priority:12,verificationStatus:'review-target',proposal:'Make the action name explicit'}],evidence:[{id:'E',source:'before/desktop.png',type:'browser-capture'}]});}
 return {service,run,root};
}
async function terminal(service,job){for(let i=0;i<400;i++){const next=await service.jobs.get(job.id);if(!['queued','running','cancelling'].includes(next.status))return next;await new Promise(r=>setTimeout(r,10));}throw Error('Timed out');}
async function advance(service,stage,extra={}){const job=await service.advance({runId:'stage-test',expectedStage:stage,...extra});const final=await terminal(service,job);assert.equal(final.status,'succeeded',final.error);return final;}
async function planned(t){const result=await fixture(t);await advance(result.service,'awaiting-confirmation',{confirmed:true,findingId:'TEST_FINDING',note:'Make the fixture action explicit'});return result;}

test('every reachable workflow stage has exactly one translated primary action',()=>{
 const stages=['needs-baseline','needs-diagnosis','awaiting-confirmation','needs-plan','needs-execution','needs-after-capture','needs-structural-evaluation','needs-visual-qa','awaiting-judgment','complete','onboarding-failed','finding-stale','execution-failed','boundary-breached','visual-qa-needs-evidence','visual-qa-failed','needs-absent-baseline','needs-foundation-approval','needs-first-render-plan'];
 for(const stage of stages){const action=primaryActionForStage(stage);assert.equal(action.stage,stage);assert.ok(action.kind);assert.ok(messages[action.label],action.label);assert.ok(messages[action.description],action.description);}
 assert.equal(primaryActionForStage('unknown'),null);
});
test('scope confirmation prepares a durable plan without executing; action overrides cannot bypass approval',async t=>{
 const {service}=await fixture(t);
 await assert.rejects(service.advance({runId:'stage-test',expectedStage:'needs-execution',confirmed:true}),/stage changed/);
 await assert.rejects(service.advance({runId:'stage-test',expectedStage:'awaiting-confirmation',findingId:'TEST_FINDING',note:'fixture'}),/scope confirmation/);
 await advance(service,'awaiting-confirmation',{confirmed:true,findingId:'TEST_FINDING',note:'Make action explicit',action:'execute'});
 assert.equal((await service.state('stage-test')).workflow.stage,'needs-execution');assert.equal((await service.localRun('stage-test')).manifest.execution,null);
 await assert.rejects(service.advance({runId:'stage-test',expectedStage:'needs-plan',findingId:'INVENTED',action:'execute'}),/stage changed/);
 const current=await service.localRun('stage-test');assert.equal(current.manifest.findingId,'TEST_FINDING');assert.equal(current.manifest.execution,null);
 await assert.rejects(service.advance({runId:'stage-test',expectedStage:'needs-execution',findingId:'TEST_FINDING'}),/Explicit plan/);
});
test('simultaneous submissions create one task and stale queued actions cannot mutate evidence',async t=>{
 const {service,run}=await fixture(t);let release;const blocker=await service.jobs.start({kind:'fixture-blocker'},()=>new Promise(r=>{release=r;}));
 while(!release)await new Promise(r=>setTimeout(r,5));
 const input={runId:'stage-test',expectedStage:'awaiting-confirmation',confirmed:true,findingId:'TEST_FINDING',note:'Fixture confirmation'};
 const requests=await Promise.allSettled([service.advance(input),service.advance(input)]);
 assert.equal(requests.filter(r=>r.status==='fulfilled').length,1);
 const job=requests.find(r=>r.status==='fulfilled').value;
 await assert.rejects(service.advance(input),/already running/);
 const manifest=JSON.parse(await readFile(join(run.directory,'run.json'),'utf8'));manifest.onboarding={status:'failed',error:'Fixture changed stage'};await writeFile(join(run.directory,'run.json'),JSON.stringify(manifest));
 release();await terminal(service,blocker);const final=await terminal(service,job);assert.equal(final.status,'failed');assert.match(final.error,/stage changed/);assert.equal((await service.localRun('stage-test')).manifest.confirmation,null);
});
test('structural evaluation never invents QA or a human decision; failed QA allows only rejection',async t=>{
 const {service,run}=await planned(t);await saveExecution(run.directory,{exitCode:0});await saveCapture(run.directory,'after',capture('after'));
 await advance(service,'needs-structural-evaluation');assert.equal((await service.state('stage-test')).workflow.stage,'needs-visual-qa');
 await saveVisualReview(run.directory,visualQa('fail'));
 await assert.rejects(service.advance({runId:'stage-test',expectedStage:'visual-qa-failed',decision:'accept',reason:'Fixture'}),/only allows rejection/);
 await assert.rejects(service.advance({runId:'stage-test',expectedStage:'visual-qa-failed',decision:'reject',reason:''}),/reason is required/);
 await advance(service,'visual-qa-failed',{decision:'reject',reason:'Test-only rejected regression'});assert.equal((await service.state('stage-test')).workflow.stage,'complete');
 await assert.rejects(service.advance({runId:'stage-test',expectedStage:'complete'}),/Explicit plan or source/);
});
test('passing QA waits for an explicit decision and reason',async t=>{
 const {service,run}=await planned(t);await saveExecution(run.directory,{exitCode:0});await saveCapture(run.directory,'after',capture('after'));await advance(service,'needs-structural-evaluation');await saveVisualReview(run.directory,visualQa());
 assert.equal((await service.state('stage-test')).workflow.stage,'awaiting-judgment');assert.equal((await service.localRun('stage-test')).manifest.judgment,null);
 await assert.rejects(service.advance({runId:'stage-test',expectedStage:'awaiting-judgment',reason:'Fixture'}),/Choose accept or reject/);
 await advance(service,'awaiting-judgment',{decision:'accept',reason:'Test-only acceptance'});
});
test('bootstrap uses absence and explicit foundation approval instead of confirming an invented finding',async t=>{
 const {service,run}=await fixture(t,'bootstrap');await advance(service,'needs-absent-baseline',{reason:'Test fixture has no initial page'});
 await assert.rejects(service.advance({runId:'stage-test',expectedStage:'needs-foundation-approval',action:'plan'}),/foundation form/);
 const foundation=structuredClone(spec.designFoundation);foundation.status='approved';for(const entry of [...foundation.tokens,...foundation.components,...foundation.patterns,...foundation.brand.assets])entry.status='approved';
 await saveFoundationApproval(run.directory,{schemaVersion:'0.1',foundationVersion:'1.0.0',reviewer:{type:'human',name:'Test fixture'},reason:'Fixture only',foundation});
 await advance(service,'needs-first-render-plan',{findingId:'INVENTED'});assert.equal((await service.localRun('stage-test')).manifest.findingId,null);
 await saveCapture(run.directory,'after',capture('after'));await advance(service,'needs-structural-evaluation');assert.equal((await service.localRun('stage-test')).manifest.evaluation.kind,'first-render');
});
test('unconnected local records cannot be changed through the primary action endpoint',async t=>{
 const {service,root}=await fixture(t);await rm(join(root,'.harness','workbench-projects','stage-test.json'));
 await assert.rejects(service.advance({runId:'stage-test',expectedStage:'awaiting-confirmation',confirmed:true,findingId:'TEST_FINDING',note:'Fixture'}),/no local project connection/);
});

test('reconnecting preserves the complete capture plan, routes and startup environment',async t=>{
 const {service,root}=await fixture(t);
 const planPath=join(root,'capture-plan.json'),configPath=join(root,'project.json');
 const plan={schemaVersion:'0.1',adapter:'web',configurations:[{id:'desktop',viewport:{width:1280,height:800}}],states:[{id:'home',start:{url:'http://127.0.0.1:4321/'},actions:[]}]};
 await writeFile(planPath,JSON.stringify(plan));const config=JSON.parse(await readFile(configPath,'utf8'));Object.assign(config,{capturePlan:'capture-plan.json',routes:['/'],browser:'chrome',timeoutMs:45000,start:{command:'node',args:['preview.mjs'],env:{FIXTURE_ENV:'retained'},cwd:root}});await writeFile(configPath,JSON.stringify(config));
 const connected=await service.configure({runId:'stage-test',repo:root,url:'http://127.0.0.1:4321/',start:{command:'node',args:['fixed-preview.mjs']}});
 const next=await loadProjectConfig(connected.configPath);assert.deepEqual(next.capturePlanDocument,plan);assert.equal(next.capturePlanPath,planPath);assert.deepEqual(next.routes,['/']);assert.equal(next.timeoutMs,45000);assert.deepEqual(next.start.env,{FIXTURE_ENV:'retained'});assert.deepEqual(next.start.args,['fixed-preview.mjs']);
});
test('pending bootstrap control records never masquerade as captured evidence',async t=>{
 const {run,root}=await fixture(t,'bootstrap');
 await assert.rejects(exportRun({directory:run.directory,outputRoot:join(root,'strict-export')}),/Nothing to publish/);
 const result=await exportRun({directory:run.directory,outputRoot:join(root,'pending-export'),allowPendingBootstrap:true});
 assert.deepEqual(result.summary.captured,{before:false,after:false});assert.equal(result.summary.executed,false);assert.equal(result.summary.judgment,null);
});
