import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {discoverProject} from '../packages/workbench/project-setup.js';
import {createWorkbench} from '../packages/workbench/service.js';
import {saveExecution,loadRun} from '../packages/harness-core/store.js';
import {resolveCanvasTarget} from '../packages/workbench/cowart-storage.js';
import {autoExecuteDirection} from '../packages/workbench/direction-execution.js';
const command=promisify(execFile);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
async function terminal(service,job){for(let n=0;n<400;n++){const current=await service.jobs.get(job.id);if(!['queued','running','cancelling'].includes(current.status))return current;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Job timeout');}
async function fixture(t,{failed=false}={}){
 const root=await mkdtemp(join(tmpdir(),'simple-review-')),repo=join(root,'project');await mkdir(repo);
 t.after(()=>rm(root,{recursive:true,force:true}));
 await writeFile(join(repo,'package.json'),JSON.stringify({name:'actual-project',scripts:{dev:'astro dev'}}));
 await writeFile(join(repo,'index.html'),'<h1>First</h1><h1>Second</h1>');
 let executions=0,captures=0;
 const repository={root:repo,commit:'a'.repeat(40),dirty:false};
 const service=createWorkbench(root,{inspectRepository:async target=>({...repository,root:target||repo}),projectSetup:{port:async()=>43971},fetch:async()=>{throw Error('Port free');},spawnPreview:()=>({exitCode:null,signalCode:null,killed:false}),stopPreview:()=>{},waitForPreview:async()=>{},captureBrowser:async({directory,phase})=>{captures++;await mkdir(join(directory,phase),{recursive:true});await writeFile(join(directory,phase,'desktop.png'),png);return {viewports:{desktop:{screenshot:failed?undefined:`${phase}/desktop.png`,reached:!failed,width:1280,height:800,status:200,dom:{h1:['First','Second'],actions:[],controls:[],horizontalOverflow:false},...(failed?{error:'Fixture unavailable'}:{})}}};},execute:async({directory})=>{executions++;assert.match(await readFile(join(directory,'codex-brief.md'),'utf8'),/CANVAS|D1/);await saveExecution(directory,{exitCode:0,worktree:repo});},generate:async(_cmd,_args,{cwd})=>{const context=JSON.parse(await readFile(join(cwd,'review-context.json'),'utf8'));await writeFile(join(cwd,'review-result.json'),JSON.stringify({verdict:'pass',screenshotRefs:context.evidence.map(item=>item.reference),findings:[],rationale:'Test-only reviewed fixture.',limitations:['Deterministic fixture; not product acceptance.']}));}});
 t.after(()=>service.close());return {root,repo,repository,service,counts:()=>({executions,captures})};
}
test('discovery reads declared Vite/Astro scripts and a free local port without executing scripts',async t=>{
 const {repo,repository}=await fixture(t);
 const astro=await discoverProject(repository,{port:async()=>44001});assert.equal(astro.framework,'Astro');assert.equal(astro.url,'http://127.0.0.1:44001/');assert.deepEqual(astro.start.args,['run','dev','--','--ignore-lock','--host','127.0.0.1','--port','44001']);assert.equal(astro.dependenciesInstalled,false);
 await writeFile(join(repo,'package.json'),JSON.stringify({scripts:{dev:'vite'},packageManager:'pnpm@11.19.0'}));const vite=await discoverProject(repository,{port:async()=>44002});assert.equal(vite.framework,'Vite');assert.equal(vite.start.command,'pnpm');assert.equal(vite.start.args.includes('--'),false);
 await writeFile(join(repo,'package.json'),JSON.stringify({scripts:{dev:'astro dev && touch EXECUTED'}}));assert.equal((await discoverProject(repository)).detected,false);await assert.rejects(access(join(repo,'EXECUTED')),/ENOENT/);
});
test('unreadable package metadata and unsupported launchers remain manual rather than guessed',async t=>{
 const {repo,repository}=await fixture(t);await writeFile(join(repo,'package.json'),'broken');assert.equal((await discoverProject(repository)).detected,false);
 for(const pkg of [{scripts:{dev:'node server.js'}},{scripts:{dev:'astro dev --background'}},{scripts:{dev:'vite'},packageManager:'yarn@4.0.0'}]){await writeFile(join(repo,'package.json'),JSON.stringify(pkg));assert.equal((await discoverProject(repository)).detected,false);}
});
test('two-field onboarding captures and diagnoses automatically but never edits or invents an audience',async t=>{
 const {service,repo,counts}=await fixture(t);const task='A mobile user finds Quick start';const job=await service.configure({repo,task});const final=await terminal(service,job);assert.equal(final.status,'succeeded',final.error);
 const run=await service.localRun(final.result.runId);assert.equal(run.spec.project.task,task);assert.equal(run.spec.project.audience,'尚未指定目标用户');assert.ok(run.manifest.diagnosis);assert.ok(run.manifest.onboarding.foundationInventory);assert.equal(run.manifest.execution,null);assert.equal(run.manifest.judgment,null);assert.deepEqual(counts(),{executions:0,captures:1});
 assert.equal((await service.state(run.manifest.id)).workflow.stage,'awaiting-confirmation');
});
test('failed first capture preserves failure provenance and never emits a successful diagnosis',async t=>{
 const {service,repo,counts}=await fixture(t,{failed:true});const final=await terminal(service,await service.configure({repo,task:'Inspect the home page'}));assert.equal(final.status,'failed');assert.match(final.error,/No planned page state/);const run=await service.localRun(final.runId);assert.equal(run.manifest.onboarding.status,'failed');assert.equal(run.manifest.diagnosis,null);assert.equal(run.manifest.execution,null);assert.equal(counts().executions,0);
});
test('a screenshot request prepares a readable plan then uses the same explicitly approved execution and QA pipeline',async t=>{
 const {service,repo,root,counts}=await fixture(t);const first=await terminal(service,await service.configure({repo,task:'Inspect home'}));const parent=await service.localRun(first.result.runId);const target=await resolveCanvasTarget(root,parent.manifest.id,'before:page--desktop');
 const job=await service.sourceChange({runId:parent.manifest.id,captureId:'before:page--desktop',fingerprint:target.source.fingerprint,notes:'Make the main action clear.',confirmed:true});const planned=await terminal(service,job);assert.equal(planned.status,'succeeded',planned.error);assert.equal(planned.result.awaiting,'plan-confirmation');
 const run=await service.localRun(planned.result.runId);assert.equal((await service.state(run.manifest.id)).workflow.stage,'needs-execution');assert.equal(run.manifest.execution,null);assert.match(await readFile(join(run.directory,'codex-brief.md'),'utf8'),/Make the main action clear/);assert.equal(counts().executions,0);
 await assert.rejects(service.action({runId:run.manifest.id,action:'execute',findingId:'CANVAS'}),/Explicit plan/);
 const executed=await terminal(service,await service.advance({runId:run.manifest.id,expectedStage:'needs-execution',findingId:'CANVAS',confirmed:true}));assert.equal(executed.status,'succeeded',executed.error);const result=await loadRun(run.directory);assert.equal(result.manifest.visualReviews[0].verdict,'pass');assert.equal(result.manifest.judgment,null);assert.equal(counts().executions,1);assert.equal((await service.state(run.manifest.id)).workflow.stage,'awaiting-judgment');
});
test('legacy directions only adapt input to the shared plan preparation, without a second preview or edit loop',async t=>{
 const {root,repo}=await fixture(t);
 await command('git',['init','-q',repo]);await command('git',['-C',repo,'add','.']);await command('git',['-C',repo,'-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','Fixture']);
 const spec={version:'0.1',project:{name:'Fixture',goal:'Inspect',audience:'Fixture users',task:'Inspect home',source:repo},evidence:[],findings:[],review:{status:'not-started',before:'',after:'',judgment:'pending',reason:''}};
 await writeFile(join(root,'spec.json'),JSON.stringify(spec));await writeFile(join(root,'config.json'),JSON.stringify({version:'0.1',spec:'spec.json',repo,url:'http://127.0.0.1:43972/',start:{command:'npm',args:['run','dev']}}));await mkdir(join(root,'.harness'),{recursive:true});await writeFile(join(root,'.harness/direction-project.json'),JSON.stringify({reviewId:'fixture',configPath:join(root,'config.json')}));
 let prepared=0;const result=await autoExecuteDirection({root,task:{id:'test',reviewId:'fixture',projectSource:repo,decisions:{}},step:{id:'step',title:'Action clarity',proposal:'Clarify action',scope:'src/index.html',keep:'Current brand',acceptance:'Task is clearer'},signal:new AbortController().signal,update:async()=>{},prepare:async input=>{prepared++;assert.equal(input.findingId,'D1');assert.match(input.spec.findings[0].proposal,/Current brand/);assert.match(input.spec.findings[0].proposal,/Scope: src\/index.html/);assert.doesNotMatch(input.spec.findings[0].proposal,/ocean video|npm ci/);return {runId:'prepared',awaiting:'plan-confirmation'};}});assert.equal(prepared,1);assert.equal(result.awaiting,'plan-confirmation');
});

test('a running task prevents connection changes from invalidating its source and configuration',async t=>{
 const {service,repo,root}=await fixture(t);const first=await terminal(service,await service.configure({repo,task:'Inspect home'}));const runId=first.result.runId;const binding=(await service.localRun(runId)).manifest.onboarding.config.configPath;const before=await readFile(binding,'utf8');
 let release;const pending=await service.jobs.start({kind:'fixture-blocker',runId},()=>new Promise(resolve=>{release=resolve;}));while(!release)await new Promise(resolve=>setTimeout(resolve,5));
 try{await assert.rejects(service.configure({runId,repo,task:'A changed task'}),/already running/);assert.equal(await readFile(binding,'utf8'),before);}finally{release();await terminal(service,pending);}
});
test('reconnecting a different repository cannot reuse the previous project evidence or plan',async t=>{
 const {service,repo,root}=await fixture(t);const first=await terminal(service,await service.configure({repo,task:'Inspect home'}));const other=join(root,'different-project');await mkdir(other);
 await assert.rejects(service.configure({runId:first.result.runId,repo:other,url:'http://127.0.0.1:43980/',task:'Different task'}),/different repository/);
 const state=await service.state(first.result.runId);assert.equal(state.project.repository.root,repo);
});
