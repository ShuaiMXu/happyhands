import {mkdir,readFile,writeFile,lstat,realpath,copyFile,rename,rm,chmod} from 'node:fs/promises';
import {join,dirname,resolve,relative} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {homedir} from 'node:os';
import {verifyBundle,sha256} from './integrity.mjs';
async function exists(path){try{await lstat(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
export async function run(command,args,{cwd,env=process.env}={}){
 return new Promise((resolveResult,reject)=>{const child=spawn(command,args,{cwd,env,stdio:'inherit',shell:false,windowsHide:true});child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolveResult():reject(Error(`${command} failed (${signal||code}).`)));});
}
export async function installSkill({source,project=process.cwd(),agent='codex',scope='user',userHome=homedir(),destination,installDependencies=async cwd=>{
 const args=['ci','--ignore-scripts','--omit=dev','--no-audit','--no-fund'];
 if(process.env.npm_execpath?.endsWith('npm-cli.js'))return run(process.execPath,[process.env.npm_execpath,...args],{cwd});
 if(process.platform==='win32')throw Error('Run the installer through npx so the npm CLI location is available.');
 return run('npm',args,{cwd});
}}){
 if(!['codex','claude-code'].includes(agent))throw Error('Select codex or claude-code; DSH uses the portable instructions as an external operator.');
 if(!['user','project'].includes(scope))throw Error('Select --scope user or project.');
 const bundle=await verifyBundle(source),root=await realpath(project);
 const userRoot=agent==='codex'?(process.env.CODEX_HOME||join(userHome,'.codex')):join(userHome,'.claude');
 const target=resolve(destination||(scope==='user'?join(userRoot,'skills','happyhands'):join(root,agent==='codex'?'.agents':'.claude','skills','happyhands')));
 if(scope==='project'&&!destination&&relative(root,target).startsWith('..'))throw Error('Skill destination escaped the selected project.');
 // Check each existing ancestor before creating anything. Never follow a project link to another location.
 let current=dirname(target);const ancestors=[];
 while(!await exists(current)){ancestors.push(current);current=dirname(current);}
 for(let path=current;;path=dirname(path)){if((await lstat(path)).isSymbolicLink())throw Error('Installation destination cannot use symbolic links.');if(dirname(path)===path)break;}
 if(await exists(target))throw Error('Skill already exists. Keep the existing installation; choose a different --destination to review an upgrade.');
 await mkdir(dirname(target),{recursive:true});
 const staging=join(dirname(target),'.happyhands-install-'+randomUUID());await mkdir(staging);
 try{
  for(const path of [...bundle.files.map(row=>row.path),'bundle.json']){await mkdir(dirname(join(staging,path)),{recursive:true});await copyFile(join(source,path),join(staging,path));}
  await chmod(join(staging,'bin/happyhands.mjs'),0o755);
  await installDependencies(staging);await verifyBundle(staging);
  // A competing installer must never replace a skill after dependency installation.
  if(await exists(target))throw Error('Skill destination appeared during installation.');
  await writeFile(join(staging,'installation.json'),JSON.stringify({version:bundle.version,sourceRevision:bundle.sourceRevision,bundleHash:sha256(await readFile(join(staging,'bundle.json'))),agent,scope},null,2)+'\n',{flag:'wx'});
  await rename(staging,target);
 }finally{await rm(staging,{recursive:true,force:true});}
 return {directory:target,version:bundle.version,command:['node',join(target,'bin/happyhands.mjs')]};
}
