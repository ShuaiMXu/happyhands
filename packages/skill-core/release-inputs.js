import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRegistry} from './registry.js';

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
  return inputHash([...sources,['pnpm-lock.yaml',await readFile(new URL('../../pnpm-lock.yaml',import.meta.url),'utf8')]]);
}
export function regressionEvidenceHash(report){
  return inputHash({schemaVersion:report.schemaVersion,corpusVersion:report.corpusVersion,corpusHash:report.corpusHash,implementationHash:report.implementationHash,registryHash:report.registryHash,passed:report.passed,cases:report.cases});
}
