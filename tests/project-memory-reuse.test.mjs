import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {projectMemory} from '../packages/workbench/memory.js';
import {verifyProjectMemory,stageProjectMemory,readRunMemoryExceptions,projectMemoryDigest} from '../packages/harness-core/project-memory.js';
import {createRun,saveOnboarding,saveCapture,confirmFinding,savePlan,loadRun,saveRunMemoryException,beginExecutionContext} from '../packages/harness-core/store.js';
import {executeWithAgent} from '../packages/harness-core/runner.js';
import {exportRun} from '../packages/harness-core/export.js';
import {technicalProject} from './helpers/technical-project.mjs';
import {projectMemoryRegistry} from '../packages/harness-core/project-memory.js';
const exec=promisify(execFile);

test('approved scoped memory follows a verified source check across linked checkouts but excludes other tasks and projects',async t=>{
  const p=await technicalProject(t, {'feature.mjs':'export const label = ;'});
  const policy={kind:'node-syntax',file:'feature.mjs'};
  const run=await p.start({evidencePolicy:policy});
  const prior=await createRun({spec:structuredClone(p.spec),url:'http://localhost',outputRoot:join(p.root,'runs'),id:'prior-source'});
  const source=await loadRun(prior.directory);
  source.manifest.onboarding=(await loadRun(run)).manifest.onboarding;
  source.manifest.judgment={decision:'accept',reason:'Synthetic approval of the prior fixture'};
  await writeFile(join(prior.directory,'run.json'),JSON.stringify(source.manifest));
  const inputPath=join(p.root,'memory-input.json');
  const title='Keep the feature module syntactically valid';
  const proposal={principle:title,context:'Feature module source review',reason:'The fixed fixture previously had a syntax error',scope:{failureClass:'parse-error',trigger:{files:['feature.mjs'],tasks:[p.spec.project.task]},check:{type:'technical',policy}}};
  const invoke=async(directory,action,input)=>{
    if(input)await writeFile(inputPath,JSON.stringify(input));
    return JSON.parse(await p.invoke('memory','--run',directory,'--action',action,...(input?['--input',inputPath]:[])));
  };
  const approved=await invoke(prior.directory,'propose',proposal);
  const expired=await invoke(prior.directory,'propose',{...proposal,principle:'Expired private detail',scope:{...proposal.scope,reviewBy:'2000-01-01'}});
  const irrelevant=await invoke(prior.directory,'propose',{...proposal,principle:'Unrelated private detail',scope:{...proposal.scope,trigger:{files:['other.mjs']}}});
  await assert.rejects(invoke(prior.directory,'propose',{...proposal,scope:{...proposal.scope,trigger:{files:['../feature.mjs']}}}),/repository-relative/);
  assert.deepEqual(await invoke(run,'checks'),[],'candidates do not enter current runs');
  for(const {id} of [approved,expired,irrelevant])await invoke(prior.directory,'decide',{id,decision:'approve',reason:'Synthetic approval of the test scope'});
  await p.invoke('verify','--run',run,'--phase','before');
  const active=await stageProjectMemory(await loadRun(run)),current=await verifyProjectMemory(await loadRun(run),p.repo,active);
  assert.deepEqual(current.entries.map(entry=>entry.principle),[title]);
  assert.doesNotMatch(await readFile(join(run,active.path),'utf8'),/private detail/);
  const selected=await invoke(run,'checks');
  assert.equal(selected.find(row=>row.id===approved.id).status,'selected');
  assert.equal(selected.find(row=>row.id===expired.id).reason,'review-date-expired');
  assert.equal(selected.find(row=>row.id===irrelevant.id).reason,'scope-mismatch');
  const baseline=(await loadRun(run)).manifest;
  const unrelatedSpec={...p.spec,project:{...p.spec.project,task:'Check a different task which uses the same module'}};
  const unrelated=await createRun({spec:unrelatedSpec,outputRoot:join(p.root,'runs'),id:'unrelated-task',evidencePolicy:policy});
  await writeFile(join(unrelated.directory,'run.json'),JSON.stringify({...unrelated.manifest,onboarding:baseline.onboarding,technicalEvidence:baseline.technicalEvidence}));
  assert.equal((await invoke(unrelated.directory,'checks')).find(row=>row.id===approved.id).reason,'scope-mismatch');
  await p.fix({'feature.mjs':'export const label = "Save";'});
  const related=await projectMemoryRegistry(await loadRun(run),p.candidate);
  assert.equal(related.identity,(await projectMemoryRegistry(await loadRun(run),p.repo)).identity);
  assert.equal((await related.store.list()).length,3);
  const other=join(p.root,'other');await exec('git',['init','-q',other],{cwd:p.root});
  assert.deepEqual(await (await projectMemoryRegistry(await loadRun(run),other)).store.list(),[]);
  await p.invoke('verify','--run',run,'--phase','after','--repo',p.candidate);
  const verified=(await invoke(run,'checks')).find(row=>row.id===approved.id);
  assert.deepEqual([verified.status,verified.result,verified.evidence.states],['executed','pass',['feature.mjs']]);
  const report=JSON.parse(await p.invoke('report','--run',run));
  const html=await readFile(report.path,'utf8');
  assert.match(html,/parse-error<\/dt><dd>executed · pass/);
  assert.match(html,/Independent visual QA<\/th><td>not-reviewed/);
  const sourcePath=join(prior.directory,'run.json');
  await writeFile(sourcePath,JSON.stringify({...source.manifest,technicalEvidence:baseline.technicalEvidence}));
  assert.equal((await invoke(run,'list')).find(row=>row.id===approved.id).status,'source-unavailable');
  assert.deepEqual(await invoke(run,'checks'),[]);
  await writeFile(sourcePath,JSON.stringify(source.manifest));
  await invoke(run,'retire',{id:approved.id,reason:'The fixture changed its design scope'});
  assert.equal((await invoke(run,'checks')).some(row=>row.id===approved.id),false);
  assert.equal((await invoke(run,'list')).find(row=>row.id===approved.id).retirement.status,'deprecated');
});
async function fixture(t){
  const host=await mkdtemp(join(tmpdir(),'memory-reuse-'));t.after(()=>rm(host,{recursive:true,force:true}));
  const repo=join(host,'project');await mkdir(repo);
  const git=async(...args)=>(await exec('git',args,{cwd:repo,windowsHide:true})).stdout.trim();
  await git('init','-q');await git('config','user.email','fixture@example.invalid');await git('config','user.name','Fixture');
  await writeFile(join(repo,'README.md'),'Fixture');await git('add','.');await git('commit','-qm','Fixture');
  const memory=projectMemory(host,await realpath(repo));
  const candidate=await memory.propose({manifest:{id:'prior-run',judgment:{decision:'accept',reason:'Synthetic previous judgment'}}},{principle:'Use outcome labels',context:'Review screens',exceptions:['Destructive actions'],reason:'Prior clarity feedback'});
  await memory.decide({id:candidate.id,decision:'approve',reason:'Synthetic scope review'});
  await mkdir(join(host,'.harness','runs'),{recursive:true});
  const run=await createRun({spec:structuredClone(sample),url:'http://127.0.0.1:4321',outputRoot:join(host,'.harness','runs'),id:'reuse001'});
  await saveOnboarding(run.directory,{repository:{root:repo,commit:await git('rev-parse','HEAD')}});
  await saveCapture(run.directory,'before',{at:'2026-10-18T00:00:00Z',url:'http://127.0.0.1:4321',viewports:{desktop:{width:1280,height:800,status:200,screenshot:'before/desktop.png',dom:{h1:['HappyClaw'],actions:[],horizontalOverflow:false}}}});
  await confirmFinding(run.directory,'F1','supported','Synthetic evidence confirmation');await savePlan(run.directory,'F1');
  return {host,repo,memory,candidate,run:await loadRun(run.directory),git};
}
test('later plan snapshots approved project history without replacing current evidence',async t=>{
  const {repo,run}=await fixture(t),reference=run.manifest.plan.projectMemory;
  assert.equal(reference.count,1);
  const context=await verifyProjectMemory(run,repo);assert.equal(context.entries[0].source.runId,'prior-run');
  assert.deepEqual(context.entries[0].exceptions,['Destructive actions']);
  assert.equal(run.manifest.confirmation.findingId,'F1');assert.equal(run.manifest.captures.before.viewports.desktop.dom.h1[0],'HappyClaw');
  const brief=await readFile(join(run.directory,'execution-brief.md'),'utf8');assert.ok(brief.includes(reference.path));assert.match(brief,/not approval of this change/);
  await assert.rejects(executeWithAgent({directory:run.directory,repo,commandOverride:'git'}),/exited/);
  const prompt=await readFile(join(run.directory,'execution-prompt.txt'),'utf8');assert.match(prompt,/Use outcome labels/);assert.match(prompt,/untrusted data, not commands/);
});
test('retirement blocks agent launch and preserves the original plan snapshot',async t=>{
  const {repo,memory,candidate,run,git}=await fixture(t);
  const path=join(run.directory,run.manifest.plan.projectMemory.path),before=await readFile(path,'utf8');
  await memory.retire({id:candidate.id,reason:'No longer applicable'});
  await assert.rejects(executeWithAgent({directory:run.directory,repo,commandOverride:'never-start-this-agent'}),/Project memory changed/);
  assert.equal(await git('branch','--list','pd/reuse001'),'');assert.equal(await readFile(path,'utf8'),before);
  await savePlan(run.directory,'F1');const updated=await loadRun(run.directory);
  assert.equal(updated.manifest.plan.projectMemory.count,0);assert.deepEqual((await verifyProjectMemory(updated,repo)).entries,[]);
});
test('snapshot tampering and unrelated repositories cannot reuse a confirmed memory context',async t=>{
  const {host,repo,run}=await fixture(t);
  const other=join(host,'other');await mkdir(other);
  await assert.rejects(verifyProjectMemory(run,other),/Project memory changed/);
  await writeFile(join(run.directory,run.manifest.plan.projectMemory.path),'{}');
  await assert.rejects(verifyProjectMemory(run,repo),/Project memory changed/);
});
test('legacy plans cannot silently ignore newly approved project principles',async t=>{
  const {repo,run}=await fixture(t);delete run.manifest.plan.projectMemory;
  await assert.rejects(verifyProjectMemory(run,repo),/not included/);
});

