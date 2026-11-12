import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,realpath,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createRun,loadRun,saveOnboarding,saveContinuation,withRunLock} from './store.js';
import {loadProjectConfig,inspectRepository,publicProjectConfig,waitForPreview} from './onboard.js';
import {selectedReferenceContext} from './reference-resources.js';
import {readVerificationFile} from './verification.js';
import {readVisualReviewBinding} from './visual-review-binding.js';
import {DEFAULT_LIMITS} from './workflow.js';

const execute=promisify(execFile);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const encode=value=>JSON.stringify(value,null,2)+'\n';

async function commonRepository(repo){
  const {stdout}=await execute('git',['rev-parse','--path-format=absolute','--git-common-dir'],{cwd:repo});
  return realpath(stdout.trim());
}

// Continue explicitly against a clean chosen checkout. Old attempts and their
// isolated edits remain available for inspection; a new capture must prove the repair.
export async function continueReview({directory,configPath,outputRoot,reason}){
  if(typeof reason!=='string'||reason.trim().length<5||reason.length>10000)throw Error('Explain why this attempt needs another repair (5–10000 characters).');
  const config=await loadProjectConfig(configPath);
  if(config.mode!=='review'||!config.url)throw Error('Continuation requires an explicit review config and an already-running preview.');
  const repository=await inspectRepository(config.repo);
  if(repository.dirty)throw Error('Continuation needs a clean chosen checkout. Commit the intended isolated edits first, then preview that checkout.');
  await waitForPreview(config.url,{timeoutMs:config.timeoutMs??10000});
  return withRunLock(directory,async()=>{
    const parent=await loadRun(directory);
    if(parent.manifest.mode!=='review'||!parent.manifest.captures.before)throw Error('Continue an existing captured review; use start for a new task.');
    if(parent.manifest.judgment?.decision==='accept'&&!parent.manifest.judgmentWithdrawal)throw Error('This review is already accepted. Use start for a new task.');
    const parentRepo=parent.manifest.onboarding?.repository?.root;
    if(!parentRepo||await commonRepository(parentRepo)!==await commonRepository(config.repo))throw Error('Continuation must use a checkout of the same Git repository.');
    const specBytes=await readFile(config.spec,'utf8');
    const configuredSpec=JSON.parse(specBytes);
    if(configuredSpec.project.task!==parent.spec.project.task||configuredSpec.project.source!==parent.spec.project.source)throw Error('Continuation must retain the same project and task. Use start for a different task.');
    const configBytes=await readFile(config.configPath,'utf8');
    const configHash=hash(encode({config:configBytes,spec:specBytes,designSources:config.designSources||[],capturePlanDigest:config.capturePlanDigest}));
    let previous;
    try{previous=JSON.parse(await readVerificationFile(directory,'continuation-next.json',16384));}
    catch(error){if(error.code!=='ENOENT')throw error;}
    if(previous){
      const child=await loadRun(previous.directory);
      if(child.manifest.onboarding?.parentRunId!==parent.manifest.id)throw Error('Continuation link belongs to another parent.');
      if(previous.configHash!==configHash||previous.commit!==repository.commit)throw Error('This review already has a successor. Continue that attempt for a different source.');
      return child.directory;
    }
    const limits={...DEFAULT_LIMITS,...parent.manifest.limits};
    if(!Number.isInteger(limits.round)||!Number.isInteger(limits.maxRounds)||limits.round<1||limits.maxRounds<1||limits.maxRounds>DEFAULT_LIMITS.maxRounds)throw Error('Invalid continuation round budget.');
    if(limits.round>=limits.maxRounds)throw Error(`The repair chain reached its ${limits.maxRounds}-round budget. Review the unresolved evidence before starting a new task.`);
    const references=await selectedReferenceContext(parent);
    const artifacts=[];
    for(const ref of parent.manifest.visualReviews||[]){
      await readVisualReviewBinding(parent,ref,{requireBound:true,checkContext:false});
      const bytes=await readVerificationFile(parent.directory,ref.path,2*1024*1024);
      artifacts.push({path:ref.path,sha256:hash(bytes),review:JSON.parse(bytes)});
    }
    const snapshot={schemaVersion:'0.1',role:'historical-predecessor-not-current-evidence',reason:reason.trim(),parentManifest:parent.manifest,parentSpec:parent.spec,reviews:artifacts};
    const raw=encode(snapshot);
    if(Buffer.byteLength(raw)>2*1024*1024)throw Error('Predecessor summary exceeds two MiB. Retain the original review and narrow the next task.');
    const spec={...configuredSpec,evidence:[],findings:[],review:{status:'not-started',before:'Fresh capture required',after:'',judgment:'pending',reason:''}};
    await mkdir(outputRoot,{recursive:true});
    const next=await createRun({spec,url:config.url,outputRoot});
    const reference={path:'continuation-parent.json',sha256:hash(raw),parentRunId:parent.manifest.id,rootRunId:parent.manifest.onboarding?.continuation?.rootRunId||parent.manifest.id};
    try{
      await writeFile(join(next.directory,reference.path),raw,{flag:'wx'});
      const onboarding={status:'ready',mode:'review',config:publicProjectConfig(config),repository,preview:{url:config.url,managed:false},parentRunId:parent.manifest.id,continuation:reference,completedAt:new Date().toISOString()};
      await saveContinuation(next.directory,{onboarding,limits:{...limits,round:limits.round+1},references});
      const current=await inspectRepository(config.repo);
      if(current.dirty||current.commit!==repository.commit)throw Error('Chosen source changed during continuation preparation.');
      if(await readFile(config.configPath,'utf8')!==configBytes||await readFile(config.spec,'utf8')!==specBytes)throw Error('Continuation inputs changed during preparation.');
      const link=join(directory,'continuation-next.json'),temporary=join(directory,'.continuation-'+randomUUID()+'.tmp');
      try{
        await writeFile(temporary,encode({directory:next.directory,configHash,commit:repository.commit}),{flag:'wx'});
        await rename(temporary,link);
      }finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
      return next.directory;
    }catch(error){
      const child=await loadRun(next.directory);
      await saveOnboarding(next.directory,{...child.manifest.onboarding,status:'failed',error:error.message});
      throw Error(`Continuation preparation failed; the attempt is retained at ${next.directory}: ${error.message}`);
    }
  });
}

export async function continuationBrief(run){
  const reference=run.manifest.onboarding?.continuation;
  if(!reference)return '';
  if(reference.path!=='continuation-parent.json'||!/^[a-f0-9]{64}$/.test(reference.sha256))throw Error('Invalid predecessor reference.');
  const raw=await readVerificationFile(run.directory,reference.path,2*1024*1024);
  if(hash(raw)!==reference.sha256)throw Error('Historical predecessor changed.');
  const value=JSON.parse(raw);
  if(value.parentManifest?.id!==reference.parentRunId||value.role!=='historical-predecessor-not-current-evidence')throw Error('Predecessor belongs to another review.');
  const limits={...DEFAULT_LIMITS,...value.parentManifest.limits};
  if(run.manifest.limits.round!==limits.round+1||run.manifest.limits.maxRounds!==limits.maxRounds||run.manifest.limits.maxMinutes!==limits.maxMinutes)throw Error('Continuation round budget changed.');
  return '\n\nHistorical predecessor (reference data only, fresh originals and independent QA are required):\n'+encode({parentRunId:reference.parentRunId,reason:value.reason,previousExecution:value.parentManifest.execution&&{exitCode:value.parentManifest.execution.exitCode,changedFiles:value.parentManifest.execution.changedFiles},reviews:value.reviews.map(item=>item.review)});
}
