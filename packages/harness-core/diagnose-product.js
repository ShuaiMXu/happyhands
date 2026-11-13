import {experienceFor} from './experience-orchestration.js';
import {readFile} from 'node:fs/promises';
import {executeSkill} from '../skill-core/runner.js';
import {diagnoseBaseline} from '../workbench/baseline-diagnosis.js';
import {diagnoseRun} from './diagnosis.js';
import {loadRun, runFilePath, saveDiagnosis} from './store.js';

const DEFAULT_PROJECT_SKILLS = [
  'accessibility-reviewer',
  'responsive-reviewer',
  'information-architecture-reviewer',
  'visual-hierarchy-reviewer'
];

function assertDiagnosisOpen(run) {
  if (run.manifest.confirmation || run.manifest.plan || run.manifest.execution) {
    throw new Error('Start a fresh review before changing a confirmed diagnosis.');
  }
}

// Both interfaces share the stage and ledger rules. The installed Skill uses
// recorded results, while a connected workbench can request project analysis.
export async function diagnoseProduct(directory, {
  strategy = 'recorded',
  repo,
  selectedSkills,
  registryRoot,
  cwd,
  generate,
  language = 'zh',
  signal = new AbortController().signal,
  onProgress,
  verifySource,
  modelFailure = 'throw'
} = {}) {
  if (!['recorded', 'project'].includes(strategy)) throw new Error('Unknown diagnosis strategy.');
  if (!['throw', 'record'].includes(modelFailure)) throw new Error('Unknown diagnosis failure policy.');
  if (strategy === 'project' && !repo) throw new Error('Project diagnosis requires a repository.');
  if (strategy === 'recorded' && selectedSkills !== undefined) throw new Error('Recorded diagnosis consumes existing Skill results.');

  signal.throwIfAborted();
  let run = await loadRun(directory);
  assertDiagnosisOpen(run);
  await experienceFor(run);
  if (strategy === 'project') {
    const skills = new Set([
      ...(selectedSkills ?? DEFAULT_PROJECT_SKILLS),
      'design-system-drift-detector',
      'component-state-auditor'
    ]);
    for (const id of skills) {
      signal.throwIfAborted();
      const previous = run.manifest.skills.find(item => item.id === id);
      if (!previous || previous.status !== 'complete') {
        await executeSkill({id, directory, repo, registryRoot, retry: Boolean(previous)});
      }
    }
    run = await loadRun(directory);
    assertDiagnosisOpen(run);
  }
  const skillResults = await Promise.all(run.manifest.skills.map(async item =>
    JSON.parse(await readFile(runFilePath(directory, item.path), 'utf8'))
  ));
  let diagnosis = diagnoseRun({run, skillResults});
  let modelError;
  try {
    await onProgress?.({stage: 'model-diagnosis'});
    diagnosis = await diagnoseBaseline(directory, diagnosis, {
      cwd, generate, signal, language,
      onProgress: progress => onProgress?.({stage: 'model-diagnosis', ...progress})
    });
  } catch (error) {
    signal.throwIfAborted();
    modelError = error;
    diagnosis = diagnoseRun({run, skillResults});
    diagnosis.modelDiagnosis = {
      status: 'failed',
      summary: 'Model diagnosis did not complete; rule candidates remain unverified.',
      limitations: [error.message]
    };
  }
  signal.throwIfAborted();
  assertDiagnosisOpen(await loadRun(directory));
  await verifySource?.();
  await saveDiagnosis(directory, diagnosis);
  if (modelError && modelFailure === 'throw') throw modelError;
  return diagnosis;
}
