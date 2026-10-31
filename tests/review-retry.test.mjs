import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRun,saveCapture,saveEvaluation,confirmFinding,saveVisualReview,loadRun,saveReviewAttachment,saveJudgment} from '../packages/harness-core/store.js';
import {prepareProtocolRetry,prepareEvidenceRetry,CURRENT_VISUAL_REVIEW_PROTOCOL} from '../packages/harness-core/review-retry.js';
import {readVisualReviewBinding} from '../packages/harness-core/visual-review-binding.js';
import {runAiVisualReview} from '../packages/workbench/ai-review.js';
import {exportRun} from '../packages/harness-core/export.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
async function fixture(t,overrides={}){
 const root=await mkdtemp(join(tmpdir(),'review-retry-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const spec=JSON.parse(await readFile(new URL('../examples/happyclaw-site/experience.json',import.meta.url)));
 const {directory}=await createRun({spec,url:'http://localhost',outputRoot:root,id:'retry-test'});
 for(const phase of ['before','after']){if(phase==='after')await confirmFinding(directory,spec.findings[0].id,'supported','Synthetic fixture');await mkdir(join(directory,phase));await writeFile(join(directory,phase,'desktop.png'),png);await saveCapture(directory,phase,{viewports:{desktop:{screenshot:`${phase}/desktop.png`}}});}
 await saveEvaluation(directory,{status:'fixture'});
 const review={schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'model',name:'Synthetic previous reviewer',version:'ai-visual-review@13; fixture'},reviewedAt:new Date().toISOString(),verdict:'needs-evidence',screenshotRefs:['before/desktop.png','after/desktop.png'],findings:[],rationale:'Synthetic former scope uncertainty.',limitations:['Test fixture only.'],...overrides};
 await saveVisualReview(directory,review);return {root,directory,review,run:await loadRun(directory)};
}
async function model(_command,args,options){
 const context=JSON.parse(await readFile(join(options.cwd,'review-context.json')));
 assert.equal(context.previousReview.verdict,'needs-evidence');assert.equal(context.reviewAttempt.fromProtocol,'ai-visual-review@13');
 await writeFile(args[args.indexOf('-o')+1],JSON.stringify({verdict:'needs-evidence',screenshotRefs:context.evidence.map(item=>item.reference),findings:[],rationale:'Synthetic retry remains uncertain, never upgraded.',limitations:['Fixture images cannot establish quality.']}));
}

test('a protocol retry preserves old bytes and bindings, exports history and cannot reroll the current method',async t=>{
 const {root,directory,run}=await fixture(t),old=run.manifest.visualReviews[0],bytes=await readFile(join(directory,old.path));
 const cwd=join(root,'new-method');await mkdir(cwd);
 const review=await runAiVisualReview(directory,{cwd,signal:new AbortController().signal,retry:{reason:'Explicit protocol scope repair fixture.'},generate:model});
 assert.equal(review.verdict,'needs-evidence');assert.equal(review.attempt.toProtocol,CURRENT_VISUAL_REVIEW_PROTOCOL);
 const current=await loadRun(directory);assert.equal(current.manifest.visualReviewHistory.length,1);assert.deepEqual(current.manifest.visualReviewHistory[0],old);
 assert.deepEqual(await readFile(join(directory,old.path)),bytes);assert.notEqual(current.manifest.visualReviews[0].path,old.path);
 assert.equal((await readVisualReviewBinding(current,old,{requireBound:true})).status,'bound');assert.equal((await readVisualReviewBinding(current,current.manifest.visualReviews[0],{requireBound:true})).status,'bound');
 assert.equal(current.manifest.judgment,null);assert.equal(current.manifest.verificationEvidence,undefined);
 const exported=await exportRun({directory,outputRoot:join(root,'public')});assert.deepEqual(await readFile(join(exported.directory,old.path)),bytes);
 await rm(join(directory,old.path));await assert.rejects(readVisualReviewBinding(current,current.manifest.visualReviews[0]),/ENOENT/);await writeFile(join(directory,old.path),bytes);
 await assert.rejects(prepareProtocolRetry(current,current.manifest.visualReviews[0],{reason:'Try another random result.'}),/unchanged methods/);
 let called=false;const cached=await runAiVisualReview(directory,{cwd,signal:new AbortController().signal,retryOnProtocolChange:true,generate:async()=>{called=true;}});
 assert.equal(called,false);assert.deepEqual(cached,review);
});

test('failed protocol generation leaves the prior review effective and a workbench protocol upgrade is explicit',async t=>{
 const {root,directory,run}=await fixture(t),old=run.manifest.visualReviews[0],before=await readFile(join(directory,old.path));
 const failed=join(root,'failed');await mkdir(failed);
 await assert.rejects(runAiVisualReview(directory,{cwd:failed,signal:new AbortController().signal,retryOnProtocolChange:true,generate:async()=>{throw Error('Provider offline fixture');}}),/Provider offline/);
 assert.deepEqual((await loadRun(directory)).manifest.visualReviews,[old]);assert.deepEqual(await readFile(join(directory,old.path)),before);
 const cwd=join(root,'workbench');await mkdir(cwd);
 const review=await runAiVisualReview(directory,{cwd,signal:new AbortController().signal,retryOnProtocolChange:true,generate:model});
 assert.equal(review.verdict,'needs-evidence');assert.match(review.attempt.reason,/workbench/);assert.equal((await loadRun(directory)).manifest.visualReviewHistory.length,1);
});

test('protocol retries reject human decisions, recorded findings and stale or forged retry identity',async t=>{
 const {directory,run,review}=await fixture(t),old=run.manifest.visualReviews[0],attempt=await prepareProtocolRetry(run,old,{reason:'Protocol fix fixture.'});
 await assert.rejects(prepareProtocolRetry({...run,manifest:{...run.manifest,judgment:{decision:'reject'}}},old,{reason:'Override user.'}),/human decision/);
 const changed={...review,reviewer:{...review.reviewer,version:CURRENT_VISUAL_REVIEW_PROTOCOL+'; fixture'},attempt:{...attempt,previousReviewHash:'0'.repeat(64)}};
 await assert.rejects(saveVisualReview(directory,changed),/no longer matches/);
 assert.equal((await loadRun(directory)).manifest.visualReviewHistory,undefined);
 const candidate={...review,reviewer:{...review.reviewer,version:CURRENT_VISUAL_REVIEW_PROTOCOL+'; fixture'},attempt};
 const results=await Promise.allSettled([saveVisualReview(directory,candidate),saveVisualReview(directory,candidate)]);
 assert.equal(results.filter(item=>item.status==='fulfilled').length,1);assert.equal(results.filter(item=>item.status==='rejected').length,1);
 const current=await loadRun(directory);assert.equal(current.manifest.visualReviewHistory.length,1);
 const finding={id:'ISSUE',title:'Synthetic unresolved issue',observation:'Fixture observation',impact:3,confidence:'high',screenshotRefs:['after/desktop.png']};
 const withFinding=await fixture(t,{findings:[finding]});await assert.rejects(prepareProtocolRetry(withFinding.run,withFinding.run.manifest.visualReviews[0],{reason:'Ignore finding.'}),/unresolved findings/);
});

async function failedFixture(t){return fixture(t,{verdict:'fail',reviewer:{type:'model',name:'Synthetic failed reviewer',version:CURRENT_VISUAL_REVIEW_PROTOCOL+'; fixture'},findings:[{id:'DOCUMENT_SHIFT',title:'Fixture document shift',observation:'Fixture disputed finding',impact:3,confidence:'high',screenshotRefs:['after/desktop.png']}]});}
async function counterEvidence(directory){return saveReviewAttachment(directory,{screenshot:'after/desktop.png',fingerprint:createHash('sha256').update(png).digest('hex'),image:png,notes:'Synthetic counter-evidence; fixture only, not a real visual acceptance.'});}
test('counter-evidence permits a new model review, retains original failure and never fills a human decision',async t=>{
 const {directory,root,run}=await failedFixture(t),old=run.manifest.visualReviews[0],oldBytes=await readFile(join(directory,old.path));
 await assert.rejects(saveJudgment(directory,'accept','Cannot bypass failure'),/did not pass/);
 const attachment=await counterEvidence(directory),cwd=join(root,'counter-review');await mkdir(cwd);
 const result=await runAiVisualReview(directory,{cwd,signal:new AbortController().signal,evidenceRetry:{reason:'Review new measurements against the disputed shift.',evidenceIds:[attachment.id]},generate:async(_command,args,options)=>{
  const context=JSON.parse(await readFile(join(options.cwd,'review-context.json')));assert.equal(context.previousReview.findings[0].id,'DOCUMENT_SHIFT');assert.equal(context.annotations.length,1);assert.match(options.input,/COUNTER-EVIDENCE REVIEW/);
  await writeFile(args[args.indexOf('-o')+1],JSON.stringify({verdict:'pass',screenshotRefs:context.evidence.map(item=>item.reference),findings:[],rationale:'Synthetic resolution only.',limitations:['Test fixture, not visual acceptance.'],findingResolutions:[{findingId:'DOCUMENT_SHIFT',verdict:'refuted',rationale:'Synthetic new measurement refutes this fixture finding.',attachmentRefs:[attachment.id]}]}));
 }});
 assert.equal(result.attempt.kind,'evidence-retry');const current=await loadRun(directory);assert.equal(current.manifest.judgment,null);assert.deepEqual(await readFile(join(directory,old.path)),oldBytes);assert.deepEqual(current.manifest.visualReviewHistory,[old]);
 await readVisualReviewBinding(current,current.manifest.visualReviews[0],{requireBound:true});
 const exported=await exportRun({directory,outputRoot:join(root,'export')});assert.deepEqual(await readFile(join(exported.directory,old.path)),oldBytes);
 await writeFile(join(directory,attachment.path),'tampered');await assert.rejects(saveJudgment(directory,'accept','Fixture test only'),/changed/);
});
test('same evidence, forged lineage, omitted or unresolved findings cannot clear a failed review',async t=>{
 const {directory,run,review}=await failedFixture(t);await assert.rejects(prepareEvidenceRetry(run,run.manifest.visualReviews[0],{reason:'Reroll',evidenceIds:[]}),/counter-evidence/);
 const evidence=await counterEvidence(directory),current=await loadRun(directory),old=current.manifest.visualReviews[0];const attempt=await prepareEvidenceRetry(current,old,{reason:'New evidence',evidenceIds:[evidence.id]});
 const candidate={...review,verdict:'pass',findings:[],attachmentRefs:[evidence.id],attempt};
 await assert.rejects(saveVisualReview(directory,candidate),/every previous finding/);
 candidate.findingResolutions=[{findingId:'DOCUMENT_SHIFT',verdict:'supported',rationale:'Issue still present',attachmentRefs:[evidence.id]}];await assert.rejects(saveVisualReview(directory,candidate),/Unresolved findings/);
 candidate.findingResolutions[0].verdict='refuted';candidate.attempt={...attempt,evidenceHash:'0'.repeat(64)};await assert.rejects(saveVisualReview(directory,candidate),/no longer matches/);
 assert.deepEqual((await loadRun(directory)).manifest.visualReviews,[old]);
 const failed={...review,attachmentRefs:[evidence.id],attempt,findingResolutions:[{findingId:'DOCUMENT_SHIFT',verdict:'supported',rationale:'Still supported in fixture.',attachmentRefs:[evidence.id]}]};await saveVisualReview(directory,failed);
 const after=await loadRun(directory);await assert.rejects(prepareEvidenceRetry(after,after.manifest.visualReviews[0],{reason:'Same evidence again',evidenceIds:[evidence.id]}),/must be new/);
 await saveJudgment(directory,'reject','Explicit fixture rejection');await assert.rejects(counterEvidence(directory),/already recorded/);
});
test('provider failure or tampered source preserves the active failure and evidence retry rejects prior human decisions',async t=>{
 const {directory,root}=await failedFixture(t),item=await counterEvidence(directory),run=await loadRun(directory),old=run.manifest.visualReviews[0];
 await assert.rejects(prepareEvidenceRetry({...run,manifest:{...run.manifest,judgment:{decision:'reject'}}},old,{reason:'Override person',evidenceIds:[item.id]}),/human decision/);
 const cwd=join(root,'offline');await mkdir(cwd);await assert.rejects(runAiVisualReview(directory,{cwd,signal:new AbortController().signal,evidenceRetry:{reason:'New evidence',evidenceIds:[item.id]},generate:async()=>{throw Error('Provider offline fixture');}}),/Provider offline/);assert.deepEqual((await loadRun(directory)).manifest.visualReviews,[old]);
 await writeFile(join(directory,'after/desktop.png'),'changed');await assert.rejects(prepareEvidenceRetry(await loadRun(directory),old,{reason:'Wrong source',evidenceIds:[item.id]}),/changed/);
});


test('missing-evidence review requires genuinely new bound evidence and retains the previous review',async t=>{
 const {directory,run}=await fixture(t,{reviewer:{type:'model',name:'Fixture',version:CURRENT_VISUAL_REVIEW_PROTOCOL+'; fixture'}}),old=run.manifest.visualReviews[0];
 await assert.rejects(prepareEvidenceRetry(run,old,{reason:'No new evidence',evidenceIds:[]}),/counter-evidence/);
 const attachment=await counterEvidence(directory),current=await loadRun(directory),attempt=await prepareEvidenceRetry(current,old,{reason:'New source-bound interaction capture',evidenceIds:[attachment.id]});
 assert.equal(attempt.kind,'evidence-retry');assert.equal(attempt.previousReviewPath,old.path);
 assert.deepEqual(current.manifest.visualReviews,[old]);assert.equal(current.manifest.judgment,null);
 await saveVisualReview(directory,{schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'model',name:'New fixture reviewer',version:CURRENT_VISUAL_REVIEW_PROTOCOL+'; fixture'},reviewedAt:new Date().toISOString(),verdict:'pass',screenshotRefs:['before/desktop.png','after/desktop.png'],findings:[],rationale:'Synthetic new evidence only',limitations:['Fixture, not product acceptance'],attempt,attachmentRefs:[attachment.id],findingResolutions:[]});
 const after=await loadRun(directory);await readVisualReviewBinding(after,after.manifest.visualReviews[0],{requireBound:true});
 assert.deepEqual(after.manifest.visualReviewHistory,[old]);
});
