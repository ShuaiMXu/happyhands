import {PNG} from 'pngjs';
import {STRUCTURE_DIMENSIONS} from '../packages/harness-core/page-structure-review.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {createRun,saveCapture,confirmFinding,saveEvaluation,saveVisualReview,loadRun,saveJudgment,saveOnboarding,saveReviewAttachment} from '../packages/harness-core/store.js';
import {verificationHash} from '../packages/harness-core/verification.js';
import {readVisualReviewBinding} from '../packages/harness-core/visual-review-binding.js';
import {exportRun,reindex} from '../packages/harness-core/export.js';
import {runAiVisualReview} from '../packages/workbench/ai-review.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
async function fixture(t,{save=true}={}){
  const root=await mkdtemp(join(tmpdir(),'review-binding-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'runs'));
  const created=await createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:join(root,'runs'),id:'binding-fixture'});
  await saveOnboarding(created.directory,{repository:{root:join(root,'private-project')},config:{repo:join(root,'private-project'),configPath:join(root,'private.json')}});
  for(const phase of ['before','after']){
    if(phase==='after')await confirmFinding(created.directory,'F1','supported','Synthetic fixture scope');
    await mkdir(join(created.directory,phase));await writeFile(join(created.directory,phase,'desktop.png'),png);
    await saveCapture(created.directory,phase,{viewports:{desktop:{screenshot:`${phase}/desktop.png`}}});
  }
  await saveEvaluation(created.directory,{status:'fixture'});
  const review={schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'model',name:'Synthetic fixture only',version:'test'},reviewedAt:new Date().toISOString(),verdict:'pass',screenshotRefs:['before/desktop.png','after/desktop.png'],findings:[],rationale:'Synthetic binding test, not a product assessment.',limitations:['No real model or human acceptance.']};
  if(save)await saveVisualReview(created.directory,review);
  const run=await loadRun(created.directory);return {root,run,review,reference:run.manifest.visualReviews[0]};
}

test('ordinary QA retains original hashes and survives judgment and sanitized export',async t=>{
  const {root,run,reference}=await fixture(t),binding=await readVisualReviewBinding(run,reference);
  assert.equal(binding.status,'bound');assert.equal(binding.record.originals.length,2);
  assert.equal(binding.record.inputAssurance,'attestation-time-snapshot');
  assert.ok(binding.record.originals.every(original=>/^[a-f0-9]{64}$/.test(original.hash)));
  assert.ok(!JSON.stringify(binding.record).includes(root));
  await saveJudgment(run.directory,'accept','Synthetic test decision only');const accepted=await loadRun(run.directory);
  assert.equal((await readVisualReviewBinding(accepted,reference)).status,'bound');
  const exported=await exportRun({directory:run.directory,outputRoot:join(root,'public')});assert.ok(exported.files.includes(reference.evidenceBinding.path));
  const copy=await loadRun(exported.directory);assert.equal((await readVisualReviewBinding(copy,copy.manifest.visualReviews[0])).status,'bound');
});

test('changed original bytes block accept, cached QA reuse and export without overwriting the original verdict',async t=>{
  const {root,run,reference}=await fixture(t);await writeFile(join(run.directory,'after','desktop.png'),Buffer.from('changed original'));
  await assert.rejects(readVisualReviewBinding(run,reference),/original changed/);
  await assert.rejects(saveJudgment(run.directory,'accept','Synthetic decision'),/original changed/);
  let called=false;await assert.rejects(runAiVisualReview(run.directory,{cwd:join(root,'cached'),signal:new AbortController().signal,generate:async()=>{called=true;}}),/original changed/);assert.equal(called,false);
  await assert.rejects(exportRun({directory:run.directory,outputRoot:join(root,'public')}),/original changed/);
  const latest=await loadRun(run.directory);assert.equal(latest.manifest.judgment,null);assert.equal(latest.manifest.visualReviews[0].verdict,'pass');
  await saveJudgment(run.directory,'reject','Synthetic rejection because evidence changed');assert.equal((await loadRun(run.directory)).manifest.judgment.decision,'reject');
});

