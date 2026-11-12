import {mkdir,copyFile,writeFile,readFile,chmod,lstat,realpath} from 'node:fs/promises';
import {join,dirname,posix,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {filesUnder,sha256} from '../skills/happyhands/lib/integrity.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function buildLite(output){
 const sourceRoot=await realpath(root);
 const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim();
 const target=resolve(output);try{await lstat(target);throw Error('Build output already exists; select a fresh directory.');}catch(error){if(error.code!=='ENOENT')throw error;}
 await mkdir(target,{recursive:true});
 const copy=async(source,path=source)=>{
  const input=join(sourceRoot,source);
  if(!(await lstat(input)).isFile()||await realpath(input)!==input)throw Error('Bundle source must be a regular file without symbolic links: '+source);
  await mkdir(dirname(join(target,path)),{recursive:true});
  await copyFile(input,join(target,path));
 };
 const directories=['packages/harness-core','packages/skill-core','packages/experience-core','packages/workbench','skills','.agents','regression'];
 const tracked=execFileSync('git',['ls-files','-z','--',...directories,':(top,glob)*.schema.json'],{cwd:sourceRoot,encoding:'utf8'}).split('\0').filter(Boolean);
 const skillPrefix='skills/happyhands/';
 for(const path of tracked){
  await copy(path);
  if(path.startsWith(skillPrefix))await copy(path,path.slice(skillPrefix.length));
 }
 const guides=['docs/harness.md','docs/lightweight.md','docs/finding-admission-policy.md','docs/dsh.md','docs/dsh.zh-CN.md'];
 for(const path of ['scripts/harness.mjs','LICENSE','THIRD_PARTY_NOTICES.md'])await copy(path);
 for(const path of guides){
  const text=await readFile(join(sourceRoot,path),'utf8');
  const bundled=text.replace(/\]\(((?:[\w.-]+\/)*[\w.-]+\.md)(#[^)]*)?\)/g,(link,file,fragment='')=>{
   const resolved=posix.normalize(posix.join(posix.dirname(path),file));
   if(guides.includes(resolved)||tracked.includes(resolved))return link;
   return `](https://github.com/ShuaiMXu/happyhands/blob/${revision}/${resolved}${fragment})`;
  });
  await mkdir(join(target,'docs'),{recursive:true});
  await writeFile(join(target,path),bundled);
 }
 await copy('pnpm-lock.yaml','engine-lock.yaml');
 await copy('distribution/lite/package.json','package.json');await copy('distribution/lite/package-lock.json','npm-shrinkwrap.json');
 const pkg=JSON.parse(await readFile(join(target,'package.json'),'utf8'));
 await chmod(join(target,'bin/happyhands.mjs'),0o755);
 const files=await Promise.all((await filesUnder(target)).map(async path=>{const bytes=await readFile(join(target,path));return {path,bytes:bytes.length,sha256:sha256(bytes)};}));
 const manifest={schemaVersion:'0.1',name:pkg.name,version:pkg.version,sourceRevision:revision,sourceDirty:Boolean(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()),files};
 await writeFile(join(target,'bundle.json'),JSON.stringify(manifest,null,2)+'\n');return {directory:target,version:pkg.version,files:files.length,bytes:files.reduce((n,row)=>n+row.bytes,0)};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const args=process.argv.slice(2);if(args.length&&(args.length!==2||args[0]!=='--out'))throw Error('Usage: node scripts/build-lite.mjs [--out DIRECTORY]');console.log(JSON.stringify(await buildLite(args[1]||join(root,'.harness','lite-build',String(Date.now()))),null,2));}
