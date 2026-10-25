import {stageDesignGuidance} from './design-guidance.js';
import {acceptedPatternHistory} from '../harness-core/pattern-history.js';
import { stageOjoGuidance } from './ojo-guidance.js';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { sourceFiles } from './scan.js';
import { getSkill, loadRegistry } from './registry.js';
import { runHandler } from './handlers.js';
import { skillResult } from './result.js';
import { loadRun, saveSkillResult } from '../harness-core/store.js';

export { loadRegistry };

export async function executeSkill({ id, directory, repo, registryRoot, retry = false, sourceSnapshot = null }) {
  const skill = await getSkill(id, registryRoot);
  const run = await loadRun(directory);
  const snapshot = sourceSnapshot ?? (repo ? await sourceFiles(repo,{includeDesignDocs:['pattern-library-curator','brand-foundation-extractor'].includes(id)}) : null);
  const projectHistory=id==='pattern-library-curator'?await acceptedPatternHistory(run,repo,snapshot):null;
  const contractFiles = [];
  async function collect(base, prefix = '') {
    for (const entry of (await readdir(base, {withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink()) continue;
      const name = prefix + entry.name;
      if (entry.isDirectory()) await collect(join(base,entry.name),name+'/');
      else contractFiles.push([name,await readFile(join(base,entry.name),'utf8')]);
    }
  }
  await collect(skill.directory);
  const rubricText = contractFiles.find(([name])=>name==='rubric.json')?.[1];
  const available = {
    repository: Boolean(repo), designFoundation: Boolean(run.spec.designFoundation),
    baselineCapture: Boolean(run.manifest.captures.before), afterCapture: Boolean(run.manifest.captures.after),
    criticalTask: Boolean(run.spec.project.task?.trim()),
    finding: Boolean(run.spec.findings.some(item => item.id === run.manifest.findingId)),
    judgment: Boolean(run.manifest.judgment) && !run.manifest.judgmentWithdrawal, projectHistory: projectHistory?.status==='checked', gitDiff: false, regressionCases: false
  };
  const missing = skill.requiredInputs.filter(key => !available[key]);
  const value = missing.length
    ? { status: 'needs-evidence', evidence: [{ missing }], findings: [], proposedUpdates: [], limitations: [`Missing required inputs: ${missing.join(', ')}.`] }
    : await runHandler(skill.handler, { run, spec: run.spec, repo, skill, sourceSnapshot: snapshot, projectHistory, rubricSnapshot: rubricText ? JSON.parse(rubricText) : undefined });
  const ojo = !missing.length && ['brand-foundation-extractor','visual-hierarchy-reviewer','visual-qa-evaluator'].includes(id)
    ? await stageOjoGuidance(directory, 'review') : null;
  const design = ojo ? await stageDesignGuidance(directory,'review',run.manifest.onboarding?.config?.designGuidance) : null;
  if(projectHistory&&missing.length){value.evidence.push({type:'accepted-pattern-history',...projectHistory,records:[]});value.limitations.push(...projectHistory.limitations);}
  if (ojo) value.designGuidance = ojo.metadata;
  if (design) {value.designGuidancePacks=design.metadata;value.guidanceApplication='available-only: deterministic handler did not execute model critique or vendor scripts';}
  const hash = value => createHash('sha256').update(value).digest('hex');
  const source = new URL('./', import.meta.url);
  const files = (await readdir(source)).filter(name=>name.endsWith('.js')).sort();
  const implementation = await Promise.all(files.map(async name=>name+'\n'+await readFile(new URL(name,source),'utf8')));
  if(projectHistory)implementation.push('harness-core/pattern-history.js\n'+await readFile(new URL('../harness-core/pattern-history.js',import.meta.url),'utf8'));
  implementation.push('pnpm-lock.yaml\n'+await readFile(new URL('../../pnpm-lock.yaml',import.meta.url),'utf8'));
  const provenance = {
    schemaVersion: '0.1', skillVersion: skill.version,
    ...(projectHistory?{patternHistoryHash:hash(JSON.stringify(projectHistory))}:{}),
    designGuidance: ojo?.metadata || null,
    designGuidancePacks: design?.metadata || null,
    contractHash: hash(JSON.stringify(contractFiles)),
    implementationHash: hash(implementation.join('\n')),
    inputHash: hash(JSON.stringify({spec:run.spec,captures:run.manifest.captures,findingId:run.manifest.findingId,confirmation:run.manifest.confirmation,judgment:run.manifest.judgment,judgmentWithdrawal:run.manifest.judgmentWithdrawal||null,...(projectHistory?{patternHistory:projectHistory}:{}),source:snapshot ? {files:snapshot.files,truncated:snapshot.truncated} : null})),
    sourceHash: snapshot ? hash(JSON.stringify(snapshot.files)) : null,
    sourceFileCount: snapshot?.files.length || 0, sourceTruncated: snapshot?.truncated || false,
    repositoryCommit: run.manifest.onboarding?.repository?.commit || run.manifest.execution?.baseCommit || null
  };
  const result = skillResult(skill, value, provenance);
  await saveSkillResult(directory, result, { retry, expectedPath: run.manifest.skills.find(item=>item.id===id)?.path || null });
  return result;
}
