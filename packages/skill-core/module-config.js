import ts from 'typescript';
import {posix} from 'node:path';
import {createHash} from 'node:crypto';

export const isModuleConfig=path=>/(^|\/)(?:ts|js)config(?:\.[^/]+)?\.json$/i.test(path);
const inside=path=>!posix.isAbsolute(path)&&path!=='..'&&!path.startsWith('../');

export function localConfigReferences(file){
  const parsed=ts.parseConfigFileTextToJson(file.path,file.content);
  if(parsed.error)return [];
  const value=parsed.config,refs=[];
  for(const ref of typeof value?.extends==='string'?[value.extends]:Array.isArray(value?.extends)?value.extends:[]){
    if(typeof ref==='string'&&ref.startsWith('.'))refs.push(ref);
  }
  for(const ref of Array.isArray(value?.references)?value.references:[])if(typeof ref?.path==='string'&&!posix.isAbsolute(ref.path)&&!ref.path.includes(':'))refs.push(ref.path);
  return refs.map(ref=>posix.normalize(posix.join(posix.dirname(file.path),ref.replaceAll('\\','/')))).filter(inside).map(path=>path.endsWith('.json')?[path]:[path+'.json',path+'/tsconfig.json']);
}

export function packageConfigReferences(file){
  const parsed=ts.parseConfigFileTextToJson(file.path,file.content);
  if(parsed.error)return [];
  const bases=typeof parsed.config?.extends==='string'?[parsed.config.extends]:Array.isArray(parsed.config?.extends)?parsed.config.extends:[];
  return bases.flatMap(value=>{
    if(typeof value!=='string'||value.includes('\\'))return [];
    const match=/^(@[a-z0-9_~-][a-z0-9._~-]*\/[a-z0-9_~-][a-z0-9._~-]*|[a-z0-9_~-][a-z0-9._~-]*)(?:\/(.+))?$/i.exec(value);
    if(!match||match[2]?.split('/').some(part=>!part||part==='.'||part==='..')||match[2]&&posix.extname(match[2])&&posix.extname(match[2])!=='.json')return [];
    return [{name:match[1],subpath:match[2]||null}];
  });
}

export function packageConfigEntry(file){
  const parsed=ts.parseConfigFileTextToJson(file.path,file.content);if(parsed.error||!parsed.config||typeof parsed.config!=='object'||Array.isArray(parsed.config))return null;
  const value=parsed.config?.tsconfig;
  if(value===undefined)return 'tsconfig.json';
  if(typeof value!=='string'||!value||value.includes('\\')||posix.isAbsolute(value)||value.includes(':')||value.split('/').some(part=>part==='..'||!part)||posix.extname(value)&&posix.extname(value)!=='.json')return null;
  return posix.normalize(value);
}