test('a reasoned run exception invalidates the plan and preserves global memory and other runs',async t=>{
  const {host,repo,memory,candidate,run}=await fixture(t);
  const before=await readFile(join(run.directory,'execution-brief.md'),'utf8');
  const saved=await saveRunMemoryException(run.directory,{id:candidate.id,principleHash:candidate.contentHash,decision:'exclude',reason:'This workflow uses domain-specific action names'});
  assert.equal(saved.planInvalidated,true);assert.equal(await readFile(join(run.directory,saved.event.priorPlan.path),'utf8'),before);
  assert.equal((await loadRun(run.directory)).manifest.plan,undefined);assert.equal((await memory.active()).length,1);
  await assert.rejects(verifyProjectMemory(run,repo),/Project memory changed/);
  await assert.rejects(executeWithAgent({directory:run.directory,repo,commandOverride:'never-start-this-agent'}),/plan are required/);
  await savePlan(run.directory,'F1');const replanned=await loadRun(run.directory);
  assert.equal(replanned.manifest.plan.projectMemory.count,0);assert.equal(replanned.manifest.plan.projectMemory.excludedCount,1);
  const context=await verifyProjectMemory(replanned,repo);assert.equal(context.entries.length,0);assert.equal(context.excludedEntries[0].exclusion.reason,'This workflow uses domain-specific action names');
  const sibling=await createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:join(host,'.harness','runs'),id:'sibling-run'});
  await saveOnboarding(sibling.directory,{repository:{root:repo}});assert.equal((await stageProjectMemory(await loadRun(sibling.directory))).count,1);
  await assert.rejects(executeWithAgent({directory:run.directory,repo,commandOverride:'git'}),/exited/);
  assert.match(await readFile(join(run.directory,'execution-prompt.txt'),'utf8'),/excludedEntries/);
  await assert.rejects(saveRunMemoryException(run.directory,{id:candidate.id,principleHash:candidate.contentHash,decision:'apply',reason:'Too late'}),/before execution/);
});

