import { readdir, readFile, stat, realpath } from 'node:fs/promises';
import { extname, join, relative, resolve, isAbsolute, posix } from 'node:path';
import {isModuleConfig,localConfigReferences,packageConfigReferences,packageConfigEntry} from './module-config.js';
import {BRAND_DOCUMENT} from './brand-evidence.js';

const SKIP = new Set(['.git', '.harness', '.next', '.astro', 'dist', 'build', 'coverage', 'node_modules']);
const TEXT_EXTENSIONS = new Set(['.astro', '.css', '.html', '.jsx', '.js', '.mjs', '.cjs', '.mts', '.cts', '.scss', '.svelte', '.tsx', '.ts', '.vue']);

export async function sourceFiles(repo, options = {}) {
  const {maxFiles=1000,maxBytes=512_000,includeDesignDocs=false,maxTotalBytes=64*1024*1024}=options;
  // Offline HTML kits embed assets. Bound them separately; an explicit maxBytes
  // still overrides this allowance for callers requesting a smaller scan.
  const htmlLimit=options.maxBytes===undefined?32*1024*1024:maxBytes;
  let totalBytes=0;
  const omissions=[];
  const root = resolve(repo);
  const files = [];
  // A scan is incomplete when the walk stops early or an eligible file is too
  // large. Landing exactly on maxFiles with nothing left to visit is complete.
  let truncated = false;
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (files.length >= maxFiles) { truncated = true; return; }
      if (entry.isSymbolicLink() || SKIP.has(entry.name)) continue;
      const path = join(directory, entry.name);
      // Installed design methods and templates are guidance, not the target UI.
      const sourcePath=relative(root,path).replaceAll('\\','/');
      if(['skills/vendor/taste','skills/vendor/taste-v2','skills/vendor/impeccable'].includes(sourcePath))continue;
      if (entry.isDirectory()) await walk(path);
      else if (TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase()) || isModuleConfig(sourcePath) || includeDesignDocs && BRAND_DOCUMENT.test(entry.name)) {
        // Check the size before reading: an oversized asset would otherwise be
        // pulled into memory whole only to be discarded.
        const bytes=(await stat(path)).size,limit=extname(entry.name).toLowerCase()==='.html'?htmlLimit:maxBytes;
        if(bytes>limit||totalBytes+bytes>maxTotalBytes){truncated=true;omissions.push({path:sourcePath,bytes,reason:bytes>limit?'file-size-limit':'total-size-limit'});continue;}
        totalBytes+=bytes;
        files.push({ path: relative(root, path).replaceAll('\\', '/'), content: await readFile(path, 'utf8') });
      }
    }
  }
  await walk(root);
  const known=new Map(files.map(file=>[file.path,file])),queue=files.filter(file=>isModuleConfig(file.path)),visited=new Set(),canonicalRoot=await realpath(root);
  async function readConfig(sourcePath,{dependencyInput=false}={}){
    if(known.has(sourcePath))return known.get(sourcePath);
    if(sourcePath.split('/').some(part=>SKIP.has(part)&&!(dependencyInput&&part==='node_modules')))return null;
    const path=join(root,sourcePath);let canonical,metadata;
    try{canonical=await realpath(path);metadata=await stat(canonical);}catch(error){if(['ENOENT','ENOTDIR'].includes(error.code))return null;throw error;}
    const rel=relative(canonicalRoot,canonical).replaceAll('\\','/');
    const samePath=process.platform==='win32'?rel.toLowerCase()===sourcePath.toLowerCase():rel===sourcePath;
    if(isAbsolute(rel)||rel==='..'||rel.startsWith('../')||!samePath||!metadata.isFile())return null;
    if(files.length>=maxFiles||metadata.size>maxBytes||totalBytes+metadata.size>maxTotalBytes){truncated=true;omissions.push({path:sourcePath,bytes:metadata.size,reason:files.length>=maxFiles?'file-count-limit':metadata.size>maxBytes?'file-size-limit':'total-size-limit'});return null;}
    const file={path:sourcePath,content:await readFile(canonical,'utf8'),...(dependencyInput?{dependencyInput:true}:{})};totalBytes+=metadata.size;files.push(file);known.set(sourcePath,file);return file;
  }
  let packageLookups=0;
  for(let index=0;index<queue.length;index++){
    const config=queue[index];if(visited.has(config.path))continue;
    if(visited.size>=128){truncated=true;omissions.push({path:config.path,reason:'module-config-file-limit'});break;}
    visited.add(config.path);
    for(const candidates of localConfigReferences(config))for(const sourcePath of candidates){
      const file=await readConfig(sourcePath,{dependencyInput:Boolean(config.dependencyInput)});if(file){if(!visited.has(sourcePath))queue.push(file);break;}
    }
    for(const reference of packageConfigReferences(config)){
      if(packageLookups>=256){truncated=true;omissions.push({path:config.path,reason:'package-config-lookup-limit'});break;}
      let directory=posix.dirname(config.path),packageResolved=false;
      for(;;){
        if(posix.basename(directory)==='node_modules'){directory=posix.dirname(directory);continue;}
        if(packageLookups++>=256){truncated=true;omissions.push({path:config.path,reason:'package-config-lookup-limit'});break;}
        const packageRoot=posix.join(directory,'node_modules',reference.name),requested=join(root,packageRoot);
        let canonical,metadata;
        try{canonical=await realpath(requested);metadata=await stat(canonical);}catch(error){if(!['ENOENT','ENOTDIR'].includes(error.code))throw error;}
        if(metadata){
          const rel=relative(canonicalRoot,canonical).replaceAll('\\','/'),same=process.platform==='win32'?rel.toLowerCase()===packageRoot.toLowerCase():rel===packageRoot;
          if(!same||isAbsolute(rel)||rel.startsWith('../')||!metadata.isDirectory())break;
          const manifest=await readConfig(packageRoot+'/package.json',{dependencyInput:true});
          const entry=reference.subpath||(manifest?packageConfigEntry(manifest):'tsconfig.json');
          if(entry){
            const base=posix.normalize(posix.join(packageRoot,entry)),candidates=base.endsWith('.json')?[base]:[base,base+'.json',base+'/tsconfig.json'];
            for(const candidate of candidates){if(!candidate.startsWith(packageRoot+'/'))continue;const file=await readConfig(candidate,{dependencyInput:true});if(file){packageResolved=true;if(!visited.has(file.path))queue.push(file);break;}}
          }
          break; // Do not crawl ancestor packages after locating a package directory.
        }
        if(directory==='.')break;directory=posix.dirname(directory);
      }
      if(!packageResolved){truncated=true;omissions.push({path:config.path,package:reference.name,reason:'package-config-unavailable'});}
    }
  }
  return { root, files, truncated, omissions };
}
