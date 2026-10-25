import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createRun,loadRun,saveCapture,saveDiagnosis,confirmFinding} from '../packages/harness-core/store.js';
import {diagnoseRun,overridePriority} from '../packages/harness-core/diagnosis.js';import {diagnoseBaseline,assertBaselineResult} from '../packages/workbench/baseline-diagnosis.js';
import {exportRun} from '../packages/harness-core/export.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'baseline-model-'));t.after(()=>rm(root,{recursive:true,force:true}));const spec=JSON.parse(await readFile(new URL('../examples/happyclaw-site/experience.json',import.meta.url)));const run=await createRun({spec,url:'http://localhost',outputRoot:root,id:'model-test'});await mkdir(join(run.directory,'before'));await writeFile(join(run.directory,'before/desktop.png'),png);await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png',width:1,height:1}}});return {root,run:await loadRun(run.directory),cwd:join(root,'job')};}
const response={status:'complete',summary:'Fixture only',screenshotRefs:['before/desktop.png'],limitations:['Synthetic model output, not a visual assessment.'],findings:[{title:'Fixture finding',observation:'Fixture observation',proposal:'Fixture proposed change',impact:3,confidence:'medium',effort:2,screenshotRefs:['before/desktop.png']}]};
const generate=async(_command,_args,{cwd,input})=>{assert.match(input,/OJO/);assert.match(input,/taste-v2/);assert.match(input,/COMPLETE/);await writeFile(join(cwd,'result.json'),JSON.stringify(response));};
test('baseline model suggestions enter existing confirmation and export without approval or score',async t=>{const {run,cwd,root}=await fixture(t);const diagnosis=await diagnoseBaseline(run.directory,diagnoseRun({run}),{cwd,generate});assert.equal(diagnosis.modelDiagnosis.status,'complete');assert.equal(diagnosis.experienceScore.score,null);const candidate=diagnosis.findings.find(item=>item.id.startsWith('MODEL-'));assert.equal(candidate.verificationStatus,'authored-candidate');await saveDiagnosis(run.directory,diagnosis);await exportRun({directory:run.directory,outputRoot:join(root,'public')});assert.ok(await readFile(join(root,'public',run.manifest.id,diagnosis.modelDiagnosis.path)));await confirmFinding(run.directory,candidate.id,'supported','Human fixture decision');const confirmed=await loadRun(run.directory);assert.equal(confirmed.spec.findings.find(item=>item.id===candidate.id).proposal,'Fixture proposed change');assert.equal(confirmed.manifest.plan,null);assert.equal(confirmed.manifest.judgment,null);});
test('baseline model requires complete citations and does not promote missing evidence',()=>{assert.throws(()=>assertBaselineResult({...response,screenshotRefs:[]},response.screenshotRefs),/every/);assert.throws(()=>assertBaselineResult({...response,status:'needs-evidence'},response.screenshotRefs),/Incomplete/);assert.throws(()=>assertBaselineResult({...response,findings:[{...response.findings[0],screenshotRefs:['after/fake.png']}]},response.screenshotRefs),/citation/);});
test('changed originals during model work cannot publish candidates',async t=>{const {run,cwd}=await fixture(t);await assert.rejects(diagnoseBaseline(run.directory,diagnoseRun({run}),{cwd,generate:async(...args)=>{await generate(...args);await writeFile(join(run.directory,'before/desktop.png'),'changed');}}),/original changed/);});
test('tampered model proposal or record blocks confirmation and export',async t=>{const {run,cwd,root}=await fixture(t);const diagnosis=await diagnoseBaseline(run.directory,diagnoseRun({run}),{cwd,generate});await saveDiagnosis(run.directory,diagnosis);const candidate=diagnosis.findings.find(item=>item.id.startsWith('MODEL-'));candidate.proposal='tampered';await writeFile(join(run.directory,'diagnosis.json'),JSON.stringify(diagnosis));await assert.rejects(confirmFinding(run.directory,candidate.id,'supported','test'),/proposal changed/);await assert.rejects(exportRun({directory:run.directory,outputRoot:join(root,'public')}),/proposal changed/);});
test('confirmed scope cannot be replaced by another model diagnosis',async t=>{const {run,cwd}=await fixture(t);await confirmFinding(run.directory,run.spec.findings[0].id,'supported','Fixture');await assert.rejects(diagnoseBaseline(run.directory,diagnoseRun({run}),{cwd,generate}),/fresh review/);});
test('identical model results can be retried without changing previous records',async t=>{const {run,cwd}=await fixture(t);const base=diagnoseRun({run});const first=await diagnoseBaseline(run.directory,base,{cwd,generate});const second=await diagnoseBaseline(run.directory,base,{cwd,generate});assert.equal(second.modelDiagnosis.status,'complete');assert.ok(await readFile(join(run.directory,first.modelDiagnosis.path)));assert.ok(await readFile(join(run.directory,second.modelDiagnosis.path)));});
test('export rejects a replaced capture manifest even if original files remain',async t=>{const {run,cwd,root}=await fixture(t);const diagnosis=await diagnoseBaseline(run.directory,diagnoseRun({run}),{cwd,generate});await saveDiagnosis(run.directory,diagnosis);const manifest=JSON.parse(await readFile(join(run.directory,'run.json')));manifest.captures.before={viewports:{}};await writeFile(join(run.directory,'run.json'),JSON.stringify(manifest));await assert.rejects(exportRun({directory:run.directory,outputRoot:join(root,'public')}),/capture manifest changed/);});
test('interaction parts and internal surface originals are all supplied to the model',async t=>{const {run,cwd}=await fixture(t);const part='before/part-'+ 'a'.repeat(24)+'-0.png',surface='before/surface-'+ 'b'.repeat(24)+'-0.png';for(const file of [part,surface])await writeFile(join(run.directory,file),png);const manifest=JSON.parse(await readFile(join(run.directory,'run.json')));manifest.captures.before={states:[{stateId:'page',configurationId:'desktop',screenshot:'before/desktop.png',interactionParts:[{screenshot:part}],pageSurfaces:{surfaces:[{tiles:[{screenshot:surface}]}]}}]};await writeFile(join(run.directory,'run.json'),JSON.stringify(manifest));const current=await loadRun(run.directory);const diagnosis=await diagnoseBaseline(run.directory,diagnoseRun({run:current}),{cwd,generate:async(_cmd,args,{cwd})=>{assert.equal(args.filter(arg=>arg==='-i').length,3);await writeFile(join(cwd,'result.json'),JSON.stringify({...response,screenshotRefs:['before/desktop.png',part,surface]}));}});assert.equal(diagnosis.modelDiagnosis.status,'complete');});
test('export rejects changed project context and labels changed Foundation as stale',async t=>{const {run,cwd,root}=await fixture(t);const diagnosis=await diagnoseBaseline(run.directory,diagnoseRun({run}),{cwd,generate});await saveDiagnosis(run.directory,diagnosis);const path=join(run.directory,'experience.json'),spec=JSON.parse(await readFile(path));spec.project.task+=' changed';await writeFile(path,JSON.stringify(spec));await assert.rejects(exportRun({directory:run.directory,outputRoot:join(root,'public')}),/source context changed/);spec.project.task=run.spec.project.task;spec.designFoundation.brand.voice.push('New explicitly reviewed voice');await writeFile(path,JSON.stringify(spec));await exportRun({directory:run.directory,outputRoot:join(root,'public')});const published=JSON.parse(await readFile(join(root,'public',run.manifest.id,'diagnosis.json')));assert.equal(published.modelDiagnosis.status,'needs-evidence');assert.equal(published.findings.find(item=>item.id.startsWith('MODEL-')).verificationStatus,'stale-candidate');const candidate=diagnosis.findings.find(item=>item.id.startsWith('MODEL-'));await assert.rejects(confirmFinding(run.directory,candidate.id,'supported','Cannot confirm old Foundation'),/context changed/);});
test('export rejects changed manifest source metadata',async t=>{const {run,cwd,root}=await fixture(t);const diagnosis=await diagnoseBaseline(run.directory,diagnoseRun({run}),{cwd,generate});await saveDiagnosis(run.directory,diagnosis);const path=join(run.directory,'run.json'),manifest=JSON.parse(await readFile(path));manifest.source='a different source';await writeFile(path,JSON.stringify(manifest));await assert.rejects(exportRun({directory:run.directory,outputRoot:join(root,'public')}),/source context changed/);});

