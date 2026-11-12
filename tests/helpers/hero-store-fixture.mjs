// Synthetic evidence gate fixture; no product, browser or model is evaluated.
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {PNG} from 'pngjs';
const repository=fileURLToPath(new URL('../../',import.meta.url));
const load=relative=>import(new URL('../../'+relative,import.meta.url));
const {createRun,saveOnboarding,saveCapture,confirmFinding,savePlan,saveExecution,saveEvaluation,saveVisualReview,loadRun}=await load('packages/harness-core/store.js');
const {readRemediation,collectRemediation,RESULT_FILE,methodStateEntries}=await load('packages/harness-core/remediation.js');
const {verificationBinding,verificationHash,saveVerificationEvidence,readVerificationEvidence}=await load('packages/harness-core/verification.js');
const {snapshotHash}=await load('packages/skill-core/design-system.js');
const defaultConfigs=[{id:'desktop',width:80,height:50},{id:'mobile',width:39,height:84}];
const image=(config,color)=>{const png=new PNG({width:config.width,height:config.height});for(let i=0;i<png.data.length;i+=4){png.data[i]=color;png.data[i+1]=color;png.data[i+2]=color;png.data[i+3]=255;}return PNG.sync.write(png);};
export async function heroStoreFixture({kind='valid',configs=defaultConfigs}={}){
 const root=await mkdtemp(join(tmpdir(),'hh-hero-store-audit-'));
 try{
  const images=configs.flatMap((config,i)=>[image(config,20+i),image(config,230-i)]);
  const url='http://localhost:4321/apps/portal/',commit='a'.repeat(40),snapshot={files:[]};
  const spec=JSON.parse(await readFile(join(repository,'examples/happyclaw-site/experience.json')));
  const check={id:'hero-motion',command:'node',args:['check.mjs','{url}','{out}'],stage:'normal-interaction',method:'Synthetic gate audit only.',limitations:['Synthetic fixture; no real motion or model execution.'],stateIds:['hero'],screenshots:configs.flatMap(c=>[`${c.id}-a.png`,`${c.id}-b.png`])};
  const run=await createRun({spec,url,outputRoot:root});
  await saveOnboarding(run.directory,{config:{designGuidance:{remediation:{profile:'happyhands',surface:'homepage-hero',adoptionReason:'Synthetic gate validation fixture only'}},verificationChecks:[check]},repository:{commit}});
  for(const phase of ['before','after']){
   if(phase==='after'){
    await confirmFinding(run.directory,spec.findings[0].id,'supported','Synthetic gate test only');
    await savePlan(run.directory,spec.findings[0].id);
    const current=await loadRun(run.directory),method=await readRemediation(current);
    const row={status:'preserved',observed:'Synthetic original, no implementation claim',decision:'Preserve fixture without modifying a product',files:[],verification:'Gate test only; no browser execution'};
    await writeFile(join(root,RESULT_FILE),JSON.stringify({contractHash:method.hash,checks:method.contract.rules.map(r=>({...row,ruleId:r.id})),issues:[{...row,id:spec.findings[0].id}]}));
    await saveExecution(run.directory,{exitCode:0,changedFiles:[],remediation:await collectRemediation(current,root,[])});
   }
   const states=configs.map(config=>({stateId:'hero',configurationId:config.id,width:config.width,height:config.height,reached:true,start:{url},finalUrl:kind==='redirect'&&phase==='after'&&config.id===configs.at(-1).id?'http://localhost:4321/apps/setup/':url,screenshot:`${phase}/hero--${config.id}.png`}));
   if(kind==='newly-reachable'&&phase==='before'){delete states.at(-1).screenshot;states.at(-1).reached=false;}
   await mkdir(join(run.directory,phase));
   for(let i=0;i<states.length;i++)if(states[i].screenshot)await writeFile(join(run.directory,states[i].screenshot),images[i*2]);
   await saveCapture(run.directory,phase,{states,designSystemSource:{repositoryCommit:commit,dirty:false,status:'capture-scan-match',snapshotHash:snapshotHash(snapshot)},verificationPreviewFingerprint:'preview',verificationOriginalHashes:Object.fromEntries(states.flatMap((e,i)=>e.screenshot?[[e.screenshot,verificationHash(images[i*2])]]:[])),verificationSource:{version:1,commit,dirty:false,contentHash:'b'.repeat(64),fileCount:1}});
  }
  await saveEvaluation(run.directory,{status:'fixture'});
  let current=await loadRun(run.directory);
  const binding=await verificationBinding(run.directory,current.manifest);
  const contexts=configs.map((config,i)=>({stateId:'hero',configurationId:config.id,motionObserved:true,frameIndexes:[i*2,i*2+1]}));
  if(kind==='desktop-only')contexts.pop();
  if(kind==='newly-reachable')contexts.pop();
  if(kind==='false-motion')contexts[0].motionObserved=false;
  if(kind==='duplicate-images')images[1]=images[0];
  if(kind==='reuse-frame-hashes'){images[2]=images[0];images[3]=images[1];}
  if(kind==='wrong-dimensions')images[1]=image(configs[1],120);
  if(kind==='duplicate-frame-index')contexts[0].frameIndexes=[0,0];
  if(kind==='reuse-frame-pair')contexts.at(-1).frameIndexes=[0,1];
  const result=kind==='missing-runtime'?{status:'pass',kind:'static-still-pair',motionObserved:false,interactionRecords:[]}:{status:'pass',heroMotion:{version:1,contexts}};
  await saveVerificationEvidence(run.directory,{binding,records:[{...check,status:'pass',checkHash:verificationHash(check),result,images}]});
  current=await loadRun(run.directory);
  const bundle=await readVerificationEvidence(run.directory,current.manifest);
  const review={schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'human',name:'Synthetic fixture, no real acceptance',version:'1'},reviewedAt:new Date().toISOString(),verdict:'pass',screenshotRefs:['before','after'].flatMap(phase=>current.manifest.captures[phase].states.map(e=>e.screenshot).filter(Boolean)).concat(bundle.records.flatMap(r=>r.images.map(i=>i.path))),findings:[],rationale:'Synthetic gate audit only.',limitations:['No browser/model was run.'],remediationHash:current.manifest.plan.remediation.hash,verificationDigest:bundle.digest,verificationRefs:['hero-motion'],methodChecks:current.manifest.plan.remediation.ruleIds.flatMap(ruleId=>methodStateEntries(current.manifest).map(s=>({ruleId,stateKey:s.key,status:['redirect','newly-reachable'].includes(kind)&&s.screenshot.includes(configs.at(-1).id)&&ruleId.startsWith('HH-HERO')?'not-applicable':'pass',reason:'Synthetic gate test only.',screenshotRefs:[s.screenshot]})))};
  return {manifest:await saveVisualReview(run.directory,review),bundle};
 }finally{await rm(root,{recursive:true,force:true});}
}
