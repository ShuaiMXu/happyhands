import test from 'node:test';
import assert from 'node:assert/strict';
import {brandReviewReferences,brandReviewOriginals,assertBrandAssessments,aggregateBrandAssessments} from '../packages/skill-core/brand-review.js';
const declaration={source:'BRAND.md',line:2,category:'voice',fileHash:'a'.repeat(64),text:'Direct',status:'observed'};
const context={before:{brandEvidence:{declarations:[declaration]}},after:{brandEvidence:{declarations:[{...declaration,text:'Clear',fileHash:'b'.repeat(64)}]}}};
function review(verdict='aligned'){
  return {screenshotRefs:['before/page.png','after/page.png'],brandAssessments:brandReviewReferences(context).map(item=>({reference:item.reference,verdict,observation:'Synthetic comparison of this source and assigned original only.',screenshotRefs:[`${item.phase}/page.png`]}))};
}
test('each declaration needs an explicit scoped assessment and matching-phase original',()=>{
  assert.doesNotThrow(()=>assertBrandAssessments(review(),context));
  assert.throws(()=>assertBrandAssessments({screenshotRefs:[]},context),/every/);
  for(const change of [row=>row.reference='foreign',row=>row.observation=' ',row=>row.screenshotRefs=[],row=>row.screenshotRefs=['after/page.png'],row=>row.score=100]){
    const input=review();change(input.brandAssessments[0]);assert.throws(()=>assertBrandAssessments(input,context),/Invalid/);
  }
  const duplicate=review();duplicate.brandAssessments[1]=duplicate.brandAssessments[0];assert.throws(()=>assertBrandAssessments(duplicate,context),/Invalid/);
  const missing=review();missing.brandAssessments.pop();assert.throws(()=>assertBrandAssessments(missing,context),/every/);
});
test('unseen and out-of-scope declarations need explanations without invented image evidence',()=>{
  const input=review('out-of-scope');for(const row of input.brandAssessments)row.screenshotRefs=[];
  assert.doesNotThrow(()=>assertBrandAssessments(input,context));
  assert.doesNotThrow(()=>assertBrandAssessments({screenshotRefs:[]},{before:null,after:null}));
  assert.throws(()=>assertBrandAssessments(review(),{}),/every/);
});

test('brand phase allowlists exclude specialist images and annotations without relaxing assessment admission',()=>{
 const supplemental='verification/fixture/image-0.png';
 assert.deepEqual(brandReviewOriginals(['before/page.png','after/page.png','before/page.png',supplemental,'reviews/attachments/fixture.png']),{before:['before/page.png'],after:['after/page.png']});
 const input=review();input.screenshotRefs.push(supplemental);input.brandAssessments[1].screenshotRefs.push(supplemental);
 assert.throws(()=>assertBrandAssessments(input,context),/Invalid/);
});
test('aggregate preserves every session claim, conflicts and uncertainty rather than choosing a winner',()=>{
  const a=review(),b=review('conflict'),c=review('out-of-scope');
  const rows=aggregateBrandAssessments([a,b,c],context);assert.equal(rows.length,2);assert.ok(rows.every(row=>row.verdict==='conflict'));
  assert.match(rows[0].observation,/Session 1 \[aligned\]/);assert.match(rows[0].observation,/Session 3 \[out-of-scope\]/);
  assert.doesNotThrow(()=>assertBrandAssessments({...a,brandAssessments:rows},context));
  const long=review();long.brandAssessments[0].observation='x'.repeat(2500);assert.throws(()=>aggregateBrandAssessments([long,a],context),/budget/);
});
