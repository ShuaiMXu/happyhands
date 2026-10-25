import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,rename,realpath} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {createRun,confirmFinding,saveCapture,saveEvaluation,loadRun,saveOnboarding,saveDiagnosis,saveRunMemoryException,savePlan} from '../packages/harness-core/store.js';
import {projectMemory} from '../packages/workbench/memory.js';
import {diagnoseRun} from '../packages/harness-core/diagnosis.js';
import {exportRun} from '../packages/harness-core/export.js';
import {runAiVisualReview,visualReviewBatches} from '../packages/workbench/ai-review.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
async function fixture(t,afterFields={}){const root=await mkdtemp(join(tmpdir(),'ai-review-'));t.after(()=>rm(root,{recursive:true,force:true}));const spec=JSON.parse(await readFile(new URL('../examples/happyclaw-site/experience.json',import.meta.url)));const run=await createRun({spec,url:'http://localhost',outputRoot:root,id:'review-test'});for(const phase of ['before','after']){if(phase==='after')await confirmFinding(run.directory,spec.findings[0].id,'supported','QA fixture scope');await mkdir(join(run.directory,phase));await writeFile(join(run.directory,phase,'desktop.png'),png);await saveCapture(run.directory,phase,{viewports:{desktop:{screenshot:`${phase}/desktop.png`,...(phase==='after'?afterFields:{})}}});}await saveEvaluation(run.directory,{status:'fixture'});const cwd=join(root,'reviewer');await mkdir(cwd);return {run,cwd};}
const result={verdict:'needs-evidence',screenshotRefs:['before/desktop.png','after/desktop.png'],findings:[],rationale:'Images do not show a usable interface.',limitations:['Test fixture images only']};
function responseFor(context,value){const {verdict,...rest}=value;return context.reviewPurpose==='regional-batch'?{...rest,regionalVerdict:verdict}:value;}
async function memoryFixture(t){
  const {run,cwd}=await fixture(t),root=dirname(cwd),runs=join(root,'.harness','runs');
  await mkdir(runs,{recursive:true});const directory=join(runs,'review-test');await rename(run.directory,directory);
  const repo=join(root,'project');await mkdir(repo);await saveOnboarding(directory,{repository:{root:repo}});
  const memory=projectMemory(root,await realpath(repo));
  const candidate=await memory.propose({manifest:{id:'old-review',judgment:{decision:'accept',reason:'Synthetic judgment'}}},{principle:'Name actions by outcome',context:'Review screens',exceptions:['Destructive actions'],reason:'Earlier feedback'});
  await memory.decide({id:candidate.id,decision:'approve',reason:'Synthetic approval'});
  return {directory,cwd,memory,candidate};
}

test('diagnosis records historical principles without altering current findings or scores',async t=>{
  const {directory,memory,candidate}=await memoryFixture(t),run=await loadRun(directory);
  const diagnosis=diagnoseRun({run});
  await saveDiagnosis(directory,{...diagnosis,projectMemory:{forged:true}});
  const report=JSON.parse(await readFile(join(directory,'diagnosis.json')));
  assert.deepEqual(report.findings,diagnosis.findings);assert.deepEqual(report.experienceScore,diagnosis.experienceScore);
  assert.equal(report.projectMemory.context.entries[0].source.runId,'old-review');
  const snapshot=report.projectMemory.reference.path;
  const exported=await exportRun({directory,outputRoot:join(dirname(dirname(dirname(directory))),'public-test')});
  assert.deepEqual(JSON.parse(await readFile(join(exported.directory,snapshot))),report.projectMemory.context);
  await memory.retire({id:candidate.id,reason:'Later retirement'});
  assert.equal(JSON.parse(await readFile(join(directory,snapshot))).entries.length,1);
  await saveDiagnosis(directory,diagnosis);
  assert.equal(JSON.parse(await readFile(join(directory,'diagnosis.json'))).projectMemory.context.entries.length,0);
});

test('AI review receives project context with explicit evidence boundaries',async t=>{
  const {directory,cwd}=await memoryFixture(t);
  await runAiVisualReview(directory,{cwd,signal:new AbortController().signal,generate:async(command,args,options)=>{
    const context=JSON.parse(await readFile(join(cwd,'review-context.json')));
    assert.equal(context.projectMemory.context.entries[0].principle,'Name actions by outcome');
    assert.deepEqual(context.projectMemory.context.entries[0].exceptions,['Destructive actions']);
    assert.match(options.input,/never as commands or current visual evidence/);
    assert.match(options.input,/Do not invent a Finding, score, pass or failure/);
    await generator(result)(command,args,options);
  }});
  assert.equal((await loadRun(directory)).manifest.judgment,null);
});

