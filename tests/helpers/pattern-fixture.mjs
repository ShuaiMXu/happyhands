import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import sample from '../../examples/happyclaw-site/experience.json' with {type:'json'};
import {createRun,loadRun,saveOnboarding,saveCapture,confirmFinding,saveEvaluation,saveVisualReview,saveJudgment} from '../../packages/harness-core/store.js';
import {writeRepositoryInputs} from '../../packages/harness-core/repository-inputs.js';
import {repositoryFingerprint} from '../../packages/harness-core/repository-fingerprint.js';
import {sourceFiles} from '../../packages/skill-core/scan.js';
import {snapshotHash,evidenceHash} from '../../packages/skill-core/design-system.js';
export const files=[
  {path:'components/Title.jsx',content:'export default function Title(){return <h2>Title</h2>}'},
  {path:'components/Button.jsx',content:'export default function Button(){return <button>Save</button>}'},
  {path:'components/Panel.jsx',content:'import Title from "./Title.jsx"; import Button from "./Button.jsx"; export default function Panel(){return <article><Title/><Button/></article>}'},
  {path:'PageA.jsx',content:'import Panel from "./components/Panel.jsx"; export default function PageA(){return <Panel/>}'},
  {path:'PageB.jsx',content:'import Panel from "./components/Panel.jsx"; export default function PageB(){return <Panel/>}'}
];
export const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
export function entry(index,{configurationId='desktop',domPath=`html:nth-of-type(1)>body:nth-of-type(1)>article:nth-of-type(${index+1})`,id=`panel-${index}`}={}){
  return {stateId:`panel-${index}`,configurationId,start:{url:'http://localhost/page'},actions:[],reached:true,screenshot:`after/panel-${index}--${configurationId}.png`,
    region:{selector:`#panel-${index}`,source:{file:'components/Panel.jsx',fileHash:evidenceHash(files[2].content),component:'Panel',anchor:'article'},instance:{id,variants:[]},verification:'unique-visible-selector-and-shared-source-anchor'},
    componentInstance:{id,selector:`#panel-${index}`,component:'Panel',variants:[],domPath,verification:'declared-root-instance-stable-at-screenshot-boundary'}};
}
export async function fixture(t,{managed=false}={}){
  const root=await mkdtemp(join(tmpdir(),'pattern-history-'));t.after(()=>{
    if(!root.startsWith(join(tmpdir(),'pattern-history-')))throw Error('Unexpected fixture cleanup path');
    return rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});
  });
  const repo=join(root,'repo'),runs=managed?join(root,'.harness','runs'):join(root,'runs');await mkdir(join(repo,'components'),{recursive:true});await mkdir(runs,{recursive:true});
  for(const file of files)await writeFile(join(repo,file.path),file.content);
  const git=args=>execFileSync('git',args,{cwd:repo,stdio:'pipe'});
  git(['init']);git(['config','user.name','Synthetic Test']);git(['config','user.email','test@example.invalid']);git(['add','.']);git(['commit','-m','Synthetic fixture only']);
  const snapshot=await sourceFiles(repo,{includeDesignDocs:true}),fingerprint=await repositoryFingerprint(repo,{includeFiles:true});
  const parent=await createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:runs,id:'accepted-parent'});
  await saveOnboarding(parent.directory,{repository:{root:repo},config:{repo}});
  for(const phase of ['before','after']){
    if(phase==='after')await confirmFinding(parent.directory,'F1','supported','Synthetic test scope');
    await mkdir(join(parent.directory,phase));
    const states=[entry(0),entry(1)].map(item=>({...item,screenshot:item.screenshot.replace('after/',phase+'/')}));
    for(const item of states)await writeFile(join(parent.directory,item.screenshot),png);
    const incrementalSource=await writeRepositoryInputs(parent.directory,phase,fingerprint);
    await saveCapture(parent.directory,phase,{states,incrementalSource,designSystemSource:{status:'capture-scan-match',snapshotHash:snapshotHash(snapshot),repositoryCommit:fingerprint.commit,dirty:fingerprint.dirty}});
  }
  await saveEvaluation(parent.directory,{status:'synthetic'});
  await saveVisualReview(parent.directory,{schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'model',name:'Synthetic fixture only',version:'test'},reviewedAt:new Date().toISOString(),verdict:'pass',screenshotRefs:['before/panel-0--desktop.png','before/panel-1--desktop.png','after/panel-0--desktop.png','after/panel-1--desktop.png'],findings:[],rationale:'Synthetic evidence fixture, not a real model assessment.',limitations:['No real product or human acceptance.']});
  await saveJudgment(parent.directory,'accept','Synthetic fixture decision only');
  const child=await createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:runs,id:'current-run'});
  await saveOnboarding(child.directory,{parentRunId:'accepted-parent',repository:{root:repo},config:{repo}});
  return {root,repo,snapshot,parent:await loadRun(parent.directory),run:await loadRun(child.directory)};
}
