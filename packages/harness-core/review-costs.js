import {readContinuationSnapshot} from './continuation-snapshot.js';
import {mkdir,realpath,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {loadRun,withRunLock,writeJson} from './store.js';
import {readVerificationFile,verificationHash} from './verification.js';
const VERSION='review-costs@1';
const fields=['maxCalls','maxInputTokens','maxOutputTokens'];
const empty=()=>({calls:0,inputTokens:0,cachedInputTokens:0,outputTokens:0,unknownUsage:0,pending:0,unmeasuredHistory:false});
export function assertCostPolicy(policy){
 if(!policy||typeof policy!=='object'||Array.isArray(policy)||Object.keys(policy).some(k=>!fields.includes(k)))throw Error('Invalid review cost policy.');
 for(const key of fields)if(policy[key]!==undefined&&(!Number.isSafeInteger(policy[key])||policy[key]<0))throw Error('Review budgets require nonnegative safe integers.');
 return policy;
}
export function summarizeReviewCosts(record){
 const total={...empty(),...record.baseline};
 for(const original of record.calls){const call=original.reconciliation?{...original,state:'settled',usage:original.reconciliation.usage,outcome:original.reconciliation.execution}:original;total.calls++;if(call.state==='reserved'){total.pending++;continue;}if(!call.usage){total.unknownUsage++;continue;}total.inputTokens+=call.usage.input_tokens;total.cachedInputTokens+=call.usage.cached_input_tokens;total.outputTokens+=call.usage.output_tokens;}
 if(['calls','inputTokens','cachedInputTokens','outputTokens','unknownUsage','pending'].some(key=>!Number.isSafeInteger(total[key])||total[key]<0))throw Error('Review cost totals exceed safe integer limits.');
 total.uncachedInputTokens=total.inputTokens-total.cachedInputTokens;return total;
}
export async function readReviewCosts(directory){
 const run=await loadRun(directory),ref=run.manifest.reviewCosts;
 if(!ref)return null;
 if(ref.path!==`review-costs/${ref.hash}.json`||!/^[a-f0-9]{64}$/.test(ref.hash))throw Error('Invalid review cost ledger reference.');
 const bytes=await readVerificationFile(directory,ref.path,2*1024*1024);
 if(verificationHash(bytes)!==ref.hash)throw Error('Review cost ledger changed.');
 const record=JSON.parse(bytes);
 if(record.version!==VERSION||record.runId!==run.manifest.id||!Array.isArray(record.calls)||record.calls.length>10000||!Array.isArray(record.policyChanges))throw Error('Invalid review cost ledger.');
 let previous=record.previous,depth=0,historyBytes=0;const seen=new Set([ref.hash]);
 while(previous){if(++depth>10000||seen.has(previous.hash)||previous.path!==`review-costs/${previous.hash}.json`||!/^[a-f0-9]{64}$/.test(previous.hash))throw Error('Invalid review cost history chain.');seen.add(previous.hash);const raw=await readVerificationFile(directory,previous.path,2*1024*1024);historyBytes+=raw.length;if(historyBytes>32*1024*1024||verificationHash(raw)!==previous.hash)throw Error('Review cost history changed or exceeds its bounded reader.');const old=JSON.parse(raw);if(old.runId!==run.manifest.id||old.version!==VERSION)throw Error('Review cost history identity changed.');previous=old.previous;}
 assertCostPolicy(record.policy);
 for(const call of record.calls)if(call.reconciliation){const r=call.reconciliation,bytes=await readVerificationFile(directory,r.evidencePath,256*1024);if(verificationHash(bytes)!==r.evidenceHash)throw Error('Reconciled provider receipt changed.');const receipt=JSON.parse(bytes);if(receipt.callId!==call.id||receipt.execution!==r.execution||JSON.stringify(receipt.usage)!==JSON.stringify(r.usage))throw Error('Reconciliation receipt binding changed.');}
 return record;
}
async function initialCosts(run){
 const parent=run.manifest.onboarding?.continuation;
 if(!parent)return {version:VERSION,runId:run.manifest.id,baseline:{...empty(),unmeasuredHistory:!!run.manifest.visualReviews?.length},policy:{},policyChanges:[],calls:[]};
 if(parent.path!=='continuation-parent.json'||!/^[a-f0-9]{64}$/.test(parent.sha256))throw Error('Invalid review cost predecessor.');
 const bytes=await readVerificationFile(run.directory,parent.path,2*1024*1024);
 if(verificationHash(bytes)!==parent.sha256)throw Error('Review cost predecessor changed.');
 const snapshot=await readContinuationSnapshot(run.directory,bytes);
 if(snapshot.parentManifest?.id!==parent.parentRunId||snapshot.role!=='historical-predecessor-not-current-evidence')throw Error('Review cost predecessor identity changed.');
 const inherited=snapshot.reviewCostInheritance;
 if(inherited){if(!inherited.record||inherited.record.version!==VERSION||inherited.record.runId!==snapshot.parentManifest.id||verificationHash(JSON.stringify(inherited.record,null,2)+'\n')!==inherited.source?.hash||inherited.source?.hash!==snapshot.parentManifest.reviewCosts?.hash||JSON.stringify(summarizeReviewCosts(inherited.record))!==JSON.stringify(inherited.totals)||JSON.stringify(inherited.record.policy)!==JSON.stringify(inherited.policy))throw Error('Inherited review costs do not match their frozen source record.');}
 return {version:VERSION,runId:run.manifest.id,baseline:inherited?.totals||{...empty(),unmeasuredHistory:true},policy:inherited?.policy||{},policyChanges:[],calls:[]};
}
async function persist(run,record){
 const folder=join(run.directory,'review-costs');await mkdir(folder,{recursive:true});
 if(await realpath(folder)!==join(await realpath(run.directory),'review-costs'))throw Error('Review cost storage cannot use symlinks.');
 record.previous=run.manifest.reviewCosts||null;
 const bytes=JSON.stringify(record,null,2)+'\n';if(Buffer.byteLength(bytes)>2*1024*1024)throw Error('Review cost ledger is full; no records were truncated.');
 const hash=verificationHash(bytes),path=`review-costs/${hash}.json`;
 try{await writeFile(join(run.directory,path),bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;if(!(await readVerificationFile(run.directory,path,2*1024*1024)).equals(Buffer.from(bytes)))throw Error('Existing review cost snapshot changed.');}
 run.manifest.reviewCosts={path,hash};await writeJson(join(run.directory,'run.json'),run.manifest);return record;
}
export async function configureReviewCosts(directory,policy,reason){
 assertCostPolicy(policy);if(!reason?.trim()||reason.length>2000)throw Error('Budget changes require a bounded reason.');
 return withRunLock(directory,async()=>{const run=await loadRun(directory);try{await readVerificationFile(directory,'continuation-next.json',256*1024);throw Error('Configure the active successor budget, not its frozen predecessor.');}catch(e){if(e.code!=='ENOENT')throw e;}const record=await readReviewCosts(directory)||await initialCosts(run);record.policyChanges.push({at:new Date().toISOString(),previous:record.policy,policy,reason});record.policy={...policy};return persist(run,record);});
}
export async function reserveReviewCall(directory,{key,stage,policy,deduplicate=false,retryReason,modelIdentity=null}){
 if(!/^[a-f0-9]{64}$/.test(key)||!stage?.trim())throw Error('Invalid model call identity.');
 return withRunLock(directory,async()=>{
  const run=await loadRun(directory);
  try{await readVerificationFile(directory,'continuation-next.json',256*1024);throw Error('This run has a continuation; do not spend against a frozen predecessor.');}catch(e){if(e.code!=='ENOENT')throw e;}
  const existing=await readReviewCosts(directory),record=existing||await initialCosts(run);
  if(policy!==undefined){assertCostPolicy(policy);if((existing||Object.keys(record.policy).length)&&fields.some(key=>record.policy[key]!==policy[key]))throw Error('Budget changes require review-budget with an explicit reason.');if(!existing){record.policy={...policy};record.policyChanges.push({at:new Date().toISOString(),previous:null,policy,reason:'Explicit invocation budget.'});}}
  const totals=summarizeReviewCosts(record),limits=record.policy;
  if(record.calls.some(call=>call.outcome==='uncertain'&&!call.reconciliation))throw Error('A failed model call has uncertain execution; reconcile its receipt before retrying.');
  const prior=record.calls.filter(call=>call.key===key).at(-1);
  if(!deduplicate&&prior?.outcome==='completed'&&!retryReason?.trim())throw Error('This identical model request already completed; use bound recovery or provide an explicit retry reason before another paid call.');
  if(deduplicate&&prior?.outcome==='completed')throw Error('This model call completed but its reusable result is missing; recover the original output instead of duplicating it.');
  if(prior&&prior.state!=='reserved'&&prior.outcome!=='completed'&&!retryReason?.trim())throw Error('Retrying a failed model call requires an explicit retry reason.');
  if(record.calls.some(call=>call.key===key&&call.state==='reserved'&&!call.reconciliation)||totals.pending)throw Error('A previous model call is still pending or uncertain; reconcile its execution before spending again.');
  if(limits.maxCalls!==undefined&&totals.calls>=limits.maxCalls)throw Error('Cumulative review call budget exhausted.');
  if(Object.keys(limits).length&&totals.unmeasuredHistory)throw Error('Historical review usage is unmeasured; a complete task budget cannot be claimed.');
  if((limits.maxInputTokens!==undefined||limits.maxOutputTokens!==undefined)&&totals.unknownUsage)throw Error('Previous model usage is unknown; token budget blocks the next call.');
  if(limits.maxInputTokens!==undefined&&totals.inputTokens>=limits.maxInputTokens||limits.maxOutputTokens!==undefined&&totals.outputTokens>=limits.maxOutputTokens)throw Error('Cumulative review token budget exhausted before the next call.');
  const call={id:randomUUID(),key,stage,...(modelIdentity?{modelIdentity}:{}),...(retryReason?{retryReason}:{}),state:'reserved',ownerPid:process.pid,reservedAt:new Date().toISOString()};record.calls.push(call);await persist(run,record);return call.id;
 });
}
export async function settleReviewCall(directory,id,{usage=null,outcome='completed',error=null}={}){
 if(usage&&!validUsage(usage))throw Error('Invalid measured review usage.');
 return withRunLock(directory,async()=>{const run=await loadRun(directory),record=await readReviewCosts(directory);const call=record?.calls.find(item=>item.id===id);if(!call||call.state!=='reserved'||call.reconciliation)throw Error('Model call reservation is absent or already settled.');Object.assign(call,{state:'settled',settledAt:new Date().toISOString(),usage,outcome,error});await persist(run,record);return summarizeReviewCosts(record);});
}
export const validUsage=value=>value&&['input_tokens','cached_input_tokens','output_tokens'].every(k=>Number.isSafeInteger(value[k])&&value[k]>=0)&&value.cached_input_tokens<=value.input_tokens;
// Codex exec: one terminal turn.completed summary. Different terminal summaries
// are ambiguous; do not sum potentially cumulative usage or treat truncation as zero.
export function reviewUsageCollector(){
 let tail='',invalid=false;const summaries=new Map();
 const line=text=>{try{const event=JSON.parse(text);if(event.type==='turn.completed'){if(!validUsage(event.usage)){invalid=true;return;}const value=Object.fromEntries(['input_tokens','cached_input_tokens','output_tokens'].map(k=>[k,event.usage[k]]));summaries.set(JSON.stringify(value),value);}}catch{if(/"type"\s*:\s*"turn.completed"/.test(text))invalid=true;}};
 return {push(chunk){if(invalid)return;tail+=String(chunk);const lines=tail.split('\n');tail=lines.pop();for(const value of lines){if(value.length>256*1024){invalid=true;return;}line(value);}if(tail.length>256*1024){invalid=true;tail='';}},finish(){if(tail.trim())line(tail);return !invalid&&summaries.size===1?[...summaries.values()][0]:null;}};
}
export async function reviewCostReport(directory){
 const stored=await readReviewCosts(directory),record=stored||await initialCosts(await loadRun(directory));
 return {status:stored?'measured':record.baseline.unmeasuredHistory?'unmeasured-history':'not-started',scope:'Native visual-review attempts recorded by review-costs@1; external and pre-instrumentation calls are not measured.',assurance:{calls:'Reservation ceiling; attempts are not refunded.',tokens:'Observed stop-before-next-call thresholds, not a per-call hard maximum.'},policy:record.policy,totals:summarizeReviewCosts(record),pending:record.calls.filter(call=>call.state==='reserved'&&!call.reconciliation),uncertain:record.calls.filter(call=>call.outcome==='uncertain'&&!call.reconciliation),policyChanges:record.policyChanges};
}

export async function reconcileReviewCall(directory,id,{reason,evidencePath}){
 if(!reason?.trim()||reason.length>2000)throw Error('Review reconciliation requires a bounded reason.');
 const bytes=await readVerificationFile(directory,evidencePath,256*1024),receipt=JSON.parse(bytes);
 if(receipt.callId!==id||!['completed','not-started'].includes(receipt.execution)||!validUsage(receipt.usage)||!receipt.providerReceipt?.trim())throw Error('Reconciliation requires a call-specific provider receipt and valid measured usage.');
 if(receipt.execution==='not-started'&&Object.values(receipt.usage).some(n=>n!==0))throw Error('A not-started receipt must contain zero usage.');
 return withRunLock(directory,async()=>{const run=await loadRun(directory),record=await readReviewCosts(directory),call=record?.calls.find(call=>call.id===id);
 if(!call||call.reconciliation||!(call.state==='reserved'||!call.usage))throw Error('Only unresolved calls can be reconciled once.');
 if(call.state==='reserved'){let active=true;try{process.kill(call.ownerPid,0);}catch(error){if(error.code==='ESRCH')active=false;}if(active)throw Error('The pending model owner is still active or cannot be proven stopped.');}
 if(!(await readVerificationFile(directory,evidencePath,256*1024)).equals(bytes))throw Error('Provider receipt changed.');
 call.reconciliation={at:new Date().toISOString(),reason,evidencePath,evidenceHash:verificationHash(bytes),execution:receipt.execution,usage:receipt.usage,authority:'operator-supplied-provider-receipt-not-machine-certified'};await persist(run,record);return summarizeReviewCosts(record);});
}
