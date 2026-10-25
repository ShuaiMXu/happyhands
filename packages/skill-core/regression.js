import { createHash } from 'node:crypto';
import { getSkill } from './registry.js';
import { runHandler } from './handlers.js';
import { skillResult } from './result.js';
import { diagnoseRun, evaluateScore, EXPERIENCE_DIMENSIONS } from '../harness-core/diagnosis.js';
import {skillContracts,regressionImplementationHash,regressionEvidenceHash,inputHash} from './release-inputs.js';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function fixture(input) {
  const view = { width: 1280, height: 800, status: 200, screenshot: 'before/desktop.png', dom: { h1: input.h1 ?? ['Example product'], actions: [], horizontalOverflow: false } };
  const finding = (id, impact) => ({ id, title: `Synthetic finding ${id}`, evidenceIds: ['E1'], impact, confidence: 4, effort: 2, proposal: 'Clarify the next action.' });
  return {
    spec: {
      project: { name: 'Synthetic regression', source: 'synthetic fixture', task: 'Choose a next action' },
      evidence: [{ id: 'E1', origin: 'before/desktop.png', state: 'desktop', observation: 'Synthetic observation' }],
      findings: [finding('F1', 5), finding('F2', 2)]
    },
    manifest: {
      findingId: input.selected || null,
      confirmation: input.confirmation || null,
      captures: {
        before: input.capture === false ? null : { viewports: { desktop: view } },
        after: input.after ? { viewports: { desktop: { ...view, screenshot: 'after/desktop.png' } } } : null
      }
    }
  };
}

export async function evaluateCase(entry, { registryRoot } = {}) {
  const run = fixture(entry.input);
  if (entry.input.foundationComponents) run.spec.designFoundation = { components: structuredClone(entry.input.foundationComponents) };
  if (entry.kind === 'skill') {
    const skill = await getSkill(entry.skill, registryRoot);
    const result = skillResult(skill, await runHandler(skill.handler, { run, spec: run.spec, skill,
      repo: entry.input.sourceSnapshot ? 'synthetic-regression-snapshot' : undefined,
      sourceSnapshot:entry.input.sourceSnapshot,projectHistory:entry.input.projectHistory }));
    return { status: result.status, findingIds: result.findings.map(item => item.id), updateTypes: result.proposedUpdates.map(item => item.type), skillVersion: skill.version };
  }
  if (entry.kind === 'priority') {
    const result = diagnoseRun({ run });
    return { first: result.findings[0]?.id, evaluatorVersion: result.evaluatorVersion };
  }
  if (entry.kind === 'score') {
    const rubric = entry.input.rubric === false ? null : {
      version: '0.1', evaluator: 'synthetic-regression@1.0.0',
      dimensions: EXPERIENCE_DIMENSIONS.map(id => ({ id, score: 80, weight: entry.input.weight ?? 1, evidenceRefs: ['E1'], rationale: 'Synthetic rubric evidence.' }))
    };
    const result = evaluateScore(rubric, new Set(entry.input.evidence === false ? [] : ['E1']));
    return { status: result.status, score: result.score };
  }
  throw new Error(`Unknown regression kind: ${entry.kind}`);
}

export function compareReports(report, baseline) {
  const old = new Map((baseline?.cases || []).map(entry => [entry.id, entry]));
  const changes = report.cases.map(entry => {
    const previous = old.get(entry.id);
    old.delete(entry.id);
    const change = !previous ? 'added'
      : previous.caseHash !== entry.caseHash ? 'case-changed'
      : previous.passed && !entry.passed ? 'regressed'
      : !previous.passed && entry.passed ? 'fixed'
      : JSON.stringify(previous.actual) !== JSON.stringify(entry.actual) ? 'changed'
      : 'unchanged';
    return { id: entry.id, change };
  });
  for (const id of old.keys()) changes.push({ id, change: 'removed' });
  return changes;
}

export async function runRegression(corpus, options = {}) {
  if (corpus.schemaVersion !== '0.1' || !Array.isArray(corpus.cases) || corpus.cases.length < 10) throw new Error('Regression corpus requires schema 0.1 and at least ten cases.');
  const before={implementationHash:await regressionImplementationHash(),registryHash:inputHash(await skillContracts(options.registryRoot))};
  const ids = new Set();
  const cases = [];
  for (const entry of corpus.cases) {
    if (!entry.id || ids.has(entry.id) || !entry.expected || !entry.input || !entry.forbidden?.length) throw new Error('Each regression case needs a unique ID, inputs, expected behavior and forbidden conclusions.');
    ids.add(entry.id);
    if (entry.feedback && (entry.feedback.status !== 'reviewed' || !entry.feedback.reviewer?.trim() || !entry.feedback.reason?.trim())) throw new Error(`Human feedback case ${entry.id} requires recorded review before entering the regression gate.`);
    let actual = null;
    const failures = [];
    try {
      actual = await evaluateCase(entry, options);
      for (const [key, value] of Object.entries(entry.expected)) {
        if (JSON.stringify(actual[key]) !== JSON.stringify(value)) failures.push(`${key}: expected ${JSON.stringify(value)}, received ${JSON.stringify(actual[key])}`);
      }
    } catch (error) { failures.push(error.message); }
    cases.push({ id: entry.id, kind: entry.kind, caseHash: hash(entry), passed: failures.length === 0, actual, failures, forbidden: entry.forbidden });
  }
  const report = { schemaVersion: '0.1', corpusVersion: corpus.version, corpusHash: hash(corpus), implementationHash: await regressionImplementationHash(), registryHash:inputHash(await skillContracts(options.registryRoot)), passed: cases.every(entry => entry.passed), cases,
    modelReview: { status: 'not-run', reason: 'These synthetic deterministic checks do not establish model or visual judgment quality. Model releases still require independent human review.' } };
  if(before.implementationHash!==report.implementationHash||before.registryHash!==report.registryHash)throw Error('Regression inputs changed while executing cases.');
  report.changes = compareReports(report, options.baseline);
  // Removing or rewriting the case is not proof of a fix. Review it before release.
  report.requiresReview = report.changes.some(entry => ['removed', 'case-changed', 'changed'].includes(entry.change));
  report.evidenceHash=regressionEvidenceHash(report);
  return report;
}