test('changed review content, binding content and task context cannot reuse a pass label',async t=>{
  for(const kind of ['review','binding','task'])await t.test(kind,async sub=>{
    const {run,reference}=await fixture(sub);
    if(kind==='review'){const changed=JSON.parse(await readFile(join(run.directory,reference.path)));changed.rationale='Changed after attestation';await writeFile(join(run.directory,reference.path),JSON.stringify(changed));}
    if(kind==='binding')await writeFile(join(run.directory,reference.evidenceBinding.path),'{}');
    if(kind==='task'){const spec=structuredClone(run.spec);spec.project.task='Another task';await writeFile(join(run.directory,'experience.json'),JSON.stringify(spec));}
    const latest=await loadRun(run.directory);await assert.rejects(readVisualReviewBinding(latest,reference),/changed|bound/);
  });
});

test('a removed binding reference cannot masquerade as a legacy record',async t=>{
  const {run,reference}=await fixture(t),removed={...reference};delete removed.evidenceBinding;
  await assert.rejects(readVisualReviewBinding(run,removed),/binding reference is missing/);
});

test('genuine legacy fixtures remain unbound without fabricated backfill and cannot prove bound history',async t=>{
  const {root,run,reference}=await fixture(t);await rm(join(run.directory,reference.evidenceBinding.path));delete run.manifest.visualReviews[0].evidenceBinding;
  await writeFile(join(run.directory,'run.json'),JSON.stringify(run.manifest));const legacy=await loadRun(run.directory);
  assert.equal((await readVisualReviewBinding(legacy,legacy.manifest.visualReviews[0])).status,'legacy-unbound');
  await assert.rejects(readVisualReviewBinding(legacy,legacy.manifest.visualReviews[0],{requireBound:true}),/no durable evidence binding/);
  const exported=await exportRun({directory:run.directory,outputRoot:join(root,'legacy-export')});assert.ok(!exported.files.some(path=>path.endsWith('.binding.json')));
});

test('linked originals and changed expected model inputs are rejected',async t=>{
  const {root,run,reference}=await fixture(t);await rm(join(run.directory,'before'),{recursive:true,force:true});const outside=join(root,'linked-source');await mkdir(outside);await writeFile(join(outside,'desktop.png'),png);
  await symlink(outside,join(run.directory,'before'),process.platform==='win32'?'junction':'dir');await assert.rejects(readVisualReviewBinding(run,reference),/symlink/);
  const second=await fixture(t,{save:false});await assert.rejects(saveVisualReview(second.run.directory,second.review,{screenshotHashes:{'after/desktop.png':'0'.repeat(64)}}),/Screenshot changed/);
  assert.equal((await loadRun(second.run.directory)).manifest.visualReviews.length,0);
});

test('annotation notes are bound alongside their image and referenced source',async t=>{
  const {run,review}=await fixture(t,{save:false});
  const attachment=await saveReviewAttachment(run.directory,{screenshot:'before/desktop.png',fingerprint:verificationHash(png),image:png,notes:'Original synthetic annotation'});
  await saveVisualReview(run.directory,{...review,attachmentRefs:[attachment.id]});
  const current=await loadRun(run.directory),reference=current.manifest.visualReviews[0];assert.equal((await readVisualReviewBinding(current,reference)).record.originals.length,3);
  current.manifest.reviewAttachments[0].notes='Changed after review';await writeFile(join(run.directory,'run.json'),JSON.stringify(current.manifest));
  await assert.rejects(readVisualReviewBinding(await loadRun(run.directory),reference),/context changed/);
});

