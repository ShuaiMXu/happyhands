import ts from 'typescript';
import {posix} from 'node:path';
import {moduleConfigResolver} from './module-config.js';

const extensions=['.ts','.tsx','.js','.jsx','.astro','.vue','.svelte','.mjs','.cjs','.mts','.cts'];
function scripts(file){
  if(/\.[cm]?[jt]sx?$/.test(file.path))return [{text:file.content,offset:0}];
  const content=file.content.replace(/<!--[\s\S]*?-->/g,value=>value.replace(/[^\n]/g,' ')),parts=[];
  if(/\.astro$/.test(file.path)){
    const front=/^\s*---[^\S\n]*\r?\n([\s\S]*?)\r?\n---/.exec(content);
    if(front)parts.push({text:front[1],offset:content.slice(0,front.index+front[0].indexOf(front[1])).split('\n').length-1});
  }
  for(const match of content.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
    if(/\bsrc\s*=|\btype\s*=\s*["'](?:application\/json|__bundler\/)/i.test(match[1]))continue;
    parts.push({text:match[2],offset:content.slice(0,match.index+match[0].indexOf('>')+1).split('\n').length-1});
  }
  return parts;
}

export function moduleReferences(file){
  const references=[],issues=[];
  for(const part of scripts(file)){
    const ast=ts.createSourceFile(file.path,part.text,ts.ScriptTarget.Latest,true,/\.tsx$/.test(file.path)?ts.ScriptKind.TSX:/\.(?:astro|vue|svelte|[cm]?ts)$/.test(file.path)?ts.ScriptKind.TS:ts.ScriptKind.JSX);
    if(ast.parseDiagnostics.length){issues.push({file:file.path,line:part.offset+1,reason:'module-syntax-needs-inspection'});continue;}
    const add=(node,specifier,kind)=>references.push({file:file.path,line:part.offset+ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1,specifier,kind});
    function visit(node){
      if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)){
        const clause=node.importClause;
        const bindings=clause?.namedBindings;
        const onlyTypes=!clause?.name&&bindings&&ts.isNamedImports(bindings)&&bindings.elements.length>0&&bindings.elements.every(item=>item.isTypeOnly);
        if(!clause?.isTypeOnly&&!onlyTypes)add(node,node.moduleSpecifier.text,'import');
      }else if(ts.isExportDeclaration(node)&&!node.isTypeOnly&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){
        if(!node.exportClause||!ts.isNamedExports(node.exportClause)||!node.exportClause.elements.length||node.exportClause.elements.some(item=>!item.isTypeOnly))add(node,node.moduleSpecifier.text,'re-export');
      }
      else if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==='require')){
        const argument=node.arguments[0];
        if(node.arguments.length===1&&argument&&ts.isStringLiteralLike(argument))add(node,argument.text,node.expression.kind===ts.SyntaxKind.ImportKeyword?'dynamic-import':'require-candidate');
        else issues.push({file:file.path,line:part.offset+ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1,reason:'dynamic-module-expression'});
      }
      ts.forEachChild(node,visit);
    }
    visit(ast);
  }
  return {references,issues};
}

function resolvePath(base,paths){
  if(base.startsWith('../')||posix.isAbsolute(base))return {reason:'outside-source-snapshot'};
  if(paths.has(base))return {target:base};
  const candidates=extensions.flatMap(ext=>[base+ext,posix.join(base,'index'+ext)]);
  if(/\.[cm]?js$/.test(base)){
    const stem=base.replace(/\.[cm]?js$/,'');
    candidates.push(...(/\.mjs$/.test(base)?['.mts']:/\.cjs$/.test(base)?['.cts']:['.ts','.tsx']).map(ext=>stem+ext));
  }
  const matches=[...new Set(candidates.filter(path=>paths.has(path)))];
  return matches.length===1?{target:matches[0]}:{reason:matches.length?'ambiguous-source-module':'module-missing-from-snapshot'};
}

export function resolveModule(source,specifier,paths,configs=null){
  if(!specifier.startsWith('.'))return configs?configs.resolve(source,specifier,base=>resolvePath(base,paths)):{reason:'external-or-alias-needs-resolution'};
  return resolvePath(posix.normalize(posix.join(posix.dirname(source),specifier)),paths);
}

export function componentGraph(files,{truncated=false}={}){
  const paths=new Set(files.map(file=>file.path)),edges=[],issues=[],configs=moduleConfigResolver(files);
  for(const file of files){
    const parsed=moduleReferences(file);issues.push(...parsed.issues);
    for(const reference of parsed.references){
      const resolved=truncated&&!reference.specifier.startsWith('.')?{reason:'alias-snapshot-incomplete'}:resolveModule(file.path,reference.specifier,paths,configs);
      if(resolved.target)edges.push({...reference,...resolved});
      else issues.push({...reference,...resolved});
    }
  }
  issues.push(...configs.issues);
  const reverse=new Map();
  for(const edge of edges){if(!reverse.has(edge.target))reverse.set(edge.target,[]);reverse.get(edge.target).push(edge);}
  function consumers(target){
    const direct=edges.filter(edge=>edge.target===target&&edge.file!==target);
    const visited=new Set([target]),queue=[{file:target,via:[]}],potential=[];
    let truncated=false;
    for(let index=0;index<queue.length;index++)for(const edge of reverse.get(queue[index].file)||[]){
      if(visited.has(edge.file))continue;
      if(queue[index].via.length>=32||potential.length>=256){truncated=true;continue;}
      visited.add(edge.file);const via=[edge,...queue[index].via];
      potential.push({file:edge.file,via,status:'module-reachability-only'});queue.push({file:edge.file,via});
    }
    return {direct,potential,truncated};
  }
  return {edges,issues,consumers};
}

export function moduleGraphEvidence(graph,{truncated=false}={}){
  const edges=graph.edges.slice(0,10000),issues=graph.issues.slice(0,1000);
  const limited=edges.length!==graph.edges.length||issues.length!==graph.issues.length;
  return {schemaVersion:'0.1',status:truncated||limited?'partial':'static-reference-only',edges,issues,
    ...(limited?{omissions:{edges:graph.edges.length-edges.length,issues:graph.issues.length-issues.length}}:{})};
}