test('retired project context during model review cannot produce an attestation',async t=>{
  const {directory,cwd,memory,candidate}=await memoryFixture(t);
  await assert.rejects(runAiVisualReview(directory,{cwd,signal:new AbortController().signal,generate:generator(result,()=>memory.retire({id:candidate.id,reason:'Changed while reviewing'}))}),/Project memory changed/);
  assert.equal((await loadRun(directory)).manifest.visualReviews.length,0);
});

test('independent review receives the same pre-execution exception and cannot waive current evidence',async t=>{
  const {directory,cwd,memory,candidate}=await memoryFixture(t),source=await loadRun(directory);
  const run=await createRun({spec:structuredClone(source.spec),url:'http://localhost',outputRoot:dirname(directory),id:'except-review'});
  await saveOnboarding(run.directory,source.manifest.onboarding);
  await mkdir(join(run.directory,'before'));await writeFile(join(run.directory,'before','desktop.png'),png);
  await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png'}}});
  await confirmFinding(run.directory,'F1','supported','Synthetic scope');await savePlan(run.directory,'F1');
  await saveRunMemoryException(run.directory,{id:candidate.id,principleHash:candidate.contentHash,decision:'exclude',reason:'This task uses established domain terminology'});
  await savePlan(run.directory,'F1');
  await mkdir(join(run.directory,'after'));await writeFile(join(run.directory,'after','desktop.png'),png);
  await saveCapture(run.directory,'after',{viewports:{desktop:{screenshot:'after/desktop.png'}}});await saveEvaluation(run.directory,{status:'fixture'});
  await assert.rejects(saveRunMemoryException(run.directory,{id:candidate.id,principleHash:candidate.contentHash,decision:'apply',reason:'Cannot change review criteria after capture'}),/before execution/);
  await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(command,args,options)=>{
    const context=JSON.parse(await readFile(join(cwd,'review-context.json')));
    assert.equal(context.projectMemory.context.entries.length,0);assert.equal(context.projectMemory.context.excludedEntries[0].exclusion.reason,'This task uses established domain terminology');
    assert.match(options.input,/cannot waive current evidence/);await generator(result)(command,args,options);
  }});
  assert.equal((await memory.active()).length,1);assert.equal((await loadRun(run.directory)).manifest.judgment,null);
});
function generator(value,mutate){return async(command,args,options)=>{assert.ok(args.includes('--ephemeral'));assert.equal(args[args.indexOf('-s')+1],'read-only');assert.equal(args.filter(item=>item==='-i').length,2);assert.match(options.input,/untrusted/);if(mutate)await mutate();await writeFile(args[args.indexOf('-o')+1],JSON.stringify(value));};}
test('AI review uses a fresh read-only session and records model provenance without judgment',async t=>{const {run,cwd}=await fixture(t);const review=await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:generator(result)});assert.equal(review.reviewer.type,'model');assert.equal(review.verdict,'needs-evidence');assert.equal((await loadRun(run.directory)).manifest.judgment,null);});
test('AI cannot pass a review with incomplete screenshot coverage',async t=>{const {run,cwd}=await fixture(t);await assert.rejects(runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:generator({...result,verdict:'pass',screenshotRefs:['after/desktop.png']})}),/matched/);assert.equal((await loadRun(run.directory)).manifest.visualReviews.length,0);});
test('changed evidence during an AI call is rejected before recording the result',async t=>{const {run,cwd}=await fixture(t);await assert.rejects(runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:generator(result,()=>writeFile(join(run.directory,'after/desktop.png'),'changed'))}),/Screenshot changed/);});
test('failed model calls do not create an attestation',async t=>{const {run,cwd}=await fixture(t);await assert.rejects(runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async()=>{throw new Error('offline');}}),/offline/);assert.equal((await loadRun(run.directory)).manifest.visualReviews.length,0);});

