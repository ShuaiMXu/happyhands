#!/usr/bin/env node
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
import {access,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {installSkill,run} from '../lib/install.mjs';
const exec=promisify(execFile),skillRoot=fileURLToPath(new URL('../',import.meta.url));
async function root(){try{await access(join(skillRoot,'scripts/harness.mjs'));return skillRoot;}catch{return resolve(skillRoot,'../..');}}
function options(args){const result={};for(let i=0;i<args.length;i+=2){if(!/^--[a-z-]+$/.test(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw Error('Expected --option VALUE.');const key=args[i].slice(2);if(Object.hasOwn(result,key))throw Error('Duplicate option: '+key);result[key]=args[i+1];}return result;}
try{
 const [command='help',...args]=process.argv.slice(2),runtime=await root();
 if(command==='install'){
  const opts=options(args);if(Object.keys(opts).some(key=>!['agent','scope','destination'].includes(key)))throw Error('Install supports --agent, --scope and --destination.');
  console.log(JSON.stringify(await installSkill({source:runtime,agent:opts.agent,scope:opts.scope,destination:opts.destination}),null,2));
 }else if(command==='doctor'){
  const opts=options(args),agent=opts.agent||'codex';if(!['codex','claude-code'].includes(agent)||Object.keys(opts).some(key=>key!=='agent'))throw Error('Doctor supports --agent codex|claude-code.');
  const tools={};for(const [key,binary]of [['git','git'],['executor',agent==='codex'?'codex':'claude']])try{tools[key]={available:true,version:(await exec(binary,['--version'],{timeout:10000})).stdout.trim()};}catch{tools[key]={available:false};}
  console.log(JSON.stringify({node:process.version,agent,tools,workbenchRequired:false,limitations:['Executable presence does not verify model authentication or browser access. Run a read-only model and capture attempt before repair.']},null,2));if(Object.values(tools).some(tool=>!tool.available))process.exitCode=1;
 }else if(command==='resources'){
  const {resourceCommand}=await import(pathToFileURL(join(runtime,'packages/harness-core/reference-resources.js')).href);console.log(JSON.stringify(await resourceCommand(args),null,2));
 }else{
  if(command==='help')console.log('HappyHands lightweight Skill\ninstall [--agent codex|claude-code] [--scope user|project] [--destination PATH]\ndoctor [--agent codex|claude-code]\nresources search --query TEXT\nresources select --run DIRECTORY --id ID [--document PATH]\nresources select --run DIRECTORY --file PATH\nAll Harness commands below reuse the same run and acceptance gates.');
  await run(process.execPath,[join(runtime,'scripts/harness.mjs'),command,...args],{cwd:process.cwd(),env:{...process.env,PD_HARNESS_HEADLESS:'1'}});
 }
}catch(error){console.error(error.message);process.exitCode=1;}
