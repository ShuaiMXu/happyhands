import test from 'node:test';
import assert from 'node:assert/strict';
import sample from '../examples/happyclaw-site/experience.json' with { type: 'json' };
import { diagnoseRun, evaluateScore, EXPERIENCE_DIMENSIONS, overridePriority } from '../packages/harness-core/diagnosis.js';

function runWithBaseline() {
  return {
    spec: structuredClone(sample),
    manifest: {
      captures: {
        before: {
          viewports: {
            desktop: { width: 1280, height: 800, status: 200, finalUrl: 'http://localhost/', screenshot: 'before/desktop.png', dom: { h1: ['HappyClaw'], actions: [], horizontalOverflow: false } },
            mobile: { width: 390, height: 844, status: 200, finalUrl: 'http://localhost/', screenshot: 'before/mobile.png', dom: { h1: ['HappyClaw'], actions: [], horizontalOverflow: false } }
          }
        },
        after: null
      }
    }
  };
}

test('diagnosis keeps every finding traceable and refuses an unsupported score', () => {
  const diagnosis = diagnoseRun({ run: runWithBaseline() });
  const evidence = new Set(diagnosis.evidence.map(item => item.id));
  assert.ok(diagnosis.findings.length > 0);
  for (const finding of diagnosis.findings) {
    assert.ok(finding.evidenceRefs.length > 0);
    assert.ok(finding.evidenceRefs.every(id => evidence.has(id)));
  }
  assert.equal(diagnosis.experienceScore.status, 'insufficient-evidence');
  assert.equal(diagnosis.experienceScore.score, null);
});

test('findings with the same root cause merge their evidence and sources', () => {
  const skillResults = [{
    skill: { id: 'content-design-reviewer', version: '0.1.0' },
    findings: [{ id: 'SKILL-F1', title: sample.findings[0].title, confidence: 'high', evidence: [{ screenshot: 'before/desktop.png' }] }]
  }];
  const diagnosis = diagnoseRun({ run: runWithBaseline(), skillResults });
  const merged = diagnosis.findings.find(item => item.id === 'F1');
  assert.equal(merged.sources.length, 2);
  assert.equal(merged.evidenceRefs.length, 3);
});

test('priority override requires rationale and changes the ordered result', () => {
  const diagnosis = diagnoseRun({ run: runWithBaseline() });
  assert.throws(() => overridePriority(diagnosis, 'F2', 50, ''), /reason/i);
  overridePriority(diagnosis, 'F2', 50, 'This blocks the launch task for our current audience.');
  assert.equal(diagnosis.findings[0].id, 'F2');
  assert.equal(diagnosis.priorityOverrides[0].reason, 'This blocks the launch task for our current audience.');
});

// A deterministic reviewer is certain the pattern exists and usually claims the fix is cheap,
// which is exactly the shape that wins a priority contest: 3 × high / 1 beats a judged 5 × 4 / 2.
function cheapCertainSkillFinding() {
  return [{
    skill: { id: 'information-architecture-reviewer', version: '0.2.0' },
    findings: [{ id: 'IA-MAIN-DESKTOP', title: 'desktop has no main landmark for the critical task', confidence: 'high', impact: 3, effort: 1, evidence: [{ screenshot: 'before/desktop.png' }] }]
  }];
}

test('an unconfirmed machine finding does not outrank a judged one on arithmetic alone', () => {
  const diagnosis = diagnoseRun({ run: runWithBaseline(), skillResults: cheapCertainSkillFinding() });
  const machine = diagnosis.findings.find(item => item.id === 'IA-MAIN-DESKTOP');
  const judged = diagnosis.findings.find(item => item.id === 'F1');
  // The machine finding still scores higher; it is ranked behind because nobody has verified it.
  assert.ok(machine.priority > judged.priority);
  assert.equal(machine.verificationStatus, 'review-target');
  assert.ok(diagnosis.findings.indexOf(judged) < diagnosis.findings.indexOf(machine));
  assert.equal(diagnosis.findings[0].id, 'F3');
  // Nothing is hidden: both remain in one list with their numbers intact.
  assert.ok(diagnosis.findings.length > 2);
});

test('a finding confirmed against the current baseline leads the list', () => {
  const run = runWithBaseline();
  run.manifest.confirmation = { findingId: 'F2', verdict: 'supported', note: 'Still visible on the baseline.' };
  const diagnosis = diagnoseRun({ run, skillResults: cheapCertainSkillFinding() });
  assert.equal(diagnosis.findings[0].id, 'F2');
  assert.equal(diagnosis.findings[0].verificationStatus, 'supported');
  // F2 scores lower than F1 and lower than the machine finding, and still leads.
  assert.ok(diagnosis.findings[0].priority < diagnosis.findings[1].priority);
});

