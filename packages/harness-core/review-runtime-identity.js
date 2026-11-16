import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {verificationHash} from './verification.js';
const exec=promisify(execFile);
// Conservative: any environment/config/version change invalidates same-run reuse.
// Only hashes are persisted; config and credential bytes are never copied.
export async function reviewRuntimeIdentity(model,directory,agent='codex'){
 if(!model)throw Error('Batch recovery requires an explicit --model identity.');
 // An API adapter has no binary or local config; its identity is provider, endpoint and model. The key is never hashed.
 const {builtInApiConfig,declaredApiConfig}=await import('./api-models.js');
 const api=builtInApiConfig(agent)||(['codex','claude-code'].includes(agent)?null:declaredApiConfig(await import('./agents.js').then(m=>m.customAgent(agent))));
 if(api)return {model,agent,provider:api.provider,baseUrl:api.baseUrl||null};
 const command=agent==='codex'?(process.env.WORKBENCH_CODEX||'codex'):agent==='claude-code'?(process.env.HAPPYHANDS_CLAUDE||'claude'):(await import('./agents.js').then(m=>m.customAgent(agent))).command;
 const version=(await exec(command,['--version'],{timeout:5000,maxBuffer:32768})).stdout.trim();if(!version)throw Error('Cannot verify the review CLI version.');
 const home=process.env.CODEX_HOME||join(homedir(),'.codex');let config;
 try{config=await readFile(join(home,'config.toml'));}catch(error){if(error.code!=='ENOENT')throw error;config=Buffer.from('[absent config]');}
 const localConfigs=[];for(let folder=resolve(directory);;folder=dirname(folder)){for(const name of ['.codex/config.toml','AGENTS.md','AGENTS.override.md']){try{const bytes=await readFile(join(folder,name));if(bytes.length>2*1024*1024)throw Error('Review runtime configuration is too large to bind.');localConfigs.push({path:join(folder,name),hash:verificationHash(bytes)});}catch(error){if(error.code!=='ENOENT')throw error;}}if(dirname(folder)===folder)break;}
 for(const name of ['AGENTS.md','AGENTS.override.md'])try{localConfigs.push({path:join(home,name),hash:verificationHash(await readFile(join(home,name)))});}catch(error){if(error.code!=='ENOENT')throw error;}
 let executable=null;for(const folder of (process.env.PATH||'').split(process.platform==='win32'?';':':'))try{executable=await realpath(join(folder,command));break;}catch{}
 if(command.includes('/')||command.includes('\\'))executable=await realpath(command);
 return {model,agent,command,executable,version,localConfigs,configHash:verificationHash(config),environmentHash:verificationHash(Object.fromEntries(Object.entries(process.env).sort(([a],[b])=>a.localeCompare(b))))};
}
