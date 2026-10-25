import {sourceContent} from './source-content.js';
import postcss from 'postcss';
// CSS AST extraction preserves source coordinates; non-CSS sources remain explicit legacy scans.
export function cssDeclarations(file, allowTemplate = true) {
  const decoded=allowTemplate?sourceContent(file):{content:file.content,location:null};
  if(decoded.error)return {declarations:[],error:{file:file.path,line:decoded.location.containerLine,message:decoded.error}};
  if(decoded.location){
    const result=cssDeclarations({path:file.path+'.decoded.html',content:decoded.content},false);
    return {...result,declarations:result.declarations.map(item=>({...item,embedded:{...decoded.location,line:item.line},line:decoded.location.containerLine})),...(result.error?{error:{...result.error,file:file.path,line:decoded.location.containerLine}}:{})};
  }
  if (/\.(?:html|astro|vue|svelte)$/i.test(file.path)) {
    const declarations=[],errors=[];
    for(const match of file.content.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)){
      const offset=file.content.slice(0,match.index+match[0].indexOf('>')+1).split('\n').length-1;
      const parsed=cssDeclarations({path:file.path+'.css',content:match[1]});
      declarations.push(...parsed.declarations.map(item=>({...item,line:item.line+offset})));
      if(parsed.error)errors.push({...parsed.error,file:file.path,line:(parsed.error.line||1)+offset});
    }
    return {declarations,error:errors.length?{file:file.path,message:'One or more inline style blocks could not be parsed',errors}:null};
  }
  if (!file.path.endsWith('.css')) return null;
  try {
    const root = postcss.parse(file.content, { from: file.path });
    const declarations = [];
    root.walkDecls(/^--/, node => {
      const contexts = []; let parent = node.parent;
      while (parent && parent.type !== 'root') {
        contexts.push(parent.type === 'rule' ? parent.selector : '@'+parent.name+' '+parent.params);
        parent = parent.parent;
      }
      const context = contexts.join(' ');
      const dark = /prefers-color-scheme\s*:\s*dark|data-(?:hh-)?theme\s*=\s*["']?dark|\.dark(?:\b)/i.test(context);
      const light = /prefers-color-scheme\s*:\s*light|data-(?:hh-)?theme\s*=\s*["']?light|\.light(?:\b)/i.test(context);
      declarations.push({name:node.prop,value:node.value.trim(),theme:light ? null : dark ? 'dark' : null,line:node.source.start.line,contexts,ambiguous:dark && light});
    });
    return {declarations,error:null};
  } catch (error) { return {declarations:[],error:{file:file.path,line:error.line,message:error.reason}}; }
}
