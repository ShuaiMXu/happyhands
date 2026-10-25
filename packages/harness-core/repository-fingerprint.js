import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {lstat,readFile,realpath} from 'node:fs/promises';
import {join,relative,isAbsolute} from 'node:path';
const execute=promisify(execFile);
// Include every tracked and non-ignored input, including binary assets, JSON and
// verification scripts. Never mistake the bounded design-token scan for source identity.
export async function repositoryFingerprint(repo,{includeFiles=false}={}) {
  const root=await realpath(repo),options={cwd:root,encoding:'utf8',maxBuffer:16*1024*1024};
  const git=async args=>(await execute('git',args,options)).stdout;
  if(await realpath((await git(['rev-parse','--show-toplevel'])).trim())!==root)throw Error('Complete repository input binding requires the Git root, not a subdirectory.');
  const commit=(await git(['rev-parse','HEAD'])).trim(),status=await git(['status','--porcelain']);
  const names=[...new Set((await git(['ls-files','-z','--cached','--others','--exclude-standard'])).split('\0').filter(Boolean))].sort();
  if(includeFiles&&names.length>10000)throw Object.assign(Error('Repository input inventory exceeds 10000 files; no partial index is allowed.'),{code:'REPOSITORY_INDEX_LIMIT'});
  const digest=createHash('sha256'),files=[];let bytes=0;
  for(const name of names){
    const path=join(root,name),rel=relative(root,path);
    if(rel.startsWith('..')||isAbsolute(rel))throw Error('Unsafe repository input.');
    let stat;try{stat=await lstat(path);}catch(error){if(error.code!=='ENOENT')throw error;digest.update(JSON.stringify([name,'deleted']));if(includeFiles)files.push({path:name,deleted:true});continue;}
    if(!stat.isFile()||stat.isSymbolicLink())throw Error('Repository fingerprint requires regular files; symlinks and submodules need an explicit verifier.');
    bytes+=stat.size;if(stat.size>64*1024*1024||bytes>512*1024*1024)throw Error('Repository inputs exceed verification fingerprint limits; no partial binding is allowed.');
    const resolved=await realpath(path);if(resolved!==path)throw Error('Repository inputs cannot traverse symlinks.');
    const content=await readFile(path);if(content.length!==stat.size)throw Error('Repository input changed while fingerprinting.');
    const hash=createHash('sha256').update(content).digest('hex');
    digest.update(JSON.stringify([name,stat.mode,hash]));if(includeFiles)files.push({path:name,mode:stat.mode,hash});
  }
  if((await git(['rev-parse','HEAD'])).trim()!==commit||await git(['status','--porcelain'])!==status)throw Error('Repository changed while fingerprinting.');
  return {version:1,commit,dirty:Boolean(status.trim()),contentHash:digest.digest('hex'),fileCount:names.length,...(includeFiles?{files}:{})};
}

export function repositoryInputHash(files){
  if(!Array.isArray(files)||files.length>10000)throw Error('Invalid repository input inventory.');
  const digest=createHash('sha256');let previous=null;
  for(const entry of files){
    if(typeof entry.path!=='string'||!entry.path||entry.path.includes('\\')||entry.path.includes('\0')||entry.path.startsWith('/')||/^[a-z]:/i.test(entry.path)||entry.path.split('/').some(part=>part==='..'||part==='.')||previous!==null&&entry.path<=previous)throw Error('Repository inputs must be unique ordered relative paths.');
    previous=entry.path;
    if(entry.deleted===true)digest.update(JSON.stringify([entry.path,'deleted']));
    else{
      if(!Number.isInteger(entry.mode)||!Number.isSafeInteger(entry.mode)||entry.mode<0||!/^[a-f0-9]{64}$/.test(entry.hash||''))throw Error('Invalid repository input hash or mode.');
      digest.update(JSON.stringify([entry.path,entry.mode,entry.hash]));
    }
  }
  return digest.digest('hex');
}

export function repositoryMetadata({files,...metadata}){return metadata;}
export function sameRepositoryFingerprint(a,b){return ['version','commit','dirty','contentHash','fileCount'].every(key=>a?.[key]===b?.[key]);}