test('model suggestions use normal ranking and explicit reprioritization preserves provenance',async t=>{const {run,cwd,root}=await fixture(t);const base=diagnoseRun({run});base.findings.forEach(item=>{item.verificationStatus='review-target';item.priority=999;});const items=[{...response.findings[0],title:'Lower priority',impact:1,confidence:'low',effort:5},{...response.findings[0],title:'Higher priority',impact:5,confidence:'high',effort:1}];const diagnosis=await diagnoseBaseline(run.directory,base,{cwd,generate:async(_cmd,_args,{cwd})=>writeFile(join(cwd,'result.json'),JSON.stringify({...response,findings:items}))});assert.equal(diagnosis.findings[0].title,'Higher priority');assert.equal(diagnosis.findings[1].title,'Lower priority');await saveDiagnosis(run.directory,diagnosis);await exportRun({directory:run.directory,outputRoot:join(root,'public')});const lower=diagnosis.findings[1];overridePriority(diagnosis,lower.id,50,'Explicit reviewer scope');assert.equal(diagnosis.findings[0].id,lower.id);await saveDiagnosis(run.directory,diagnosis);await exportRun({directory:run.directory,outputRoot:join(root,'public')});await confirmFinding(run.directory,lower.id,'supported','Human fixture decision');assert.equal((await loadRun(run.directory)).manifest.confirmation.findingId,lower.id);});
async function multiOriginalFixture(t,count){
 const fixtureResult=await fixture(t),{run}=fixtureResult,states=[];
 for(let i=0;i<count;i++){const screenshot=`before/state-${i}--desktop.png`;await writeFile(join(run.directory,screenshot),png);states.push({stateId:`state-${i}`,configurationId:'desktop',screenshot,width:1,height:1});}
 const manifest=JSON.parse(await readFile(join(run.directory,'run.json')));manifest.captures.before={states};await writeFile(join(run.directory,'run.json'),JSON.stringify(manifest));return {...fixtureResult,run:await loadRun(run.directory)};
}
async function batchResponse(cwd,overrides={}){
 const context=JSON.parse(await readFile(join(cwd,'context.json')));const refs=context.originals.map(item=>item.reference);
 await writeFile(join(cwd,'result.json'),JSON.stringify({...response,screenshotRefs:refs,findings:[{...response.findings[0],screenshotRefs:[refs[0]]}],...overrides}));return context;
}

