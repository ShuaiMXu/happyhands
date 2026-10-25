import {verificationPreviewFingerprint} from '../harness-core/preview-fingerprint.js';
export {verificationPreviewFingerprint};
import {repositoryFingerprint} from '../harness-core/repository-fingerprint.js';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {loadRun} from '../harness-core/store.js';
import {inspectRepository} from '../harness-core/onboard.js';
import {sourceFiles} from '../skill-core/scan.js';
import {snapshotHash} from '../skill-core/design-system.js';
import {verificationBinding,verificationHash,validateVerificationChecks,readVerificationFile,saveVerificationEvidence} from '../harness-core/verification.js';
import {runLocal} from './jobs.js';

// Runs inside the existing managed preview lifetime. No shell and no automatic
// tool installation: commands come only from the connected project config.
export async function runVerificationChecks({directory,repo,url,checks,signal,execute=runLocal,inspect=inspectRepository,scan=sourceFiles,fingerprint=verificationPreviewFingerprint,fingerprintSource=repositoryFingerprint}) {
  validateVerificationChecks(checks);if(!checks?.length)return null;
  const run=await loadRun(directory),binding=await verificationBinding(directory,run.manifest);
  const assertSource=async()=>{
    if(binding.repository&&JSON.stringify(await fingerprintSource(repo))!==JSON.stringify(binding.repository))throw Error('Specialist verification repository inputs changed.');
    const identity=await inspect(repo);
    if(identity.dirty!==binding.source.dirty||identity.commit!==binding.source.repositoryCommit||snapshotHash(await scan(repo,{includeDesignDocs:true}))!==binding.source.snapshotHash)throw Error('Specialist verification source does not match after capture.');
  };
  await assertSource();
  const preview=await fingerprint(url),captured=run.manifest.captures.after.verificationPreviewFingerprint;
  if(captured&&captured!==preview)throw Error('Specialist verification preview no longer matches after capture.');
  const records=[];let remaining=248*1024;
  for(const check of [...checks].sort((a,b)=>['normal-layout','normal-interaction','auxiliary'].indexOf(a.stage)-['normal-layout','normal-interaction','auxiliary'].indexOf(b.stage))){
    signal?.throwIfAborted();
    const out=join(directory,'verification-staging',randomUUID());await mkdir(out,{recursive:true});
    const context=join(out,'context.json');await writeFile(context,JSON.stringify({binding,url,out},null,2));
    const values={url,out,context,harness:fileURLToPath(new URL('../../',import.meta.url))};
    const args=check.args.map(arg=>arg.replace(/\{(url|out|context|harness)\}/g,(_,key)=>values[key]));
    let error=null;
    try{await execute(check.command,args,{cwd:repo,signal,timeoutMs:check.timeoutMs||120000});}catch(cause){signal?.throwIfAborted();error=cause.message;await writeFile(join(out,'execution-error.txt'),error);}
    await assertSource();if(await fingerprint(url)!==preview)throw Error('Specialist verification preview changed during checks.');
    let result,images=[];
    if(error)result={status:'needs-evidence',error:'Configured verification command failed; inspect the retained local job output.'};
    else try{
      const raw=await readVerificationFile(out,'result.json',remaining);result=JSON.parse(raw);
      if(!['pass','fail','needs-evidence'].includes(result.status))throw Error('Specialist result.json requires status pass, fail or needs-evidence.');
      images=await Promise.all(check.screenshots.map(name=>readVerificationFile(out,name,12*1024*1024)));
      if(images.some(bytes=>!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))))throw Error('Specialist original is not a PNG.');
      remaining-=raw.length;
    }catch(cause){
      signal?.throwIfAborted();await writeFile(join(out,'output-error.txt'),cause.message);images=[];
      result={status:'needs-evidence',error:'Specialist output is missing, invalid or exceeds its declared limits; inspect the retained local output error.'};
    }
    records.push({...check,result,images,status:result.status,checkHash:verificationHash(check),preview:{fingerprint:preview,binding:captured?'capture-response-match':'legacy-source-match-only'},limitations:[...check.limitations,...(!captured?['Legacy capture has no preview response fingerprint; matching source alone cannot certify the original served build.']:[])]});
  }
  signal?.throwIfAborted();
  return saveVerificationEvidence(directory,{binding,records});
}
