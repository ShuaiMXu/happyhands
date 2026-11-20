// A technical Run tests a predeclared repair criterion. Visual review remains
// the default and cannot be replaced by passing a technical check.
export function validateEvidencePolicy(policy) {
  if (policy === undefined) return;
  const fields = (...names) => Object.keys(policy).every(key => names.includes(key));
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw Error('Invalid evidencePolicy.');
  switch (policy.kind) {
    case 'visual':
    case 'horizontal-overflow':
      if (fields('kind')) return;
      break;
    case 'node-syntax':
      if (fields('kind', 'file') && typeof policy.file === 'string' &&
          /^(?:[\w.-]+\/)*[\w.-]+\.(?:js|mjs|cjs)$/.test(policy.file) &&
          !policy.file.split('/').some(part => part === '.' || part === '..')) return;
      break;
    case 'button-name':
      if (fields('kind', 'selector', 'name') && [policy.selector, policy.name].every(
        value => typeof value === 'string' && value.trim().length && value.length <= 200
      )) return;
      break;
  }
  throw Error('evidencePolicy must declare visual, node-syntax (file), button-name (selector and name), or horizontal-overflow.');
}

export function evidenceLevel(policy) {
  if (!policy || policy.kind === 'visual') return 'visual';
  return policy.kind === 'node-syntax' ? 'source' : 'runtime';
}

export function technicalWorkflow(manifest, result) {
  const level = evidenceLevel(manifest.evidencePolicy);
  if (level === 'visual') return null;
  const evidence = manifest.technicalEvidence || {};
  const summary = {level, visual: 'not-reviewed'};
  if (!evidence.before) return {...result, ...summary, stage: 'needs-technical-before', next: 'verify --phase before'};
  if (evidence.before.status !== 'fail') return {...result, ...summary, stage: 'technical-baseline-unconfirmed', blocked: true,
    reason: 'The declared criterion did not reproduce a defect. Inspect the baseline record before starting another Run.'};
  if (!evidence.after) return {...result, ...summary, stage: 'needs-technical-after', next: 'verify --phase after'};
  if (evidence.after.status !== 'pass') return {...result, ...summary, stage: 'technical-verification-failed', blocked: true,
    reason: 'The candidate did not pass the declared check in all matched states. Inspect the retained evidence.'};
  return {...result, ...summary, stage: 'technical-verified', next: null};
}
