import {mkdir,copyFile,writeFile,readFile,chmod,lstat,readdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {filesUnder,sha256} from '../skills/happyhands/lib/integrity.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function buildLite(output){
 const target=resolve(output);try{await lstat(target);throw Error('Build output already exists; select a fresh directory.');}catch(error){if(error.code!=='ENOENT')throw error;}
 await mkdir(target,{recursive:true});
 const copy=async(source,path=source)=>{await mkdir(dirname(join(target,path)),{recursive:true});await copyFile(join(root,source),join(target,path));};
 const directories=['packages/harness-core','packages/skill-core','packages/experience-core','packages/workbench','skills','.agents','regression'];
 for(const directory of directories)for(const path of await filesUnder(join(root,directory)))await copy(directory+'/'+path);
 for(const path of await filesUnder(join(root,'skills/happyhands')))await copy('skills/happyhands/'+path,path);
 for(const path of ['scripts/harness.mjs','LICENSE','THIRD_PARTY_NOTICES.md','docs/harness.md','docs/finding-admission-policy.md','docs/dsh.md','docs/dsh.zh-CN.md'])await copy(path);
 await copy('pnpm-lock.yaml','engine-lock.yaml');
 for(const entry of await readdir(root,{withFileTypes:true}))if(entry.isFile()&&entry.name.endsWith('.schema.json'))await copy(entry.name);
 await copy('distribution/lite/package.json','package.json');await copy('distribution/lite/package-lock.json','npm-shrinkwrap.json');
 const pkg=JSON.parse(await readFile(join(target,'package.json'),'utf8'));
 await chmod(join(target,'bin/happyhands.mjs'),0o755);
 const files=await Promise.all((await filesUnder(target)).map(async path=>{const bytes=await readFile(join(target,path));return {path,bytes:bytes.length,sha256:sha256(bytes)};}));
 const manifest={schemaVersion:'0.1',name:pkg.name,version:pkg.version,sourceRevision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceDirty:Boolean(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()),files};
 await writeFile(join(target,'bundle.json'),JSON.stringify(manifest,null,2)+'\n');return {directory:target,version:pkg.version,files:files.length,bytes:files.reduce((n,row)=>n+row.bytes,0)};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const args=process.argv.slice(2);if(args.length&&(args.length!==2||args[0]!=='--out'))throw Error('Usage: node scripts/build-lite.mjs [--out DIRECTORY]');console.log(JSON.stringify(await buildLite(args[1]||join(root,'.harness','lite-build',String(Date.now()))),null,2));}
