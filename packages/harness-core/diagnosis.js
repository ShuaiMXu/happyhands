import Ajv from 'ajv/dist/2020.js';
import schema from '../../diagnosis.schema.json' with { type: 'json' };
import { captureEntries } from './capture-state.js';

const checkDiagnosis = new Ajv({ allErrors: true }).compile(schema);
const CONFIDENCE = Object.freeze({ low: 1, medium: 3, high: 5 });
export const EXPERIENCE_DIMENSIONS = Object.freeze([
  'hierarchy',
  'information-architecture',
  'responsive',
  'accessibility',
  'consistency',
  'task-friction'
]);

// How far a finding has been verified, best first. A deterministic check is certain that a pattern
// exists in the DOM; it is not evidence that the pattern matters to the user task. Ranking by the
// priority number alone conflates those, and a machine finding always wins: it is certain by
// construction and usually claims to be cheap, so `3 × high / 1` outranks a judged `5 × 4 / 2`.
// The labels below already existed; now they order the list.
const BANDS = Object.freeze({ supported: 0, 'authored-candidate': 1, 'review-target': 2, 'stale-candidate': 3 });

function bandOf(finding) {
  return BANDS[finding.verificationStatus] ?? BANDS['review-target'];
}

// A person's explicit ordering wins over both, because `prioritize` records a reason.
export function compareDiagnosisFindings(a, b) {
  return Number(Boolean(b.humanPriority)) - Number(Boolean(a.humanPriority))
    || bandOf(a) - bandOf(b)
    || b.priority - a.priority
    || a.id.localeCompare(b.id);
}

function keyOf(title) {
  return title.toLowerCase().replace(/[^a-z0-9\p{L}]+/gu, ' ').trim();
}

function captureEvidence(manifest) {
  const items = [];
  for (const [phase, capture] of Object.entries(manifest.captures || {})) {
    if (!capture) continue;
    // Both capture shapes become one list, so a task-state capture contributes
    // evidence per state and configuration instead of being silently dropped.
    // An unreached state has no screenshot to cite; the failure itself is the fact.
    for (const entry of captureEntries(capture)) {
      const name = entry.legacy ? entry.configurationId : `${entry.stateId}--${entry.configurationId}`;
      const reached = entry.reached !== false && entry.dom;
      items.push({
        id: `capture:${phase}:${name}`,
        type: 'browser-capture',
        phase,
        state: name,
        source: entry.screenshot || 'state-not-reached',
        facts: reached
          ? { status: entry.status, finalUrl: entry.finalUrl, h1: entry.dom.h1 || [], actions: entry.dom.actions || [], horizontalOverflow: entry.dom.horizontalOverflow }
          : { reached: false, error: entry.error || 'State was not reached.' }
      });
    }
  }
  return items;
}

function specEvidence(spec) {
  return spec.evidence.map(item => ({ id: `spec:${item.id}`, type: 'authored-observation', source: item.origin, state: item.state, observation: item.observation }));
}

function priorityOf(finding) {
  return (finding.impact * finding.confidence) / finding.effort;
}

function normalizedSpecFindings(spec, manifest) {
  const declaredRevision = spec.project.source.match(/\bbaseline\s+([0-9a-f]{7,40})\b/i)?.[1]?.toLowerCase();
  const capturedRevision = manifest.onboarding?.repository?.commit?.toLowerCase();
  const stale = Boolean(declaredRevision && capturedRevision && !capturedRevision.startsWith(declaredRevision));
  const confirmation = manifest.confirmation;
  return spec.findings.map(item => {
    const confirmed = confirmation?.findingId === item.id && confirmation.verdict === 'supported';
    // A finding a person checked against the current baseline outranks one nobody has looked at.
    const outdated = stale || (confirmation?.findingId === item.id && confirmation.verdict === 'stale');
    return {
      id: item.id,
      title: item.title,
      rootKey: keyOf(item.title),
      evidenceRefs: item.evidenceIds.map(id => `spec:${id}`),
      sources: [{ type: 'experience-spec', id: item.id }],
      verificationStatus: outdated ? 'stale-candidate' : confirmed ? 'supported' : 'authored-candidate',
      impact: item.impact,
      confidence: item.confidence,
      effort: item.effort,
      priority: outdated ? 0 : priorityOf(item),
      authoredPriority: priorityOf(item),
      proposal: item.proposal
    };
  });
}

function normalizedSkillFindings(skillResults, evidence) {
  const findings = [];
  for (const result of skillResults) {
    for (const [index, item] of result.findings.entries()) {
      const refs = [];
      for (const [evidenceIndex, value] of (item.evidence || []).entries()) {
        const id = `skill:${result.skill.id}:${index}:${evidenceIndex}`;
        evidence.push({ id, type: 'skill-evidence', source: `${result.skill.id}@${result.skill.version}`, value });
        refs.push(id);
      }
      if (!refs.length) continue;
      const confidence = CONFIDENCE[item.confidence] || 1;
      findings.push({
        id: item.id || `${result.skill.id}-${index + 1}`,
        title: item.title,
        rootKey: item.rootCause || keyOf(item.title),
        evidenceRefs: refs,
        sources: [{ type: 'skill', id: result.skill.id, version: result.skill.version }],
        verificationStatus: 'review-target',
        impact: item.impact || 3,
        confidence,
        effort: item.effort || 3,
        priority: (item.impact || 3) * confidence / (item.effort || 3),
        proposal: item.proposal || null
      });
    }
  }
  return findings;
}

