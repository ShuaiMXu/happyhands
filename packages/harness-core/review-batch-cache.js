import {readReviewCosts} from './review-costs.js';
import {mkdir,realpath,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {loadRun,withRunLock,writeJson} from './store.js';
import {readVerificationFile,verificationHash} from './verification.js';
export async function readReviewBatch(directory,key){
 const run=await loadRun(directory),ref=run.manifest.reviewBatchResults?.[key];if(!ref)return null;
 if(!/^[a-f0-9]{64}$/.test(key)||ref.path!==`review-batches/${ref.hash}.json`||!/^[a-f0-9]{64}$/.test(ref.hash))throw Error('Invalid cached review batch reference.');
 const bytes=await readVerificationFile(directory,ref.path,2*1024*1024);if(verificationHash(bytes)!==ref.hash)throw Error('Cached review batch changed.');
 const record=JSON.parse(bytes);const costs=await readReviewCosts(directory);if(!costs?.calls.some(call=>call.id===record.callId&&call.key===key))throw Error('Cached review batch has no matching model call reservation.');
 if(record.version!=='review-batch@1'||!record.generatedAt||record.key!==key||record.runId!==run.manifest.id||typeof record.rawResult!=='string')throw Error('Cached review batch binding changed.');return record;
}
export async function saveReviewBatch(directory,key,rawResult,callId){
 if(!/^[a-f0-9]{64}$/.test(key)||typeof rawResult!=='string'||Buffer.byteLength(rawResult)>1024*1024)throw Error('Invalid raw model batch result.');
 return withRunLock(directory,async()=>{
  const run=await loadRun(directory);const costs=await readReviewCosts(directory);if(!costs?.calls.some(call=>call.id===callId&&call.key===key))throw Error('Raw review output requires its exact model reservation.');if(run.manifest.reviewBatchResults?.[key])return readReviewBatch(directory,key);
  const folder=join(directory,'review-batches');await mkdir(folder,{recursive:true});if(await realpath(folder)!==join(await realpath(directory),'review-batches'))throw Error('Review batch storage cannot use symlinks.');
  const record={version:'review-batch@1',key,runId:run.manifest.id,callId,generatedAt:new Date().toISOString(),rawResult},bytes=JSON.stringify(record),hash=verificationHash(bytes),path=`review-batches/${hash}.json`;
  if(Buffer.byteLength(bytes)>2*1024*1024)throw Error('Encoded raw review batch exceeds its storage limit.');
  try{await writeFile(join(directory,path),bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;if(!(await readVerificationFile(directory,path,2*1024*1024)).equals(Buffer.from(bytes)))throw Error('Review batch result changed.');}
  run.manifest.reviewBatchResults={...run.manifest.reviewBatchResults,[key]:{path,hash}};await writeJson(join(directory,'run.json'),run.manifest);return record;
 });
}
