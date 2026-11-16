import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeReviewReferences} from '../packages/harness-core/review-reference-normalization.js';
const artifactId='11111111-1111-1111-1111-111111111111',image='verification/'+artifactId+'/image-0.png';
const record={id:'modal-check',artifactId,images:[{path:image}],status:'pass',stage:'normal-interaction'};
const manifest={captures:{before:{viewports:{desktop:{screenshot:'before/desktop.png'}}},after:{viewports:{desktop:{screenshot:'after/desktop.png'}}}},verificationEvidence:{digest:'a'.repeat(64)},verificationRecords:[record]};
const original={schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'model',name:'Synthetic protocol fixture',version:'1'},reviewedAt:'2026-11-16T00:00:00Z',verdict:'needs-evidence',screenshotRefs:['before/desktop.png','after/desktop.png',image],findings:[],rationale:'Test reference conversion only',limitations:['No real model inspection'],verificationDigest:'a'.repeat(64),verificationRefs:[artifactId],attachmentRefs:[artifactId]};
test('exact reference conversion preserves all semantic fields and leaves the original untouched',()=>{
 const saved=structuredClone(original),{review,provenance}=normalizeReviewReferences(original,manifest);assert.deepEqual(original,saved);assert.deepEqual(review.verificationRefs,['modal-check']);assert.deepEqual(review.attachmentRefs,[]);
 for(const key of Object.keys(original).filter(k=>!['verificationRefs','attachmentRefs'].includes(k)))assert.deepEqual(review[key],original[key]);assert.equal(provenance.changes.length,2);
});
test('ambiguous mappings, missing originals and unknown IDs are not guessed',()=>{
 assert.throws(()=>normalizeReviewReferences(original,{...manifest,verificationRecords:[record,{...record,id:'other'}]}),/unique/);
 assert.throws(()=>normalizeReviewReferences({...original,screenshotRefs:['before/desktop.png','after/desktop.png']},manifest),/inspected originals/);
 assert.throws(()=>normalizeReviewReferences({...original,verificationRefs:['unknown']},manifest),/unique/);
});
