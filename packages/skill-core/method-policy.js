import {loadRegistry} from './registry.js';

export const METHOD_POLICY = 'task-scoped-methods@1';
const stages = {
  diagnose: ['accessibility-reviewer', 'responsive-reviewer', 'information-architecture-reviewer', 'visual-hierarchy-reviewer', 'design-system-drift-detector', 'component-state-auditor'],
  foundation: ['foundation-extractor', 'brand-foundation-extractor', 'component-inventory'],
  plan: ['fix-planner', 'component-reuse-planner'],
  review: ['visual-qa-evaluator'],
  learn: ['judgment-distiller', 'pattern-library-curator']
};

// A generic evidence gate is never an implemented analyzer, even if a manifest
// accidentally advertises bounded maturity. Explicit legacy invocation is retained.
export function skillCapability(skill) {
  const implemented = skill.maturity !== 'contract-only' && skill.handler !== 'evidenceGate';
  return {
    policy: METHOD_POLICY,
    provider: implemented ? 'bounded-handler' : 'contract-only',
    defaultEligible: implemented,
    handler: skill.handler,
    professionalJudgment: 'not-established-by-handler',
    deliverable: skill.role === 'diagnose' || skill.role === 'foundation' ? 'experience-audit' : skill.role === 'plan' ? 'experience-decision' : skill.role === 'review' ? 'independent-review' : 'learning-candidate'
  };
}

export async function selectSkills(stage, {registryRoot, requested} = {}) {
  if (!Object.hasOwn(stages, stage)) throw Error('Unknown method stage: ' + stage);
  if (requested !== undefined && (!Array.isArray(requested) || requested.some(id => typeof id !== 'string'))) throw Error('Requested skills must be an array of IDs.');
  const registry = await loadRegistry(registryRoot);
  const selected = [], excluded = [];
  for (const id of new Set(requested ?? stages[stage])) {
    const skill = registry.find(item => item.id === id);
    if (!skill) throw Error('Unknown skill: ' + id);
    const capability = skillCapability(skill);
    if (requested === undefined && !capability.defaultEligible) excluded.push({id, reason: 'No dedicated executable provider.'});
    else selected.push({id, ...capability, invocation: requested === undefined ? 'default' : 'explicit'});
  }
  return {policy: METHOD_POLICY, stage, selected, excluded};
}

export function auditReadingMethods() {
  // One public workflow; supporting methods share its audit rather than create
  // competing reports. Planning, learning and placeholder contracts are on demand.
  return ['review-product', ...['information-architecture-reviewer', 'interaction-reviewer', 'visual-hierarchy-reviewer', 'content-design-reviewer', 'accessibility-reviewer'].map(id => 'product-design/' + id)];
}
