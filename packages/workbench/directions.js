import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { writeJson } from './jobs.js';

export function directionService(root) {
 const directory=join(root,'.harness','direction-tasks');
 const validId=id=>/^[a-f0-9]{24}$/.test(id||'');
 const validRunId=id=>/^[a-zA-Z0-9_-]{4,100}$/.test(id||'');
 async function reviewContext(review,runId){
  if(!runId)return null;
  if(!validRunId(runId))throw Error('Invalid review run ID');
  const runDirectory=join(root,'.harness','runs',runId);
  const [manifest,spec]=await Promise.all([
   readFile(join(runDirectory,'run.json'),'utf8').then(JSON.parse),
   readFile(join(runDirectory,'experience.json'),'utf8').then(JSON.parse)
  ]).catch(error=>{if(error.code==='ENOENT')throw Error('Review run unavailable');throw error;});
  if(manifest.id!==runId)throw Error('Review run identity mismatch');
  if(!review.projectSource||spec.project?.source!==review.projectSource)throw Error('These directions do not belong to the current project');
  const commit=manifest.onboarding?.repository?.commit;
  if(!commit||!commit.startsWith(review.sourceCommit))throw Error('These directions were prepared for a different source revision');
  const evidenceHash=createHash('sha256').update(JSON.stringify({captures:manifest.captures||null,diagnosis:manifest.diagnosis||null,skills:manifest.skills||[]})).digest('hex');
  return {runId,projectSource:spec.project.source,sourceCommit:commit,evidenceHash};
 }
 async function list(){await mkdir(directory,{recursive:true});return Promise.all((await readdir(directory)).filter(f=>/^[a-f0-9]{24}\.json$/.test(f)).map(async f=>JSON.parse(await readFile(join(directory,f),'utf8'))));}
 async function get(id){if(!validId(id))throw Error('Invalid direction task ID');return JSON.parse(await readFile(join(directory,id+'.json'),'utf8').catch(error=>{if(error.code==='ENOENT')throw Error('任务不存在');throw error;}));}
 async function save(input){
  const review=JSON.parse(await readFile(join(root,'apps/designer/directions/review.json'),'utf8'));
  if(input.reviewId!==review.id)throw Error('Review version mismatch');
  const context=await reviewContext(review,input.runId);
  if(!input.decisions||typeof input.decisions!=='object'||Array.isArray(input.decisions))throw Error('Invalid decisions');
  const allowed=['未决定','接受建议','暂缓','保留现状'];const decisions={};
  for(const key of Object.keys(input.decisions))if(!review.items.some(i=>i.id===key))throw Error('Unknown direction');
  for(const item of review.items){const value=input.decisions[item.id]||{};const decision=value.decision||'未决定';if(!allowed.includes(decision)||typeof (value.reason||'')!=='string'||(value.reason||'').length>4000)throw Error('Invalid decision');decisions[item.id]={decision,reason:value.reason||''};}
  const selected=review.items.filter(i=>decisions[i.id].decision==='接受建议');if(!selected.length)throw Error('请至少接受一项建议');
  const id=createHash('sha256').update(JSON.stringify({review,decisions,context})).digest('hex').slice(0,24);
  await mkdir(directory,{recursive:true});const task={id,reviewId:review.id,project:review.project,createdAt:new Date().toISOString(),status:'awaiting-plan-preparation',executionAuthorized:false,executionAuthorizations:[],sourceCommit:context?.sourceCommit||review.sourceCommit,...(context||{}),decisions,steps:selected.map(i=>({id:i.id,title:i.title,keep:i.keep,proposal:i.change,scope:i.scope,acceptance:i.accept,status:'accepted'})),next:'选择一个已接受方向并确认范围，采集基线并生成完整修改计划；执行仍需单独批准。'};
  try{await writeFile(join(directory,id+'.json'),JSON.stringify(task,null,2),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;return JSON.parse(await readFile(join(directory,id+'.json'),'utf8'));}return task;
 }
 async function authorize(input){
  if(input.confirmed!==true)throw Error('请确认本轮修改范围');
  const task=await get(input.taskId),step=task.steps.find(item=>item.id===input.stepId);
  if(!step)throw Error('只能执行已接受的方向');
  if(task.runId){const review=JSON.parse(await readFile(join(root,'apps/designer/directions/review.json'),'utf8')),context=await reviewContext(review,task.runId);if(context.sourceCommit!==task.sourceCommit||context.evidenceHash!==task.evidenceHash)throw Error('Review evidence changed; generate and confirm fresh directions before execution');}
  const authorization={stepId:step.id,kind:'plan-preparation',confirmedAt:new Date().toISOString(),source:'local-workbench',scope:step.scope,acceptance:step.acceptance};
  const updated={...task,status:'plan-preparation-authorized',executionAuthorized:false,preparedStepId:step.id,planAuthorizations:[...(task.planAuthorizations||[]),authorization],next:'范围已确认；生成完整计划后，请回到主审阅页核对并明确批准执行。'};
  await writeJson(join(directory,task.id+'.json'),updated);
  return updated;
 }
 return {list,get,save,authorize,reviewContext};
}