test('large baselines account for all originals through bounded, source-bound batches',async t=>{
 const {run,cwd,root}=await multiOriginalFixture(t,36),seen=[],progress=[];
 const diagnosis=await diagnoseBaseline(run.directory,diagnoseRun({run}),{cwd,onProgress:value=>progress.push(value),generate:async(_cmd,args,{cwd,input})=>{
  const context=await batchResponse(cwd);assert.ok(args.filter(arg=>arg==='-i').length<=24);assert.match(input,/Other batches are uninspected/);
  assert.equal(context.plannedStates.length,36);assert.equal(context.capture.states.length,context.originals.length);assert.ok(context.capture.states.every(state=>context.originals.some(original=>original.state===state.stateId)));
  seen.push(...context.originals.map(item=>item.reference));
 }});
 assert.equal(seen.length,36);assert.equal(new Set(seen).size,36);assert.deepEqual(progress.map(item=>item.batchIndex),[1,2]);
 const record=JSON.parse(await readFile(join(run.directory,diagnosis.modelDiagnosis.path)));assert.equal(record.batches.length,2);assert.deepEqual(record.result.screenshotRefs,seen);assert.equal(record.originals[24].state,'state-24');
 assert.equal(diagnosis.modelDiagnosis.status,'complete');assert.equal(diagnosis.findings.filter(item=>item.id.startsWith('MODEL-')).length,2);
 await saveDiagnosis(run.directory,diagnosis);await exportRun({directory:run.directory,outputRoot:join(root,'public')});assert.equal((await loadRun(run.directory)).manifest.judgment,null);
});

