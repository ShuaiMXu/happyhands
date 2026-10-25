import {mkdir,realpath,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {captureOriginals} from './capture-state.js';
import {readVerificationFile,verificationHash,readVerificationEvidence} from './verification.js';
import {assertVisualReview} from './visual-review.js';
import {designSystemContext} from '../skill-core/design-system.js';
import {assertBrandAssessments} from '../skill-core/brand-review.js';

function context(run,review){
  const qa=review.skillId==='visual-qa-evaluator';
  const phases=qa?['before','after']:[...new Set(review.screenshotRefs.map(path=>path.split('/')[0]).filter(phase=>['before','after'].includes(phase)))].sort();
  return {runId:run.manifest.id,skillId:review.skillId,...(review.brandAssessments?{designSystemExtractions:run.manifest.designSystemExtractions||null}:{}),captures:Object.fromEntries(phases.map(phase=>[phase,run.manifest.captures?.[phase]||null])),
    attachments:(run.manifest.reviewAttachments||[]).filter(attachment=>review.attachmentRefs?.includes(attachment.id)),
    ...(qa?{project:run.spec.project,foundation:run.spec.designFoundation,foundationApproval:run.manifest.foundationApproval||null,findings:run.spec.findings,evidence:run.spec.evidence,
      confirmation:run.manifest.confirmation||null,plan:run.manifest.plan||null,evaluation:run.manifest.evaluation||null,verificationDigest:run.manifest.verificationEvidence?.digest||null}: {})};
}

export async function assertReviewStorage(directory){
  await mkdir(join(directory,'reviews'),{recursive:true});
  if(await realpath(join(directory,'reviews'))!==join(await realpath(directory),'reviews'))throw Error('Visual review storage cannot use symlinks.');
}

function safeReviewPath(reference){
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(reference.skillId||'')||!new RegExp(`^reviews/${reference.skillId}(?:-[a-f0-9]{64})?\\.json$`).test(reference.path||''))throw Error('Invalid visual review path.');
}

async function reviewManifest(run){
  const verification=run.manifest.verificationEvidence?await readVerificationEvidence(run.directory,run.manifest):{records:[]};
  return {...run.manifest,verificationRecords:verification.records};
}