// TypeScript reads only this virtual snapshot, including explicitly snapshotted
// package JSON configs. It never executes config or consults the host filesystem/network.
export function moduleConfigResolver(files){
  const root='/snapshot',contents=new Map(files.map(file=>[root+'/'+file.path,file.content])),directories=new Map(),cache=new Map(),issues=[];
  for(const file of files){
    const parts=file.path.split('/');let dir=root;
    for(let index=0;index<parts.length;index++){
      if(!directories.has(dir))directories.set(dir,{files:new Set(),directories:new Set()});
      const entries=directories.get(dir),name=parts[index];
      if(index===parts.length-1)entries.files.add(name);else{entries.directories.add(name);dir+='/'+name;}
    }
  }
  const normalize=path=>posix.normalize(path.replaceAll('\\','/'));
  const entries=path=>{const value=directories.get(normalize(path));return {files:[...(value?.files||[])].sort(),directories:[...(value?.directories||[])].sort()};};
  const host={useCaseSensitiveFileNames:true,getCurrentDirectory:()=>root,fileExists:path=>contents.has(normalize(path)),readFile:path=>contents.get(normalize(path)),directoryExists:path=>directories.has(normalize(path)),
    readDirectory:(path,extensions,excludes,includes,depth)=>ts.matchFiles(path,extensions,excludes,includes,true,root,depth,entries,normalize),onUnRecoverableConfigFileDiagnostic:()=>{}};
  const extra=['.astro','.vue','.svelte'].map(extension=>({extension,isMixedContent:true,scriptKind:ts.ScriptKind.Deferred}));
  function parsed(path){
    if(cache.has(path))return cache.get(path);
    const diagnostics=[],inputs=new Set();let limited=false;
    const value=ts.getParsedCommandLineOfConfigFile(root+'/'+path,{}, {...host,readFile:name=>{const content=host.readFile(name);if(content!==undefined){if(!inputs.has(normalize(name))&&inputs.size>=32){limited=true;return undefined;}inputs.add(normalize(name));}return content;},onUnRecoverableConfigFileDiagnostic:error=>diagnostics.push(error)},undefined,undefined,extra);
    diagnostics.push(...(value?.errors||[]).filter(error=>![18002,18003].includes(error.code)));
    const absolute=value=>typeof value==='string'&&(posix.isAbsolute(value.replaceAll('\\','/'))||/^[A-Za-z][\w+.-]*:/.test(value));
    const absoluteInput=[...inputs].some(file=>{
      const raw=ts.parseConfigFileTextToJson(file,contents.get(file)).config;
      const bases=Array.isArray(raw?.extends)?raw.extends:[raw?.extends];
      return bases.some(absolute)||absolute(raw?.compilerOptions?.baseUrl)||(Array.isArray(raw?.references)&&raw.references.some(ref=>absolute(ref?.path)))||Object.values(raw?.compilerOptions?.paths||{}).some(targets=>Array.isArray(targets)&&targets.some(absolute));
    });
    const unsafePackage=[...inputs].some(file=>file.includes('/node_modules/')&&file.endsWith('/package.json')&&packageConfigEntry({path:file,content:contents.get(file)})===null);
    const config={path,value,inputs:[...inputs],invalid:diagnostics.length>0||absoluteInput||unsafePackage||limited};cache.set(path,config);
    if(unsafePackage)issues.push({file:path,line:1,reason:'unsafe-package-config-entry'});
    if(absoluteInput)issues.push({file:path,line:1,reason:'absolute-module-config-needs-inspection'});
    if(limited)issues.push({file:path,line:1,reason:'module-config-input-limit'});
    for(const error of diagnostics)issues.push({file:error.file?.fileName.startsWith(root+'/')?error.file.fileName.slice(root.length+1):path,line:error.file&&typeof error.start==='number'?error.file.getLineAndCharacterOfPosition(error.start).line+1:1,reason:'module-config-needs-inspection',diagnosticCode:error.code,message:ts.flattenDiagnosticMessageText(error.messageText,' ')});
    return config;
  }
  function scope(source){
    let directory=posix.dirname(source),roots=[];
    for(;;){
      roots=['tsconfig.json','jsconfig.json'].map(name=>directory==='.'?name:directory+'/'+name).filter(path=>contents.has(root+'/'+path));
      if(roots.length||directory==='.')break;directory=posix.dirname(directory);
    }
    if(!roots.length)return {reason:'external-or-alias-needs-resolution'};
    if(roots.length>1)return {reason:'ambiguous-module-config',configs:roots};
    const applicable=[],seen=new Set(),active=new Set(),inputs=new Set();let invalid=false;
    function visit(path,depth){
      if(active.has(path)||depth>32){invalid=true;issues.push({file:path,line:1,reason:'module-config-reference-cycle-or-limit'});return;}
      if(seen.has(path))return;
      seen.add(path);active.add(path);const config=parsed(path);for(const file of config.inputs)inputs.add(file);
      if(config.invalid||!config.value){invalid=true;return;}
      if(config.value.fileNames.includes(root+'/'+source))applicable.push(config);
      for(const reference of config.value.projectReferences||[]){
        const base=normalize(reference.path),target=base.endsWith('.json')?base:base+'/tsconfig.json';
        if(!target.startsWith(root+'/')||!contents.has(target)){invalid=true;issues.push({file:path,line:1,reason:'project-reference-missing-from-snapshot',reference:reference.originalPath||reference.path});continue;}
        visit(target.slice(root.length+1),depth+1);
      }
      active.delete(path);
    }
    visit(roots[0],0);
    if(invalid)return {reason:'module-config-needs-inspection',configs:roots};
    return applicable.length===1?{config:applicable[0],inputs:[...inputs].sort()}:{reason:applicable.length?'ambiguous-project-config-scope':'source-outside-config-inputs',configs:roots};
  }
  const scopes=new Map();
  function resolve(source,specifier,resolvePath){
    if(!scopes.has(source))scopes.set(source,scope(source));
    const selected=scopes.get(source);if(!selected.config)return selected;
    const {path,value}=selected.config,options=value.options,mappings=options.paths||{};
    let key=Object.hasOwn(mappings,specifier)?specifier:null,capture='';
    if(!key){
      let length=-1;
      for(const pattern of Object.keys(mappings)){
        const star=pattern.indexOf('*');if(star<0)continue;
        const prefix=pattern.slice(0,star),suffix=pattern.slice(star+1);
        if(prefix.length>length&&specifier.startsWith(prefix)&&specifier.endsWith(suffix)&&specifier.length>=prefix.length+suffix.length){key=pattern;capture=specifier.slice(prefix.length,specifier.length-suffix.length);length=prefix.length;}
      }
    }
    const origin=options.baseUrl||options.pathsBasePath||posix.dirname(root+'/'+path);
    const targets=key?mappings[key].map(target=>target.replace('*',capture)):options.baseUrl?[specifier]:[];
    for(const target of targets){
      if(/^[A-Za-z][\w+.-]*:/.test(target))return {reason:'outside-source-snapshot',configs:[path]};
      const candidate=normalize(posix.isAbsolute(target)?target:posix.join(origin,target));
      if(candidate!==root&&!candidate.startsWith(root+'/'))return {reason:'outside-source-snapshot',configs:[path]};
      const resolved=resolvePath(candidate===root?'.':candidate.slice(root.length+1));
      if(resolved.target)return {...resolved,resolution:{kind:key?'tsconfig-paths':'tsconfig-base-url',config:path,pattern:key,base:origin===root?'.':origin.slice(root.length+1),configInputs:selected.inputs.map(file=>({file:file.slice(root.length+1),hash:createHash('sha256').update(contents.get(file)).digest('hex')}))}};
      if(resolved.reason!=='module-missing-from-snapshot')return {...resolved,configs:[path]};
    }
    return {reason:key?'alias-target-missing-from-snapshot':'external-or-alias-needs-resolution',configs:[path]};
  }
  return {resolve,issues};
}
