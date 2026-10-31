import test from 'node:test';
import assert from 'node:assert/strict';
import sample from '../examples/happyclaw-site/experience.json' with { type: 'json' };
import { assertExperienceSpec, rankedFindings, codexBrief, recordJudgment } from '../packages/experience-core/index.js';

test('real repository review is a valid Experience Spec with traceable evidence', () => {
  assert.equal(assertExperienceSpec(sample), sample);
  const [highestPriority] = rankedFindings(sample);
  assert.equal(highestPriority.id, 'F3');
  assert.deepEqual(highestPriority.evidenceIds, ['E4']);
});

test('findings cannot reference absent evidence', () => {
  const invalid = structuredClone(sample);
  invalid.findings[0].evidenceIds.push('MISSING');
  assert.throws(() => assertExperienceSpec(invalid), /missing evidence/i);
});

test('Codex brief states the task, evidence, edit scope and review requirement', () => {
  const brief = codexBrief(sample, 'F1');
  assert.match(brief, /Understand the value and start a trial/);
  assert.match(brief, /src\/components\/Hero.astro/);
  assert.match(brief, /isolated branch\/worktree/);
  assert.match(brief, /same state on desktop and mobile/);
  assert.match(brief, /Normal-first visual review/);
  assert.match(brief, /200% text resizing.*supplementary/);
  assert.match(brief, /Existing design foundation/);
  assert.match(brief, /Observed entries are evidence, not approved rules/);
  assert.match(brief, /propose a foundation update for human approval/);
});

test('accept allows an optional reason; reject requires one without mutating the source', () => {
  for (const reason of [undefined, '', ' ']) {
    const accepted = recordJudgment(sample, 'accept', reason);
    assert.equal(accepted.review.judgment, 'accept');
    assert.equal(accepted.review.reason, '');
    assertExperienceSpec(accepted);
    assert.throws(() => recordJudgment(sample, 'reject', reason), /reason/i);
  }
  assert.throws(() => recordJudgment(sample, 'accept', 123), /text/i);
  const reviewed = recordJudgment(sample, 'reject', 'The change hides deployment information.');
  assert.equal(reviewed.review.judgment, 'reject');
  assert.equal(sample.review.judgment, 'pending');
});