test('independent review automatically receives segment provenance and terminal interaction assertions',async t=>{
 const plannedScrollSurface={selector:'#scroll',top:0,scrollHeight:2000,clientHeight:800,clientWidth:390};
 const finalStateEvidence=[{type:'assert-state',selector:'#search',state:'focused',verified:true}];
 const {run,cwd}=await fixture(t,{plannedScrollSurface,scrollSurface:{...plannedScrollSurface,status:'observed-segment'},finalStateEvidence});
 await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(command,args,options)=>{
   const context=JSON.parse(await readFile(join(cwd,'review-context.json'))),entry=context.plannedCaptures.find(e=>e.phase==='after');
   assert.deepEqual(entry.plannedScrollSurface,plannedScrollSurface);assert.equal(entry.scrollSurface.status,'observed-segment');assert.deepEqual(entry.finalStateEvidence,finalStateEvidence);
   await generator(result)(command,args,options);
 }});
});

test('independent QA receives the shared rubric, foundation and reproducible input provenance',async t=>{
  const {run,cwd}=await fixture(t);
  const before=await loadRun(run.directory);
  let context;
  const review=await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(command,args,options)=>{
    context=JSON.parse(await readFile(join(cwd,'review-context.json')));
    assert.deepEqual(context.designFoundation,before.spec.designFoundation || null);
    assert.equal(context.foundationApproval,null);
    assert.deepEqual(context.reviewOrder.stages,['normal-layout','normal-interaction','auxiliary']);
    assert.equal(context.reviewStage,'normal-layout');
    assert.match(options.input,/Normal-first visual review/);
    assert.equal(context.ojoGuidance.mode,'review');
    assert.equal(context.designGuidancePacks.mode,'review');
    assert.deepEqual(context.designGuidancePacks.packs.map(pack=>pack.id),['taste','impeccable','taste-v2']);
    const taste=context.designGuidancePacks.packs.find(pack=>pack.id==='taste');
    const originalTaste=(await readFile(new URL('../skills/vendor/taste/upstream/skills/redesign-skill/SKILL.md',import.meta.url),'utf8')).replaceAll('\r\n','\n');
    assert.equal(await readFile(join(cwd,context.designGuidancePacks.reference,'taste/upstream/skills/redesign-skill/SKILL.md'),'utf8'),originalTaste);
    assert.ok(options.input.includes(taste.revision));
    assert.match(options.input,/not auto-executed/);
    const originalOjo=(await readFile(new URL('../skills/vendor/ojo/upstream/SKILL.md',import.meta.url),'utf8')).replaceAll('\r\n','\n');
    assert.equal(await readFile(join(cwd,context.ojoGuidance.reference,'upstream/SKILL.md'),'utf8'),originalOjo);
    assert.ok(options.input.includes(context.ojoGuidance.bundleHash));
    assert.equal(context.confirmedChange.id,before.manifest.confirmation.findingId);
    const rubric=JSON.parse(await readFile(new URL('../skills/product-design/visual-hierarchy-reviewer/rubric.json',import.meta.url)));
    assert.deepEqual(context.designLanguageRubric,rubric);
    assert.equal(await readFile(join(cwd,'review-prompt.txt'),'utf8'),options.input);
    await generator(result)(command,args,options);
  }});
  const {createHash}=await import('node:crypto');
  const hash=value=>createHash('sha256').update(value).digest('hex');
  const provenance=JSON.parse(await readFile(join(cwd,'review-provenance.json')));
  assert.deepEqual(provenance.ojoGuidance,context.ojoGuidance);
  assert.deepEqual(provenance.designGuidancePacks,context.designGuidancePacks);
  assert.ok(review.reviewer.version.includes(context.designGuidancePacks.bundleHash));
  assert.ok(review.reviewer.version.includes(context.ojoGuidance.bundleHash));
  assert.equal(provenance.contextHash,hash(JSON.stringify(context)));
  assert.equal(provenance.promptHash,hash(await readFile(join(cwd,'review-prompt.txt'))));
  assert.ok(review.reviewer.version.includes(provenance.rubricHash));
  assert.equal(provenance.screenshotHashes['before/desktop.png'],hash(png));
  assert.equal((await loadRun(run.directory)).manifest.judgment,null);
});