test('reindex cannot list a published pass whose bound original changed',async t=>{
  const {root,run}=await fixture(t),outputRoot=join(root,'public');
  const exported=await exportRun({directory:run.directory,outputRoot});await writeFile(join(exported.directory,'after','desktop.png'),'Changed published original');
  assert.deepEqual(await reindex(outputRoot),[]);
});

async function annotatedFixture(t){
  const {root,run,review}=await fixture(t,{save:false});
  const bytes=PNG.sync.write(new PNG({width:120,height:80}));
  for(const phase of ['before','after'])await writeFile(join(run.directory,phase,'desktop.png'),bytes);
  review.verdict='fail';
  review.findings=[{id:'F_ANNOTATED',title:'Synthetic layout defect',observation:'Synthetic overlap for renderer integration only.',impact:2,confidence:'high',screenshotRefs:['after/desktop.png']}];
  review.annotations=[{id:'A_1',findingId:'F_ANNOTATED',screenshot:'after/desktop.png',label:'Synthetic overlap',box:{x:.2,y:.2,width:.4,height:.4}}];
  review.structureChecks=review.screenshotRefs.flatMap(screenshot=>STRUCTURE_DIMENSIONS.map(dimension=>({screenshot,dimension,status:'pass',observed:'Synthetic observation',expected:'Synthetic expected layout',basis:'Test fixture only',method:'Synthetic image'})));
  review.structureChecks.find(row=>row.screenshot==='after/desktop.png'&&row.dimension==='alignment').status='fail';
  await saveVisualReview(run.directory,review);
  const saved=await loadRun(run.directory),reference=saved.manifest.visualReviews[0];
  const bound=await readVisualReviewBinding(saved,reference);
  return {root,run:saved,reference,bound};
}

test('saving a structured review renders bound images and export retains them',async t=>{
  const {root,run,reference,bound}=await annotatedFixture(t);
  assert.equal(bound.record.annotationArtifactsVersion,1);
  const [image]=bound.review.annotationArtifacts.images;
  assert.equal(image.screenshot,'after/desktop.png');assert.deepEqual(image.annotationIds,['A_1']);
  const svg=await readFile(join(run.directory,image.path),'utf8');assert.match(svg,/<svg/);assert.match(svg,/data:image\/png;base64,/);
  const exported=await exportRun({directory:run.directory,outputRoot:join(root,'annotated-export')});
  assert.ok(exported.files.includes(image.path));
  const copy=await loadRun(exported.directory);
  assert.equal((await readVisualReviewBinding(copy,reference)).review.annotationArtifacts.images[0].sha256,image.sha256);
});

test('missing or changed annotation outputs block reuse and export',async t=>{
  for(const kind of ['missing','changed'])await t.test(kind,async sub=>{
    const {root,run,reference,bound}=await annotatedFixture(sub);
    const path=join(run.directory,bound.review.annotationArtifacts.images[0].path);
    if(kind==='missing')await rm(path);else await writeFile(path,'<svg/>');
    await assert.rejects(readVisualReviewBinding(run,reference));
    await assert.rejects(exportRun({directory:run.directory,outputRoot:join(root,'invalid-export')}));
    assert.equal((await loadRun(run.directory)).manifest.visualReviews[0].verdict,'fail');
  });
});

test('no findings produce an explicit empty artifact set without fabricated boxes',async t=>{
  const {run,review}=await fixture(t,{save:false});review.annotations=[];
  review.structureChecks=review.screenshotRefs.flatMap(screenshot=>STRUCTURE_DIMENSIONS.map(dimension=>({screenshot,dimension,status:'pass',observed:'Synthetic observation',expected:'Synthetic expected layout',basis:'Test fixture only',method:'Synthetic image'})));
  await saveVisualReview(run.directory,review);
  const saved=await loadRun(run.directory),bound=await readVisualReviewBinding(saved,saved.manifest.visualReviews[0]);
  assert.deepEqual(bound.review.annotationArtifacts,{version:1,images:[]});
  assert.equal(bound.record.annotationArtifactsVersion,1);
});
