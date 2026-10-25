import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { EventEmitter } from 'node:events';
import { createJobs, runLocal } from '../packages/workbench/jobs.js';
import { createWorkbench, managedPreviewVersionStatus, previewResponseFingerprint, previewSourceStatus, workbenchServicePlugin } from '../packages/workbench/service.js';
import { resolveCanvasTarget } from '../packages/workbench/cowart-storage.js';
import { createRun, saveOnboarding } from '../packages/harness-core/store.js';
const spec = JSON.parse(await readFile(new URL('../examples/happyclaw-site/experience.json',import.meta.url),'utf8'));
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'workbench-service-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'.harness','runs'),{recursive:true});await createRun({spec,url:'http://localhost:4321',outputRoot:join(root,'.harness','runs'),id:'test-run'});const base=join(root,'public','runs','test-run');await mkdir(join(base,'before'),{recursive:true});await writeFile(join(base,'before','desktop.png'),'screenshot');await writeFile(join(base,'run.json'),JSON.stringify({id:'test-run',captures:{before:{viewports:{desktop:{screenshot:'before/desktop.png',width:100,height:100}}}}}));return root;}
async function terminal(jobs,id){for(let n=0;n<300;n++){const job=await jobs.get(id);if(!['queued','running'].includes(job.status))return job;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error('Job did not finish');}

test('durable tasks serialize, retain results and can be reread after restart',async t=>{const root=await fixture(t),jobs=createJobs(root),order=[];const first=await jobs.start({kind:'test'},async()=>{order.push(1);await new Promise(resolve=>setTimeout(resolve,30));order.push(2);return {answer:42};});const second=await jobs.start({kind:'test'},async()=>{order.push(3);});assert.equal((await terminal(jobs,second.id)).status,'succeeded');assert.deepEqual(order,[1,2,3]);assert.equal((await createJobs(root).get(first.id)).result.answer,42);});
test('cancelling a queued job never starts its operation',async t=>{const root=await fixture(t),jobs=createJobs(root);const first=await jobs.start({},()=>new Promise(resolve=>setTimeout(resolve,50)));let ran=false;const second=await jobs.start({},async()=>{ran=true;});await jobs.cancel(second.id);assert.equal((await terminal(jobs,second.id)).status,'cancelled');assert.equal(ran,false);await terminal(jobs,first.id);});
test('process cancellation stops execution rather than reporting success',async t=>{const root=await fixture(t),controller=new AbortController();const pending=runLocal(process.execPath,['-e','setInterval(()=>{},1000)'],{cwd:root,signal:controller.signal});setTimeout(()=>controller.abort(),80);await assert.rejects(pending,/Cancelled/);});
test('restarted service marks persisted running tasks interrupted',async t=>{const root=await fixture(t),id='00000000-0000-0000-0000-000000000001',directory=join(root,'.harness','workbench-jobs',id);await mkdir(directory,{recursive:true});await writeFile(join(directory,'job.json'),JSON.stringify({id,status:'running',createdAt:'2026-01-01'}));assert.equal((await createJobs(root).get(id)).status,'interrupted');});
test('local runs cannot escape the run root',async t=>{const service=createWorkbench(await fixture(t));await assert.rejects(service.localRun('../test-run'),/Invalid run/);});
test('missing source association blocks execution instead of using the workbench repository',async t=>{const service=createWorkbench(await fixture(t));await assert.rejects(service.action({runId:'test-run',action:'execute',confirmed:true}),/no local project connection/);const state=await service.state('test-run');assert.equal(state.project,null);});
test('an exported run without a local project connection exposes a read-only foundation workspace',async t=>{const service=createWorkbench(await fixture(t));assert.deepEqual(await service.foundationWorkspace('test-run'),{available:false,refreshAvailable:false,entries:[]});await assert.rejects(service.foundationWorkspace('../test-run'),/Invalid run/);});
test('preview source provenance distinguishes matching, drifted and dirty repositories',()=>{
 const commit='a'.repeat(40),manifest={onboarding:{repository:{commit}}};
 assert.equal(previewSourceStatus({commit,dirty:false},manifest),'source-match');
 assert.equal(previewSourceStatus({commit:'b'.repeat(40),dirty:false},manifest),'source-mismatch');
 assert.equal(previewSourceStatus({commit,dirty:true},manifest),'dirty');
 assert.equal(previewSourceStatus({commit,dirty:false},{onboarding:{}}),'unverified');
});
test('managed preview fingerprint binds the entry response and invalidates on any change',async()=>{
 const request=async()=>new Response('<main>review</main>',{status:200,headers:{'content-type':'text/html'}});
 const first=await previewResponseFingerprint('http://127.0.0.1:4000/',request),second=await previewResponseFingerprint('http://127.0.0.1:4000/',request);
 assert.match(first,/^[a-f0-9]{64}$/);assert.equal(first,second);
 assert.notEqual(first,await previewResponseFingerprint('http://127.0.0.1:4000/',async()=>new Response('<main>changed</main>',{status:200,headers:{'content-type':'text/html'}})));
});
test('managed preview verification fails closed for source, process and response drift',()=>{
 const commit='a'.repeat(40),repository={commit,dirty:false},manifest={onboarding:{repository:{commit}}},session={fingerprint:'f'.repeat(64),stopped:false};
 assert.equal(managedPreviewVersionStatus(repository,manifest,session,session.fingerprint),'verified');
 assert.equal(managedPreviewVersionStatus(repository,manifest,session,'e'.repeat(64)),'preview-changed');
 assert.equal(managedPreviewVersionStatus(repository,manifest,{...session,stopped:true},null),'preview-stopped');
 assert.equal(managedPreviewVersionStatus(repository,manifest,session,null),'preview-unavailable');
 assert.equal(managedPreviewVersionStatus({...repository,dirty:true},manifest,session,session.fingerprint),'dirty');
});
test('workbench reports an unreachable unmanaged preview instead of exposing a dead live page',async t=>{
 const root=await fixture(t),runDirectory=join(root,'.harness','runs','test-run'),commit='a'.repeat(40),configPath=join(root,'project.json'),specPath=join(root,'project-spec.json');
 await writeFile(specPath,JSON.stringify(spec));
 await writeFile(configPath,JSON.stringify({version:'0.1',spec:specPath,repo:root,url:'http://127.0.0.1:43118/',mode:'review',start:{command:'npm',args:['run','dev']}}));
 await mkdir(join(root,'.harness','workbench-projects'),{recursive:true});await writeFile(join(root,'.harness','workbench-projects','test-run.json'),JSON.stringify({configPath}));
 await saveOnboarding(runDirectory,{status:'ready',repository:{root,commit,dirty:false}});
 const service=createWorkbench(root,{inspectRepository:async()=>({root,commit,dirty:false}),previewReachable:async()=>false});
 const state=await service.state('test-run');
 assert.equal(state.project.preview.sourceStatus,'source-match');
 assert.equal(state.project.preview.versionStatus,'preview-unavailable');
 assert.equal(state.project.preview.reachable,false);
 service.close();
});
test('a reachable unmanaged preview still exposes source drift instead of claiming a valid live page',async t=>{
 const root=await fixture(t),runDirectory=join(root,'.harness','runs','test-run'),captured='a'.repeat(40),current='b'.repeat(40),configPath=join(root,'project.json'),specPath=join(root,'project-spec.json');
 await writeFile(specPath,JSON.stringify(spec));
 await writeFile(configPath,JSON.stringify({version:'0.1',spec:specPath,repo:root,url:'http://127.0.0.1:43119/',mode:'review'}));
 await mkdir(join(root,'.harness','workbench-projects'),{recursive:true});await writeFile(join(root,'.harness','workbench-projects','test-run.json'),JSON.stringify({configPath}));
 await saveOnboarding(runDirectory,{status:'ready',repository:{root,commit:captured,dirty:false}});
 const service=createWorkbench(root,{inspectRepository:async()=>({root,commit:current,dirty:false}),previewReachable:async()=>true});
 const state=await service.state('test-run');
 assert.equal(state.project.preview.sourceStatus,'source-mismatch');
 assert.equal(state.project.preview.versionStatus,'source-mismatch');
 assert.equal(state.project.preview.reachable,true);
 service.close();
});
test('workbench owns managed preview start, fingerprint and stop lifecycle',async t=>{
 const root=await fixture(t),runDirectory=join(root,'.harness','runs','test-run'),commit='a'.repeat(40),configPath=join(root,'project.json'),specPath=join(root,'project-spec.json');
 await writeFile(specPath,JSON.stringify(spec));
 await writeFile(configPath,JSON.stringify({version:'0.1',spec:specPath,repo:root,url:'http://127.0.0.1:43117/',mode:'review',start:{command:'npm',args:['run','dev']}}));
 await mkdir(join(root,'.harness','workbench-projects'),{recursive:true});await writeFile(join(root,'.harness','workbench-projects','test-run.json'),JSON.stringify({configPath}));
 await saveOnboarding(runDirectory,{status:'ready',repository:{root,commit,dirty:false}});
 const child=Object.assign(new EventEmitter(),{exitCode:null,signalCode:null,pid:12345,killed:false});let stopped=false;
 const service=createWorkbench(root,{inspectRepository:async()=>({root,commit,dirty:false}),spawnPreview:()=>child,stopPreview:()=>{stopped=true;child.killed=true;},waitForPreview:async()=>({status:200,finalUrl:'http://127.0.0.1:43117/'}),previewReachable:async()=>false,previewResponseFingerprint:async()=> 'f'.repeat(64)});
 assert.equal((await service.startPreview('test-run')).status,'started');
 const running=await service.state('test-run');assert.equal(running.project.preview.versionStatus,'verified');assert.equal(running.project.preview.managed,true);assert.equal(running.project.preview.fingerprint,'f'.repeat(64));
 assert.equal((await service.stopManagedPreview('test-run')).status,'stopped');assert.equal(stopped,true);assert.equal((await service.state('test-run')).project.preview.versionStatus,'preview-stopped');
 service.close();
});
test('code changes require explicit scope confirmation',async t=>{const service=createWorkbench(await fixture(t));await assert.rejects(service.sourceChange({runId:'test-run'}),/Confirm this change scope/);});
test('judgment is unavailable before the workflow reaches an evaluated independent review',async t=>{const service=createWorkbench(await fixture(t));await assert.rejects(service.action({runId:'test-run',action:'judge',decision:'accept',reason:'Test'}),/no local project connection|current review stage/);assert.equal((await service.localRun('test-run')).manifest.judgment,null);});
test('invented visual review cannot bypass validation',async t=>{const service=createWorkbench(await fixture(t));await assert.rejects(service.action({runId:'test-run',action:'attest',review:{verdict:'pass'}}));});
test('creative jobs verify fingerprint and actual output before success',async t=>{const root=await fixture(t);const service=createWorkbench(root,{generate:async()=>{}});const target=await resolveCanvasTarget(root,'test-run','before:page--desktop');await assert.rejects(service.create({kind:'image',runId:'test-run',captureId:'before:page--desktop',fingerprint:'stale',notes:'test'}),/Capture changed/);const job=await service.create({kind:'image',runId:'test-run',captureId:'before:page--desktop',fingerprint:target.source.fingerprint,notes:'test'});assert.equal((await terminal(service.jobs,job.id)).status,'failed');});
test('image edit refuses absent or malformed references',async t=>{const root=await fixture(t),service=createWorkbench(root),target=await resolveCanvasTarget(root,'test-run','before:page--desktop');const input={kind:'edit-image',runId:'test-run',captureId:'before:page--desktop',fingerprint:target.source.fingerprint,notes:'test'};await assert.rejects(service.create(input),/reference image/);await assert.rejects(service.create({...input,annotation:'data:image/png;base64,aGVsbG8='}),/Invalid PNG/);});
test('service rejects foreign origins, unsafe methods and non-JSON mutations',async t=>{const root=await fixture(t);let handler;const plugin=workbenchServicePlugin(root);const server=createServer((req,res)=>handler(req,res,()=>{res.statusCode=404;res.end();}));plugin.configureServer({middlewares:{use(fn){handler=fn;}},httpServer:server});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const base=`http://127.0.0.1:${server.address().port}`;assert.equal((await fetch(base+'/api/workbench/jobs',{headers:{Origin:'https://evil.example'}})).status,403);assert.equal((await fetch(base+'/api/workbench/action',{method:'POST',body:'{}'})).status,415);assert.equal((await fetch(base+'/api/workbench/action',{method:'DELETE'})).status,405);assert.equal((await fetch(base+'/api/workbench/artifact?job=../secret&file=artifact.html')).status,400);const foundation=await fetch(base+'/api/workbench/foundation-history?run=test-run');assert.equal(foundation.status,200);assert.deepEqual(await foundation.json(),{available:false,refreshAvailable:false,entries:[]});});

test('confirming a diagnosed issue retains its evidence and creates a plannable scope',async t=>{
  const root=await fixture(t),service=createWorkbench(root),run=await service.localRun('test-run');
  const {saveCapture,saveDiagnosis,confirmFinding,savePlan}=await import('../packages/harness-core/store.js');
  await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png'}}});
  await saveDiagnosis(run.directory,{schemaVersion:'0.1',evaluatorVersion:'test@1',experienceScore:{status:'insufficient-evidence'},findings:[{id:'DIAG',title:'Missing action name',evidenceRefs:['E'],impact:3,confidence:4,effort:1}],evidence:[{id:'E',source:'before/desktop.png',type:'browser-capture'}]});
  await assert.rejects(confirmFinding(run.directory,'DIAG','supported',''),/note/);
  assert.equal((await service.localRun('test-run')).spec.findings.some(item=>item.id==='DIAG'),false);
  await confirmFinding(run.directory,'DIAG','supported','Use a clear action label');
  await savePlan(run.directory,'DIAG');
  const updated=await service.localRun('test-run');
  assert.equal(updated.spec.findings.find(item=>item.id==='DIAG').proposal,'Use a clear action label');
  assert.equal(updated.manifest.plan.kind,'fix');
  const reuse=JSON.parse(await readFile(join(run.directory,'component-reuse-plan.json'),'utf8'));
  assert.equal(reuse.findingId,'DIAG');
  assert.equal(updated.manifest.plan.componentReuse.path,'component-reuse-plan.json');
  assert.deepEqual(reuse.observedNeedsReview,spec.designFoundation.components.filter(item=>item.status==='observed'));
  const brief=await readFile(join(run.directory,'codex-brief.md'),'utf8');
  assert.match(brief,/## Component reuse plan/);
  assert.ok(brief.includes(JSON.stringify(reuse,null,2)));
});

test('review foundations require a baseline, preserve a version and cannot be changed after planning',async t=>{
  const root=await fixture(t),service=createWorkbench(root),run=await service.localRun('test-run');
  const {saveCapture,saveFoundationApproval,confirmFinding,savePlan}=await import('../packages/harness-core/store.js');
  const foundation=structuredClone(spec.designFoundation);foundation.status='approved';
  for(const entry of [...foundation.tokens,...foundation.components,...foundation.patterns,...foundation.brand.assets])entry.status='approved';
  const approval={schemaVersion:'0.1',foundationVersion:'1.0.0',reviewer:{type:'human',name:'QA fixture'},reason:'Test only',foundation};
  await assert.rejects(saveFoundationApproval(run.directory,approval),/Capture/);
  await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png'}}});
  await saveFoundationApproval(run.directory,approval);
  await confirmFinding(run.directory,spec.findings[0].id,'supported','Fixture confirmation');
  await savePlan(run.directory,spec.findings[0].id);
  assert.match(await readFile(join(run.directory,'codex-brief.md'),'utf8'),/Approved Foundation version: 1.0.0/);
  await assert.rejects(saveFoundationApproval(run.directory,{...approval,foundationVersion:'2.0.0'}),/cannot change/);
});
