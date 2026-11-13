import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPageStructureReview,STRUCTURE_DIMENSIONS} from '../packages/harness-core/page-structure-review.js';
import {assertVisualReview} from '../packages/harness-core/visual-review.js';
const manifest = {captures:{before:{viewports:{desktop:{screenshot:'before/desktop.png'}}}}};
function review() { return {schemaVersion:'0.1',skillId:'visual-hierarchy-reviewer',reviewer:{type:'model',name:'test',version:'1'},reviewedAt:'2026-11-13',verdict:'pass',rationale:'Reviewed original evidence.',limitations:['Synthetic test only.'],screenshotRefs:['before/desktop.png'],findings:[],structureChecks:STRUCTURE_DIMENSIONS.map(d=>({screenshot:'before/desktop.png',dimension:d,status:'pass',observed:'Measured current rendering.',expected:'Preserve adopted contract.',basis:'Project documented contract.',method:'Original screenshot and DOM.'})),annotations:[]}; }
test('structured review passes schema and runtime validation',()=>assertVisualReview(review(),manifest));
test('missing dimensions and duplicate contexts are rejected',()=>{const r=review();r.structureChecks.pop();assert.throws(()=>assertPageStructureReview(r,manifest),/Every original/);r.structureChecks.push(r.structureChecks[0]);assert.throws(()=>assertPageStructureReview(r,manifest),/duplicate/);});
test('unknown evidence and unresolved checks cannot pass',()=>{const r=review();r.structureChecks[0].screenshot='invented.png';assert.throws(()=>assertPageStructureReview(r,manifest),/unknown/);r.structureChecks[0].screenshot='before/desktop.png';r.structureChecks[0].status='needs-evidence';assert.throws(()=>assertPageStructureReview(r,manifest),/prevents/);r.verdict='needs-evidence';assertPageStructureReview(r,manifest);});
test('findings require valid original-image boxes',()=>{const r=review();r.verdict='fail';r.findings=[{id:'F1',screenshotRefs:['before/desktop.png']}];assert.throws(()=>assertPageStructureReview(r,manifest),/annotation/);r.annotations=[{id:'A1',findingId:'F1',screenshot:'before/desktop.png',label:'Small action target',box:{x:.1,y:.2,width:.3,height:.4}}];assertPageStructureReview(r,manifest);r.annotations[0].box.width=1;assert.throws(()=>assertPageStructureReview(r,manifest),/coordinates/);});
test('annotations cannot cite unknown findings or substitute screenshots',()=>{const r=review();r.annotations=[{id:'A1',findingId:'ghost',screenshot:'before/desktop.png',box:{x:0,y:0,width:1,height:1}}];assert.throws(()=>assertPageStructureReview(r,manifest),/uniquely link/);});
test('missing structured checks are rejected',()=>{const r=review();delete r.structureChecks;assert.throws(()=>assertPageStructureReview(r,manifest),/structured checks/);});

test('original defects are not rewritten as passes after repair',()=>{const r=review();const m=structuredClone(manifest);m.captures.after={viewports:{desktop:{screenshot:'after/desktop.png'}}};r.screenshotRefs.push('after/desktop.png');r.structureChecks.push(...r.structureChecks.map(row=>({...row,screenshot:'after/desktop.png'})));r.structureChecks[0].status='fail';assertPageStructureReview(r,m);r.structureChecks[5].status='fail';assert.throws(()=>assertPageStructureReview(r,m),/prevents/);});
test('surface tile originals cannot silently escape review',()=>{const m=structuredClone(manifest);m.captures.before.viewports.desktop.interactionParts=[{screenshot:'before/expanded.png'}];assert.throws(()=>assertPageStructureReview(review(),m),/Every original/);});

test('current contract cannot pass QA without structured evidence',async()=>{
  const {methodStateEntries}=await import('../packages/harness-core/remediation-validation.js');
  const r=review();r.skillId='visual-qa-evaluator';delete r.structureChecks;delete r.annotations;
  const m=structuredClone(manifest);m.captures.after={viewports:{desktop:{screenshot:'after/desktop.png'}}};
  m.plan={remediation:{hash:'a'.repeat(64),ruleIds:['UX-page-structure']}};
  r.screenshotRefs.push('after/desktop.png');r.remediationHash=m.plan.remediation.hash;
  r.methodChecks=methodStateEntries(m).map(s=>({ruleId:'UX-page-structure',stateKey:s.key,status:'pass',reason:'Synthetic fixture checks only',screenshotRefs:[s.screenshot]}));
  assert.throws(()=>assertVisualReview(r,m),/structured checks/);
});

test('aggregation preserves worst status and prefixes annotation finding links',async()=>{
 const {aggregateStructureReviews}=await import('../packages/harness-core/page-structure-review.js');
 const a=review(),b=review();b.structureChecks[0].status='needs-evidence';a.annotations=[{id:'A1',findingId:'F1'}];b.annotations=[{id:'A1',findingId:'F1'}];
 const out=aggregateStructureReviews([a],b);assert.equal(out.structureChecks[0].status,'needs-evidence');assert.deepEqual(out.annotations.map(a=>[a.id,a.findingId]),[['B1_A1','B1_F1'],['X_A1','X_F1']]);
});
