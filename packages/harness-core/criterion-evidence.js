import {isDeepStrictEqual} from 'node:util';
import {captureEntries, captureKey, capturedTaskContext} from './capture-state.js';
import {readRepositoryInputs, repositoryChanges} from './repository-inputs.js';
import {captureRouteKey} from './whole-page.js';

export function matchedCriterionStates(manifest, refs) {
  const cited = new Set(refs);
  const key = entry => captureKey(entry.stateId, entry.configurationId);
  const route = entry => {
    const routeKey = captureRouteKey(entry);
    return routeKey === null ? null : routeKey + new URL(entry.finalUrl || entry.start.url).hash;
  };
  const before = new Map(captureEntries(manifest.captures.before).filter(entry => cited.has(entry.screenshot)).map(entry => [key(entry), entry]));
  return captureEntries(manifest.captures.after).flatMap(after => {
    if (!cited.has(after.screenshot)) return [];
    const state = key(after), baseline = before.get(state);
    const afterRoute = route(after);
    if (!baseline || baseline.reached === false || after.reached === false || baseline.error || after.error || baseline.status >= 400 || after.status >= 400 || !afterRoute ||
        route(baseline) !== afterRoute || ![after.width, after.height].every(size => Number.isSafeInteger(size) && size > 0) ||
        baseline.width !== after.width || baseline.height !== after.height ||
        !isDeepStrictEqual(capturedTaskContext(baseline), capturedTaskContext(after))) return [];
    return [{state, stateId:after.stateId}];
  });
}

export function assertCriterionAssessments(review, manifest, {regional=false}={}) {
  const criteria = manifest.experienceAudit?.goal?.criteria;
  const rows = review.criterionAssessments;
  if (!rows) {
    if (!regional && review.skillId === 'visual-qa-evaluator' && manifest.designDecision?.traceCriteria && review.verdict === 'pass') {
      throw Error('Passing Visual QA requires evidence for every design goal criterion.');
    }
    return;
  }
  if (regional || review.skillId !== 'visual-qa-evaluator' || !criteria || rows.length !== criteria.length ||
      new Set(rows.map(row => row.criterion)).size !== rows.length || rows.some(row => row.criterion > criteria.length)) {
    throw Error('Criterion evidence must cover each bound goal criterion exactly once in the complete review.');
  }
  for (const row of rows) {
    if (row.screenshotRefs.some(ref => !review.screenshotRefs.includes(ref))) throw Error('Criterion evidence must cite originals inspected in this review.');
    const states = matchedCriterionStates(manifest, row.screenshotRefs);
    if (row.verdict === 'pass' && !states.length) throw Error('Passing criterion evidence requires a matched, reached before and after state.');
    for (const id of row.verificationRefs) {
      const record = (manifest.verificationRecords || []).find(value => value.id === id);
      if (!review.verificationRefs?.includes(id) || !record || !states.some(state => record.stateIds.includes(state.stateId)) ||
          (row.verdict === 'pass' && record.status !== 'pass')) throw Error('Criterion check is unreviewed, outside the cited states, or unresolved.');
    }
    if (review.verdict === 'pass' && row.verdict !== 'pass') throw Error('An unresolved design goal criterion prevents passing Visual QA.');
  }
}

export async function criterionSourceChanges(run) {
  const [before, after] = await Promise.all([readRepositoryInputs(run,'before'), readRepositoryInputs(run,'after')]);
  if (!before || !after) return null;
  return repositoryChanges(before.files, after.files).map(change => change.path);
}

export async function assertCriterionFiles(run, review) {
  const cited = review.criterionAssessments?.flatMap(row => row.changedFiles) || [];
  if (!cited.length) return;
  const actual = new Set(await criterionSourceChanges(run));
  if (cited.some(path => !actual.has(path))) throw Error('Criterion cites a file without a recorded change between the captured sources.');
}
