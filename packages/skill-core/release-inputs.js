import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRegistry} from './registry.js';
import {engineLockfile} from './runtime-root.js';

export const inputHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function entries(directory,onlyJavaScript=false,prefix=''){
  const result=[];
  for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    if(entry.isSymbolicLink())throw Error('Release inputs cannot contain symbolic links.');
    const name=prefix+entry.name,path=join(directory,entry.name);
    if(entry.isDirectory())result.push(...await entries(path,onlyJavaScript,name+'/'));
    else if(!onlyJavaScript||name.endsWith('.js'))result.push([name,await readFile(path,'utf8')]);
  }
  return result;
}
export async function skillContracts(registryRoot){
  return Promise.all((await loadRegistry(registryRoot)).map(async skill=>({id:skill.id,version:skill.version,maturity:skill.maturity,contractHash:inputHash(await entries(skill.directory))})));
}
export async function regressionImplementationHash(){
  const sources=await entries(fileURLToPath(new URL('../',import.meta.url)),true);
  const methods=[];
  for(const name of ['happyhands','happyhands-ui','review-product','experience-remediation','review-video']) {
    for(const [path,content] of await entries(fileURLToPath(new URL('../../skills/'+name+'/',import.meta.url)))) methods.push(['skills/'+name+'/'+path,content]);
  }
  for(const name of ['ojo','taste','taste-v2','web-taste','impeccable']) for(const file of ['ADAPTER.md','source.json']) methods.push(['skills/vendor/'+name+'/'+file,await readFile(new URL('../../skills/vendor/'+name+'/'+file,import.meta.url),'utf8')]);
  return inputHash([...sources,...methods,['pnpm-lock.yaml',await engineLockfile()]]);
}
export function regressionEvidenceHash(report){
  return inputHash({schemaVersion:report.schemaVersion,corpusVersion:report.corpusVersion,corpusHash:report.corpusHash,implementationHash:report.implementationHash,registryHash:report.registryHash,passed:report.passed,cases:report.cases});
}
