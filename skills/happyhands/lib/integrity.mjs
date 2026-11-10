import {readFile,lstat,readdir,realpath} from 'node:fs/promises';
import {join,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const safePath=value=>typeof value==='string'&&value.length>0&&!isAbsolute(value)&&!value.includes('\\')&&!value.includes(':')&&!value.split('/').some(part=>!part||part==='.'||part==='..');
export async function filesUnder(root,prefix=''){
 const files=[];
 for(const entry of (await readdir(join(root,prefix),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  if(entry.isSymbolicLink())throw Error('Bundle cannot contain symbolic links.');
  const name=prefix+entry.name;
  if(entry.isDirectory())files.push(...await filesUnder(root,name+'/'));else if(entry.isFile())files.push(name);
 }
 return files;
}
export async function verifyBundle(root){
 const manifest=JSON.parse(await readFile(join(root,'bundle.json'),'utf8'));
 if(manifest.schemaVersion!=='0.1'||manifest.name!=='happyhands-lite'||!Array.isArray(manifest.files)||!manifest.files.length||new Set(manifest.files.map(row=>row.path)).size!==manifest.files.length)throw Error('Invalid lightweight bundle manifest.');
 for(const row of manifest.files){
  if(!safePath(row.path)||!Number.isSafeInteger(row.bytes)||row.bytes<0||!/^[a-f0-9]{64}$/.test(row.sha256))throw Error('Invalid bundled file record.');
  let path=root;for(const part of row.path.split('/')){path=join(path,part);if((await lstat(path)).isSymbolicLink())throw Error('Bundled files cannot use links.');}
  const bytes=await readFile(path);if(bytes.length!==row.bytes||sha256(bytes)!==row.sha256)throw Error('Bundle file changed: '+row.path);
 }
 const canonical=await realpath(root);
 for(const row of manifest.files){const delta=relative(canonical,await realpath(join(root,row.path)));if(isAbsolute(delta)||delta.startsWith('..'))throw Error('Bundle file escaped its root.');}
 return manifest;
}
