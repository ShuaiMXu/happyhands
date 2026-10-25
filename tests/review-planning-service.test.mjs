import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createWorkbench} from '../packages/workbench/service.js';import {createRun,saveOnboarding} from '../packages/harness-core/store.js';import {reviewCandidates} from '../packages/harness-core/review-discovery.js';import {configurationsForState} from '../packages/harness-core/capture-state.js';import {createHash} from 'node:crypto';
const commit='a'.repeat(40),url='http://127.0.0.1:4321/';
async function fixture(t,overrides={}){
 const root=await mkdtemp(join(tmpdir(),'review-planning-')),repo=join(root,'app');await mkdir(repo);t.after(()=>rm(root,{recursive:true,force:true}));
 const spec={version:'0.1',project:{name:'Planning fixture',source:repo,goal:'Check pages',audience:'Developers',task:'Use menu'},evidence:[],findings:[],review:{status:'not-started',before:'',after:'',judgment:'pending',reason:''}};
 const configPath=join(root,'project.json');await writeFile(join(root,'experience.json'),JSON.stringify(spec));await writeFile(configPath,JSON.stringify({version:'0.1',spec:'experience.json',repo,url,start:{command:'npm',args:['run','dev']}}));
 await mkdir(join(root,'.harness','runs'),{recursive:true});
 const run=await createRun({spec,url,outputRoot:join(root,'.harness','runs'),id:'parent-run'});await saveOnboarding(run.directory,{status:'ready',repository:{root:repo,commit,dirty:false},config:{configPath},configDigest:createHash('sha256').update(await readFile(configPath)).digest('hex')});
 const calls={spawn:0,stop:0,capture:0},child={exitCode:null,signalCode:null,killed:false};let repository={root:repo,commit,dirty:false};
 const configurations=[{id:'mobile',viewport:{width:390,height:844}}];
 const service=createWorkbench(root,{
  inspectRepository:async()=>repository,fetch:async()=>{throw Error('No preview');},previewReachable:async()=>false,
  spawnPreview:()=>{calls.spawn++;return child;},stopPreview:value=>{if(value)calls.stop++;},waitForPreview:async()=>({status:200}),previewResponseFingerprint:async()=> 'f'.repeat(64),
  discoverReviewTargets:async()=>({...reviewCandidates([{url,configurationId:'mobile',title:'Home',controls:[{selector:'#menu',name:'Menu',expanded:'false',targetSelector:'#nav'}]}],url),url,configurations}),
  captureBrowserPlan:async({plan,directory,phase})=>{
    calls.capture++;await mkdir(join(directory,phase));const states=[];
    for(const state of plan.states)for(const configuration of configurationsForState(plan,state)){const screenshot=phase+'/'+state.id+'--'+configuration.id+'.png';await writeFile(join(directory,screenshot),'fixture only');states.push({...configuration.viewport,stateId:state.id,configurationId:configuration.id,start:state.start,actions:state.actions,captureMode:state.captureMode||'viewport',reached:true,screenshot,dom:{h1:['Fixture'],controls:[],actions:[],headings:[],horizontalOverflow:false}});}
    return {schemaVersion:'0.1',states};
  },...overrides
 });t.after(()=>service.close());return {root,run,service,calls,configPath,setRepository:value=>{repository=value;}};
}
async function finish(service,id){for(let n=0;n<300;n++){const job=await service.jobs.get(id);if(!['queued','running','cancelling'].includes(job.status))return job;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Timed out');}
async function discover(f){const job=await finish(f.service,(await f.service.discoverPlan({runId:'parent-run'})).id);assert.equal(job.status,'succeeded',job.error);return job.result.proposal;}
test('discovery is source-bound, stops owned preview and does not mutate parent evidence',async t=>{
 const f=await fixture(t),before=await readFile(join(f.run.directory,'run.json')),proposal=await discover(f);
 assert.equal(proposal.sourceCommit,commit);assert.equal(f.calls.capture,0);assert.equal(f.calls.spawn,1);assert.equal(f.calls.stop,1);assert.deepEqual(await readFile(join(f.run.directory,'run.json')),before);
});
test('confirming selected scope creates a fresh baseline via existing onboarding, without execution or judgment',async t=>{
 const f=await fixture(t),proposal=await discover(f),input={runId:'parent-run',proposalId:proposal.id,selectedIds:[proposal.candidates[1].id]};
 await assert.rejects(f.service.confirmReviewPlan(input),/Explicitly confirm/);
 await assert.rejects(f.service.confirmReviewPlan({...input,selectedIds:['invented'],confirmed:true}),/Unknown/);
 const before=await readFile(join(f.run.directory,'run.json'));
 const job=await finish(f.service,(await f.service.confirmReviewPlan({...input,confirmed:true})).id);assert.equal(job.status,'succeeded',job.error);
 const next=await f.service.localRun(job.result.runId);assert.notEqual(next.manifest.id,'parent-run');assert.equal(next.manifest.onboarding.parentRunId,'parent-run');assert.equal(next.manifest.execution,null);assert.equal(next.manifest.judgment,null);assert.equal(next.manifest.confirmation,null);
 assert.equal(next.manifest.captures.before.states.length,2);assert.equal(next.manifest.onboarding.config.reviewPlanApproval.proposalId,proposal.id);assert.match(next.manifest.onboarding.config.capturePlanDigest,/^[a-f0-9]{64}$/);assert.deepEqual(await readFile(join(f.run.directory,'run.json')),before);
 // A mutated plan cannot be silently used by subsequent execution or discovery.
 const path=next.manifest.onboarding.config.capturePlan;await writeFile(path,(await readFile(path,'utf8'))+' ');
 await assert.rejects(f.service.discoverPlan({runId:next.manifest.id}),/Capture plan changed/);
});
test('source drift, another parent and config edits invalidate a saved proposal',async t=>{
 const f=await fixture(t),proposal=await discover(f),input={runId:'parent-run',proposalId:proposal.id,selectedIds:[proposal.candidates[0].id],confirmed:true};
 f.setRepository({root:join(f.root,'app'),commit:'b'.repeat(40),dirty:false});await assert.rejects(f.service.confirmReviewPlan(input),/source changed/);
 f.setRepository({root:join(f.root,'app'),commit,dirty:false});const record=join(f.root,'.harness','review-plans',proposal.id+'.json');await writeFile(record,JSON.stringify({...proposal,runId:'other-run'}));await assert.rejects(f.service.confirmReviewPlan(input),/stale|another/);
 await writeFile(record,JSON.stringify(proposal));await writeFile(f.configPath,(await readFile(f.configPath,'utf8'))+' ');await assert.rejects(f.service.confirmReviewPlan(input),/configuration changed/);
});
test('busy jobs cannot discover or confirm a different plan in the same run',async t=>{
 const f=await fixture(t),proposal=await discover(f);let release;const pending=await f.service.jobs.start({runId:'parent-run'},()=>new Promise(resolve=>{release=resolve;}));while(!release)await new Promise(resolve=>setTimeout(resolve,5));
 await assert.rejects(f.service.discoverPlan({runId:'parent-run'}),/already running/);await assert.rejects(f.service.confirmReviewPlan({runId:'parent-run',proposalId:proposal.id,selectedIds:[proposal.candidates[0].id],confirmed:true}),/already running/);release();await finish(f.service,pending.id);
});

test('changing a newly confirmed capture plan while queued fails without publishing its replacement',async t=>{
 const f=await fixture(t),proposal=await discover(f);let release;const holding=await f.service.jobs.start({},()=>new Promise(resolve=>{release=resolve;}));while(!release)await new Promise(resolve=>setTimeout(resolve,5));
 const pending=await f.service.confirmReviewPlan({runId:'parent-run',proposalId:proposal.id,selectedIds:[proposal.candidates[0].id],confirmed:true});
 const config=JSON.parse(await readFile(pending.configPath));const path=join(pending.configPath,'..',config.capturePlan);await writeFile(path,(await readFile(path,'utf8'))+' ');release();await finish(f.service,holding.id);
 const result=await finish(f.service,pending.id);assert.equal(result.status,'failed');assert.match(result.error,/Capture plan changed/);assert.equal(f.calls.capture,0);
});

test('a port returning 404 is occupied and cannot supply discovery evidence from an unowned preview',async t=>{
 const f=await fixture(t,{fetch:async()=>new Response('Old server',{status:404})});const result=await finish(f.service,(await f.service.discoverPlan({runId:'parent-run'})).id);
 assert.equal(result.status,'failed');assert.match(result.error,/already in use/);assert.equal(f.calls.spawn,0);assert.equal(result.result,undefined);
});
