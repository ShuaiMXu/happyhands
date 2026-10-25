import test from 'node:test';
import assert from 'node:assert/strict';
import { exportedReviewState } from '../apps/designer/cowart/review-state.js';
const document={schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'model',name:'Independent reviewer',version:'1'},reviewedAt:'2026-09-30',verdict:'pass',screenshotRefs:['before/desktop.png','after/desktop.png'],findings:[],rationale:'Inspected the matched states.',limitations:['No behavioral data.']};
function fixture(){return {manifest:{captures:{before:{viewports:{desktop:{screenshot:'before/desktop.png'}}},after:{viewports:{desktop:{screenshot:'after/desktop.png'}}}},diagnosis:{},confirmation:{verdict:'supported'},plan:{},evaluation:{},visualReviews:[{skillId:'visual-qa-evaluator',verdict:'pass'}],judgment:null},reviews:[{skillId:'visual-qa-evaluator',document:structuredClone(document),problem:null}]};}
test('an exported completed comparison retains independent QA without becoming a writable run',()=>{
 const run=fixture(),original=structuredClone(run),state=exportedReviewState(run);
 assert.equal(state.readOnly,true);assert.equal(state.workflow.stage,'awaiting-judgment');assert.equal(state.reviews[0].verdict,'pass');assert.equal(state.judgment,null);assert.deepEqual(state.jobs,[]);assert.deepEqual(run,original);
 run.manifest.judgment={decision:'reject',reason:'Brand mismatch'};assert.equal(exportedReviewState(run).judgment.decision,'reject');
});
test('missing, mismatched and incomplete review evidence cannot manufacture an exported QA pass',()=>{
 for(const mutate of [run=>{run.reviews[0].problem='Missing artifact';},run=>{run.reviews[0].document=null;},run=>{run.reviews[0].skillId='visual-hierarchy-reviewer';},run=>{run.reviews[0].document.screenshotRefs=['before/desktop.png'];},run=>{run.reviews[0].document.screenshotRefs.push('after/missing.png');}]){
  const run=fixture();mutate(run);const state=exportedReviewState(run);assert.equal(state.reviews.length,0);assert.equal(state.workflow.stage,'needs-visual-qa');assert.equal(state.readOnly,true);
 }
});