export async function bindVisualReview(run,review,path,expectedHashes={}){
  if(review.skillId==='visual-qa-evaluator'&&(review.reviewer?.type==='model'||review.brandAssessments))assertBrandAssessments(review,await designSystemContext(run));
  safeReviewPath({skillId:review.skillId,path});
  const bytes=await readVerificationFile(run.directory,path,1024*1024),reviewHash=verificationHash(bytes);
  if(JSON.stringify(JSON.parse(bytes))!==JSON.stringify(review))throw Error('Visual review artifact changed while saving.');
  const referenced=[...review.screenshotRefs,...review.findings.flatMap(finding=>finding.screenshotRefs||[])];
  const attachmentPaths=new Set();
  const allowed=new Set([...Object.values(run.manifest.captures||{}).flatMap(captureOriginals),...(run.manifest.verificationRecords||[]).flatMap(record=>record.images.map(image=>image.path))]);
  for(const attachment of run.manifest.reviewAttachments||[])if(review.attachmentRefs?.includes(attachment.id)){allowed.add(attachment.path);referenced.push(attachment.path,attachment.screenshot);attachmentPaths.add(attachment.path);attachmentPaths.add(attachment.screenshot);}
  const paths=[...new Set([...referenced,...Object.keys(expectedHashes)])].sort();
  if(paths.length>10000||paths.some(path=>!allowed.has(path)))throw Error('Visual review contains an unknown or excessive evidence reference.');
  const originals=[];
  for(const path of paths){
    const hash=verificationHash(await readVerificationFile(run.directory,path,24*1024*1024));
    if(expectedHashes[path]&&expectedHashes[path]!==hash)throw Error(attachmentPaths.has(path)?'Visual review attachment or source changed':'Screenshot changed during AI review; capture and review again.');
    originals.push({path,hash});
  }
  const inputAssurance=referenced.every(path=>Boolean(expectedHashes[path]))?'producer-supplied-input-hashes':'attestation-time-snapshot';
  const record={schemaVersion:'0.1',runId:run.manifest.id,reviewPath:path,reviewHash,contextHash:verificationHash(context(run,review)),inputAssurance,originals};
  const content=JSON.stringify(record,null,2)+'\n',hash=verificationHash(content),bindingPath=path.replace(/\.json$/,'.binding.json');
  if(Buffer.byteLength(content)>8*1024*1024)throw Error('Visual review binding exceeds its limit.');
  try{await writeFile(join(run.directory,bindingPath),content,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;if((await readVerificationFile(run.directory,bindingPath,8*1024*1024)).toString('utf8')!==content)throw Error('Visual review binding already changed.');}
  return {path:bindingPath,hash};
}

export async function readVisualReviewBinding(run,reference,{requireBound=false,checkOriginals=true,checkContext=true,retryDepth=0}={}){
  safeReviewPath(reference);
  if(!reference.evidenceBinding){
    let sidecar=false;try{await readVerificationFile(run.directory,reference.path.replace(/\.json$/,'.binding.json'),8*1024*1024);sidecar=true;}catch(error){if(error.code!=='ENOENT')throw error;}
    if(sidecar)throw Error('Visual review binding reference is missing.');
    if(requireBound)throw Error('Visual review has no durable evidence binding; collect a fresh review.');
    const review=JSON.parse(await readVerificationFile(run.directory,reference.path,1024*1024));if(checkContext)assertVisualReview(review,await reviewManifest(run));
    if(review.skillId!==reference.skillId||review.verdict!==reference.verdict||JSON.stringify(review.reviewer)!==JSON.stringify(reference.reviewer)||review.reviewedAt!==reference.reviewedAt||(review.verificationDigest||null)!==(reference.verificationDigest||null))throw Error('Legacy visual review reference changed.');
    return {status:'legacy-unbound',review,record:null};
  }
  const binding=reference.evidenceBinding;
  if(!/^[a-f0-9]{64}$/.test(binding.hash||'')||binding.path!==reference.path.replace(/\.json$/,'.binding.json'))throw Error('Invalid visual review binding path.');
  const raw=await readVerificationFile(run.directory,binding.path,8*1024*1024);
  if(verificationHash(raw)!==binding.hash)throw Error('Visual review binding changed.');
  const record=JSON.parse(raw),reviewBytes=await readVerificationFile(run.directory,reference.path,1024*1024);
  if(record.schemaVersion!=='0.1'||record.runId!==run.manifest.id||record.reviewPath!==reference.path||record.reviewHash!==verificationHash(reviewBytes)||!Array.isArray(record.originals)||!record.originals.length||record.originals.length>10000)throw Error('Visual review artifact changed or is not bound to this run.');
  const review=JSON.parse(reviewBytes);
  if(checkContext&&review.skillId==='visual-qa-evaluator'&&(review.reviewer?.type==='model'||review.brandAssessments))assertBrandAssessments(review,await designSystemContext(run));
  if(review.skillId!==reference.skillId||review.verdict!==reference.verdict||review.reviewedAt!==reference.reviewedAt||JSON.stringify(review.reviewer)!==JSON.stringify(reference.reviewer)||(review.verificationDigest||null)!==(reference.verificationDigest||null))throw Error('Visual review reference changed.');
  if(checkContext&&record.contextHash!==verificationHash(context(run,review)))throw Error('Visual review context changed; collect a fresh review.');
  if(checkContext)assertVisualReview(review,await reviewManifest(run));
  const paths=new Set();
  for(const original of record.originals){
    if(typeof original.path!=='string'||paths.has(original.path)||!/^[a-f0-9]{64}$/.test(original.hash||''))throw Error('Invalid visual review original binding.');paths.add(original.path);
    if(checkOriginals&&verificationHash(await readVerificationFile(run.directory,original.path,24*1024*1024))!==original.hash)throw Error('Visual review original changed; capture and review again.');
  }
  if(review.screenshotRefs.some(path=>!paths.has(path))||review.findings.some(finding=>(finding.screenshotRefs||[]).some(path=>!paths.has(path))))throw Error('Visual review evidence binding is incomplete.');
  if(review.attempt){
    if(retryDepth>=32)throw Error('Review retry lineage exceeds its inspection bound.');
    const attempt=review.attempt,parent=(run.manifest.visualReviewHistory||[]).find(item=>item.path===attempt.previousReviewPath);
    if(!parent||verificationHash(parent)!==attempt.previousReferenceHash)throw Error('Review retry parent reference changed or is missing.');
    const prior=await readVisualReviewBinding(run,parent,{requireBound:true,checkOriginals,checkContext,retryDepth:retryDepth+1});
    const versionMatches=(version,expected)=>version===expected||version.startsWith(expected+';');
    if(prior.record.reviewHash!==attempt.previousReviewHash||!versionMatches(prior.review.reviewer.version,attempt.fromProtocol)||!versionMatches(review.reviewer.version,attempt.toProtocol))throw Error('Review retry parent attestation changed.');
    if(attempt.kind==='evidence-retry'){
      if(prior.review.verdict!=='fail'||prior.review.reviewer.type!=='model')throw Error('Counter-evidence parent is not a failed model review.');
      const evidence=(attempt.evidenceIds||[]).map(id=>(run.manifest.reviewAttachments||[]).find(item=>item.id===id));
      if(evidence.some(item=>!item)||(verificationHash(evidence)!==attempt.evidenceHash))throw Error('Counter-evidence lineage changed.');
      const {assertFindingResolutions}=await import('./review-retry.js');assertFindingResolutions(review,prior.review);
    }else if(prior.review.verdict!=='needs-evidence'||prior.review.findings.length)throw Error('Review retry parent attestation changed.');
  }
  return {status:'bound',review,record};
}
