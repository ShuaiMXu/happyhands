import {readVerificationFile,verificationHash} from './verification.js';
import {readVisualReviewBinding} from './visual-review-binding.js';

export const CURRENT_VISUAL_REVIEW_PROTOCOL='ai-visual-review@16';
const protocol=version=>/^ai-visual-review@([1-9][0-9]*)(?:;|$)/.exec(version||'');

// A protocol repair can revisit an unresolved, finding-free model attestation.
// It cannot reroll the current method, replace a human decision, or hide a
// recorded regression without new evidence.
export async function prepareProtocolRetry(run,reference,{reason,optional=false}={}){
  if(typeof reason!=='string'||!reason.trim()||reason.trim().length>2000)throw Error('A bounded review retry reason is required.');
  const old=protocol(reference?.reviewer?.version),current=protocol(CURRENT_VISUAL_REVIEW_PROTOCOL);
  const eligible=!run.manifest.judgment&&reference?.skillId==='visual-qa-evaluator'&&reference.verdict==='needs-evidence'
    &&reference.reviewer.type==='model'&&reference.evidenceBinding&&old&&Number(old[1])<Number(current[1]);
  if(!eligible){if(optional)return null;throw Error('Protocol retry requires an older bound model needs-evidence review without a human decision; unchanged methods require new evidence.');}
  const saved=await readVisualReviewBinding(run,reference,{requireBound:true});
  if(saved.review.findings.length){if(optional)return null;throw Error('A review with unresolved findings requires new evidence, not a protocol retry.');}
  return {kind:'protocol-retry',previousReviewPath:reference.path,previousReviewHash:saved.record.reviewHash,
    previousReferenceHash:verificationHash(reference),fromProtocol:`ai-visual-review@${old[1]}`,toProtocol:CURRENT_VISUAL_REVIEW_PROTOCOL,reason:reason.trim()};
}

export async function assertProtocolRetry(run,reference,review){
  const attempt=review.attempt,expected=await prepareProtocolRetry(run,reference,{reason:attempt.reason});
  if(verificationHash(attempt)!==verificationHash(expected)||review.reviewer.type!=='model'||!review.reviewer.version.startsWith(CURRENT_VISUAL_REVIEW_PROTOCOL+';')
    ||(reference.verificationDigest||null)!==(review.verificationDigest||null))throw Error('Review retry no longer matches the previous attestation, protocol or evidence.');
}

// Revisit a failure only with a genuinely new, source-bound image, never a random reroll.
export async function prepareEvidenceRetry(run,reference,{reason,evidenceIds}={}){
  if(typeof reason!=='string'||!reason.trim()||reason.trim().length>2000)throw Error('A bounded evidence review reason is required.');
  if(run.manifest.judgment||run.manifest.judgmentWithdrawal||reference?.skillId!=='visual-qa-evaluator'||reference.verdict!=='fail'||reference.reviewer?.type!=='model')throw Error('Evidence review requires a bound model failure without a human decision.');
  if(!Array.isArray(evidenceIds)||!evidenceIds.length||evidenceIds.length>12||new Set(evidenceIds).size!==evidenceIds.length)throw Error('Select new source-bound counter-evidence.');
  const saved=await readVisualReviewBinding(run,reference,{requireBound:true});
  const used=new Set(saved.review.attachmentRefs||[]),attachments=run.manifest.reviewAttachments||[];
  const previousImages=new Set(attachments.filter(item=>used.has(item.id)).map(item=>item.imageHash));
  const evidence=[];
  for(const id of [...evidenceIds].sort()){
    const item=attachments.find(item=>item.id===id);
    if(!item||used.has(id)||previousImages.has(item.imageHash)||item.path!==`reviews/attachments/${id}.png`||!item.notes?.trim())throw Error('Counter-evidence must be new and include its method and limitations.');
    if(verificationHash(await readVerificationFile(run.directory,item.path,12*1024*1024))!==item.imageHash||verificationHash(await readVerificationFile(run.directory,item.screenshot,24*1024*1024))!==item.fingerprint)throw Error('Counter-evidence or its source changed.');
    evidence.push(item);
  }
  const old=protocol(reference.reviewer.version);
  if(!old)throw Error('Counter-evidence requires a recognized model review protocol.');
  return {kind:'evidence-retry',previousReviewPath:reference.path,previousReviewHash:saved.record.reviewHash,previousReferenceHash:verificationHash(reference),fromProtocol:`ai-visual-review@${old[1]}`,toProtocol:CURRENT_VISUAL_REVIEW_PROTOCOL,reason:reason.trim(),evidenceIds:[...evidenceIds].sort(),evidenceHash:verificationHash(evidence)};
}

export function assertFindingResolutions(review,previous){
  const resolutions=review.findingResolutions||[],ids=previous.findings.map(item=>item.id);
  if(resolutions.length!==ids.length||new Set(resolutions.map(item=>item.findingId)).size!==ids.length||resolutions.some(item=>!ids.includes(item.findingId)))throw Error('Resolve every previous finding explicitly.');
  for(const item of resolutions){
    if(!item.attachmentRefs.length||item.attachmentRefs.some(id=>!review.attachmentRefs?.includes(id))||!item.attachmentRefs.some(id=>review.attempt.evidenceIds.includes(id)))throw Error('Every resolution must cite inspected new counter-evidence.');
    if(review.verdict==='pass'&&item.verdict!=='refuted')throw Error('Unresolved findings block a passing review.');
  }
}

export async function assertEvidenceRetry(run,reference,review){
  const attempt=review.attempt,expected=await prepareEvidenceRetry(run,reference,attempt);
  if(verificationHash(attempt)!==verificationHash(expected)||review.reviewer.type!=='model'||!review.reviewer.version.startsWith(CURRENT_VISUAL_REVIEW_PROTOCOL+';')||(reference.verificationDigest||null)!==(review.verificationDigest||null)||attempt.evidenceIds.some(id=>!review.attachmentRefs?.includes(id)))throw Error('Counter-evidence retry no longer matches its source, parent or evidence.');
  assertFindingResolutions(review,(await readVisualReviewBinding(run,reference,{requireBound:true})).review);
}
