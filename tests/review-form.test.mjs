import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReviewRecord,reviewScreenshots} from '../apps/designer/cowart/review-form.js';
import {assertVisualReview} from '../packages/harness-core/visual-review.js';
const manifest={captures:{before:{viewports:{desktop:{screenshot:'before/desktop.png'},mobile:{screenshot:'before/mobile.png'}}},after:{viewports:{desktop:{screenshot:'after/desktop.png'},mobile:{screenshot:'after/mobile.png'}}}}};
const input={skillId:'visual-qa-evaluator',name:'Reviewer',verdict:'pass',independent:true,rationale:'Inspected both layouts',limitations:'No user testing',screenshotRefs:reviewScreenshots(manifest,'visual-qa-evaluator'),findings:[]};
test('human review form produces a schema-valid attestation without inventing findings',()=>{
 const record=buildReviewRecord(input,manifest,'2026-09-29');assert.equal(assertVisualReview(record,manifest).reviewer.type,'human');assert.equal(record.reviewedAt,'2026-09-29');assert.deepEqual(record.findings,[]);
});
test('review form requires explicit independence, identity, verdict and evidence',()=>{
 for(const change of [{independent:false},{name:''},{verdict:''},{screenshotRefs:[]},{screenshotRefs:['before/foreign.png']},{limitations:''}])assert.throws(()=>buildReviewRecord({...input,...change},manifest));
});
test('failed review needs findings; annotations cannot bypass coverage validation',()=>{
 assert.throws(()=>buildReviewRecord({...input,verdict:'fail'},manifest));
 const record=buildReviewRecord({...input,screenshotRefs:['before/desktop.png']},manifest);assert.throws(()=>assertVisualReview(record,manifest),/matched/);
 const failed=buildReviewRecord({...input,verdict:'fail',findings:[{title:'Contrast',observation:'The text is faint',impact:3,confidence:'high'}]},manifest);assert.equal(assertVisualReview(failed,manifest).findings[0].id,'VISUAL_1');
});
test('baseline reviews exclude after images and unsafe screenshot paths',()=>{
 assert.deepEqual(reviewScreenshots(manifest,'visual-hierarchy-reviewer'),['before/desktop.png','before/mobile.png']);
 assert.deepEqual(reviewScreenshots({captures:{before:{viewports:{desktop:{screenshot:'../../secret.png'}}}}},'visual-hierarchy-reviewer'),[]);
});
