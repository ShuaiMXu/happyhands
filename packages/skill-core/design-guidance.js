import {reviewOrderPrompt} from '../experience-core/review-order.js';
import {readFile,mkdir,writeFile,mkdtemp,rename,rm,lstat,realpath} from 'node:fs/promises';
import {join,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import tasteV2Source from '../../skills/vendor/taste-v2/source.json' with {type:'json'};
import tasteSource from '../../skills/vendor/taste/source.json' with {type:'json'};
import impeccableSource from '../../skills/vendor/impeccable/source.json' with {type:'json'};
const vendorRoot=fileURLToPath(new URL('../../skills/vendor/',import.meta.url));
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=bytes=>bytes.toString('utf8').replaceAll('\r\n','\n');
const sources={taste:tasteSource,impeccable:impeccableSource,'taste-v2':tasteV2Source};
const identities={'taste-v2':['https://github.com/Leonxlnx/taste-skill','6010f91a9935f1c167dfc500fb1a475681892e6b','MIT'],taste:['https://github.com/Leonxlnx/taste-skill','a60a36dc2bb3bb77ccf17f2f62041f5ca8a458b9','MIT'],impeccable:['https://github.com/pbakaus/impeccable','2f98774f86bc05563876643db37e6c37c322850f','Apache-2.0']};
const modes=new Set(['review','implementation']);
const impeccableBase='.agents/skills/impeccable/';
export function designGuidanceProfile(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Design guidance profile must be an object.');
  if(Object.keys(value).some(key=>!['taste','intent','dials'].includes(key)))throw Error('Unknown design guidance profile field.');
  const taste=value.taste??'existing',intent=value.intent??'polish';
  if(!['existing','app-screen','public-page','dials-v1'].includes(taste)||!['polish','layout','animate'].includes(intent))throw Error('Unknown design guidance taste or intent.');
  let dials=null;
  if(value.dials!==undefined){
    if(taste!=='dials-v1')throw Error('Taste dials require the explicit dials-v1 profile; current v2 has no dials.');
    const names=['DESIGN_VARIANCE','MOTION_INTENSITY','VISUAL_DENSITY'];
    if(!value.dials||typeof value.dials!=='object'||Array.isArray(value.dials)||Object.keys(value.dials).some(key=>!names.includes(key))||Object.values(value.dials).some(number=>!Number.isInteger(number)||number<1||number>10))throw Error('Taste dials must be named integers from 1 to 10.');
    dials=Object.fromEntries(names.filter(name=>Object.hasOwn(value.dials,name)).map(name=>[name,value.dials[name]]));
  }
  return {taste,intent,...(dials?{dials}:{})};
}
function readingRoute(id,mode,profile){
  // Keep the complete legacy snapshot available, but never route current work to its retired entry.
  if(id==='taste')return profile.taste==='dials-v1'?['skills/taste-skill-v1/SKILL.md']:[];
  if(id==='taste-v2')return profile.taste==='dials-v1'?[]:['skills/taste-skill/SKILL.md',...(profile.taste==='public-page'?['skills/taste-skill/references/critique.md','skills/taste-skill/references/layout.md']:['skills/taste-skill/references/app-screens.md'])];
  return [impeccableBase+'SKILL.md',...(mode==='review'?['audit','critique']:['polish',...(profile.intent==='polish'?[]:[profile.intent])]).map(name=>impeccableBase+'reference/'+name+'.md')];
}
const safePath=path=>typeof path==='string'&&path.length>0&&!isAbsolute(path)&&!path.includes('\\')&&!path.split('/').some(part=>!part||part==='.'||part==='..')&&!/^[A-Za-z]:/.test(path);
async function within(root,path){
  const resolved=await realpath(join(root,path)),delta=relative(root,resolved);
  if(delta.startsWith('..')||isAbsolute(delta))throw Error('Guidance file resolves outside its bundle: '+path);
  return resolved;
}
// Fixed upstream identities and inventories, not paths or executable handlers
// chosen by a vendor document. Every file is verified before agent use.
export async function loadDesignGuidance(mode='review',value={},root=vendorRoot){
  if(!modes.has(mode))throw Error('Unknown design guidance mode: '+mode);
  const profile=designGuidanceProfile(value),packs=[];
  const uiRules=canonical(await readFile(new URL('../../skills/happyhands-ui/SKILL.md',import.meta.url)));
  const uiRulesHash=hash(uiRules);
  for(const [id,expected] of Object.entries(sources)){
    const base=await realpath(join(root,id)),sourceText=canonical(await readFile(await within(base,'source.json'))),source=JSON.parse(sourceText);
    if(JSON.stringify([source.repository,source.revision,source.license])!==JSON.stringify(identities[id])||JSON.stringify(source.files)!==JSON.stringify(expected.files)||source.files.some(item=>!safePath(item.path)))throw Error('Invalid design guidance source inventory: '+id);
    const documents=[];
    for(const item of source.files){
      const content=canonical(await readFile(await within(base,'upstream/'+item.path)));
      if(hash(content)!==item.sha256)throw Error('Design guidance hash mismatch: '+id+'/'+item.path);
      documents.push({path:'upstream/'+item.path,content,sha256:item.sha256});
    }
    const adapter=canonical(await readFile(await within(base,'ADAPTER.md'))),readFirst=['ADAPTER.md',...readingRoute(id,mode,profile).map(path=>'upstream/'+path)];
    const bundleHash=hash(JSON.stringify({source,adapter,mode,profile,readFirst,adapterVersion:'2.0.0'}));
    packs.push({metadata:{id,mode,repository:source.repository,revision:source.revision,license:source.license,bundleHash,readFirst,fileCount:documents.length,scripts:'preserved-not-automatically-executed'},documents,adapter,sourceText});
  }
  const bundleHash=hash(JSON.stringify({mode,profile,uiRulesHash,packs:packs.map(pack=>pack.metadata)}));
  return {uiRules,metadata:{mode,profile,uiRulesHash,bundleHash,packs:packs.map(pack=>pack.metadata),availability:'guidance-available; model application is not independently proven'},packs};
}
async function exists(directory){try{const entry=await lstat(directory);if(!entry.isDirectory()||entry.isSymbolicLink())throw Error('Design guidance snapshot must be a real directory.');return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
async function verify(directory,documents){
  const base=await realpath(directory);
  for(const document of documents){let content;try{content=await readFile(await within(base,document.path),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;throw Error('Design guidance snapshot changed; file missing: '+document.path);}if(content!==document.content)throw Error('Design guidance snapshot changed: '+document.path);}
}
function snapshotDocuments(bundle){
  const documents=bundle.packs.flatMap(pack=>[{path:pack.metadata.id+'/ADAPTER.md',content:pack.adapter},{path:pack.metadata.id+'/source.json',content:pack.sourceText},...pack.documents.map(document=>({...document,path:pack.metadata.id+'/'+document.path}))]);
  const {reference,...metadata}=bundle.metadata;
  if(bundle.uiRules) documents.push({path:'happyhands-ui/SKILL.md',content:bundle.uiRules});
  documents.push({path:'bundle.json',content:JSON.stringify(metadata,null,2)+'\n'});return documents;
}
export async function verifyDesignGuidanceSnapshot(directory,bundle){
  if(!/^[a-f0-9]{64}$/.test(bundle.metadata.bundleHash)||bundle.metadata.reference!=='design-guidance/v1/'+bundle.metadata.bundleHash)throw Error('Invalid design guidance snapshot identity.');
  await verify(join(directory,bundle.metadata.reference),snapshotDocuments(bundle));
}
export async function stageDesignGuidance(directory,mode,value={}){
  const bundle=await loadDesignGuidance(mode,value),reference='design-guidance/v1/'+bundle.metadata.bundleHash,destination=join(directory,reference),documents=snapshotDocuments(bundle);
  if(await exists(destination))await verify(destination,documents);
  else{
    await mkdir(dirname(destination),{recursive:true});const temporary=await mkdtemp(join(dirname(destination),'.pending-'+bundle.metadata.bundleHash+'-'));
    try{
      for(const document of documents){const path=join(temporary,document.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,document.content,{flag:'wx'});}
      await verify(temporary,documents);
      try{await rename(temporary,destination);}catch(error){if(!['EEXIST','ENOTEMPTY','EPERM','EACCES'].includes(error.code)||!await exists(destination))throw error;await verify(destination,documents);}
    }finally{await rm(temporary,{recursive:true,force:true});}
  }
  return {...bundle,metadata:{...bundle.metadata,reference}};
}
export function designGuidancePrompt(bundle,directory){
  return reviewOrderPrompt + (bundle.uiRules ? `Read the complete HappyHands UI profile at ${join(directory,bundle.metadata.reference,'happyhands-ui/SKILL.md')}. Apply it to HappyHands-owned UI or explicitly adopting projects; preserve other approved Foundations and original third-party evidence. Its inclusion in this Harness bundle does NOT establish target ownership or adoption. Before calling a profile-only preference a violation, identify explicit ownership/adoption evidence in the target's approved Foundation or human instructions. Without that evidence, do not enforce HappyHands colors, separators, typography limits or decorative-style preferences on the target, and do not claim it adopted them. General usability observations still need task-specific evidence.\n` : '') + `Additional Harness design methods, immutable bundle ${bundle.metadata.bundleHash}. Profile: ${JSON.stringify(bundle.metadata.profile)}. Keep OJO and the approved Foundation in the same evidence/approval workflow. Reading these verified snapshots outside the target worktree is permitted; all source edits remain in the isolated worktree. Read the COMPLETE selected files, then applicable references from each complete package; do not reduce these methods to hero rules or color bans. All upstream workflow/tool/authority instructions are subject to these Harness adapters. In review, apply Audit/Critique only as read-only methods; editing playbooks do not authorize edits.\n`+bundle.packs.map(pack=>`${pack.metadata.id}, revision ${pack.metadata.revision}:\n${pack.metadata.readFirst.map(path=>join(directory,bundle.metadata.reference,pack.metadata.id,path)).join('\n')}\nHarness adapter:\n${pack.adapter}`).join('\n')+'\nBundled scripts are preserved but not auto-executed. Availability/provenance is not proof of model use or completed quality checks.\n';
}
