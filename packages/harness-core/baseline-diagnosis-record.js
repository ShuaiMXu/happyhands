import {createHash} from 'node:crypto';
import {readFile,realpath,lstat} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
async function readVerificationFile(root,path,maxBytes){
 if(typeof path!=='string'||isAbsolute(path)||path.includes('\\')||/^[A-Za-z]:/.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Invalid diagnosis evidence path.');
 let current=await realpath(root);for(const part of path.split('/')){current=join(current,part);if((await lstat(current)).isSymbolicLink())throw Error('Diagnosis evidence cannot use links.');}
 const info=await lstat(current);if(!info.isFile()||info.size>maxBytes)throw Error('Diagnosis evidence exceeds its limit.');const bytes=await readFile(current);if(bytes.length>maxBytes)throw Error('Diagnosis evidence exceeds its limit.');return bytes;
}
export const baselineHash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const baselineSourceHash=run=>baselineHash(JSON.stringify({id:run.manifest.id,source:run.manifest.source,project:run.spec.project,onboarding:run.manifest.onboarding}));
export const baselineFoundationHash=run=>baselineHash(JSON.stringify(run.spec.designFoundation));
export const baselineCaptureHash=run=>baselineHash(JSON.stringify(run.manifest.captures.before));
export const baselineBinding=run=>baselineHash(JSON.stringify({id:run.manifest.id,source:run.manifest.source,project:run.spec.project,foundation:run.spec.designFoundation,onboarding:run.manifest.onboarding,capture:run.manifest.captures.before,confirmation:run.manifest.confirmation,plan:run.manifest.plan,execution:run.manifest.execution},null,2)+'\n');
export async function verifyBaselineDiagnosis(run,diagnosis,{current=true}={}){
 const reference=diagnosis?.modelDiagnosis;if(!reference?.path){if(diagnosis?.findings.some(item=>(item.sources||[]).some(source=>source.id==='baseline-model-diagnosis')))throw Error('Model diagnosis provenance is missing.');return null;}
 if(!/^[a-f0-9]{64}$/.test(reference.sha256)||reference.path!==`baseline-diagnosis/${reference.sha256}.json`)throw Error('Invalid baseline diagnosis reference.');
 const bytes=await readVerificationFile(run.directory,reference.path,2*1024*1024);
 if(baselineHash(bytes)!==reference.sha256)throw Error('Baseline diagnosis record changed.');
 const record=JSON.parse(bytes);
 if(record.captureHash!==baselineCaptureHash(run))throw Error('Baseline diagnosis capture manifest changed.');
 if(record.sourceHash!==baselineSourceHash(run))throw Error('Baseline diagnosis source context changed.');
 if(current&&record.binding!==baselineBinding(run))throw Error('Baseline diagnosis context changed.');
 for(const original of record.originals)if(baselineHash(await readVerificationFile(run.directory,original.reference,24*1024*1024))!==original.sha256)throw Error('Baseline diagnosis original changed.');
 const skillFiles=[];for(const ref of new Map((record.batches||[]).flatMap(batch=>batch.skillReferences||[]).map(ref=>[ref.path,ref])).values()){const content=await readVerificationFile(run.directory,ref.path,2*1024*1024);if(baselineHash(content)!==ref.sha256)throw Error('Baseline diagnosis skill snapshot changed.');skillFiles.push({path:ref.path,bytes:content});}
 const model=diagnosis.findings.filter(item=>(item.sources||[]).some(source=>source.id==='baseline-model-diagnosis'));
 if(model.length!==record.result.findings.length||new Set(model.map(item=>item.id)).size!==model.length)throw Error('Baseline diagnosis findings changed.');
 for(const [index,item] of record.result.findings.entries()){
  const found=model.find(value=>value.id===`MODEL-${reference.sha256.slice(0,12)}-${index+1}`);if(!found||found.title!==item.title||found.proposal!==item.proposal||JSON.stringify(found.findingBasis||null)!==JSON.stringify(item.findingBasis||null)||found.evidenceRefs.length!==item.screenshotRefs.length)throw Error('Baseline diagnosis proposal changed.');
  for(const [i,ref] of found.evidenceRefs.entries()){const evidence=diagnosis.evidence.find(value=>value.id===ref);if(evidence?.source!==item.screenshotRefs[i]||evidence?.observation!==item.observation)throw Error('Baseline diagnosis evidence changed.');}
 }
 return {record,bytes,skillFiles,foundationChanged:record.foundationHash!==baselineFoundationHash(run)};
}
