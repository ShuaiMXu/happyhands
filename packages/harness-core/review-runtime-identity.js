import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {verificationHash} from './verification.js';
const exec=promisify(execFile);

// Each CLI keeps its instructions and configuration in a different place. Batch
// reuse must bind the files the selected agent actually reads, not Codex's.
const AGENT_CONFIG = {
 codex:{home:()=>process.env.CODEX_HOME||join(homedir(),'.codex'),files:['config.toml','AGENTS.md','AGENTS.override.md'],local:['.codex/config.toml','AGENTS.md','AGENTS.override.md']},
 'claude-code':{home:()=>process.env.HAPPYHANDS_CLAUDE_HOME||join(homedir(),'.claude'),files:['settings.json','CLAUDE.md'],local:['.claude/settings.json','.claude/settings.local.json','CLAUDE.md','.claude/CLAUDE.md']}
};

// Environment variables that can change what a review observes. Credentials are
// deliberately excluded: rotating a key is not a different reviewer, and hashing
// secrets buys nothing the run ledger then has to protect.
const ENVIRONMENT_KEYS=['PATH','SHELL','TERM','CI','NODE_ENV','NODE_OPTIONS','LANG','LC_ALL','TZ',
 'CODEX_HOME','HAPPYHANDS_CLAUDE','HAPPYHANDS_CLAUDE_HOME','HAPPYHANDS_MODEL_AGENT',
 'HAPPYHANDS_API_PROVIDER','HAPPYHANDS_API_BASE_URL','HAPPYHANDS_API_MODEL'];

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
 // A declared CLI we know nothing about still binds the repository's own
 // instruction files, so editing them invalidates reuse.
 const layout=AGENT_CONFIG[agent]||{home:()=>null,files:[],local:['AGENTS.md','AGENTS.override.md','CLAUDE.md','.claude/settings.json']};
 let config;
 const home=layout.home();
 try{config=home?await readFile(join(home,layout.files[0])):Buffer.from('[no known config]');}catch(error){if(error.code!=='ENOENT')throw error;config=Buffer.from('[absent config]');}
 const localConfigs=[];
 for(let folder=resolve(directory);;folder=dirname(folder)){
  for(const name of layout.local){try{const bytes=await readFile(join(folder,name));if(bytes.length>2*1024*1024)throw Error('Review runtime configuration is too large to bind.');localConfigs.push({path:join(folder,name),hash:verificationHash(bytes)});}catch(error){if(error.code!=='ENOENT')throw error;}}
  if(dirname(folder)===folder)break;
 }
 if(home)for(const name of layout.files.slice(1))try{localConfigs.push({path:join(home,name),hash:verificationHash(await readFile(join(home,name)))});}catch(error){if(error.code!=='ENOENT')throw error;}
 let executable=null;for(const folder of (process.env.PATH||'').split(process.platform==='win32'?';':':'))try{executable=await realpath(join(folder,command));break;}catch{}
 if(command.includes('/')||command.includes('\\'))executable=await realpath(command);
 const environment=Object.fromEntries(ENVIRONMENT_KEYS.filter(key=>process.env[key]!==undefined).sort().map(key=>[key,process.env[key]]));
 return {model,agent,command,executable,version,localConfigs,configHash:verificationHash(config),environmentHash:verificationHash(environment)};
}
