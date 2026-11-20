import {verificationPreviewFingerprint} from './preview-fingerprint.js';
export {verificationPreviewFingerprint};
import {repositoryFingerprint} from './repository-fingerprint.js';
import {fileURLToPath} from 'node:url';
import {mkdir,realpath,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {isDeepStrictEqual} from 'node:util';
import {loadRun} from './store.js';
import {captureEntries} from './capture-state.js';
import {assertManagedPreview,inspectRepository,loadProjectConfig,publicProjectConfig,spawnPreview,stopPreview,waitForPreview} from './onboard.js';
import {sourceFiles} from '../skill-core/scan.js';
import {snapshotHash} from '../skill-core/design-system.js';
import {verificationBinding,verificationHash,validateVerificationChecks,readVerificationFile,saveVerificationEvidence} from './verification.js';
import {runLocal} from './jobs.js';

export async function runManagedVerification({directory,repo,signal}) {
  const {manifest}=await loadRun(directory),frozen=manifest.onboarding?.config;
  if(!frozen?.configPath||!frozen.start||!frozen.verificationChecks?.length)throw Error('Managed verification requires a connected project with a recorded preview command and specialist checks.');
  if(manifest.judgment)throw Error('A judged Run cannot accept new specialist evidence.');
  const config=await loadProjectConfig(frozen.configPath);
  const current=publicProjectConfig(config);
  if(current.repo!==frozen.repo||current.url!==frozen.url||!isDeepStrictEqual(current.start,frozen.start)||!isDeepStrictEqual(current.verificationChecks,frozen.verificationChecks)){
    throw Error('Managed verification configuration changed after onboarding.');
  }
  const checkout=await realpath(repo||manifest.execution?.worktree||config.repo);
  return runVerificationChecks({directory,repo:checkout,url:config.url,checks:config.verificationChecks,managedConfig:config,signal});
}

// Commands come from the connected project. An explicit CLI replay may own
// the preview while workbench and manual callers retain their existing server.
export async function runVerificationChecks({directory,repo,url,checks,signal,execute=runLocal,inspect=inspectRepository,scan=sourceFiles,fingerprint=verificationPreviewFingerprint,fingerprintSource=repositoryFingerprint,managedConfig}) {
  validateVerificationChecks(checks);if(!checks?.length)return null;
  const run=await loadRun(directory),binding=await verificationBinding(directory,run.manifest);
  const assertSource=async()=>{
    if(binding.repository&&JSON.stringify(await fingerprintSource(repo))!==JSON.stringify(binding.repository))throw Error('Specialist verification repository inputs changed.');
    const identity=await inspect(repo);
    if(identity.dirty!==binding.source.dirty||identity.commit!==binding.source.repositoryCommit)throw Error('Specialist verification source does not match after capture.');
    if(binding.source.status!=='not-extracted'&&snapshotHash(await scan(repo,{includeDesignDocs:true}))!==binding.source.snapshotHash)throw Error('Specialist verification source does not match after capture.');
  };
  await assertSource();
  const verify=signal=>collectVerification({directory,repo,url,checks,signal,execute,fingerprint,assertSource,run,binding});
  if(!managedConfig)return verify(signal);
  const sub=await assertManagedPreview(managedConfig,{signal});
  const start={...managedConfig.start,cwd:join(repo,sub)};
  await assertManagedPreview({repo,url,start},{signal});
  const child=spawnPreview(start);
  child.ref();
  const closed=new AbortController();
  const stopped=()=>closed.abort(new Error('The managed preview stopped during specialist verification.'));
  child.once('exit',stopped);
  child.once('error',stopped);
  const active=signal?AbortSignal.any([signal,closed.signal]):closed.signal;
  try {
    const preview=await waitForPreview(url,{timeoutMs:managedConfig.timeoutMs,signal:active});
    if(new URL(preview.finalUrl).origin!==new URL(url).origin)throw Error('The managed preview redirected to another origin.');
    await assertSource();
    return await verify(active);
  } finally {
    if(child.pid&&child.exitCode===null&&child.signalCode===null){
      const done=once(child,'close',{signal:AbortSignal.timeout(5000)});
      stopPreview(child);
      await done;
    }
  }
}

async function collectVerification({directory,repo,url,checks,signal,execute,fingerprint,assertSource,run,binding}) {
  const preview=await fingerprint(url),captured=run.manifest.captures.after.verificationPreviewFingerprint;
  if(captured&&captured!==preview)throw Error('Specialist verification preview no longer matches after capture.');
  const records=[];let remaining=248*1024;
  for(const check of [...checks].sort((a,b)=>['normal-layout','normal-interaction','auxiliary'].indexOf(a.stage)-['normal-layout','normal-interaction','auxiliary'].indexOf(b.stage))){
    signal?.throwIfAborted();
    const out=join(directory,'verification-staging',randomUUID());await mkdir(out,{recursive:true});
    const states=captureEntries(run.manifest.captures.after).filter(entry=>check.stateIds.includes(entry.stateId)).map(entry=>({stateId:entry.stateId,configurationId:entry.configurationId,width:entry.width,height:entry.height,start:entry.start,finalUrl:entry.finalUrl,appearance:entry.dom?.appearance,actions:entry.actions}));
    const context=join(out,'context.json');await writeFile(context,JSON.stringify({binding,url,out,states},null,2));
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
