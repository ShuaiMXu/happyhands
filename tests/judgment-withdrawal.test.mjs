import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {createRun,loadRun,saveOnboarding,saveCapture,confirmFinding,savePlan,saveEvaluation,saveVisualReview,saveJudgment,withdrawJudgment} from '../packages/harness-core/store.js';
import {workflowState} from '../packages/harness-core/workflow.js';
import {projectMemory} from '../packages/workbench/memory.js';
import {stageProjectMemory,verifyProjectMemory} from '../packages/harness-core/project-memory.js';
import {createWorkbench} from '../packages/workbench/service.js';
import {exportRun} from '../packages/harness-core/export.js';
import {executeSkill} from '../packages/skill-core/runner.js';
import {incrementalReviewPlan} from '../packages/harness-core/incremental.js';
import {createServer} from 'node:http';
import {workbenchServicePlugin} from '../packages/workbench/service.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'judgment-withdrawal-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const repo=join(root,'project'),runs=join(root,'.harness','runs');await mkdir(repo);await mkdir(runs,{recursive:true});
  const run=await createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:runs,id:'judged-run'});
  await saveOnboarding(run.directory,{repository:{root:repo}});
  for(const phase of ['before','after']){
    await mkdir(join(run.directory,phase));await writeFile(join(run.directory,phase,'desktop.png'),png);
    await saveCapture(run.directory,phase,{viewports:{desktop:{width:1280,height:800,status:200,screenshot:`${phase}/desktop.png`,dom:{h1:['Fixture'],actions:[],horizontalOverflow:false}}}});
    if(phase==='before'){await confirmFinding(run.directory,'F1','supported','Synthetic confirmation');await savePlan(run.directory,'F1');}
  }
  await saveEvaluation(run.directory,{status:'fixture'});
  await saveVisualReview(run.directory,{schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'model',name:'Synthetic fixture, not actual model QA',version:'test'},reviewedAt:new Date().toISOString(),verdict:'pass',screenshotRefs:['before/desktop.png','after/desktop.png'],findings:[],rationale:'Synthetic fixture only',limitations:['No real product was assessed']});
  await saveJudgment(run.directory,'accept','Synthetic test decision only');
  return {root,repo,run:await loadRun(run.directory)};
}
test('withdrawal preserves the original decision and evidence and prevents reassessment in place',async t=>{
  const {run}=await fixture(t),before=await readFile(join(run.directory,'experience.json'),'utf8');
  assert.equal(workflowState(run.manifest).stage,'complete');
  await assert.rejects(withdrawJudgment(run.directory,''),/reason/);
  await withdrawJudgment(run.directory,'Prior scope was incomplete');
  const changed=await loadRun(run.directory);assert.deepEqual(changed.manifest.judgment,run.manifest.judgment);
  assert.equal(changed.manifest.judgmentWithdrawal.reason,'Prior scope was incomplete');
  assert.equal(workflowState(changed.manifest).stage,'judgment-withdrawn');
  assert.equal(incrementalReviewPlan({...changed,manifest:{...changed.manifest,execution:{changedFiles:['src/Button.tsx']}}},sample.designFoundation).mode,'full');
  const learned=await executeSkill({id:'judgment-distiller',directory:run.directory});
  assert.equal(learned.status,'needs-evidence');assert.deepEqual(learned.proposedUpdates,[]);
  assert.equal(await readFile(join(run.directory,'experience.json'),'utf8'),before);
  await assert.rejects(withdrawJudgment(run.directory,'Overwrite'),/already been withdrawn/);
  await assert.rejects(saveJudgment(run.directory,'reject','Overwrite'),/already has a judgment/);
});
test('withdrawing a source decision excludes derived principles and invalidates later plans',async t=>{
  const {root,repo,run}=await fixture(t),memory=projectMemory(root,await realpath(repo));
  const proposal={principle:'Use outcome labels',context:'Review screens',reason:'Synthetic prior feedback'};
  const approved=await memory.propose(run,proposal),candidate=await memory.propose(run,proposal);
  await memory.decide({id:approved.id,decision:'approve',reason:'Synthetic review'});
  const later=await createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:join(root,'.harness','runs'),id:'later-run'});
  await saveOnboarding(later.directory,{repository:{root:repo}});
  const connected=await loadRun(later.directory),reference=await stageProjectMemory(connected);connected.manifest.plan={projectMemory:reference};
  assert.equal((await verifyProjectMemory(connected,repo)).entries.length,1);
  await withdrawJudgment(run.directory,'Source decision withdrawn');
  assert.deepEqual(await memory.active(),[]);
  const records=await memory.list();assert.equal(records.find(item=>item.id===approved.id).review.decision,'approve');assert.ok(records.every(item=>item.status==='source-withdrawn'));
  await assert.rejects(memory.propose(run,proposal),/withdrawn judgment/);
  await assert.rejects(memory.decide({id:candidate.id,decision:'approve',reason:'Too late'}),/source judgment was withdrawn/);
  await assert.rejects(verifyProjectMemory(connected,repo),/Project memory changed/);
  await rm(join(run.directory,'judgment-withdrawal.json'));
  await assert.rejects(memory.active(),/withdrawal artifact is missing/);
  await assert.rejects(loadRun(run.directory),/withdrawal artifact is missing/);
});
test('the immutable withdrawal remains authoritative when its manifest mirror is stale',async t=>{
  const {run}=await fixture(t);await withdrawJudgment(run.directory,'Interrupted update fixture');
  await writeFile(join(run.directory,'run.json'),JSON.stringify(run.manifest));
  assert.equal(workflowState((await loadRun(run.directory)).manifest).stage,'judgment-withdrawn');
  const record=JSON.parse(await readFile(join(run.directory,'judgment-withdrawal.json')));record.judgmentHash='0'.repeat(64);
  await writeFile(join(run.directory,'judgment-withdrawal.json'),JSON.stringify(record));
  await assert.rejects(loadRun(run.directory),/Invalid judgment withdrawal/);
});
test('legacy runs without a judgment field remain readable but cannot be withdrawn',async t=>{
  const {root}=await fixture(t);
  const run=await createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:join(root,'.harness','runs'),id:'legacy-run'});
  delete run.manifest.judgment;await writeFile(join(run.directory,'run.json'),JSON.stringify(run.manifest));
  assert.equal((await loadRun(run.directory)).manifest.id,'legacy-run');
  await assert.rejects(withdrawJudgment(run.directory,'No decision'),/recorded human judgment is required/);
});
test('local service can withdraw old judgments without a live repository binding and exports withdrawn status',async t=>{
  const {root,run}=await fixture(t),service=createWorkbench(root);t.after(()=>service.close());
  const result=await service.withdrawDecision({runId:run.manifest.id,reason:'Reassess after new requirements'});
  assert.equal(result.exportError,null);
  const exported=JSON.parse(await readFile(join(root,'public','runs',run.manifest.id,'run.json')));
  assert.equal(exported.judgment.decision,'accept');assert.ok(exported.judgmentWithdrawal);
  const index=JSON.parse(await readFile(join(root,'public','runs','index.json')));
  assert.equal(index.runs[0].judgment,'withdrawn');assert.equal(index.runs[0].originalJudgment,'accept');
  assert.equal((await service.state(run.manifest.id)).workflow.stage,'judgment-withdrawn');
  const copy=await exportRun({directory:run.directory,outputRoot:join(root,'another-export')});
  assert.ok(copy.files.includes('judgment-withdrawal.json'));
});

test('withdrawal endpoint enforces origin, reason and local run identity',async t=>{
  const {root,run}=await fixture(t);let middleware;
  const server=createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));
  workbenchServicePlugin(root).configureServer({middlewares:{use(fn){middleware=fn;}},httpServer:server});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}/api/workbench/withdraw-judgment`;
  const post=(input,extra={})=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(input)});
  assert.equal((await post({runId:run.manifest.id,reason:'Blocked origin'},{Origin:'https://example.invalid'})).status,403);
  assert.equal((await post({runId:run.manifest.id,reason:''})).status,400);
  assert.equal((await post({runId:'../outside',reason:'Wrong source'})).status,400);
  assert.equal((await loadRun(run.directory)).manifest.judgmentWithdrawal,undefined);
  const response=await post({runId:run.manifest.id,reason:'Explicit fixture withdrawal'});assert.equal(response.status,200);
  assert.equal((await response.json()).withdrawal.reason,'Explicit fixture withdrawal');
});
