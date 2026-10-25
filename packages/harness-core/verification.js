import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,realpath,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {loadRun,withRunLock,runFilePath} from './store.js';
import {captureEntries,captureOriginals} from './capture-state.js';

export const verificationHash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const ID=/^[a-z][a-z0-9-]{0,47}$/;
const LIMIT=256*1024;
export function validateVerificationChecks(checks=[]) {
  if(!Array.isArray(checks)||checks.length>8)throw Error('verificationChecks must contain at most eight checks.');
  const ids=new Set();
  for(const check of checks){
    if(!check||!ID.test(check.id)||ids.has(check.id))throw Error('Verification check IDs must be unique safe names.');
    ids.add(check.id);
    if(!/^[a-zA-Z0-9_.-]+$/.test(check.command||'')||!Array.isArray(check.args)||check.args.some(a=>typeof a!=='string'))throw Error('Verification requires a bare command and string args.');
    if(typeof check.method!=='string'||!check.method.trim()||check.method.length>2000)throw Error('Verification method is required.');
    if(!['normal-layout','normal-interaction','auxiliary'].includes(check.stage))throw Error('Verification stage is required.');
    if(!Array.isArray(check.limitations)||!check.limitations.length||check.limitations.some(s=>typeof s!=='string'||!s.trim()||s.length>2000))throw Error('Verification limitations must be explicit.');
    if(!Array.isArray(check.stateIds)||!check.stateIds.length||check.stateIds.some(id=>!ID.test(id)))throw Error('Verification must name captured state IDs.');
    if(!Array.isArray(check.screenshots)||check.screenshots.some(name=>!ID.test(name.replace(/\.png$/,''))||!name.endsWith('.png')))throw Error('Verification screenshots must be explicit PNG basenames.');
    if(check.timeoutMs!==undefined&&(!Number.isInteger(check.timeoutMs)||check.timeoutMs<1000||check.timeoutMs>600000))throw Error('Verification timeout must be 1000–600000 ms.');
  }
  if(checks.reduce((n,c)=>n+c.screenshots.length,0)>12)throw Error('Verification supports at most 12 original images; split the run instead of dropping evidence.');
  return checks;
}
// Reject symlinks at every segment, including links that remain inside the root.
export async function readVerificationFile(root,path,maxBytes) {
  if(typeof path!=='string'||path.includes('\\'))throw Error('Invalid verification path.');
  runFilePath(root,path);
  let current=await realpath(root);
  for(const segment of path.split('/')){current=join(current,segment);if((await lstat(current)).isSymbolicLink())throw Error('Verification evidence cannot use symlinks.');}
  const stat=await lstat(current);
  if(!stat.isFile()||stat.size>maxBytes)throw Error('Verification evidence exceeds its file limit.');
  const bytes=await readFile(current);
  if(bytes.length>maxBytes)throw Error('Verification evidence exceeds its file limit.');
  return bytes;
}
export async function verificationBinding(directory,manifest) {
  const capture=manifest.captures.after,source=capture?.designSystemSource;
  if(!source?.repositoryCommit||typeof source.dirty!=='boolean'||source.status!=='capture-scan-match')throw Error('Verification requires a source-bound after capture with known worktree state.');
  const repository=capture.verificationSource;
  if(!repository||(repository.version!==1||repository.commit!==source.repositoryCommit||repository.dirty!==source.dirty||! /^[a-f0-9]{64}$/.test(repository.contentHash)||!Number.isInteger(repository.fileCount)||repository.fileCount<0))throw Error('Invalid complete repository fingerprint.');
  if(!capture.verificationPreviewFingerprint)throw Error('Verification requires capture-time preview binding; collect fresh captures.');
  const originalHashes={};
  for(const phase of ['before','after'])for(const screenshot of captureOriginals(manifest.captures[phase])){
    if(!/^(before|after)\/[a-z0-9_-]+\.png$/.test(screenshot))throw Error('Unsafe captured original path.');
    const hash=verificationHash(await readVerificationFile(directory,screenshot,24*1024*1024));
    if(!manifest.captures[phase].verificationOriginalHashes?.[screenshot])throw Error('Verification requires capture-time original hashes for both phases; collect fresh captures.');
    if( manifest.captures[phase].verificationOriginalHashes[screenshot]!==hash)throw Error('Captured original PNG changed.');
    originalHashes[screenshot]=hash;
  }
  return {runId:manifest.id,captureHash:verificationHash(manifest.captures),source,...(capture.verificationSource?{repository:capture.verificationSource}:{}),originalHashes};
}
export async function readVerificationEvidence(directory,manifest) {
  const index=manifest.verificationEvidence;
  const required=manifest.onboarding?.config?.verificationChecks||[];
  if(!index){if(required.length&&manifest.captures.after)throw Error('Required specialist verification has not completed.');return {digest:null,records:[]};}
  if(!/^[a-f0-9]{64}$/.test(index.digest)||index.path!==`verification/${index.digest}/index.json`)throw Error('Invalid verification index.');
  const bytes=await readVerificationFile(directory,index.path,LIMIT);
  if(verificationHash(bytes)!==index.digest)throw Error('Verification index changed.');
  const bundle=JSON.parse(bytes);
  if(JSON.stringify(bundle.binding)!==JSON.stringify(await verificationBinding(directory,manifest)))throw Error('Verification belongs to another source or capture.');
  if(!Array.isArray(bundle.records)||bundle.records.length>8)throw Error('Invalid verification record count.');
  const records=[],ids=new Set();let size=0,imageCount=0;
  for(const record of bundle.records){
    if(!ID.test(record.id)||ids.has(record.id))throw Error('Invalid verification record ID.');ids.add(record.id);
    if(record.path!==`verification/${record.artifactId}/result.json`||!/^[a-f0-9-]{36}$/.test(record.artifactId))throw Error('Invalid verification artifact.');
    if(typeof record.method!=='string'||!record.method.trim()||!Array.isArray(record.limitations)||!record.limitations.length||record.limitations.some(s=>typeof s!=='string'||!s.trim())||!Array.isArray(record.stateIds)||!record.stateIds.length||record.stateIds.some(id=>!captureEntries(manifest.captures.after).some(e=>e.stateId===id)))throw Error('Invalid verification method, limitations or scope.');
    if(!['pass','fail','needs-evidence'].includes(record.status)||!['normal-layout','normal-interaction','auxiliary'].includes(record.stage))throw Error('Invalid verification status or stage.');
    const raw=await readVerificationFile(directory,record.path,LIMIT);size+=raw.length;
    if(size>LIMIT||verificationHash(raw)!==record.sha256)throw Error('Verification record changed or exceeds total limit.');
    const images=[];
    for(const image of record.images){
      if(++imageCount>12||!/^image-[0-9]+\.png$/.test(image.name)||image.path!==`verification/${record.artifactId}/${image.name}`)throw Error('Invalid verification image.');
      const data=await readVerificationFile(directory,image.path,12*1024*1024);
      if(verificationHash(data)!==image.sha256||!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Verification image changed or is not PNG.');
      images.push(image);
    }
    const result=JSON.parse(raw);if(result.status!==record.status)throw Error('Verification result status does not match index.');
    records.push({...record,images,result});
  }
  if(required.some(check=>!records.some(record=>record.id===check.id&&record.checkHash===verificationHash(check))))throw Error('Required specialist verification is missing or its configuration changed.');
  return {digest:index.digest,binding:bundle.binding,records};
}

// The producer passes bytes, never arbitrary record-declared absolute paths.
// Each revision is immutable; a new index only selects the current evidence set.
export async function saveVerificationEvidence(directory,{binding,records}) {
  return withRunLock(directory,async()=>{
    const run=await loadRun(directory);
    if(run.manifest.judgment)throw Error('This run already has a human judgment; start a new run.');
    if(JSON.stringify(binding)!==JSON.stringify(await verificationBinding(directory,run.manifest)))throw Error('Verification source changed.');
    if(!records.length||records.length>8)throw Error('Expected 1–8 verification records.');
    await mkdir(join(directory,'verification'),{recursive:true});
    if((await lstat(join(directory,'verification'))).isSymbolicLink())throw Error('Verification storage cannot use symlinks.');
    const stored=[];let size=0,count=0;const ids=new Set();
    for(const record of records){
      if(!ID.test(record.id)||ids.has(record.id))throw Error('Invalid verification ID.');ids.add(record.id);
      if(!['pass','fail','needs-evidence'].includes(record.status))throw Error('Invalid verification status.');
      if(!record.stateIds?.length||record.stateIds.some(id=>!captureEntries(run.manifest.captures.after).some(e=>e.stateId===id)))throw Error('Verification scope must name after capture states.');
      const raw=Buffer.from(JSON.stringify(record.result));size+=raw.length;if(size>LIMIT)throw Error('Verification records exceed total limit.');
      const artifactId=randomUUID(),folder=join(directory,'verification',artifactId);await mkdir(folder,{recursive:true});
      const images=[];
      for(const image of record.images||[]){
        if(++count>12||!Buffer.isBuffer(image)||image.length>12*1024*1024||!image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Verification needs at most 12 bounded original PNGs.');
        const name=`image-${images.length}.png`;await writeFile(join(folder,name),image,{flag:'wx'});
        images.push({name,path:`verification/${artifactId}/${name}`,sha256:verificationHash(image)});
      }
      await writeFile(join(folder,'result.json'),raw,{flag:'wx'});
      stored.push({id:record.id,artifactId,path:`verification/${artifactId}/result.json`,sha256:verificationHash(raw),status:record.status,stage:record.stage,method:record.method,limitations:record.limitations,stateIds:record.stateIds,checkHash:record.checkHash,preview:record.preview,images});
    }
    const raw=JSON.stringify({version:1,binding,records:stored}),digest=verificationHash(raw),path=`verification/${digest}/index.json`;
    await mkdir(join(directory,'verification',digest),{recursive:true});await writeFile(join(directory,path),raw,{flag:'wx'});
    const index={digest,path,retryable:stored.some(record=>record.stage!=='auxiliary'&&record.status==='needs-evidence')};
    const candidate={...run.manifest,verificationEvidence:index};await readVerificationEvidence(directory,candidate);
    candidate.verificationHistory=[...(run.manifest.verificationHistory||[]),...(run.manifest.verificationEvidence?[run.manifest.verificationEvidence]:[])];
    const temporary=join(directory,`run-${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify(candidate,null,2)+'\n');await rename(temporary,join(directory,'run.json'));
    return index;
  });
}
