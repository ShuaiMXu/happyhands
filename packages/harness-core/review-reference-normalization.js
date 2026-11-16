import {assertVisualReview} from './visual-review.js';
import {verificationHash} from './verification.js';
// Only exact, unique IDs can be converted. Semantic content is never edited.
export function normalizeReviewReferences(original,manifest){
 const result=structuredClone(original),records=manifest.verificationRecords||[],changes=[];
 const byId=new Map(records.map(record=>[record.id,record]));
 const byArtifact=new Map();for(const record of records){const rows=byArtifact.get(record.artifactId)||[];rows.push(record);byArtifact.set(record.artifactId,rows);}
 if(result.verificationRefs){result.verificationRefs=result.verificationRefs.map(value=>{if(byId.has(value))return value;const candidates=byArtifact.get(value);if(candidates?.length!==1)throw Error('Verification reference has no unique exact mapping.');changes.push({field:'verificationRefs',from:value,to:candidates[0].id});return candidates[0].id;});}
 if(result.attachmentRefs){result.attachmentRefs=result.attachmentRefs.filter(value=>{
  if(manifest.reviewAttachments?.some(item=>item.id===value))return true;
  const candidates=byArtifact.get(value);if(candidates?.length!==1)throw Error('Attachment reference is unknown or ambiguous.');
  const record=candidates[0];if(!result.verificationRefs?.includes(record.id)||!record.images?.length||record.images.some(image=>!result.screenshotRefs?.includes(image.path)))throw Error('Removing a verification UUID requires its inspected originals and verification record citation.');
  changes.push({field:'attachmentRefs',from:value,to:null});return false;
 });}
 assertVisualReview(result,manifest);
 return {review:result,provenance:{version:'review-reference-normalization@1',originalHash:verificationHash(original),normalizedHash:verificationHash(result),changes,limitation:'Exact reference conversion only; does not prove reviewer inspection or human acceptance.'}};
}