async function largeFixture(t){
  const {run,cwd}=await fixture(t);
  // Build a new run so immutable captures are not overwritten.
  const spec=(await loadRun(run.directory)).spec;
  await mkdir(join(cwd,'runs'));
  const large=await createRun({spec,url:'http://localhost',outputRoot:join(cwd,'runs'),id:'large-review'});
  for(const phase of ['before','after']){
    if(phase==='after')await confirmFinding(large.directory,spec.findings[0].id,'supported','large QA scope');
    await mkdir(join(large.directory,phase));const states=[];
    for(let index=0;index<16;index++){const screenshot=`${phase}/region${index}--desktop.png`;await writeFile(join(large.directory,screenshot),png);states.push({stateId:`region${index}`,configurationId:'desktop',screenshot});}
    await saveCapture(large.directory,phase,{states});
  }
  await saveEvaluation(large.directory,{status:'fixture'});return {run:large,cwd};
}
test('32 screenshots use paired sessions and cannot imply whole-page acceptance',async t=>{
  const {run,cwd}=await largeFixture(t);let calls=0;
  const review=await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(command,args,options)=>{
    calls++;const context=JSON.parse(await readFile(join(options.cwd,'review-context.json')));const refs=context.evidence.map(item=>item.reference);
    assert.ok(refs.length<=12);for(const ref of refs)assert.ok(refs.includes(ref.replace(/^before\//,'after/')));
    await writeFile(args[args.indexOf('-o')+1],JSON.stringify(responseFor(context,{...result,verdict:'pass',screenshotRefs:refs})));
  }});
  assert.equal(calls,3);assert.equal(review.screenshotRefs.length,32);assert.equal(review.verdict,'needs-evidence');assert.equal((await loadRun(run.directory)).manifest.judgment,null);
});
test('a later failed batch does not publish partial QA',async t=>{
  const {run,cwd}=await largeFixture(t);let calls=0;
  await assert.rejects(runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(command,args,options)=>{
    if(++calls===2)throw Error('batch offline');const context=JSON.parse(await readFile(join(options.cwd,'review-context.json')));await writeFile(args[args.indexOf('-o')+1],JSON.stringify(responseFor(context,{...result,screenshotRefs:context.evidence.map(item=>item.reference)})));
  }}),/batch offline/);
  assert.equal((await loadRun(run.directory)).manifest.visualReviews.length,0);
});
test('batched QA rejects evidence changed after an earlier batch without publishing partial QA',async t=>{
  const {run,cwd}=await largeFixture(t);let calls=0;
  await assert.rejects(runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(command,args,options)=>{
    const context=JSON.parse(await readFile(join(options.cwd,'review-context.json'))),refs=context.evidence.map(item=>item.reference);
    await writeFile(args[args.indexOf('-o')+1],JSON.stringify(responseFor(context,{...result,verdict:'pass',screenshotRefs:refs})));
    if(++calls===1)await writeFile(join(run.directory,refs[0]),'changed-after-first-batch');
  }}),/Screenshot changed/);
  assert.ok(calls>1);assert.equal((await loadRun(run.directory)).manifest.visualReviews.length,0);
});
test('one failing region keeps the aggregate verdict failed and preserves evidence',async t=>{
  const {run,cwd}=await largeFixture(t);let calls=0;
  const review=await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(command,args,options)=>{
    const context=JSON.parse(await readFile(join(options.cwd,'review-context.json'))),refs=context.evidence.map(item=>item.reference);const failing=++calls===2;
    await writeFile(args[args.indexOf('-o')+1],JSON.stringify(responseFor(context,{...result,verdict:failing?'fail':'pass',screenshotRefs:refs,findings:failing?[{id:'REGRESSION',title:'Unreadable region',observation:'Regression fixture',impact:4,confidence:'high',screenshotRefs:refs}]:[]})));
  }});
  assert.equal(review.verdict,'fail');assert.equal(review.findings[0].id,'B2_REGRESSION');assert.equal(review.screenshotRefs.length,32);
});