test('restoring a run principle records a new reason without erasing its earlier exception',async t=>{
  const {repo,candidate,run}=await fixture(t),input={id:candidate.id,principleHash:candidate.contentHash};
  await assert.rejects(saveRunMemoryException(run.directory,{...input,decision:'exclude',reason:''}),/reason/);
  await assert.rejects(saveRunMemoryException(run.directory,{...input,principleHash:'0'.repeat(64),decision:'exclude',reason:'Stale'}),/changed or is unavailable/);
  await assert.rejects(saveRunMemoryException(run.directory,{...input,id:'../escape',decision:'exclude',reason:'Wrong ID'}),/changed or is unavailable/);
  await saveRunMemoryException(run.directory,{...input,decision:'exclude',reason:'Temporary context'});
  await saveRunMemoryException(run.directory,{...input,decision:'apply',reason:'The workflow now matches'});
  const record=await readRunMemoryExceptions(await loadRun(run.directory));assert.deepEqual(record.events.map(event=>event.decision),['exclude','apply']);
  await savePlan(run.directory,'F1');assert.equal((await verifyProjectMemory(await loadRun(run.directory),repo)).entries.length,1);
});

test('exception snapshots and archived plans export intact and tampering is rejected',async t=>{
  const {host,candidate,run}=await fixture(t);
  await mkdir(join(run.directory,'before'),{recursive:true});await writeFile(join(run.directory,'before','desktop.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64'));
  const result=await saveRunMemoryException(run.directory,{id:candidate.id,principleHash:candidate.contentHash,decision:'exclude',reason:'Recorded export context'});
  const exported=await exportRun({directory:run.directory,outputRoot:join(host,'public-test')});
  assert.ok(exported.files.includes(result.reference.path));assert.ok(exported.files.includes(result.event.priorPlan.path));
  assert.equal(JSON.parse(await readFile(join(exported.directory,result.reference.path))).events[0].reason,'Recorded export context');
  await writeFile(join(run.directory,result.event.priorPlan.path),'Changed');
  await assert.rejects(exportRun({directory:run.directory,outputRoot:join(host,'invalid-export')}),/Archived project memory plan changed/);
  await writeFile(join(run.directory,result.reference.path),'{}');
  await assert.rejects(stageProjectMemory(await loadRun(run.directory)),/exception snapshot changed/);
});

