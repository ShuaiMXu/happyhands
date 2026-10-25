import {reviewOrderPrompt} from './review-order.js';
import {approvedPatternConstraints} from './foundation.js';
import Ajv from 'ajv/dist/2020.js';
import schema from '../../experience.schema.json' with { type: 'json' };
export { assertFoundationApproval, approvedFoundationFrom, foundationApprovalReference } from './foundation.js';

const ajv = new Ajv({ allErrors: true });
const check = ajv.compile(schema);

export function assertExperienceSpec(spec) {
  if (!check(spec)) throw new Error(check.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; '));
  const ids = new Set(spec.evidence.map(item => item.id));
  if (ids.size !== spec.evidence.length) throw new Error('Evidence IDs must be unique.');
  const findingIds = new Set(spec.findings.map(item => item.id));
  if (findingIds.size !== spec.findings.length) throw new Error('Finding IDs must be unique.');
  for (const finding of spec.findings) {
    for (const id of finding.evidenceIds) if (!ids.has(id)) throw new Error(`Finding ${finding.id} references missing evidence ${id}.`);
  }
  if (spec.review.judgment !== 'pending' && !spec.review.reason.trim()) throw new Error('Accept/reject requires a reason.');
  return spec;
}

export function priority(finding) {
  return (finding.impact * finding.confidence) / finding.effort;
}

export function rankedFindings(spec) {
  assertExperienceSpec(spec);
  return [...spec.findings].sort((a, b) => priority(b) - priority(a) || a.id.localeCompare(b.id));
}

function foundationContext(foundation) {
  if (!foundation) return '';
  return `
## Existing design foundation
Foundation status: ${foundation.status}. Observed entries are evidence, not approved rules.
${foundation.brand.principles.length ? `Brand principles: ${foundation.brand.principles.join('; ')}` : 'Brand principles: not yet documented.'}
${foundation.brand.voice.length ? `Brand voice: ${foundation.brand.voice.join('; ')}` : 'Brand voice: not yet documented.'}
${foundation.tokens.length ? `Tokens: ${foundation.tokens.map(item => `${item.name}=${item.value} [${item.status}]`).join('; ')}` : 'Tokens: not yet inventoried.'}
${foundation.components.length ? `Components: ${foundation.components.map(item => `${item.name} (${item.source}) [${item.status}]`).join('; ')}` : 'Components: not yet inventoried.'}
${foundation.patterns.length ? `Patterns: ${foundation.patterns.map(item => `${item.name} [${item.status}]`).join('; ')}` : 'Patterns: not yet inventoried.'}
${approvedPatternConstraints(foundation)}
`;
}

function approvedOnly(foundation) {
  return {
    tokens: foundation.tokens.filter(item => item.status === 'approved'),
    components: foundation.components.filter(item => item.status === 'approved'),
    patterns: foundation.patterns.filter(item => item.status === 'approved')
  };
}

export function assertBootstrapFoundation(spec) {
  const foundation = spec.designFoundation;
  if (!foundation) throw new Error('A first render requires a design foundation in the Experience Spec; there is no implementation to extract one from.');
  if (foundation.status !== 'approved') throw new Error(`A first render requires an approved design foundation; this one is "${foundation.status}". Observed entries are not approved design rules.`);
  const { tokens, components } = approvedOnly(foundation);
  if (!tokens.length && !components.length) throw new Error('An approved foundation needs at least one approved token or component before it can constrain a first render.');
  return foundation;
}

export function codexBrief(spec, findingId) {
  assertExperienceSpec(spec);
  if (!spec.findings.length) throw new Error('This spec has no findings; diagnose the baseline or author a finding before planning a change.');
  const finding = spec.findings.find(item => item.id === findingId);
  if (!finding) throw new Error('Unknown finding.');
  const evidence = spec.evidence.filter(item => finding.evidenceIds.includes(item.id));
  return `# Scoped product experience improvement

Project: ${spec.project.name}
Goal: ${spec.project.goal}
Audience: ${spec.project.audience}
Critical user task: ${spec.project.task}
Source: ${spec.project.source}
${foundationContext(spec.designFoundation)}

## Problem to address
${finding.title}

## Observed evidence
${evidence.map(item => `- [${item.id}] ${item.state}: ${item.observation} (${item.origin})`).join('\n')}

## Design intent
${finding.proposal}

## Instructions
1. Inspect the actual app and confirm or correct this authored diagnosis before changing code.
   First locate the repository's design guidelines, shared styles/tokens and component implementations, including native HTML/JS modules. For each affected UI element, record the existing component/token source you will reuse, the relevant consumers, and any justified exception. An empty inventory means discovery is incomplete, not permission to invent a parallel design system. Observed components may be reused after checking their actual API and suitability; this does not promote them into approved design rules.
2. Make one scoped, reversible change in an isolated branch/worktree. Preserve the product goal, existing working paths, and approved design-foundation entries. Reuse an approved component before creating a new one.
3. Run the app. Capture the same state on desktop and mobile before and after.
4. Check task clarity, visual hierarchy, keyboard/accessibility behavior and regressions.
   Compare affected repeated components across their supplied desktop/mobile states: typography, spacing, colour, radius, controls and interaction states. Report which shared implementation was aligned, which consumers were checked, and any missing evidence; screenshots alone cannot prove source-level reuse. Keep unrelated redesigns outside the confirmed scope.
5. Report exactly what changed, what improved, what remains uncertain, and any evidence still missing. If the change introduces or replaces a token, component, brand rule or interaction pattern, propose a foundation update for human approval.

${reviewOrderPrompt}
Do not claim an Experience Score or conversion uplift without a validated rubric or behavioral data.
`;
}

export function bootstrapBrief(spec, { entries = [], reason = 'No rendered state exists for the critical user task.', approval = null } = {}) {
  assertExperienceSpec(spec);
  if (!approval?.foundationVersion || !approval?.reviewer?.name) throw new Error('A first-render brief requires a recorded, versioned Foundation Approval.');
  const foundation = assertBootstrapFoundation(spec);
  const { tokens, components, patterns } = approvedOnly(foundation);
  const missing = entries.filter(item => item.state !== 'rendered');
  return `# First render for a surface that does not exist yet

Project: ${spec.project.name}
Goal: ${spec.project.goal}
Audience: ${spec.project.audience}
Critical user task: ${spec.project.task}
Source: ${spec.project.source}

## Why there is no baseline
${reason}
${missing.length ? missing.map(item => `- ${item.url} → ${item.state}${item.status === null ? '' : ` (HTTP ${item.status})`}`).join('\n') : '- No preview URL was configured for this run.'}

This run has no before/after comparison. Do not describe the result as an improvement.

## Approved foundation constraints
Foundation version: ${approval.foundationVersion}
Approved by: ${approval.reviewer.name} (${approval.reviewer.type})
Approval reason: ${approval.reason}

These entries are approved by the referenced Foundation Approval. Use them; do not invent parallel values.
${tokens.length ? `Tokens: ${tokens.map(item => `${item.name}=${item.value}`).join('; ')}` : 'Tokens: none approved.'}
${components.length ? `Components: ${components.map(item => `${item.name} (${item.source})${item.states.length ? ` states: ${item.states.join('/')}` : ''}`).join('; ')}` : 'Components: none approved.'}
${patterns.length ? `Patterns: ${patterns.map(item => `${item.name}: ${item.description}`).join('; ')}` : 'Patterns: none approved.'}
${approvedPatternConstraints(foundation)}
${foundation.brand.principles.length ? `Brand principles: ${foundation.brand.principles.join('; ')}` : 'Brand principles: not yet documented.'}
${foundation.brand.voice.length ? `Brand voice: ${foundation.brand.voice.join('; ')}` : 'Brand voice: not yet documented.'}

Entries that are not marked approved are observed candidates. Do not treat them as rules.

## Instructions
1. Build the smallest first version of this one surface that lets the audience complete the critical user task end to end. Do not build adjacent surfaces.
2. Use only entries cited in Foundation ${approval.foundationVersion}. If the task genuinely needs something the approved foundation does not cover, do not promote it into the shared system: keep it local and report it as a foundation update candidate for human approval.
3. Give every interactive element its full set of states, including empty, loading, partial, error with a recoverable next step, and disabled where it applies. A surface that only renders its success state is not finished.
4. Make the surface reachable at a stable route that renders at 1280×800 and 390×844 without horizontal overflow.
5. Run the app and confirm the route responds before finishing.
6. Report the route, what you built, which approved entries you used, what you added, and what remains unbuilt or uncertain.

${reviewOrderPrompt}
This run is evaluated as a conformance check against the approved foundation plus deterministic render checks. That is not evidence that the design is good; a human decides whether to accept it.
`;
}

export function recordJudgment(spec, judgment, reason) {
  if (!['accept', 'reject'].includes(judgment)) throw new Error('Choose accept or reject.');
  if (!reason?.trim()) throw new Error('Explain the reason for the decision.');
  const next = structuredClone(spec);
  next.review.judgment = judgment;
  next.review.reason = reason.trim();
  return assertExperienceSpec(next);
}
