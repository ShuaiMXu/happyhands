import test from 'node:test';
import assert from 'node:assert/strict';
import { assertVisualReview } from '../packages/harness-core/visual-review.js';

const manifest = {
  captures: {
    before: { viewports: { desktop: { screenshot: 'before/desktop.png' }, mobile: { screenshot: 'before/mobile.png' } } },
    after: { viewports: { desktop: { screenshot: 'after/desktop.png' }, mobile: { screenshot: 'after/mobile.png' } } }
  }
};

function review(skillId, verdict = 'fail') {
  const qa = skillId === 'visual-qa-evaluator';
  return {
    schemaVersion: '0.1', skillId,
    reviewer: { type: 'model', name: 'visual-reviewer', version: '1.0' },
    reviewedAt: '2026-09-21T00:00:00.000Z', verdict,
    screenshotRefs: qa ? ['before/desktop.png', 'after/desktop.png', 'before/mobile.png', 'after/mobile.png'] : ['before/desktop.png', 'before/mobile.png'],
    findings: verdict === 'fail' ? [{ id: 'VISUAL_HIERARCHY_1', title: 'Primary action lacks emphasis', observation: 'Primary and secondary actions have equal visual weight.', impact: 4, confidence: 'medium', screenshotRefs: ['before/desktop.png'] }] : [],
    rationale: 'Compared task clarity and visual prominence in every cited viewport.',
    limitations: ['No behavioral data was available.']
  };
}

const firstRender = {
  baseline: { status: 'absent', reason: 'No entry route renders /jobs.' },
  captures: {
    before: null,
    after: { viewports: { desktop: { screenshot: 'after/desktop.png' }, mobile: { screenshot: 'after/mobile.png' } } }
  }
};

test('a first render is reviewed without a baseline, but every rendered viewport must be cited', () => {
  const full = review('visual-qa-evaluator', 'pass');
  full.screenshotRefs = ['after/desktop.png', 'after/mobile.png'];
  assert.equal(assertVisualReview(full, firstRender).verdict, 'pass');
  const partial = { ...full, screenshotRefs: ['after/desktop.png'] };
  assert.throws(() => assertVisualReview(partial, firstRender), /cannot stand in for the others/i);
  // A run that merely lacks a baseline, without recording why, still needs both captures.
  assert.throws(() => assertVisualReview(full, { captures: firstRender.captures }), /before and after captures/i);
});

test('visual hierarchy attestation must cite screenshots in the current run', () => {
  assert.equal(assertVisualReview(review('visual-hierarchy-reviewer'), manifest).verdict, 'fail');
  const invalid = review('visual-hierarchy-reviewer');
  invalid.screenshotRefs[0] = 'before/tablet.png';
  assert.throws(() => assertVisualReview(invalid, manifest), /must match pattern|absent from this run/i);
});

test('visual QA requires matched before and after evidence for every viewport', () => {
  const valid = review('visual-qa-evaluator');
  assert.equal(assertVisualReview(valid, manifest).skillId, 'visual-qa-evaluator');
  valid.screenshotRefs = valid.screenshotRefs.filter(ref => ref !== 'after/mobile.png');
  assert.throws(() => assertVisualReview(valid, manifest), /matched before\/after mobile/i);
});

test('pass and fail verdicts have coherent finding requirements', () => {
  assert.equal(assertVisualReview(review('visual-hierarchy-reviewer', 'pass'), manifest).findings.length, 0);
  const invalid = review('visual-hierarchy-reviewer', 'pass');
  invalid.findings = review('visual-hierarchy-reviewer').findings;
  assert.throws(() => assertVisualReview(invalid, manifest), /passing visual review/i);
});

test('a pass cannot omit planned after states even when their baseline failed to render',()=>{
 const missing=structuredClone(manifest);missing.captures.before.states=[{stateId:'menu',configurationId:'mobile',reached:false},{stateId:'stable',configurationId:'desktop',screenshot:'before/desktop.png'}];missing.captures.after.states=[{stateId:'stable',configurationId:'desktop',screenshot:'after/desktop.png'}];
 const passing=review('visual-qa-evaluator','pass');passing.screenshotRefs=['before/desktop.png','after/desktop.png'];
 assert.throws(()=>assertVisualReview(passing,missing),/every planned after state/);
});