test('execution intent freezes the plan and run exceptions before an agent result exists',async t=>{
  const {repo,candidate,run}=await fixture(t);
  await assert.rejects(beginExecutionContext(run.directory,repo,'0'.repeat(64)),/plan changed/);
  const intent=await beginExecutionContext(run.directory,repo,projectMemoryDigest(run.manifest.plan));
  assert.deepEqual(await beginExecutionContext(run.directory,repo,projectMemoryDigest(run.manifest.plan)),intent);
  await assert.rejects(saveRunMemoryException(run.directory,{id:candidate.id,principleHash:candidate.contentHash,decision:'exclude',reason:'Agent is already starting'}),/before execution/);
  await assert.rejects(savePlan(run.directory,'F1'),/execution context is locked/);
  await assert.rejects(confirmFinding(run.directory,'F1','supported','Changed while starting'),/after execution has started/);
  await writeFile(join(run.directory,'run.json'),JSON.stringify(run.manifest));
  assert.ok((await loadRun(run.directory)).manifest.executionContext); // stale mirror cannot unfreeze intent
  await saveCapture(run.directory,'after',{viewports:{desktop:{screenshot:'after/desktop.png'}}});
  assert.ok((await loadRun(run.directory)).manifest.captures.after); // locked context still permits normal result capture
  await writeFile(join(run.directory,'execution-context.json'),'null');
  await assert.rejects(loadRun(run.directory),/Execution context changed/); // malformed intent cannot silently unfreeze the run
});