function mergeFindings(findings) {
  const merged = new Map();
  for (const finding of findings) {
    const existing = merged.get(finding.rootKey);
    if (!existing) {
      merged.set(finding.rootKey, structuredClone(finding));
      continue;
    }
    existing.evidenceRefs = [...new Set([...existing.evidenceRefs, ...finding.evidenceRefs])];
    existing.sources.push(...finding.sources);
    // A duplicate carries the strongest verification of the two, whatever its priority number:
    // a skill restating a confirmed finding does not make it less verified.
    if (bandOf(finding) < bandOf(existing)) existing.verificationStatus = finding.verificationStatus;
    if (finding.priority > existing.priority) {
      existing.impact = finding.impact;
      existing.confidence = finding.confidence;
      existing.effort = finding.effort;
      existing.priority = finding.priority;
    }
  }
  return [...merged.values()];
}

export function evaluateScore(rubric, evidenceIds) {
  const base = { status: 'insufficient-evidence', score: null, evaluator: rubric?.evaluator || null, evidenceCoverage: 0, dimensions: [], missing: [] };
  if (!rubric || rubric.version !== '0.1' || !Array.isArray(rubric.dimensions)) {
    return { ...base, missing: ['A versioned rubric with all MVP dimensions is required.'] };
  }
  const byId = new Map(rubric.dimensions.map(item => [item.id, item]));
  const dimensions = [];
  let validEvidence = 0;
  let totalEvidence = 0;
  const missing = [];
  for (const id of EXPERIENCE_DIMENSIONS) {
    const item = byId.get(id);
    if (!item) {
      missing.push(`Missing dimension: ${id}.`);
      continue;
    }
    const refs = Array.isArray(item.evidenceRefs) ? item.evidenceRefs : [];
    totalEvidence += Math.max(refs.length, 1);
    const supported = refs.filter(ref => evidenceIds.has(ref));
    validEvidence += supported.length;
    const weight = item.weight ?? 1;
    if (!Number.isFinite(item.score) || item.score < 0 || item.score > 100) missing.push(`${id} needs a score from 0 to 100.`);
    // Without this, weights summing to zero divide by zero and publish
    // status "scored" with a NaN score, which serialises to null.
    if (!Number.isFinite(weight) || weight <= 0) missing.push(`${id} needs a weight greater than zero.`);
    if (!item.rationale?.trim()) missing.push(`${id} needs a rationale.`);
    if (!supported.length) missing.push(`${id} needs at least one valid evidence reference.`);
    dimensions.push({ id, score: item.score ?? null, weight, evidenceRefs: supported, rationale: item.rationale || '' });
  }
  const evidenceCoverage = totalEvidence ? validEvidence / totalEvidence : 0;
  if (evidenceCoverage < 0.8) missing.push('Evidence coverage must be at least 80%.');
  if (missing.length) return { ...base, evaluator: rubric.evaluator || null, evidenceCoverage, dimensions, missing };
  const weight = dimensions.reduce((sum, item) => sum + item.weight, 0);
  const score = Math.round(dimensions.reduce((sum, item) => sum + item.score * item.weight, 0) / weight);
  if (!Number.isFinite(score)) {
    return { ...base, evaluator: rubric.evaluator || null, evidenceCoverage, dimensions, missing: ['The weighted score is not a finite number.'] };
  }
  return { status: 'scored', score, evaluator: rubric.evaluator, evidenceCoverage, dimensions, missing: [] };
}

export function diagnoseRun({ run, skillResults = [], rubric = null }) {
  const evidence = [...specEvidence(run.spec), ...captureEvidence(run.manifest)];
  const findings = mergeFindings([...normalizedSpecFindings(run.spec, run.manifest), ...normalizedSkillFindings(skillResults, evidence)])
    .filter(item => item.evidenceRefs.length)
    .sort(compareDiagnosisFindings);
  const evidenceIds = new Set(evidence.map(item => item.id));
  for (const finding of findings) {
    const missing = finding.evidenceRefs.filter(id => !evidenceIds.has(id));
    if (missing.length) throw new Error(`Finding ${finding.id} references missing diagnosis evidence: ${missing.join(', ')}.`);
  }
  const diagnosis = {
    schemaVersion: '0.1',
    generatedAt: new Date().toISOString(),
    evaluatorVersion: 'diagnosis-core@0.2.0',
    evidence,
    findings,
    priorityOverrides: [],
    experienceScore: evaluateScore(rubric, evidenceIds)
  };
  return assertDiagnosis(diagnosis);
}

export function overridePriority(diagnosis, findingId, priority, reason) {
  if (!Number.isFinite(priority) || priority < 0) throw new Error('Priority override must be a non-negative number.');
  if (!reason?.trim()) throw new Error('Priority override requires a reason.');
  const finding = diagnosis.findings.find(item => item.id === findingId);
  if (!finding) throw new Error('Unknown diagnosis finding.');
  finding.priority = priority;
  finding.humanPriority = true;
  diagnosis.priorityOverrides.push({ findingId, priority, reason: reason.trim(), at: new Date().toISOString() });
  diagnosis.findings.sort(compareDiagnosisFindings);
  return assertDiagnosis(diagnosis);
}

export function assertDiagnosis(diagnosis) {
  if (!checkDiagnosis(diagnosis)) throw new Error(checkDiagnosis.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; '));
  const ids = new Set(diagnosis.evidence.map(item => item.id));
  if (ids.size !== diagnosis.evidence.length) throw new Error('Diagnosis evidence IDs must be unique.');
  for (const finding of diagnosis.findings) {
    for (const ref of finding.evidenceRefs) if (!ids.has(ref)) throw new Error(`Finding ${finding.id} references missing diagnosis evidence ${ref}.`);
  }
  return diagnosis;
}
