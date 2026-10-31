import {createControl} from '../../../packages/ui/controls.js';
import evidenceUrl from './evidence-not-included.svg?url';
import reviewUrl from './review.json?url';

if (new URLSearchParams(location.search).get('case')?.startsWith('run:')) {
 const target = new URL('../', location.href);
 target.search = location.search;
 target.searchParams.set('view', 'directions');
 location.replace(target.href);
} else {

const copy={
 workbench:['设计审阅工作台','Design review workbench'],workspace:['工作空间','Workspace'],report:['审阅报告','Review report'],canvas:['画布','Canvas'],code:['代码改动','Code changes'],directions:['设计方向','Directions'],local:['本地工作台','Local workbench'],pageTitle:['设计方向','Design directions'],language:['语言','Language'],stepReview:['审阅证据','Review evidence'],stepDirection:['确认方向','Confirm direction'],stepExecute:['生成修改计划','Prepare the change plan'],
 headline:["先核对记录中的设计建议，再选择本轮修改范围。", "Check the recorded design suggestions, then choose this change scope."],intro:["这些建议属于记录中的项目和源码版本。确认一个方向后，生成计划并回到统一审阅流程。", "These suggestions belong to the recorded project and source revision. Select a direction, prepare its plan and return to the shared review workflow."],applyAi:['采用 AI 推荐','Apply AI recommendation'],viewEvidence:['查看依据','View evidence'],recommendation:['AI 建议','AI recommendation'],recommendationTitle:['先通过基础质量门槛，再统一品牌与组件。','Pass the foundation quality gate, then unify brand and components.'],recommendationBody:['优先处理可访问性、Foundation 和共享组件；案例与团队证据需等真实资料齐备后发布。','Prioritize accessibility, the Foundation and shared components. Publish case and team evidence only when real supporting material is available.'],boundary:['这是基于当前截图和源码的设计判断，不是用户研究或转化结论。','This is a design judgment based on current captures and source code, not user research or a conversion claim.'],source:['证据范围','Evidence scope'],sourceNote:["覆盖范围以记录中的证据为准。方向选择只用于准备计划，源码修改另需明确批准。", "Coverage follows the recorded evidence. Selecting a direction prepares a plan; source changes require explicit approval."],openCapture:['打开全页手机截图 ↗','Open full-page mobile capture ↗'],decisionLabel:['方向决策','Direction decision'],decisionTitle:['审阅 AI 建议','Review AI recommendations'],saveTitle:['保存本轮方向','Save this direction set'],saveBody:['保存只会生成本地任务，不会修改源码。执行仍需单独确认。','Saving creates a local task without changing source code. Execution still needs a separate confirmation.'],save:['保存选择','Save decisions'],export:['导出 JSON','Export JSON'],initialStatus:['等待你的决定。','Waiting for your decision.'],executionLabel:["修改计划", "Change plan"],executionTitle:["准备一项已确认方向", "Prepare one confirmed direction"],executionBody:["收集当前证据并生成完整计划。在主审阅页核对并同意执行后，再修改、重采集与独立复核。", "Collect current evidence and prepare the full plan. Approve it in the main review before changes, recapture and independent QA."],savedTask:['已保存任务','Saved task'],changeScope:['本轮修改','Change in this run'],confirm:["我确认当前方向及其范围，用于生成修改计划", "I confirm this direction and scope for plan preparation"],start:["生成修改计划", "Prepare the change plan"],
 accepted:['接受建议','Accept'],deferred:['暂缓','Defer'],keep:['保留现状','Keep current'],constraint:['添加约束（可选）','Add a constraint (optional)'],evidence:['观察证据','Evidence'],change:['建议改变','Proposed change'],acceptance:['完成标准','Acceptance'],aiPriority:['AI 优先建议','AI priority'],sourceOriginal:['以下项目判断保留原始中文。','The item-level judgment below is retained in its original Chinese.'],viewResult:['查看结果','View result'],unsupportedTitle:['当前审阅没有可用的设计方向。','No design directions are available for this review.'],unsupportedBody:['这些建议属于另一个项目或源码版本。请先完成当前记录的证据诊断，再生成与它绑定的新方向。','These recommendations belong to another project or source revision. Diagnose the current evidence before generating a new, bound direction set.'],unsupportedStatus:['已阻止保存和源码执行，避免修改错误的项目。','Saving and source execution are blocked to prevent changes to the wrong project.']
};

const params=new URLSearchParams(location.search),reviewCase=params.get('case')||'happyclaw';let stored;
try{stored=localStorage.getItem('creative-os-language')}catch{}
let lang=['zh','en'].includes(params.get('lang'))?params.get('lang'):(stored==='en'?'en':'zh');
const tr=key=>copy[key]?.[lang==='en'?1:0]||key;
function localize(){
 document.documentElement.lang=lang==='en'?'en':'zh-CN';document.title=`HappyHands / ${tr('pageTitle')}`;
 document.querySelectorAll('[data-copy]').forEach(node=>{node.textContent=tr(node.dataset.copy)});document.querySelector('#language').value=lang;
 for(const link of document.querySelectorAll('[data-route]')){const url=new URL(link.getAttribute('href'),location.href);url.searchParams.set('case',reviewCase);url.searchParams.set('lang',lang);link.href=url.pathname+url.search}
 {const active=document.querySelector('[aria-current="page"]'),url=new URL(active.getAttribute('href'),location.href);url.searchParams.set('case',reviewCase);url.searchParams.set('lang',lang);active.href=url.pathname+url.search}
 params.set('lang',lang);history.replaceState(null,'',`?${params}`);
}
localize();
document.querySelector('#language').addEventListener('change',event=>{lang=event.target.value;try{localStorage.setItem('creative-os-language',lang)}catch{}localize();renderItems();renderTasks(tasks);jobs()});
document.querySelector('[data-evidence]').href=evidenceUrl;
const data=await fetch(reviewUrl).then(response=>{if(!response.ok)throw Error('Review unavailable');return response.json()});
document.querySelector('[data-evidence-meta]').textContent=`${data.evidenceDate} / ${data.evidenceRunId} / ${data.sourceCommit}`;
const runId=reviewCase.startsWith('run:')?reviewCase.slice(4):null;
async function resolveDirectionContext(){
 if(!runId)return {supported:reviewCase==='happyclaw',runId:null};
 try{
  const base=`/runs/${encodeURIComponent(runId)}`,[manifest,spec]=await Promise.all([fetch(`${base}/run.json`,{cache:'no-store'}).then(response=>response.ok?response.json():Promise.reject()),fetch(`${base}/experience.json`,{cache:'no-store'}).then(response=>response.ok?response.json():Promise.reject())]);
  const sourceCommit=manifest.onboarding?.repository?.commit||'';
  return {supported:manifest.id===runId&&spec.project?.source===data.projectSource&&sourceCommit.startsWith(data.sourceCommit),runId,manifest,spec,sourceCommit};
 }catch{return {supported:false,runId};}
}
const directionContext=await resolveDirectionContext();
if(directionContext.supported&&directionContext.runId){
 const evidenceLink=document.querySelector('[data-evidence]'),findScreenshot=value=>{if(!value||typeof value!=='object')return null;if(typeof value.screenshot==='string')return value.screenshot;for(const child of Object.values(value)){const found=findScreenshot(child);if(found)return found}return null},screenshot=findScreenshot(directionContext.manifest.captures?.before);
 document.querySelector('#evidence strong').textContent=`${directionContext.manifest.createdAt?.slice(0,10)||data.evidenceDate} / ${directionContext.sourceCommit.slice(0,8)}`;
 if(screenshot)evidenceLink.href=`/runs/${encodeURIComponent(runId)}/${screenshot}`;
}
if(!directionContext.supported){document.querySelector('.hero h1').textContent=tr('unsupportedTitle');document.querySelector('.hero>div>p:not(.wb-eyebrow)').textContent=tr('unsupportedBody');document.querySelector('.recommendation').hidden=true;document.querySelector('#apply-ai').disabled=true;document.querySelector('#export').disabled=true;setTimeout(()=>setStatus(tr('unsupportedStatus')));}
const key='happyhands:directions:'+data.id+':'+(runId||'static');let saved={};
try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{}
const choiceCopy={'接受建议':'accepted','暂缓':'deferred','保留现状':'keep'};let tasks=[];
function setStatus(message){document.querySelector('#status').textContent=message}
function persist(){try{localStorage.setItem(key,JSON.stringify(saved))}catch{setStatus(lang==='en'?'Browser storage is unavailable. Export these decisions before leaving.':'浏览器无法保存，请在离开前导出选择。')}}
const decisionSignature=value=>JSON.stringify(data.items.map(item=>[item.id,value[item.id]?.decision||'未决定',value[item.id]?.reason||'']));
function matchingTasks(){const signature=decisionSignature(saved);return tasks.filter(task=>task.reviewId===data.id&&(directionContext.runId?task.runId===directionContext.runId:!task.runId)&&decisionSignature(task.decisions)===signature)}
function updateWorkflow(){const accepted=data.items.filter(item=>saved[item.id]?.decision==='接受建议').length,save=document.querySelector('#submit'),execution=document.querySelector('.execution-panel'),matches=matchingTasks(),savedCurrent=matches.length>0;save.disabled=!directionContext.supported||!accepted||savedCurrent;execution.hidden=!directionContext.supported||!savedCurrent;document.querySelector('[data-workflow="direction"]').classList.toggle('current',execution.hidden);document.querySelector('[data-workflow="direction"]').classList.toggle('complete',!execution.hidden);document.querySelector('[data-workflow="execute"]').classList.toggle('current',!execution.hidden)}
function update(){const accepted=data.items.filter(item=>saved[item.id]?.decision==='接受建议').length;document.querySelector('#count').textContent=lang==='en'?`${accepted} of ${data.items.length} accepted`:`已接受 ${accepted} / ${data.items.length} 项`;persist();updateWorkflow()}
function fact(label,value){const wrap=createControl('div'),dt=createControl('dt'),dd=createControl('dd');dt.textContent=label;dd.textContent=value;wrap.append(dt,dd);return wrap}
function renderItems(){
 const root=document.querySelector('#items');root.replaceChildren();
 if(!directionContext.supported){const empty=createControl('article'),title=createControl('h3'),body=createControl('p');empty.className='direction-card';title.textContent=tr('unsupportedTitle');body.textContent=tr('unsupportedBody');empty.append(title,body);root.append(empty);updateWorkflow();return;}
 for(const item of data.items){
  const card=createControl('article');card.className='direction-card';const top=createControl('div');top.className='direction-top';const level=createControl('span');level.className='direction-level';level.textContent=item.level;top.append(level);
  if(['foundation','tokens','components'].includes(item.id)){const tag=createControl('span');tag.className='ai-tag';tag.textContent=tr('aiPriority');top.append(tag)}
  const title=createControl('h3');title.textContent=item.title;const judgment=createControl('p');judgment.className='direction-judgment';judgment.textContent=item.judgment;const sourceLanguage=createControl('small');sourceLanguage.textContent=lang==='en'?tr('sourceOriginal'):'';
  const facts=createControl('dl');facts.className='direction-facts';facts.append(fact(tr('evidence'),item.evidence),fact(tr('change'),item.change),fact(tr('acceptance'),item.accept));
  const controls=createControl('div');controls.className='decision-buttons';for(const decision of Object.keys(choiceCopy)){const button=createControl('button');button.type='button';button.textContent=tr(choiceCopy[decision]);button.setAttribute('aria-pressed',String(saved[item.id]?.decision===decision));button.onclick=()=>{saved[item.id]={...saved[item.id],decision,at:new Date().toISOString()};renderItems();update()};controls.append(button)}
  const details=createControl('details'),summary=createControl('summary'),textarea=createControl('textarea');summary.textContent=tr('constraint');textarea.value=saved[item.id]?.reason||'';textarea.maxLength=4000;textarea.addEventListener('input',()=>{saved[item.id]={...saved[item.id],reason:textarea.value,at:new Date().toISOString()};update()});details.append(summary,textarea);
  card.append(top,title,judgment,sourceLanguage,facts,controls,details);root.append(card);
 }
 update();
}
renderItems();
document.querySelector('#apply-ai').onclick=()=>{for(const item of data.items)saved[item.id]={...saved[item.id],decision:['foundation','tokens','components'].includes(item.id)?'接受建议':'暂缓',at:new Date().toISOString()};renderItems();setStatus(lang==='en'?'AI recommendations applied. Review the cards, then save this direction set.':'已采用 AI 推荐。请审阅下方选择，再保存本轮方向。');document.querySelector('#items').scrollIntoView({behavior:'smooth',block:'start'})};
document.querySelector('#export').onclick=()=>{if(!directionContext.supported)return setStatus(tr('unsupportedStatus'));const blob=new Blob([JSON.stringify({...data,runId:directionContext.runId,sourceCommit:directionContext.sourceCommit||data.sourceCommit,status:'direction-selection-only',executionAuthorized:false,decisions:saved},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=createControl('a');anchor.href=url;anchor.download=data.id+'-decisions.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
function fillSteps(){const form=document.querySelector('#exec'),stepSelect=form.elements.stepId;stepSelect.replaceChildren();for(const step of tasks.find(task=>task.id===form.elements.taskId.value)?.steps||[])stepSelect.add(new Option(step.title,step.id))}
function renderTasks(value){
 tasks=value||[];const target=document.querySelector('#tasks'),form=document.querySelector('#exec'),taskSelect=form.elements.taskId,previous=taskSelect.value;target.replaceChildren();taskSelect.replaceChildren();
 for(const task of matchingTasks().reverse()){const box=createControl('article'),heading=createControl('h3'),note=createControl('p');heading.textContent=(lang==='en'?'Current task ':'当前任务 ')+task.id.slice(0,8);note.textContent=task.next;box.append(heading,note);target.append(box);taskSelect.add(new Option(task.project+' / '+task.id.slice(0,8),task.id))}
 if([...taskSelect.options].some(option=>option.value===previous))taskSelect.value=previous;fillSteps();form.querySelector('button').disabled=!taskSelect.value;updateWorkflow();
}
async function loadTasks(){const response=await fetch('/api/workbench/directions');if(!response.ok)throw Error('Task service unavailable');tasks=await response.json();renderTasks(tasks)}
document.querySelector('#exec').elements.taskId.onchange=fillSteps;
document.querySelector('#submit').onclick=async()=>{const button=document.querySelector('#submit');button.disabled=true;try{if(!directionContext.supported)throw Error(tr('unsupportedStatus'));const response=await fetch('/api/workbench/directions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviewId:data.id,runId:directionContext.runId,decisions:saved})}),result=await response.json();if(!response.ok)throw Error(result.error);await loadTasks();setStatus(lang==='en'?'Saved locally. Choose one accepted direction below when you are ready to execute.':'已保存到本地。准备执行时，请在下方选择一个已接受方向。');document.querySelector('.execution-panel').scrollIntoView({behavior:'smooth',block:'start'})}catch(error){setStatus(error.message)}finally{updateWorkflow()}};
async function jobs(){try{const response=await fetch('/api/workbench/jobs');if(!response.ok)return;const list=await response.json(),target=document.querySelector('#jobs'),visibleTasks=new Set(matchingTasks().map(task=>task.id));target.replaceChildren();for(const job of list.filter(item=>visibleTasks.has(item.directionTaskId))){const row=createControl('p');row.dataset.status=job.status;row.textContent=job.directionStepId+' / '+job.status+' / '+(job.error||job.stage);const resultRunId=job.result?.runId||job.resultRunId||job.runId;if(resultRunId){const link=createControl('a');link.textContent=tr('viewResult');link.href='../?case='+encodeURIComponent('run:'+resultRunId)+'&view=canvas&lang='+lang;row.append(link)}target.append(row)}}catch{}}
document.querySelector('#exec').onsubmit=async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;try{const values=Object.fromEntries(new FormData(event.currentTarget)),response=await fetch('/api/workbench/directions/execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,confirmed:true})}),result=await response.json();if(!response.ok)throw Error(result.error);setStatus((lang==='en'?'Queued plan preparation: ':'已进入计划生成队列：')+result.id);await Promise.all([loadTasks(),jobs()])}catch(error){setStatus(error.message)}finally{button.disabled=false}};
loadTasks().catch(()=>setStatus(lang==='en'?'Local task service is unavailable. Decisions remain in this browser.':'本地任务服务未连接，选择仍保存在当前浏览器。'));
jobs();setInterval(()=>{if(!document.hidden)jobs()},5000);
}
