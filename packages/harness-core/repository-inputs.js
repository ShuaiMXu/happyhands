import {mkdir,writeFile,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {readVerificationFile,verificationHash} from './verification.js';
import {repositoryInputHash,repositoryMetadata,sameRepositoryFingerprint} from './repository-fingerprint.js';

export function repositoryChanges(beforeFiles,afterFiles){
  const before=new Map(beforeFiles.filter(entry=>!entry.deleted).map(entry=>[entry.path,entry])),after=new Map(afterFiles.filter(entry=>!entry.deleted).map(entry=>[entry.path,entry]));
  return [...new Set([...before.keys(),...after.keys()])].sort().flatMap(path=>{
    const a=before.get(path),b=after.get(path);return a?.hash===b?.hash&&a?.mode===b?.mode?[]:[{path,kind:!a?'added':!b?'deleted':'modified',before:a?{hash:a.hash,mode:a.mode}:null,after:b?{hash:b.hash,mode:b.mode}:null}];
  });
}

function validate(record){
  const fp=record?.fingerprint;
  if(record?.schemaVersion!=='0.1'||fp?.version!==1||!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(fp.commit||'')||typeof fp.dirty!=='boolean'||fp.fileCount!==record.files?.length||repositoryInputHash(record.files)!==fp.contentHash)throw Error('Repository input inventory does not match its fingerprint.');
  return record;
}

export async function writeRepositoryInputs(directory,phase,fingerprint){
  if(!['before','after'].includes(phase))throw Error('Invalid repository input phase.');
  const record=validate({schemaVersion:'0.1',fingerprint:repositoryMetadata(fingerprint),files:fingerprint.files});
  await mkdir(join(directory,phase),{recursive:true});
  if(await realpath(join(directory,phase))!==join(await realpath(directory),phase))throw Error('Repository input artifacts cannot traverse symlinks.');
  const path=`${phase}/repository-inputs.json`,bytes=JSON.stringify(record,null,2)+'\n';
  if(Buffer.byteLength(bytes)>8*1024*1024)throw Error('Repository input artifact exceeds 8 MB.');
  try{await writeFile(join(directory,path),bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;if((await readVerificationFile(directory,path,8*1024*1024)).toString('utf8')!==bytes)throw Error('Repository input artifact already exists with different evidence.');}
  return {status:'bound',path,hash:verificationHash(bytes),fingerprint:record.fingerprint};
}

export async function readRepositoryInputs(run,phase){
  const capture=run.manifest.captures?.[phase],reference=capture?.incrementalSource;
  if(reference?.status!=='bound')return null;
  if(!['before','after'].includes(phase)||reference.path!==`${phase}/repository-inputs.json`||!/^[a-f0-9]{64}$/.test(reference.hash||''))throw Error('Invalid repository input artifact reference.');
  const bytes=await readVerificationFile(run.directory,reference.path,8*1024*1024);
  if(verificationHash(bytes)!==reference.hash)throw Error('Repository input artifact changed.');
  const record=validate(JSON.parse(bytes));
  if(!sameRepositoryFingerprint(record.fingerprint,reference.fingerprint)||capture.verificationSource&&!sameRepositoryFingerprint(record.fingerprint,capture.verificationSource))throw Error('Repository input capture binding changed.');
  if(capture.designSystemSource?.status!=='capture-scan-match'||capture.designSystemSource.repositoryCommit!==record.fingerprint.commit||capture.designSystemSource.dirty!==record.fingerprint.dirty)throw Error('Repository inputs are not bound to the captured source.');
  return record;
}
