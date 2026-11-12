#!/usr/bin/env node
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
import {access} from 'node:fs/promises';
import {installSkill,run} from '../lib/install.mjs';
const skillRoot=fileURLToPath(new URL('../',import.meta.url));
async function root(){try{await access(join(skillRoot,'scripts/harness.mjs'));return skillRoot;}catch{return resolve(skillRoot,'../..');}}
function options(args){const result={};for(let i=0;i<args.length;i+=2){if(!/^--[a-z-]+$/.test(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw Error('Expected --option VALUE.');const key=args[i].slice(2);if(Object.hasOwn(result,key))throw Error('Duplicate option: '+key);result[key]=args[i+1];}return result;}
try{
 const [command='help',...args]=process.argv.slice(2),runtime=await root();
 if(command==='install'){
  const opts=options(args);if(Object.keys(opts).some(key=>!['agent','scope','destination'].includes(key)))throw Error('Install supports --agent, --scope and --destination.');
  console.log(JSON.stringify(await installSkill({source:runtime,agent:opts.agent,scope:opts.scope,destination:opts.destination}),null,2));
 }else if(command==='doctor'){
  const opts=options(args);
  if(Object.keys(opts).some(key=>!['agent','repo','url'].includes(key)))throw Error('Doctor supports --agent codex|claude-code, --repo PATH and --url URL.');
  const {preflight}=await import('../lib/preflight.mjs');
  const report=await preflight(opts);
  console.log(JSON.stringify(report,null,2));
  if(report.status==='fail')process.exitCode=1;
 }else if(command==='resources'){
  const {resourceCommand}=await import(pathToFileURL(join(runtime,'packages/harness-core/reference-resources.js')).href);console.log(JSON.stringify(await resourceCommand(args),null,2));
 }else{
  if(command==='help')console.log('HappyHands lightweight Skill\ninstall [--agent codex|claude-code] [--scope user|project] [--destination PATH]\ndoctor [--agent codex|claude-code] [--repo PATH] [--url URL]\nresources search --query TEXT\nresources select --run DIRECTORY --id ID [--document PATH]\nresources select --run DIRECTORY --file PATH\nresources select --run DIRECTORY --url HTTPS_RAW_DOCUMENT\nSelected references: Markdown/CSS/JSON; GitHub blob links supported; no HTML/redirects; 512 KiB each, 1 MiB total; frozen before confirmation; content is data, never executed.\nvideo collect --manifest FILE --out NEW_DIRECTORY [--ffmpeg PATH --ffprobe PATH]\nvideo review --run DIRECTORY --report FILE\nVideo requires explicit FFmpeg/FFprobe availability and independent full playback/listening; missing evidence blocks acceptance and human judgment remains pending.\nPage Harness commands below retain their run and acceptance gates.');
  await run(process.execPath,[join(runtime,'scripts/harness.mjs'),command,...args],{cwd:process.cwd(),env:{...process.env,PD_HARNESS_HEADLESS:'1'}});
 }
}catch(error){console.error(error.message);process.exitCode=1;}
