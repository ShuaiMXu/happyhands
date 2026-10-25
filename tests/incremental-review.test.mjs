import test from 'node:test';
import assert from 'node:assert/strict';
import { incrementalReviewPlan } from '../packages/harness-core/incremental.js';

const foundation = { brand: { assets: [] }, tokens: [{ name: 'Color', source: 'src/styles/tokens.css' }], components: [{ name: 'Checkout', source: 'src/components/Checkout.tsx' }], patterns: [] };
const parent = files => ({ manifest: { execution: { changedFiles: files }, judgment: { decision: 'accept' } } });
const delta=files=>({status:'verified',changes:files.map(path=>({path,kind:'modified'}))});

test('accepted token changes route to design-system checks and cite the affected foundation', () => {
  const plan = incrementalReviewPlan(parent(['old.css']), foundation,delta(['src/styles/tokens.css']));
  assert.equal(plan.mode, 'incremental');
  assert.deepEqual(plan.affectedFoundation.map(item => item.name), ['Color']);
  assert.ok(plan.skills.includes('token-contrast-auditor'));
  assert.ok(plan.skills.includes('design-system-drift-detector'));
});

test('component changes include interaction and state checks while preserving accessibility coverage', () => {
  const plan = incrementalReviewPlan(parent(['old.css']), foundation,delta(['src/components/Checkout.tsx']));
  assert.ok(plan.skills.includes('component-state-auditor'));
  assert.ok(plan.skills.includes('interaction-reviewer'));
  assert.ok(plan.skills.includes('accessibility-reviewer'));
});

test('unaccepted history falls back to a full review', () => {
  const run = parent(['src/page.tsx']); run.manifest.judgment.decision = 'reject';
  assert.equal(incrementalReviewPlan(run, foundation).mode, 'full');
});

test('extension routing is independent of changed-file order',()=>{
  for(const files of [['src/a.css','src/b.md'],['src/b.md','src/a.css']]){
    assert.ok(incrementalReviewPlan(parent([]),{},delta(files)).skills.includes('token-contrast-auditor'));
  }
  assert.ok(incrementalReviewPlan(parent([]),{},delta(['src/A.tsx','notes.md'])).skills.includes('interaction-reviewer'));
  assert.ok(incrementalReviewPlan(parent([]),{},delta(['src/a.html','notes.md'])).skills.includes('content-design-reviewer'));
});

test('an old execution file list never substitutes for a verified current delta',()=>{
  assert.equal(incrementalReviewPlan(parent(['src/components/Checkout.tsx']),foundation).mode,'full');
  assert.equal(incrementalReviewPlan(parent([]),foundation,delta(['public/logo.png'])).mode,'full');
  assert.equal(incrementalReviewPlan(parent([]),foundation,delta([])).reasonCode,'unchanged-source');
  assert.deepEqual(incrementalReviewPlan(parent([]),{components:[{name:'wrong',source:'Checkout.tsx'}]},delta(['src/components/Checkout.tsx'])).affectedFoundation,[]);
});