async function wholeFixture(t,{missingAfter=false,badDimensions=false,regionCount=16}={}){
  const base=await largeFixture(t),spec=(await loadRun(base.run.directory)).spec;
  const output=join(base.cwd,'whole-runs');await mkdir(output);
  const run=await createRun({spec,url:'http://localhost',outputRoot:output,id:'whole-review'});
  for(const phase of ['before','after']){
    if(phase==='after')await confirmFinding(run.directory,spec.findings[0].id,'supported','Whole-page QA fixture scope');
    await mkdir(join(run.directory,phase));const states=[];
    for(let index=0;index<regionCount;index++){const screenshot=`${phase}/region${index}--desktop.png`;await writeFile(join(run.directory,screenshot),png);states.push({stateId:`region${index}`,configurationId:'desktop',start:{url:'http://127.0.0.1:4321/'},width:1,height:1,reached:true,screenshot});}
    {const screenshot=`${phase}/whole--desktop.png`;await writeFile(join(run.directory,screenshot),png);states.push({stateId:'whole',configurationId:'desktop',start:{url:'http://localhost:4322/'},width:1,height:1,reached:true,actions:[],captureMode:missingAfter&&phase==='after'?'viewport':'full-page',documentSize:{width:1,height:1},screenshotSize:{width:badDimensions?2:1,height:1},screenshot});}
    await saveCapture(run.directory,phase,{states});
  }
  await saveEvaluation(run.directory,{status:'fixture'});const cwd=join(base.cwd,'whole-reviewer');await mkdir(cwd);return {run,cwd};
}
function wholeGenerator({cross='pass',regional='pass',mutate}={}){return async(command,args,options)=>{
  const context=JSON.parse(await readFile(join(options.cwd,'review-context.json'),'utf8'));
  const crossing=context.reviewPurpose==='cross-region',verdict=crossing?cross:regional,refs=context.evidence.map(item=>item.reference);
  if(crossing){assert.match(options.input,/independent CROSS-REGION/);assert.match(options.input,/not collages/);assert.equal(context.regionalReviews.length,3);assert.equal(context.plannedCaptures.length,34);assert.deepEqual(refs,['before/whole--desktop.png','after/whole--desktop.png']);assert.equal(context.ojoGuidance.mode,'review');}
  await writeFile(args[args.indexOf('-o')+1],JSON.stringify(responseFor(context,{...result,verdict,screenshotRefs:refs,findings:verdict==='fail'?[{id:'REGRESSION',title:'Cross-region regression fixture',observation:'Test-only mismatch',impact:4,confidence:'high',screenshotRefs:refs}]:[]})));
  if(crossing&&mutate)await mutate();
};}
test('complete original overviews enable a separate independent cross-region session after all batches',async t=>{
  const {run,cwd}=await wholeFixture(t);
  const review=await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:wholeGenerator()});
  assert.equal(review.verdict,'pass');assert.equal(review.screenshotRefs.length,34);assert.equal(review.coverage.crossRegionVerdict,'pass');assert.equal(review.coverage.coveredContexts,2);
  assert.equal((await loadRun(run.directory)).manifest.judgment,null);
  const summary=JSON.parse(await readFile(join(cwd,'batch-summary.json')));assert.equal(summary.crossRegion.verdict,'pass');assert.equal(summary.batches.length,3);
});
test('cross-region fail or needs-evidence cannot be hidden by regional passes',async t=>{
  for(const cross of ['fail','needs-evidence']){const {run,cwd}=await wholeFixture(t);const review=await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:wholeGenerator({cross})});assert.equal(review.verdict,cross);if(cross==='fail')assert.equal(review.findings[0].id,'X_REGRESSION');}
});
test('cross-region pass cannot override any regional needs-evidence or failure',async t=>{
  for(const regional of ['fail','needs-evidence']){const {run,cwd}=await wholeFixture(t);const review=await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:wholeGenerator({regional})});assert.equal(review.verdict,regional);assert.equal(review.coverage.crossRegionVerdict,'pass');}
});
test('one missing original overview keeps regional passes at needs-evidence without a cross-region call',async t=>{
  const {run,cwd}=await wholeFixture(t,{missingAfter:true});let calls=0;
  const review=await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(command,args,options)=>{calls++;await wholeGenerator()(command,args,options);}});
  assert.equal(calls,3);assert.equal(review.verdict,'needs-evidence');assert.equal(review.coverage.crossRegionVerdict,'not-run');assert.equal(review.coverage.missingContexts.length,1);
});
test('false overview dimensions and evidence drift during cross-region review publish no QA',async t=>{
  const bad=await wholeFixture(t,{badDimensions:true});await assert.rejects(runAiVisualReview(bad.run.directory,{cwd:bad.cwd,signal:new AbortController().signal,generate:wholeGenerator()}),/dimensions do not match/);
  assert.equal((await loadRun(bad.run.directory)).manifest.visualReviews.length,0);
  const changed=await wholeFixture(t);await assert.rejects(runAiVisualReview(changed.run.directory,{cwd:changed.cwd,signal:new AbortController().signal,generate:wholeGenerator({mutate:()=>writeFile(join(changed.run.directory,'before/region0--desktop.png'),'changed')})}),/Screenshot changed/);
  assert.equal((await loadRun(changed.run.directory)).manifest.visualReviews.length,0);
});
test('cross-region model failure never leaves a partial aggregate attestation',async t=>{
  const {run,cwd}=await wholeFixture(t);await assert.rejects(runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(command,args,options)=>{if(options.cwd.endsWith('cross-region'))throw Error('cross offline');await wholeGenerator()(command,args,options);}}),/cross offline/);
  assert.equal((await loadRun(run.directory)).manifest.visualReviews.length,0);
});