test('one incomplete batch prevents publishing successful batches as complete findings',async t=>{
 const {run,cwd}=await multiOriginalFixture(t,25);let calls=0;
 const diagnosis=await diagnoseBaseline(run.directory,diagnoseRun({run}),{cwd,generate:async(_cmd,_args,{cwd})=>{await batchResponse(cwd,++calls===2?{status:'needs-evidence',findings:[]}:{});}});
 assert.equal(calls,2);assert.equal(diagnosis.modelDiagnosis.status,'needs-evidence');assert.equal(diagnosis.findings.filter(item=>item.id.startsWith('MODEL-')).length,0);
 const record=JSON.parse(await readFile(join(run.directory,diagnosis.modelDiagnosis.path)));assert.equal(record.result.screenshotRefs.length,25);assert.equal(record.batches[0].result.findings.length,1);
});

test('a batch cannot cite an original assigned to a different session',async t=>{
 const {run,cwd}=await multiOriginalFixture(t,25);
 await assert.rejects(diagnoseBaseline(run.directory,diagnoseRun({run}),{cwd,generate:async(_cmd,_args,{cwd})=>batchResponse(cwd,{findings:[{...response.findings[0],screenshotRefs:['before/state-24--desktop.png']}]} )}),/citation/);
});

test('later batches cannot mutate earlier staged context or source originals',async t=>{
 for(const target of ['context','original']){
  const {run,cwd}=await multiOriginalFixture(t,25);let first,calls=0;
  await assert.rejects(diagnoseBaseline(run.directory,diagnoseRun({run}),{cwd,generate:async(_cmd,_args,{cwd})=>{
   await batchResponse(cwd);if(++calls===1)first=cwd;else await writeFile(target==='context'?join(first,'context.json'):join(run.directory,'before/state-0--desktop.png'),'changed');
  }}),target==='context'?/input changed/:/original changed/);
 }
});

test('cancellation between model batches stops further sessions',async t=>{
 const {run,cwd}=await multiOriginalFixture(t,25),controller=new AbortController();let calls=0;
 await assert.rejects(diagnoseBaseline(run.directory,diagnoseRun({run}),{cwd,signal:controller.signal,generate:async(_cmd,_args,{cwd})=>{calls++;await batchResponse(cwd);controller.abort(new Error('User cancelled'));}}),/User cancelled/);assert.equal(calls,1);
});

test('actual original count retains an explicit total budget before model execution',async t=>{
 const {run,cwd}=await multiOriginalFixture(t,97);let calls=0;
 await assert.rejects(diagnoseBaseline(run.directory,diagnoseRun({run}),{cwd,generate:async()=>{calls++;}}),/1–96/);assert.equal(calls,0);
});



test('unreached or missing-image planned states cannot be hidden behind a complete model response',async t=>{
 for(const reached of [false,true]){
  const {run,cwd}=await multiOriginalFixture(t,1),manifest=JSON.parse(await readFile(join(run.directory,'run.json')));
  manifest.captures.before.states.push({stateId:'missing',configurationId:'mobile',reached,...(!reached?{error:'Fixture unreachable state'}:{})});await writeFile(join(run.directory,'run.json'),JSON.stringify(manifest));
  const current=await loadRun(run.directory);const diagnosis=await diagnoseBaseline(run.directory,diagnoseRun({run:current}),{cwd,generate:async(_cmd,_args,{cwd})=>batchResponse(cwd)});
  assert.equal(diagnosis.modelDiagnosis.status,'needs-evidence');assert.equal(diagnosis.findings.filter(item=>item.id.startsWith('MODEL-')).length,0);
  const record=JSON.parse(await readFile(join(run.directory,diagnosis.modelDiagnosis.path)));assert.equal(record.missingStates.length,1);assert.equal(record.batches[0].result.findings.length,1);
 }
});
