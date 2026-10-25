import {readVerificationFile,verificationHash} from './verification.js';
import {readPatternReview,patternReviewContext} from './pattern-review-record.js';
import {acceptedPatternHistory} from './pattern-history.js';
import {sourceFiles} from '../skill-core/scan.js';
import {patternCandidates} from '../skill-core/patterns.js';

export function admittedPatternEntry(runId,id,reference,{record,input}){
  if(record.guidance.verdict!=='propose')throw Error('Only a complete proposed pattern can enter Foundation review.');
  const candidate=input.candidate,guide=record.guidance;
  return {name:candidate.name,description:guide.summary,source:candidate.source,status:'observed',
    usage:{schemaVersion:'0.1',whenToUse:guide.whenToUse,whenToAvoid:guide.whenToAvoid,exceptions:guide.exceptions,limitations:guide.limitations,
      dependencies:input.sources.map(item=>item.source),tokenReferences:candidate.tokenReferences,examples:candidate.examples},
    evidence:{schemaVersion:'0.1',status:'observed',details:{type:'pattern-guidance',reviewId:reference.id,inputDigest:reference.inputDigest},
      provenance:{type:'pattern-guidance-admission',runId,admissionId:id,review:reference}}};
}

export async function currentPatternProposal(run,reference,repo){
  const reviewed=await readPatternReview(run,reference);
  if(reviewed.record.guidance.verdict!=='propose')throw Error('Incomplete guidance cannot enter Foundation review.');
  if(patternReviewContext(run)!==reviewed.input.currentContextHash)throw Error('Saved review context changed; draft fresh guidance before admission.');
  const snapshot=await sourceFiles(repo,{includeDesignDocs:true}),history=await acceptedPatternHistory(run,repo,snapshot);
  const candidate=patternCandidates(snapshot,history).find(item=>item.source===reference.source);
  if(!candidate||verificationHash(candidate)!==verificationHash(reviewed.input.candidate)||verificationHash(history)!==reviewed.input.historyHash)throw Error('Pattern acceptance or source evidence changed; review fresh evidence before admission.');
  return reviewed;
}

export async function readPatternAdmission(run,reference){
  if(!/^[a-f0-9-]{36}$/.test(reference.id||'')||reference.path!==`pattern-admissions/${reference.id}.json`||['hash','entryHash'].some(key=>!/^[a-f0-9]{64}$/.test(reference[key]||'')))throw Error('Invalid pattern admission reference.');
  const bytes=await readVerificationFile(run.directory,reference.path,1024*1024);
  if(verificationHash(bytes)!==reference.hash)throw Error('Pattern admission changed.');
  const record=JSON.parse(bytes),review=run.manifest.patternReviews?.find(item=>item.id===reference.reviewId);
  if(record.schemaVersion!=='0.1'||record.runId!==run.manifest.id||record.id!==reference.id||record.action!=='stage-for-foundation-review'||!Number.isFinite(Date.parse(record.recordedAt))
    ||!review||JSON.stringify(record.review)!==JSON.stringify(review)||record.entry?.source!==reference.source||verificationHash(record.entry)!==reference.entryHash)throw Error('Pattern admission is not bound to this run.');
  const reviewed=await readPatternReview(run,review),expected=admittedPatternEntry(run.manifest.id,reference.id,review,reviewed);
  if(verificationHash(expected)!==reference.entryHash||record.baseFoundationHash!==verificationHash(reviewed.input.foundation))throw Error('Pattern admission rules no longer match their reviewed proposal.');
  return record;
}

export async function readPatternAdmissions(run){
  const records=[],ids=new Set(),sources=new Set();
  if((run.manifest.patternAdmissions||[]).length>128)throw Error('Pattern admission limit exceeded.');
  for(const reference of run.manifest.patternAdmissions||[]){
    if(ids.has(reference.id)||sources.has(reference.source))throw Error('Duplicate pattern admission.');
    ids.add(reference.id);sources.add(reference.source);records.push(await readPatternAdmission(run,reference));
  }
  return records;
}