test('regional sessions retain the task but have explicit local responsibility',async t=>{
 const {run,cwd}=await wholeFixture(t);let regions=0;
 await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(command,args,options)=>{
  const context=JSON.parse(await readFile(join(options.cwd,'review-context.json'),'utf8'));
  if(context.reviewPurpose==='regional-batch'){regions++;assert.match(options.input,/assigned ONLY the regional screenshots/);assert.match(options.input,/main task proof/);assert.ok(context.confirmedChange);assert.ok(context.designLanguageRubric);assert.ok(context.ojoGuidance.bundleHash);assert.equal(context.reviewResponsibility.decisionField,'regionalVerdict');assert.match(options.input,/Return keys: regionalVerdict/);assert.match(options.input,/FINAL RESPONSE CONTRACT: Return regionalVerdict/);assert.deepEqual(context.reviewResponsibility.assignedOriginals,context.evidence.map(item=>item.reference));}
  await wholeGenerator()(command,args,options);
 }});assert.equal(regions,3);
});
test('scope originals join the final session via explicit evidence and verified source, never titles',async t=>{
 const {scopeReviewCaptures}=await import('../packages/workbench/ai-review.js');
 const entry=(phase,id,file='src/Task.jsx',verified=true)=>({phase,entry:{stateId:id,configurationId:'mobile',screenshot:`${phase}/${id}--mobile.png`,region:{verification:verified?'unique-visible-selector-and-shared-source-anchor':null,source:{file}}}});
 const frames=[entry('before','task'),entry('after','task'),entry('before','task-end'),entry('after','task-end'),entry('after','unverified','src/Task.jsx',false),entry('after','unrelated','src/Other.jsx')];
 const run={spec:{findings:[{id:'TASK',title:'Unrelated',evidenceIds:['E']}],evidence:[{id:'E',state:'task',observation:'Observed task'}]},manifest:{confirmation:{verdict:'supported',findingId:'TASK'},captures:{before:{states:frames.filter(item=>item.phase==='before').map(item=>item.entry)},after:{states:frames.filter(item=>item.phase==='after').map(item=>item.entry)}}}};
 assert.deepEqual(scopeReviewCaptures(run).map(item=>item.entry.stateId),['task','task-end','task','task-end']);
 run.spec.evidence[0].state='unknown';assert.deepEqual(scopeReviewCaptures(run),[]);
 run.spec.evidence[0].observation=JSON.stringify({source:'after/task--mobile.png'});assert.equal(scopeReviewCaptures(run).length,4);
 run.spec.evidence[0].state='accessibility-reviewer@0.3.0';
 for(const value of [{state:'task--mobile'},{screenshot:'before/task--mobile.png'}]){
  run.spec.evidence[0].observation=JSON.stringify({type:'skill-evidence',source:'accessibility-reviewer@0.3.0',value});
  assert.deepEqual(scopeReviewCaptures(run).map(item=>item.entry.stateId),['task','task-end','task','task-end']);
 }
 for(const observation of ['not JSON',JSON.stringify({type:'skill-evidence',value:{state:'unknown',screenshot:'../private.png'}}),JSON.stringify({type:'skill-evidence',value:{metadata:{state:'task'}}})]){
  run.spec.evidence[0].observation=observation;assert.deepEqual(scopeReviewCaptures(run),[]);
 }
});
test('each regional session and the final session receive the original confirmed task evidence',async t=>{
 const {run,cwd}=await wholeFixture(t),loaded=await loadRun(run.directory);
 const evidence=loaded.spec.evidence.find(item=>item.id===loaded.spec.findings[0].evidenceIds[0]);
 evidence.state='accessibility-reviewer@0.3.0';
 evidence.observation=JSON.stringify({type:'skill-evidence',source:'accessibility-reviewer@0.3.0',value:{state:'region0--desktop',screenshot:'before/region0--desktop.png',rule:{id:'aria-allowed-role'}}});
 await writeFile(join(run.directory,'experience.json'),JSON.stringify(loaded.spec));
 await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(command,args,options)=>{
  const context=JSON.parse(await readFile(join(options.cwd,'review-context.json'),'utf8'));
  if(context.reviewPurpose==='cross-region'){assert.equal(context.evidence.length,4);assert.ok(context.evidence.some(item=>item.reference==='after/region0--desktop.png'));for(const item of context.evidence){assert.ok(args.includes(join(options.cwd,item.reference)));assert.deepEqual(await readFile(join(options.cwd,item.reference)),png);}assert.match(options.input,/confirmed task must also be verified/);await writeFile(args[args.indexOf('-o')+1],JSON.stringify({...result,verdict:'pass',screenshotRefs:context.evidence.map(item=>item.reference)}));}
  else {
   assert.deepEqual(context.confirmedTaskOriginals,['before/region0--desktop.png','after/region0--desktop.png']);
   for(const ref of context.confirmedTaskOriginals){assert.ok(context.evidence.some(item=>item.reference===ref));assert.ok(args.includes(join(options.cwd,ref)));assert.deepEqual(await readFile(join(options.cwd,ref)),png);}
   assert.match(options.input,/supplied to this regional session/);
   await wholeGenerator()(command,args,options);
  }
 }});
});

