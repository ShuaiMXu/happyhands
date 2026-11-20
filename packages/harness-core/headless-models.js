import {reviewRuntimeIdentity} from './review-runtime-identity.js';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {loadRun} from './store.js';
import {diagnoseProduct} from './diagnose-product.js';
import {runAiVisualReview} from './ai-review.js';
import {runLocal} from './jobs.js';
import {adaptModelLauncher,defaultModelAgent} from './model-adapters.js';

// Reuse the workbench's actual read-only model protocols, without its HTTP/UI service.
export async function headlessModel({directory,phase,model,language='zh',generate=runLocal,agent=defaultModelAgent(),maxModelCalls,resumeReview=false,costPolicy,retryReason,preflightOnly=false}){
 if(!['diagnosis','review'].includes(phase)||!['zh','en'].includes(language)||model!==undefined&&!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(model))throw Error('Invalid headless model options.');
 if(maxModelCalls!==undefined&&(phase!=='review'||!Number.isSafeInteger(maxModelCalls)||maxModelCalls<0))throw Error('Invalid review call budget.');
 if(phase!=='review'&&(resumeReview||costPolicy||preflightOnly))throw Error('Review recovery and cost policy cannot be applied to diagnosis implicitly.');
 const run=await loadRun(directory),cwd=join(run.directory,'model-attempts',phase+'-'+randomUUID());
 const launch=adaptModelLauncher(generate,agent);
 const modelArgs=args=>model?[...args.slice(0,args.indexOf('--')<0?args.length:args.indexOf('--')),'-m',model,...(args.includes('--')?args.slice(args.indexOf('--')):[])]:args;
 const invoke=(command,args,options)=>launch(command,modelArgs(args),{...options,timeoutMs:20*60*1000});
 invoke.prepare=async(command,args)=>{
  const call=await launch.prepare(command,modelArgs(args));
  return options=>call({...options,timeoutMs:20*60*1000});
 };
 invoke.visualCapability=(_model,cwd)=>launch.visualCapability(model,cwd);
 const resumeIdentity=resumeReview?await reviewRuntimeIdentity(model,directory,agent):null;
 if(phase==='review')return runAiVisualReview(directory,{cwd,generate:invoke,signal:new AbortController().signal,language,maxModelCalls,resumeIdentity,modelIdentity:{adapter:agent==='codex'?'codex-exec':agent,model:model||'CLI-default-unresolved'},costPolicy,retryReason,preflightOnly});
 return diagnoseProduct(directory,{strategy:'recorded',cwd,generate:invoke,language,modelFailure:'throw'});
}
