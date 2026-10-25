import Ajv from 'ajv/dist/2020.js';
import {readVerificationFile,verificationHash} from './verification.js';
import {pngDimensions} from './whole-page.js';

const strings={type:'array',maxItems:24,uniqueItems:true,items:{type:'string',minLength:1,maxLength:2500,pattern:'\\S'}};
// Keep the CLI output format in the basic structured-output subset. Admission
// below applies the tighter lengths, evidence references and verdict rules.
export const patternOutputSchema={type:'object',additionalProperties:false,
  required:['verdict','summary','whenToUse','whenToAvoid','exceptions','limitations','imageRefs','sourceRefs','tokenRefs'],properties:{
    verdict:{type:'string',enum:['propose','not-reusable','needs-evidence']},summary:{type:'string'},
    ...Object.fromEntries(['whenToUse','whenToAvoid','exceptions','limitations','imageRefs','sourceRefs','tokenRefs'].map(key=>[key,{type:'array',items:{type:'string'}}]))}};
const validate=new Ajv({allErrors:true}).compile({type:'object',additionalProperties:false,
  required:['verdict','summary','whenToUse','whenToAvoid','exceptions','limitations','imageRefs','sourceRefs','tokenRefs'],properties:{
    verdict:{enum:['propose','not-reusable','needs-evidence']},summary:{type:'string',minLength:1,maxLength:4000,pattern:'\\S'},
    whenToUse:strings,whenToAvoid:strings,exceptions:strings,limitations:{...strings,minItems:1},imageRefs:strings,sourceRefs:strings,tokenRefs:strings}});

export const patternReviewContext=run=>verificationHash({runId:run.manifest.id,project:run.spec.project,foundation:run.spec.designFoundation||null,
  approval:run.manifest.foundationApproval||null,plan:run.manifest.plan||null,captures:run.manifest.captures,skills:run.manifest.skills});
const sameSet=(a,b)=>a.length===b.length&&[...a].sort().every((value,index)=>value===[...b].sort()[index]);

export function assertPatternGuidance(value,input){
  if(!validate(value))throw Error('Invalid pattern guidance output: '+validate.errors.map(error=>error.instancePath+' '+error.message).join('; '));
  if(!sameSet(value.imageRefs,input.images.map(image=>image.file))||!sameSet(value.sourceRefs,input.sources.map(source=>source.source))
    ||value.tokenRefs.some(token=>!input.candidate.tokenReferences.includes(token)))throw Error('Pattern guidance cites missing or uninspected evidence.');
  for(const field of ['whenToUse','whenToAvoid','exceptions']){
    if(value.verdict==='propose'&&!value[field].length)throw Error('Proposed patterns require usage, avoidance and exception guidance.');
    if(value.verdict!=='propose'&&value[field].length)throw Error('Unresolved or non-reusable patterns cannot publish usage rules.');
  }
  return value;
}

// Validates a historical collection-time record, not current acceptance. Live
// history must be rechecked by the model runner before generating new advice.
export async function readPatternReview(run,reference){
  const id=reference.id,base=`pattern-reviews/${id}`;
  if(!/^[a-f0-9]{64}$/.test(id||'')||reference.path!==`${base}/review.json`||['hash','inputDigest'].some(key=>!/^[a-f0-9]{64}$/.test(reference[key]||'')))throw Error('Invalid pattern review reference.');
  const bytes=await readVerificationFile(run.directory,reference.path,256*1024);
  if(verificationHash(bytes)!==reference.hash)throw Error('Pattern review changed.');
  const record=JSON.parse(bytes),inputBytes=await readVerificationFile(run.directory,`${base}/input.json`,1024*1024);
  if(verificationHash(inputBytes)!==id)throw Error('Pattern review inputs changed.');
  const input=JSON.parse(inputBytes);
  const {requestNonce,inputDigest,...inputBase}=input;
  if(!/^[a-f0-9-]{36}$/.test(requestNonce||'')||inputDigest!==reference.inputDigest||verificationHash(JSON.stringify(inputBase,null,2)+'\n')!==inputDigest)throw Error('Pattern review input identity changed.');
  if(Object.keys(record).some(key=>!['schemaVersion','runId','inputHash','status','reviewer','reviewedAt','promptHash','guidance'].includes(key))
    ||record.schemaVersion!=='0.1'||record.runId!==run.manifest.id||record.inputHash!==id||record.status!=='proposal-only'
    ||record.reviewer?.type!=='model'||record.reviewer.name!=='Codex pattern guidance'||record.reviewer.version!=='pattern-guidance-review@1'
    ||!Number.isFinite(Date.parse(record.reviewedAt))||!/^[a-f0-9]{64}$/.test(record.promptHash||'')
    ||input.schemaVersion!=='0.1'||input.runId!==run.manifest.id||!input.candidate||input.candidate.source!==reference.source
    ||!Array.isArray(input.images)||!input.images.length||input.images.length>12||!Array.isArray(input.sources)||!input.sources.length
    ||!Array.isArray(input.candidate.tokenReferences)||!['zh','en'].includes(input.language)
    ||!input.repository||['identityHash','contentHash','sourceSnapshotHash'].some(key=>!/^[a-f0-9]{64}$/.test(input.repository[key]||''))
    ||['currentContextHash','methodHash','skillHash','historyHash','outputSchemaHash'].some(key=>!/^[a-f0-9]{64}$/.test(input[key]||'')))throw Error('Pattern review is not bound to this run.');
  const paths=new Set();let size=0;
  for(const image of input.images){
    if(!/^[a-f0-9]{64}$/.test(image.hash||'')||image.file!==`images/${image.hash}.png`||paths.has(image.file))throw Error('Invalid pattern review original.');
    paths.add(image.file);
    const raw=await readVerificationFile(run.directory,`${base}/${image.file}`,Math.min(24*1024*1024,128*1024*1024-size));size+=raw.length;
    if(verificationHash(raw)!==image.hash||JSON.stringify(pngDimensions(raw))!==JSON.stringify(image.dimensions))throw Error('Pattern review original changed.');
  }
  assertPatternGuidance(record.guidance,input);
  return {record,input,files:[reference.path,`${base}/input.json`,...input.images.map(image=>`${base}/${image.file}`)]};
}
