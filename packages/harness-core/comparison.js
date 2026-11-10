import {PNG} from 'pngjs';
import {mkdir,realpath,rename,rm,writeFile} from 'node:fs/promises';
import {join,resolve,relative,sep,isAbsolute,dirname,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {loadRun,withRunLock} from './store.js';
import {captureEntries,captureKey} from './capture-state.js';
import {readVerificationFile,verificationHash as hash} from './verification.js';
import {pngDimensions} from './whole-page.js';

const LIMIT=24*1024*1024,MAX_PIXELS=6_000_000,GAP=24;
const HEX=/^[a-f0-9]{64}$/;
const same=isDeepStrictEqual;
const route=url=>{const parsed=new URL(url);return parsed.pathname+parsed.search+parsed.hash;};

async function plannedDirectory(path){
 const segments=[];
 for(let current=path;;current=dirname(current)){
  try{return join(await realpath(current),...segments.reverse());}
  catch(error){if(error.code!=='ENOENT'||dirname(current)===current)throw error;segments.push(basename(current));}
 }
}

function contract(entry){
 return {
  route:route(entry.start.url),
  actions:(entry.actions||[]).map(action=>action.type==='navigate'?{...action,url:route(action.url)}:action),
  scroll:entry.dom.scroll,
  language:entry.dom.language,
  appearance:entry.dom.appearance,
  scrollSurface:entry.plannedScrollSurface||null
 };
}

async function original(run,phase,state,configuration){
 const capture=run.manifest.captures[phase];
 const matches=captureEntries(capture).filter(entry=>entry.stateId===state&&entry.configurationId===configuration);
 if(matches.length!==1)throw Error(`Expected one ${phase} capture for ${state}/${configuration}.`);
 const entry=matches[0];
 if(entry.reached===false||!entry.dom||!entry.screenshot||!entry.status||entry.status>=400)throw Error(`${phase} state was not reached successfully.`);
 if((entry.captureMode||'viewport')!=='viewport'||entry.pageSurfaces)throw Error('Comparison v1 supports whole viewport originals only; full-page surfaces need explicit matching.');
 const expected=`${phase}/${entry.legacy?configuration:captureKey(state,configuration)}.png`;
 if(entry.screenshot!==expected)throw Error('Comparison original has an unsafe or unexpected path.');
 const source=capture.verificationSource;
 if(source?.version!==1||!HEX.test(source.contentHash||'')||!/^[a-f0-9]{40,64}$/.test(source.commit||'')||typeof source.dirty!=='boolean'||!HEX.test(capture.verificationPreviewFingerprint||''))throw Error('Comparison requires capture-time source and preview binding; recapture with --repo DIRECTORY --bind-evidence true.');
 if(!entry.dom.appearance||!entry.dom.scroll||!Object.hasOwn(entry.dom,'language'))throw Error('Comparison requires captured theme, language and scroll context; collect fresh captures.');
 const bytes=await readVerificationFile(run.directory,entry.screenshot,LIMIT);
 const sha256=hash(bytes);
 if(!HEX.test(capture.verificationOriginalHashes?.[entry.screenshot]||'')||capture.verificationOriginalHashes[entry.screenshot]!==sha256)throw Error('Original screenshot changed or has no capture-time hash; collect fresh evidence.');
 const size=pngDimensions(bytes);
 if(size.width*size.height>MAX_PIXELS||size.width!==entry.width||size.height!==entry.height)throw Error('Original PNG must fit the recorded viewport at 1:1 scale and the 6 megapixel limit.');
 if(bytes[24]!==8||![2,6].includes(bytes[25]))throw Error('Comparison requires an 8-bit RGB/RGBA browser PNG.');
 const decoded=PNG.sync.read(bytes,{checkCRC:true});
 return {entry,bytes,decoded,reference:{path:entry.screenshot,sha256,capturedAt:capture.at,source:{commit:source.commit,dirty:source.dirty,contentHash:source.contentHash},previewFingerprint:capture.verificationPreviewFingerprint}};
}

// This is presentation, not another acceptance store. It never changes the run
// or invents an improvement judgment. Pixels are copied without resizing/cropping.
export async function exportComparison({directory,state,configuration,outputRoot}){
 const key=captureKey(state,configuration);
 return withRunLock(directory,async()=>{
  const run=await loadRun(directory);
  if(run.manifest.mode==='bootstrap'||!run.manifest.captures.before||!run.manifest.captures.after)throw Error('A comparison needs both original before and after captures; bootstrap has no baseline.');
  const before=await original(run,'before',state,configuration),after=await original(run,'after',state,configuration);
  if(before.entry.width!==after.entry.width||before.entry.height!==after.entry.height)throw Error('Before and after viewport sizes differ.');
  if(!same(contract(before.entry),contract(after.entry)))throw Error('Before and after route, actions, theme, language or scroll context differ.');
  const width=before.entry.width,height=before.entry.height;
  const image=new PNG({width:width*2+GAP,height});image.data.fill(255);
  PNG.bitblt(before.decoded,image,0,0,width,height,0,0);
  PNG.bitblt(after.decoded,image,0,0,width,height,width+GAP,0);
  const png=PNG.sync.write(image,{colorType:6,bitDepth:8});
  const record={
   version:1,kind:'pixel-preserving-comparison',runId:run.manifest.id,stateId:state,configurationId:configuration,
   viewport:{width,height},layout:{left:'before',right:'after',gap:GAP,scale:1,crop:null},
   contractHash:hash(contract(before.entry)),captureRecordHash:hash(run.manifest.captures),
   originals:{before:before.reference,after:after.reference},image:{file:'comparison.png',sha256:hash(png),width:width*2+GAP,height},
   limitations:[
    'This image does not establish improvement, independent QA or human acceptance.',
    'Matching recorded context does not prove identical live data or semantic equivalence; inspect the originals and task.',
    'Source and preview fingerprints record capture inputs; they do not alone prove that a server rendered the intended source.',
    'Original screenshot pixels are retained; private information is not automatically redacted.'
   ]
  };
  const digest=hash(record);
  const files={
   'comparison.png':png,
   'comparison.json':Buffer.from(JSON.stringify(record,null,2)+'\n'),
   'README.md':Buffer.from(`# Before / after evidence\n\nLeft: before. Right: after. State: ${state}. Configuration: ${configuration}.\n\n![Before on the left, after on the right](comparison.png)\n\nWhole viewport originals at 1:1 scale, with no crop or retouch.\n\nRun: ${run.manifest.id}. Original paths, capture hashes and source fingerprints are in [comparison.json](comparison.json). This export is not an acceptance decision or a claim of improvement. Review the original evidence and any private information before sharing.\n`)
  };
  for(const item of [before,after])if(hash(await readVerificationFile(run.directory,item.reference.path,LIMIT))!==item.reference.sha256)throw Error('Original changed while composing the comparison.');
  const root=resolve(outputRoot||join(run.directory,'comparisons'));
  const realRoot=await plannedDirectory(root),realRun=await realpath(run.directory);
  for(const protectedName of ['before','after','worktree']){
   const path=join(realRun,protectedName),rel=relative(path,realRoot);
   if(rel===''||(!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel)))throw Error('Comparison output cannot be inside evidence or the execution worktree.');
  }
  await mkdir(root,{recursive:true});
  if(await realpath(root)!==realRoot)throw Error('Comparison output root changed.');
  const parent=join(root,key);await mkdir(parent,{recursive:true});
  if(await realpath(parent)!==join(realRoot,key))throw Error('Comparison output cannot use a linked state directory.');
  const target=join(parent,digest),temporary=join(parent,'.tmp-'+randomUUID());
  await mkdir(temporary);
  try{
   for(const [name,bytes] of Object.entries(files))await writeFile(join(temporary,name),bytes,{flag:'wx'});
   try{await rename(temporary,target);}
   catch(error){
    if(!['EEXIST','ENOTEMPTY','EPERM','EACCES'].includes(error.code))throw error;
    for(const [name,bytes] of Object.entries(files))if(!(await readVerificationFile(root,`${key}/${digest}/${name}`,64*1024*1024)).equals(bytes))throw Error('Existing comparison changed; use a fresh output root.');
   }
  }finally{await rm(temporary,{recursive:true,force:true});}
  return {directory:target,image:join(target,'comparison.png'),provenance:join(target,'comparison.json'),digest,acceptance:'not-assessed'};
 });
}
