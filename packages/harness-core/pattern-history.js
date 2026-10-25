import {dirname,basename,join} from 'node:path';
import {lstat,realpath} from 'node:fs/promises';
import {loadRun} from './store.js';
import {readVerificationFile,verificationHash} from './verification.js';
import {readVisualReviewBinding} from './visual-review-binding.js';
import {readRepositoryInputs} from './repository-inputs.js';
import {repositoryFingerprint,sameRepositoryFingerprint} from './repository-fingerprint.js';
import {visualReviewFor} from './workflow.js';
import {snapshotHash} from '../skill-core/design-system.js';
import {sourceFiles} from '../skill-core/scan.js';
import {captureEntries} from './capture-state.js';

const ID=/^[a-z0-9][a-z0-9_-]{0,63}$/;
const JSON_LIMIT=8*1024*1024,IMAGE_LIMIT=128*1024*1024;

// Follow explicitly linked ancestry, never unrelated user folders. A name or
// public URL is insufficient to identify the local repository being reviewed.
export async function acceptedPatternHistory(run,repo,snapshot){
  const result={schemaVersion:'0.1',status:'unavailable',records:[],excluded:[],limitations:[
    'Only the explicit parent chain (at most 16 records) is inspected; unrelated branches and older source versions are not inferred.',
    'Only exact current repository contents and source snapshots qualify. Accepted UI is candidate evidence, not shared-pattern approval.'
  ]};
  if(!repo||!snapshot||snapshot.truncated){result.limitations.push('A complete current source snapshot is required.');return result;}
  const root=dirname(run.directory);
  if(basename(root)!=='runs'){result.limitations.push('An explicit local runs directory is required.');return result;}
  let current,repository;
  try{
    repository=await realpath(repo);
    if(!run.manifest.onboarding?.repository?.root||await realpath(run.manifest.onboarding.repository.root)!==repository)throw Error('current-project-mismatch');
    current=await repositoryFingerprint(repo);
  }
  catch{result.limitations.push('Current repository identity or complete inputs are unavailable.');return result;}
  const sourceHash=snapshotHash(snapshot),seen=new Set([run.manifest.id]);
  result.repository={identityHash:verificationHash(repository),...current,sourceSnapshotHash:sourceHash};
  let id=run.manifest.onboarding?.parentRunId,bytes=0;
  const accepted=[];
  result.status='checked';
  for(let depth=0;id&&depth<16;depth++){
    if(!ID.test(id)||seen.has(id)){result.excluded.push({reason:'invalid-or-cyclic-parent'});break;}
    seen.add(id);
    let parent,next=null;
    try{
      const folder=await lstat(join(root,id));
      if(!folder.isDirectory()||folder.isSymbolicLink())throw Error('unsafe');
      // Bound the extra files read by the existing run loader as well.
      for(const name of ['run.json','experience.json','execution-context.json','judgment-withdrawal.json']){
        try{const raw=await readVerificationFile(root,`${id}/${name}`,JSON_LIMIT);bytes+=raw.length;if(bytes>64*1024*1024)throw Error('budget');}
        catch(error){if(error.code!=='ENOENT'||['run.json','experience.json'].includes(name))throw error;}
      }
      parent=await loadRun(join(root,id));next=parent.manifest.onboarding?.parentRunId;
      if(parent.manifest.id!==id||parent.spec.project.source!==run.spec.project.source||!parent.manifest.onboarding?.repository?.root||await realpath(parent.manifest.onboarding.repository.root)!==repository){result.excluded.push({runId:id,reason:'different-or-unbound-project'});break;}
      if(parent.manifest.judgment?.decision!=='accept'||parent.manifest.judgmentWithdrawal){result.excluded.push({runId:id,reason:'no-active-acceptance'});id=next;continue;}
      const inputs=await readRepositoryInputs(parent,'after'),capture=parent.manifest.captures.after;
      if(!inputs||inputs.fingerprint.contentHash!==current.contentHash||inputs.fingerprint.fileCount!==current.fileCount||capture?.designSystemSource?.snapshotHash!==sourceHash){result.excluded.push({runId:id,reason:'accepted-source-does-not-match-current-inputs'});id=next;continue;}
      const reference=visualReviewFor(parent.manifest,'visual-qa-evaluator');
      if(reference?.verdict!=='pass')throw Error('qa');
      const bound=await readVisualReviewBinding(parent,reference,{requireBound:true,checkOriginals:false});
      if(bound.record.originals.length>256||captureEntries(capture).length>512)throw Error('capture-budget');
      for(const original of bound.record.originals){
        if(bytes>=IMAGE_LIMIT)throw Error('image-budget');
        const image=await readVerificationFile(parent.directory,original.path,Math.min(24*1024*1024,IMAGE_LIMIT-bytes));
        bytes+=image.length;
        if(verificationHash(image)!==original.hash)throw Error('image-changed');
      }
      result.records.push({runId:id,task:parent.spec.project.task,judgmentHash:verificationHash(parent.manifest.judgment),qaHash:reference.evidenceBinding.hash,
        sourceHash,originals:bound.record.originals,capture});
      accepted.push({id,reference,judgmentHash:verificationHash(parent.manifest.judgment)});
    }catch{result.excluded.push({runId:id,reason:'history-evidence-unavailable-or-invalid'});}
    id=next;
  }
  if(id)result.limitations.push('History traversal stopped before the full ancestry was inspected.');
  try{
    if(!sameRepositoryFingerprint(current,await repositoryFingerprint(repo))||sourceHash!==snapshotHash(await sourceFiles(repo,{includeDesignDocs:true})))throw Error('source-changed');
    for(const item of accepted){
      const latest=await loadRun(join(root,item.id));
      if(latest.manifest.judgmentWithdrawal||verificationHash(latest.manifest.judgment)!==item.judgmentHash)throw Error('decision-changed');
      await readVisualReviewBinding(latest,item.reference,{requireBound:true,checkOriginals:false});
    }
  }catch{result.records=[];result.status='unavailable';result.limitations.push('Inputs or historical decisions changed during collection; no candidates are admitted.');}
  return result;
}
