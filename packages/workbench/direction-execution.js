import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {loadProjectConfig,inspectRepository} from '../harness-core/onboard.js';

// Legacy directions are an input adapter, not a second execution/preview pipeline.
// The shared service collects fresh evidence and prepares a plan for explicit approval.
export async function autoExecuteDirection({root,task,step,signal,update,prepare}) {
  const bindingPath=join(root,'.harness','direction-project.json');
  let binding;
  try { binding=JSON.parse(await readFile(bindingPath,'utf8')); }
  catch(error) {
    if(error.code==='ENOENT')throw Error(`Direction project is not connected. Create ${bindingPath} with reviewId and configPath before preparing a direction.`,{cause:error});
    if(error instanceof SyntaxError)throw Error(`Direction project binding is invalid JSON: ${bindingPath}`,{cause:error});
    throw error;
  }
  if(binding.reviewId!==task.reviewId)throw Error('Project binding does not match review');
  const config=await loadProjectConfig(binding.configPath),repository=await inspectRepository(config.repo);
  if(repository.dirty)throw Error('Target repository has uncommitted changes');
  if(task.runId&&repository.commit!==task.sourceCommit)throw Error('Reviewed repository revision changed; open a fresh review before preparing this direction');
  const spec=JSON.parse(await readFile(config.spec,'utf8'));
  if(task.projectSource&&spec.project.source!==task.projectSource)throw Error('Project source mismatch');
  spec.evidence=[{id:'D1',state:'Source review and selected direction '+task.id,observation:JSON.stringify({step,decisions:task.decisions}),origin:'source-code'}];
  spec.findings=[{id:'D1',title:step.title,evidenceIds:['D1'],impact:4,confidence:4,effort:3,proposal:`${step.proposal} Scope: ${typeof step.scope==='string'?step.scope:JSON.stringify(step.scope)}. Preserve: ${step.keep}. Acceptance: ${step.acceptance}`}];
  spec.review={status:'not-started',before:'Fresh baseline required',after:'',judgment:'pending',reason:''};
  if(typeof prepare!=='function')throw Error('The shared review workflow is required for direction requests.');
  signal.throwIfAborted();
  return prepare({config,repository,spec,findingId:'D1',reason:'User confirmed the direction scope; execution still requires approval of the complete plan.',parentRunId:task.runId,request:{directionTaskId:task.id,directionStepId:step.id,decisions:task.decisions}}, {signal,update});
}