test('a finding confirmed as stale drops to the bottom even when it was authored highest', () => {
  const run = runWithBaseline();
  run.manifest.confirmation = { findingId: 'F1', verdict: 'stale', note: 'The heading already leads with the outcome.' };
  const diagnosis = diagnoseRun({ run });
  const finding = diagnosis.findings.find(item => item.id === 'F1');
  assert.equal(finding.verificationStatus, 'stale-candidate');
  assert.equal(finding.priority, 0);
  assert.equal(finding.authoredPriority, 10);
  assert.equal(diagnosis.findings.at(-1).id, 'F1');
});

test('a person can still promote a review target, and the reason is recorded', () => {
  const diagnosis = diagnoseRun({ run: runWithBaseline(), skillResults: cheapCertainSkillFinding() });
  overridePriority(diagnosis, 'IA-MAIN-DESKTOP', 9, 'Screen readers are a launch requirement for this audience.');
  assert.equal(diagnosis.findings[0].id, 'IA-MAIN-DESKTOP');
  assert.equal(diagnosis.findings[0].humanPriority, true);
  assert.equal(diagnosis.findings[0].verificationStatus, 'review-target', 'promoting it does not claim it was verified');
});

test('Experience Score requires all dimensions, valid evidence and rationale', () => {
  const evidence = new Set(EXPERIENCE_DIMENSIONS.map(id => `evidence:${id}`));
  const rubric = {
    version: '0.1', evaluator: 'experience-rubric@0.1.0',
    dimensions: EXPERIENCE_DIMENSIONS.map((id, index) => ({ id, score: 60 + index, weight: 1, rationale: `Reviewed ${id}.`, evidenceRefs: [`evidence:${id}`] }))
  };
  const result = evaluateScore(rubric, evidence);
  assert.equal(result.status, 'scored');
  assert.equal(result.score, 63);
  const unsupported = evaluateScore({ ...rubric, dimensions: rubric.dimensions.slice(1) }, evidence);
  assert.equal(unsupported.status, 'insufficient-evidence');
  assert.equal(unsupported.score, null);
});

test('authored findings are demoted when the captured commit differs from the declared baseline', () => {
  const run = runWithBaseline();
  run.manifest.onboarding = { repository: { commit: '17314f0e714e2f8c395913a63dd80127f4925d22' } };
  const diagnosis = diagnoseRun({ run });
  const finding = diagnosis.findings.find(item => item.id === 'F1');
  assert.equal(finding.verificationStatus, 'stale-candidate');
  assert.equal(finding.priority, 0);
  assert.equal(finding.authoredPriority, 10);
});

test('a rubric weight of zero or below cannot produce a score', () => {
  const rubric = weight => ({
    version: '0.1',
    evaluator: { name: 'test-rubric', version: '1' },
    dimensions: EXPERIENCE_DIMENSIONS.map(id => ({ id, score: 80, weight, rationale: 'Checked against captured evidence.', evidenceRefs: ['E1'] }))
  });
  const ids = new Set(['E1']);

  const ok = evaluateScore(rubric(1), ids);
  assert.equal(ok.status, 'scored');
  assert.equal(ok.score, 80);

  // Weights summing to zero used to divide by zero and publish
  // status "scored" with a NaN score, which serialises to null.
  for (const weight of [0, -1]) {
    const result = evaluateScore(rubric(weight), ids);
    assert.equal(result.status, 'insufficient-evidence', `weight ${weight} must not score`);
    assert.equal(result.score, null);
    assert.ok(result.missing.some(reason => /weight greater than zero/.test(reason)), `weight ${weight} must explain itself`);
  }
});

test('a task-state capture contributes one traceable evidence item per state, reached or not', () => {
  const run = {
    spec: structuredClone(sample),
    manifest: {
      captures: {
        before: {
          schemaVersion: '0.1', adapter: 'web', channel: 'chrome',
          states: [
            { stateId: 'checkout', configurationId: 'desktop', width: 1280, height: 800, reached: true, status: 200, finalUrl: 'http://localhost/checkout', screenshot: 'before/checkout--desktop.png', dom: { h1: ['Checkout'], actions: [], horizontalOverflow: false } },
            { stateId: 'checkout', configurationId: 'mobile', width: 390, height: 844, reached: false, error: 'Start point returned HTTP 500.', failedAction: 0, finalUrl: 'http://localhost/' }
          ]
        },
        after: null
      }
    }
  };
  const diagnosis = diagnoseRun({ run });
  const ids = diagnosis.evidence.filter(item => item.id.startsWith('capture:')).map(item => item.id);
  assert.deepEqual(ids, ['capture:before:checkout--desktop', 'capture:before:checkout--mobile'], 'each recorded state becomes evidence');
  const unreached = diagnosis.evidence.find(item => item.id === 'capture:before:checkout--mobile');
  assert.equal(unreached.source, 'state-not-reached');
  assert.equal(unreached.facts.reached, false);
  assert.match(unreached.facts.error, /HTTP 500/);
  const reached = diagnosis.evidence.find(item => item.id === 'capture:before:checkout--desktop');
  assert.equal(reached.source, 'before/checkout--desktop.png');
  // The schema forbids a null source, so the unreached item must still be a valid string.
  assert.equal(typeof unreached.source, 'string');
});