test('regional task evidence union deduplicates without losing local states and rejects oversized scope',async()=>{
 const {regionalTaskCaptures}=await import('../packages/workbench/ai-review.js');
 const entry=index=>({stateId:`state${index}`,configurationId:'desktop',screenshot:`before/state${index}--desktop.png`});
 const before=Array.from({length:12},(_,index)=>entry(index)),batch={before,after:[]};
 const scope=Array.from({length:13},(_,index)=>({phase:'before',entry:entry(index+11)}));
 const assigned=regionalTaskCaptures(batch,scope);assert.equal(assigned.before.length,24);assert.deepEqual(assigned.before.slice(0,12),before);
 assert.throws(()=>regionalTaskCaptures(batch,[...scope,{phase:'before',entry:entry(24)}]),/exceeds 24 originals/);
});

test('explicit actions inside a verified scope include landing states only in the matching capture context',async()=>{
 const {scopeReviewCaptures}=await import('../packages/workbench/ai-review.js');
 const state=(id,options={})=>({stateId:id,configurationId:'mobile',start:{url:'http://localhost:4321/'},...options});
 const states=[state('open',{region:{selector:'#menu',verification:'unique-visible-selector-and-shared-source-anchor',source:{file:'src/Header.astro'}}}),state('land',{actions:[{type:'click',scope:'#menu',role:'link',name:'Go'}]}),state('different-route',{start:{url:'http://localhost:4321/other'},actions:[{type:'click',scope:'#menu'}]}),state('different-device',{configurationId:'desktop',actions:[{type:'click',scope:'#menu'}]}),state('unscoped',{actions:[{type:'click',role:'button',name:'menu'}]}),state('unknown-context',{start:undefined,actions:[{type:'click',scope:'#menu'}]})];
 const run={spec:{findings:[{id:'FIX',evidenceIds:['E']}],evidence:[{id:'E',state:'skill',observation:JSON.stringify({type:'skill-evidence',value:{state:'open'}})}]},manifest:{confirmation:{verdict:'supported',findingId:'FIX'},captures:Object.fromEntries(['before','after'].map(phase=>[phase,{states:states.map(item=>({...item,screenshot:`${phase}/${item.stateId}.png`}))}]))}};
 assert.deepEqual(scopeReviewCaptures(run).map(item=>item.entry.stateId),['open','land','open','land']);
 states[0].region.verification=null;
 for(const capture of Object.values(run.manifest.captures))capture.states[0].region.verification=null;
 assert.deepEqual(scopeReviewCaptures(run).map(item=>item.entry.stateId),['open','open']);
});

