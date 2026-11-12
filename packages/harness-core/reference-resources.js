import {readFile,writeFile,mkdir,rename,stat} from 'node:fs/promises';
import {join,resolve,extname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {loadRun,withRunLock} from './store.js';
import {readVerificationFile} from './verification.js';
const origin='https://happyhands.cc',hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const safe=value=>typeof value==='string'&&/^[a-zA-Z0-9_./-]+$/.test(value)&&!value.startsWith('/')&&!value.split('/').some(part=>!part||part==='.'||part==='..');
async function responseBytes(response,maxBytes){
 if(!response.ok){await response.body?.cancel().catch(()=>{});throw Error('Resource fetch failed: '+response.status);}
 if(!response.body||Number(response.headers.get('content-length')||0)>maxBytes){await response.body?.cancel().catch(()=>{});throw Error('Resource is empty or exceeds its size limit.');}
 const chunks=[];let count=0;for await(const chunk of response.body){count+=chunk.length;if(count>maxBytes)throw Error('Resource exceeds its size limit.');chunks.push(chunk);}
 return Buffer.concat(chunks);
}
async function request(path,{fetcher=fetch,maxBytes=8*1024*1024}={}){
 const url=new URL(path,origin);if(url.origin!==origin||url.username||url.password)throw Error('Resource indexes may only fetch official website paths.');
 const response=await fetcher(url.href,{redirect:'error',signal:AbortSignal.timeout(15000)});
 return responseBytes(response,maxBytes);
}
async function explicitUrlReference(value,fetcher){
 const requested=new URL(value);
 if(requested.protocol!=='https:'||requested.username||requested.password)throw Error('Reference URLs require HTTPS without embedded credentials. Use --file for local documents.');
 const url=new URL(requested);url.hash='';
 // GitHub's normal file link is an HTML viewer. Select its corresponding raw
 // document explicitly rather than ingesting a page shell as a design method.
 const parts=url.pathname.split('/').filter(Boolean);
 if(url.hostname==='github.com'&&parts.length>=5&&parts[2]==='blob'){
  url.hostname='raw.githubusercontent.com';url.pathname='/'+[...parts.slice(0,2),...parts.slice(3)].join('/');
  if([...url.searchParams.keys()].every(key=>['raw','plain'].includes(key)))url.search='';
 }
 const response=await fetcher(url.href,{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok){await response.body?.cancel().catch(()=>{});throw Error('Resource fetch failed: '+response.status);}
 const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(!['text/plain','text/markdown','text/x-markdown','text/css','application/json','application/octet-stream'].includes(type)){await response.body?.cancel().catch(()=>{});throw Error('Reference URL must serve Markdown, JSON or CSS text, not an HTML viewer. Use a raw-document URL.');}
 const bytes=await responseBytes(response,512*1024);
 try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('Reference URL must contain UTF-8 text.');}
 if(/^\s*(?:<!doctype\s+html|<html\b)/i.test(bytes.toString('utf8')))throw Error('Reference URL returned HTML; select its raw document.');
 const extension=type==='application/json'?'.json':type==='text/css'?'.css':['.md','.json','.css'].includes(extname(url.pathname).toLowerCase())?extname(url.pathname).toLowerCase():'.md';
 return {bytes,extension,source:{id:'url:'+hash(url.href),name:'Selected HTTPS '+extension.slice(1)+' reference',type:'external',source:url.href,originalSource:requested.href,version:hash(bytes),license:'User-selected source; inspect its original license before reuse.'}};
}
export async function resourceIndex({fetcher=fetch}={}){
 const paths=['/design-archive/index.json','/design-how/catalog.json','/r/index.json'];
 const bytes=await Promise.all(paths.map(path=>request(path,{fetcher}))),[archive,systems,registry]=bytes.map(bytes=>JSON.parse(bytes));
 if(!Array.isArray(archive)||!Array.isArray(systems.systems)||!Array.isArray(registry.items))throw Error('Invalid resource index shape.');
 const rows=[
  ...archive.filter(row=>safe(row.slug)&&!row.slug.includes('/')).map(row=>({id:'design-md:'+row.slug,name:row.name,type:'design-md',summary:row.north_star||'',tags:[row.industry,...(row.styles||[]),...(row.types||[])],path:'design-archive/'+row.slug+'/design.md',expectedHash:row.sha256,indexHash:hash(bytes[0]),source:row.page_url||row.site_url,stack:'reference-only',license:'Check original source; indexing is not a license grant.'})),
  ...systems.systems.filter(row=>safe(row.id)&&!row.id.includes('/')).map(row=>({id:'system:'+row.id,name:row.name,type:'system',summary:row.summary||'',documents:row.documents.filter(doc=>safe(doc.path)).map(doc=>({path:doc.path,title:doc.title,kind:doc.kind})),path:'design-how/'+row.id+'/index.md',indexHash:hash(bytes[1]),source:systems.source,stack:'Check selected component source and dependencies',license:'Check selected source license before reuse.'})),
  ...registry.items.filter(row=>row.name&&row.registryDependencies?.length===1).map(row=>({id:'component:'+row.name,name:row.title||row.name,type:'component',summary:row.description||'',path:new URL(row.registryDependencies[0],origin).href,indexHash:hash(bytes[2]),source:registry.homepage,stack:'shadcn registry; inspect selected item API and dependencies',license:'Check selected registry item and upstream license.'}))
 ];
 if(rows.length>10000||new Set(rows.map(row=>row.id)).size!==rows.length)throw Error('Invalid or duplicate resource IDs.');return rows;
}
export async function searchResources(query,{limit=8,fetcher=fetch}={}){
 if(typeof query!=='string'||!query.trim()||query.length>300||!Number.isInteger(limit)||limit<1||limit>20)throw Error('Provide a search query and a limit between 1 and 20.');
 const terms=query.toLowerCase().trim().split(/\s+/);
 const rows=await resourceIndex({fetcher});
 const score=row=>{const name=String(row.name).toLowerCase(),q=query.trim().toLowerCase();return (name===q||row.id.toLowerCase().split(':').at(-1)===q?100:0)+(name.includes(q)?50:0)+terms.filter(term=>name.includes(term)).length*10;};
 return rows.filter(row=>terms.every(term=>JSON.stringify([row.id,row.name,row.summary,row.tags,row.documents]).toLowerCase().includes(term))).sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id)).slice(0,limit).map(({expectedHash,...row})=>({...row,version:expectedHash||row.indexHash}));
}
export async function selectedReferenceContext(run){
 const refs=run.manifest.selectedReferences||[];if(!Array.isArray(refs)||refs.length>12)throw Error('Invalid selected reference list.');
 return Promise.all(refs.map(async ref=>{
  if(!ref||!safe(ref.path)||!/^references\/[a-f0-9]{64}\.(md|json|css)$/.test(ref.path)||!/^[a-f0-9]{64}$/.test(ref.sha256))throw Error('Invalid selected reference path or hash.');
  const bytes=await readVerificationFile(run.directory,ref.path,512*1024);if(hash(bytes)!==ref.sha256)throw Error('Selected reference snapshot changed: '+ref.id);
  return {...ref,content:bytes.toString('utf8')};
 }));
}
export async function selectResource({directory,id,document,file,url,fetcher=fetch}){
 if([id,file,url].filter(Boolean).length!==1)throw Error('Select exactly one --id, --file or --url.');
 return withRunLock(directory,async()=>{
  const run=await loadRun(directory);
  if(run.manifest.diagnosis||run.manifest.confirmation||run.manifest.plan||run.manifest.execution)throw Error('Reference selection is frozen after diagnosis; start a fresh review.');
  if((run.manifest.selectedReferences||[]).length>=12)throw Error('Select at most twelve references.');
  let bytes,source,extension='.md';
  if(url){
   if(document)throw Error('--document is only for a system resource.');
   ({bytes,source,extension}=await explicitUrlReference(url,fetcher));
  }else if(file){
   if(document)throw Error('--document is only for a system resource.');
   const path=resolve(file),info=await stat(path);extension=extname(path).toLowerCase();
   if(!info.isFile()||info.size>512*1024||!['.md','.json','.css'].includes(extension))throw Error('Select a Markdown, JSON or CSS reference below 512 KiB.');
   bytes=await readFile(path);source={id:'local:'+hash(bytes),name:'Selected local '+extension.slice(1)+' reference',type:'local',source:path,version:hash(bytes),license:'User-selected source; inspect applicable license.'};
  }else{
   const row=(await resourceIndex({fetcher})).find(row=>row.id===id);if(!row)throw Error('Unknown resource ID; search the current index first.');
   let path=row.path,expected=row.expectedHash;
   if(document){if(row.type!=='system'||!safe(document)||!row.documents.some(doc=>doc.path===document))throw Error('Select an actual document returned by the system index.');path='design-how/'+id.slice(7)+'/'+document;}
   if(row.type==='system'){
    const manifest=JSON.parse(await request('/design-how/manifest.json',{fetcher}));expected=manifest.find(entry=>entry.path===path)?.sha256;if(!expected)throw Error('System document has no published source hash.');
   }
   bytes=await request(path,{fetcher,maxBytes:512*1024});extension=row.type==='component'?'.json':'.md';
   if(expected&&hash(bytes)!==expected)throw Error('Resource changed since its index; retry after the website index is consistent.');
   source={id:row.id+(document?'/'+document:''),name:row.name,type:row.type,source:new URL(path,origin).href,originalSource:row.source,indexHash:row.indexHash,version:hash(bytes),license:row.license,stack:row.stack};
  }
  if(bytes.length>512*1024||bytes.includes(0))throw Error('Reference exceeds the text limit or is binary.');
  const digest=hash(bytes),path='references/'+digest+extension;
  if((run.manifest.selectedReferences||[]).some(ref=>ref.id===source.id||ref.path===path))throw Error('Reference already selected.');
  const record={...source,path,sha256:digest,bytes:bytes.length,selectedAt:new Date().toISOString(),authority:'reference-data-only'};
  if((run.manifest.selectedReferences||[]).reduce((total,ref)=>total+ref.bytes,0)+bytes.length>1024*1024)throw Error('Selected references exceed one MiB; select narrower documents.');
  await mkdir(join(run.directory,'references'),{recursive:true});
  try{await writeFile(join(run.directory,path),bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST'||!(await readVerificationFile(run.directory,path,512*1024)).equals(bytes))throw error;}
  run.manifest.selectedReferences=[...(run.manifest.selectedReferences||[]),record];
  const temporary=join(run.directory,'.references-'+randomUUID()+'.json');await writeFile(temporary,JSON.stringify(run.manifest,null,2)+'\n');await rename(temporary,join(run.directory,'run.json'));
  return record;
 });
}
export async function resourceCommand(args){
 const [command,...rest]=args,options={};
 for(let i=0;i<rest.length;i+=2){if(!/^--[a-z]+$/.test(rest[i])||!rest[i+1]||rest[i+1].startsWith('--')||Object.hasOwn(options,rest[i].slice(2)))throw Error('Expected unique --option VALUE.');options[rest[i].slice(2)]=rest[i+1];}
 if(command==='search'&&Object.keys(options).every(key=>['query','limit'].includes(key)))return searchResources(options.query,{limit:options.limit===undefined?8:Number(options.limit)});
 if(command==='select'&&options.run&&Object.keys(options).every(key=>['run','id','document','file','url'].includes(key)))return selectResource({directory:options.run,id:options.id,document:options.document,file:options.file,url:options.url});
 throw Error('Use resources search --query TEXT or resources select --run DIRECTORY --id ID [--document PATH] / --file PATH / --url HTTPS_RAW_DOCUMENT.');
}
