import test from 'node:test';
import assert from 'node:assert/strict';
import corpus from '../regression/cases.json' with { type: 'json' };
import { runRegression, compareReports } from '../packages/skill-core/regression.js';
import { skillResult } from '../packages/skill-core/result.js';

const skill = { id: 'test-reviewer', version: '1.0.0', role: 'review' };
const empty = () => ({ status: 'complete', evidence: [], findings: [], proposedUpdates: [], limitations: [] });

test('synthetic regression corpus passes evidence, confirmation, priority, QA and score gates', async () => {
  const report = await runRegression(corpus);
  assert.equal(report.cases.length, 28);
  assert.equal(report.passed, true, JSON.stringify(report.cases.filter(entry => !entry.passed)));
  assert.equal(report.modelReview.status, 'not-run');
  assert.match(report.implementationHash, /^[a-f0-9]{64}$/);
  const repeat = await runRegression(corpus, { baseline: report });
  assert.ok(repeat.changes.every(entry => entry.change === 'unchanged'));
  assert.equal(repeat.requiresReview, false);
});

test('unreviewed human feedback cannot enter the release regression set', async () => {
  const candidate = structuredClone(corpus);
  candidate.cases[0].feedback = { status: 'candidate', reason: 'A user liked this result.' };
  await assert.rejects(runRegression(candidate), /requires recorded review/);
});

test('regression reports expose fixed, regressed, changed and removed cases', () => {
  const before = { cases: [
    { id: 'fixed', caseHash: 'a', passed: false },
    { id: 'regressed', caseHash: 'b', passed: true },
    { id: 'rewritten', caseHash: 'c', passed: false },
    { id: 'removed', caseHash: 'd', passed: true }
  ] };
  const after = { cases: [
    { id: 'fixed', caseHash: 'a', passed: true },
    { id: 'regressed', caseHash: 'b', passed: false },
    { id: 'rewritten', caseHash: 'new', passed: true },
    { id: 'new', caseHash: 'e', passed: true }
  ] };
  assert.deepEqual(compareReports(after, before).map(entry => entry.change), ['fixed', 'regressed', 'case-changed', 'added', 'removed']);
});

test('removing a baseline case requires review even if every remaining case passes', async () => {
  const baseline = await runRegression(corpus);
  baseline.cases.push({ id: 'removed-case', caseHash: 'old', passed: true });
  const report = await runRegression(corpus, { baseline });
  assert.equal(report.passed, true);
  assert.equal(report.requiresReview, true);
});

test('a sourced finding is preserved but an empty or source-less finding is rejected', () => {
  for (const evidence of [undefined, [], [null], [{}]]) {
    const value = { ...empty(), findings: [{ id: 'F1', evidence }] };
    assert.throws(() => skillResult(skill, value), /requires evidence/);
  }
  const value = { ...empty(), findings: [{ id: 'F1', evidence: [{ screenshot: 'before/desktop.png' }] }] };
  assert.equal(skillResult(skill, value).findings.length, 1);
});

test('a handler cannot publish an unvalidated score or overwrite provenance', () => {
  assert.throws(() => skillResult(skill, { ...empty(), score: 95 }), /rubric evaluator/);
  const provenance = { implementationHash: 'trusted' };
  const result = skillResult(skill, { ...empty(), skill: { id: 'forged' }, provenance: { implementationHash: 'forged' } }, provenance);
  assert.equal(result.skill.id, skill.id);
  assert.equal(result.provenance.implementationHash, 'trusted');
});
