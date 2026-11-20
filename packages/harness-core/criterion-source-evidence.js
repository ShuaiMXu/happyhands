import {readRepositoryInputs, repositoryChanges} from './repository-inputs.js';

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