test('changed design guidance during independent review cannot publish an attestation',async t=>{
 const {run,cwd}=await fixture(t);
 await assert.rejects(runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(command,args,options)=>{
  const context=JSON.parse(await readFile(join(cwd,'review-context.json')));
  await writeFile(join(cwd,context.designGuidancePacks.reference,'impeccable/upstream/.agents/skills/impeccable/reference/audit.md'),'tampered');await generator(result)(command,args,options);
 }}),/snapshot changed/);
 assert.equal((await loadRun(run.directory)).manifest.visualReviews.length,0);
});

test('normal whole-page and regions are reviewed before interaction batches, preserving every pair',()=>{
  const states=[{stateId:'menu',actions:[{type:'click'}]},{stateId:'section',actions:[{type:'scroll-to'}]},{stateId:'whole',captureMode:'full-page',actions:[]},{stateId:'future',actions:[{type:'unknown-action'}]}];
  const captures=Object.fromEntries(['before','after'].map(phase=>[phase,{states:states.map(e=>({...e,configurationId:'mobile',screenshot:`${phase}/${e.stateId}.png`}))}]));
  const batches=visualReviewBatches({captures});
  assert.deepEqual(batches.map(b=>b.reviewStage),['normal-layout','normal-interaction']);
  assert.deepEqual(batches[0].before.map(e=>e.stateId),['whole','section']);
  assert.deepEqual(batches[1].before.map(e=>e.stateId),['menu','future']);
  for(const b of batches)assert.deepEqual(b.before.map(e=>e.stateId),b.after.map(e=>e.stateId));
  assert.equal(batches.flatMap(b=>[...b.before,...b.after]).length,8);
});

test('small mixed scoped review retains its original scope while ordering normal originals first',async t=>{
  const {run,cwd}=await fixture(t);
  const manifest=JSON.parse(await readFile(join(run.directory,'run.json')));
  for(const phase of ['before','after']){
    await writeFile(join(run.directory,phase,'menu.png'),png);
    manifest.captures[phase]={states:[{stateId:'menu',configurationId:'desktop',actions:[{type:'click'}],screenshot:`${phase}/menu.png`},{stateId:'default',configurationId:'desktop',actions:[],screenshot:`${phase}/desktop.png`}]};
  }
  await writeFile(join(run.directory,'run.json'),JSON.stringify(manifest));
  let calls=0;
  const review=await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(command,args,options)=>{
    calls++;
    const context=JSON.parse(await readFile(join(cwd,'review-context.json')));
    assert.equal(context.reviewStage,'normal-layout-then-interaction');
    const refs=context.evidence.map(e=>e.reference);
    assert.deepEqual(refs,['before/desktop.png','before/menu.png','after/desktop.png','after/menu.png']);
    await writeFile(args[args.indexOf('-o')+1],JSON.stringify({...result,verdict:'pass',screenshotRefs:refs}));
  }});
  assert.equal(calls,1);assert.equal(review.verdict,'pass');assert.equal(review.coverage,undefined);
});


test('small whole-page runs hand every planned original to the final independent session',async t=>{
 const {run,cwd}=await wholeFixture(t,{regionCount:2});let crossed=false;
 const review=await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(command,args,options)=>{
  const context=JSON.parse(await readFile(join(options.cwd,'review-context.json'),'utf8')),refs=context.evidence.map(item=>item.reference);
  if(context.reviewPurpose==='cross-region'){
   crossed=true;assert.equal(context.plannedCaptures.length,6);assert.equal(refs.length,6);
   assert.ok(context.originalAssignment.every(item=>item.assigned&&item.reviewedRegionally));
   for(const ref of refs){assert.ok(args.includes(join(options.cwd,ref)));assert.deepEqual(await readFile(join(options.cwd,ref)),png);}
   assert.match(options.input,/Missing assigned originals/);
  }
  await writeFile(args[args.indexOf('-o')+1],JSON.stringify(responseFor(context,{...result,verdict:'pass',screenshotRefs:refs})));
 }});
 assert.ok(crossed);assert.equal(review.verdict,'pass');assert.equal((await loadRun(run.directory)).manifest.judgment,null);
});
