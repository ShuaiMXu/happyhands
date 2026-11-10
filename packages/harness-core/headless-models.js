import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {loadRun,runFilePath,saveDiagnosis} from './store.js';
import {diagnoseRun} from './diagnosis.js';
import {diagnoseBaseline} from '../workbench/baseline-diagnosis.js';
import {runAiVisualReview} from '../workbench/ai-review.js';
import {runLocal} from '../workbench/jobs.js';

// Reuse the workbench's actual read-only model protocols, without its HTTP/UI service.
export async function headlessModel({directory,phase,model,language='zh',generate=runLocal}){
 if(!['diagnosis','review'].includes(phase)||!['zh','en'].includes(language)||model!==undefined&&!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(model))throw Error('Invalid headless model options.');
 const run=await loadRun(directory),cwd=join(run.directory,'model-attempts',phase+'-'+randomUUID());
 const invoke=(command,args,options)=>generate(command,model?[...args.slice(0,args.indexOf('--')<0?args.length:args.indexOf('--')),'-m',model,...(args.includes('--')?args.slice(args.indexOf('--')):[])]:args,{...options,timeoutMs:20*60*1000});
 if(phase==='review')return runAiVisualReview(directory,{cwd,generate:invoke,signal:new AbortController().signal,language});
 const skillResults=await Promise.all((run.manifest.skills||[]).map(item=>readFile(runFilePath(directory,item.path),'utf8').then(JSON.parse)));
 const diagnosis=diagnoseRun({run,skillResults});
 try{const result=await diagnoseBaseline(directory,diagnosis,{cwd,generate:invoke,language});await saveDiagnosis(directory,result);return result;}
 catch(error){
  // Preserve the attempt and its failure, rather than silently substituting deterministic checks.
  if(!run.manifest.confirmation&&!run.manifest.plan&&!run.manifest.execution)await saveDiagnosis(directory,{...diagnosis,modelDiagnosis:{status:'failed',summary:'Model diagnosis did not complete.',limitations:[error.message]}});
  throw error;
 }
}
