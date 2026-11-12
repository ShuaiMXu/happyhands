import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {loadRun} from './store.js';
import {diagnoseProduct} from './diagnose-product.js';
import {runAiVisualReview} from '../workbench/ai-review.js';
import {runLocal} from '../workbench/jobs.js';

// Reuse the workbench's actual read-only model protocols, without its HTTP/UI service.
export async function headlessModel({directory,phase,model,language='zh',generate=runLocal}){
 if(!['diagnosis','review'].includes(phase)||!['zh','en'].includes(language)||model!==undefined&&!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(model))throw Error('Invalid headless model options.');
 const run=await loadRun(directory),cwd=join(run.directory,'model-attempts',phase+'-'+randomUUID());
 const invoke=(command,args,options)=>generate(command,model?[...args.slice(0,args.indexOf('--')<0?args.length:args.indexOf('--')),'-m',model,...(args.includes('--')?args.slice(args.indexOf('--')):[])]:args,{...options,timeoutMs:20*60*1000});
 if(phase==='review')return runAiVisualReview(directory,{cwd,generate:invoke,signal:new AbortController().signal,language});
 return diagnoseProduct(directory,{strategy:'recorded',cwd,generate:invoke,language,modelFailure:'throw'});
}
