import {inputHash} from './release-inputs.js';

// Evolution proposes changes; it never activates them. Reuse the release's
// executed corpus and immutable baseline, not an independently maintained ledger.
export function validateSkillEvolution({baseline, skills, implementationHash, report, change}) {
  if (!baseline) {
    if (change) throw Error('An evolution change needs an immutable baseline release.');
    return {policy:'reviewed-skill-evolution@1', status:'baseline-only', changes:[], qualityClaim:'not-established'};
  }
  const before = new Map(baseline.skills.map(row => [row.id, row.contractHash]));
  const after = new Map(skills.map(row => [row.id, row.contractHash]));
  const differences = [...new Set([...before.keys(), ...after.keys()])].filter(id => before.get(id) !== after.get(id)).map(id => ({id, beforeHash:before.get(id) ?? null, afterHash:after.get(id) ?? null}));
  if (baseline.regression.implementationHash !== implementationHash) differences.push({id:'$implementation', beforeHash:baseline.regression.implementationHash, afterHash:implementationHash});
  if (!differences.length && !change) return {policy:'reviewed-skill-evolution@1', status:'unchanged', baselineVersion:baseline.version, changes:[], qualityClaim:'not-established'};
  if (!change || change.baselineVersion !== baseline.version || change.evidenceHash !== report.evidenceHash || !Array.isArray(change.changes) || change.changes.length !== differences.length) throw Error('Changed methods require an evolution record bound to the baseline and current regression evidence.');
  const passed = new Set(report.cases.filter(row => row.passed).map(row => row.id));
  const seen = new Set();
  for (const row of change.changes) {
    const expected = differences.find(item => item.id === row.id);
    if (!expected || seen.has(row.id) || row.beforeHash !== expected.beforeHash || row.afterHash !== expected.afterHash) throw Error('Evolution hashes must cover each changed method exactly once.');
    seen.add(row.id);
    if (![row.reason, row.observedFailure, row.preserveBehavior].every(value => typeof value === 'string' && value.trim())) throw Error('Evolution needs an observed failure, rewrite reason and preserved behavior.');
    const groups = ['failureCases','preserveCases','affectedCases'];
    for (const group of groups) if (!Array.isArray(row[group]) || !row[group].length || row[group].some(id => !passed.has(id))) throw Error('Evolution case references must name actually passing regression cases: ' + group);
    if (row.failureCases.some(id => row.preserveCases.includes(id))) throw Error('The failure example and preserve counterexample must be distinct.');
  }
  return {policy:'reviewed-skill-evolution@1', status:'reviewed-contract-candidate', baselineVersion:baseline.version, evidenceHash:report.evidenceHash, changeHash:inputHash(change), changes:structuredClone(change.changes), qualityClaim:'not-established'};
}
