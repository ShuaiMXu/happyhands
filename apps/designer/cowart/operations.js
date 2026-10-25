import { createReviewForm } from './review-form.js';
import {judgmentWithdrawalView} from '../judgment-withdrawal-view.js';
import { t, getLanguage } from '../i18n.js';
export async function workbenchApi(path, input) {
  const response = await fetch(`/api/workbench/${path}`, input === undefined ? {cache:'no-store'} : { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input) });
  const data = await response.json(); if(!response.ok)throw new Error(data.error || `HTTP ${response.status}`); return data;
}
export function reviewLink(id, view='list') { return `?case=${encodeURIComponent('run:' + id)}&view=${view}&lang=${getLanguage()}`; }
export function jobBelongsToRun(job, runId) { return !runId || [job.runId, job.resultRunId, job.originRunId, job.result?.runId].includes(runId); }
export function jobLabel(job) {
  const parts=[t(job.kind),t(job.status),t(job.stage || '')];
  if(job.stage==='model-diagnosis'&&Number.isInteger(job.batchIndex)&&Number.isInteger(job.batchCount))parts.push(`${t('原图批次')} ${job.batchIndex}/${job.batchCount}`);
  return parts.filter(Boolean).join(' / ');
}
export function onboardingRecovery(job) {
  const failed = job.kind === 'onboard' && ['failed','cancelled','interrupted'].includes(job.status);
  return { reconnect: failed, configPath: failed ? job.configPath || '' : '', openReview: !failed || job.reviewAvailable === true };
}
export function openOperations(run, selection = {}) {
  document.getElementById('workbench-operations')?.close();
  const dialog=document.createElement('dialog');dialog.id='workbench-operations';dialog.className='wb-dialog workbench-operations';
  const heading=document.createElement('h2');heading.textContent=t('项目与任务');
  const close=document.createElement('button');close.textContent=t('关闭');close.className='operations-close';close.onclick=()=>dialog.close();
  const status=document.createElement('p');status.setAttribute('role','status');
  const content=document.createElement('div'),jobList=document.createElement('div');jobList.className='operations-jobs';
  dialog.append(heading,close,status,content,jobList);
  let closed=false,timer,refreshing=false,pendingId=null,setupVersion=0;
  let connectionRunId=run?.manifest.id;
  let connectionReady=Promise.resolve();
  const submittedJobs=new Set();
  function label(title,node){const wrap=document.createElement('label');wrap.textContent=t(title);node.setAttribute('aria-label',t(title));wrap.append(node);return wrap;}
  function field(title,multiline=false){const input=document.createElement(multiline?'textarea':'input');content.append(label(title,input));return input;}
  function button(title,fn){const el=document.createElement('button');el.type='button';el.textContent=t(title);el.onclick=async()=>{el.disabled=true;status.textContent=t('正在执行…');try{await fn();await refresh();}catch(error){status.textContent=t('操作失败')+': '+error.message;}finally{el.disabled=Boolean(pendingId);}};content.append(el);return el;}
  const setup=document.createElement('details');setup.dataset.projectSetup='true';
  const setupTitle=document.createElement('summary');setupTitle.textContent=t('连接项目');setup.append(setupTitle);setup.open=!run||selection.connectionOnly;content.append(setup);
  const intro=document.createElement('p');intro.textContent=t('选择项目，说明想检查的任务。连接后会采集页面并整理问题；修改代码前会先请你确认计划。');setup.append(intro);
  const repo=field('项目仓库目录'),task=field('关键任务');task.placeholder=t('例如：手机用户打开菜单并找到快速开始');
  const designSources=field('设计规范来源（仓库相对路径，每行一项）',true);
  designSources.placeholder='DESIGN.md\nsrc/styles/tokens.css\nsrc/components';
  if(selection.siteHandoff){
    repo.value=selection.siteHandoff.repo;task.value=selection.siteHandoff.task;designSources.value=selection.siteHandoff.designSources.join('\n');
    repo.readOnly=true;task.readOnly=true;designSources.readOnly=true;
    intro.textContent=t('已收到官网携带的项目与设计来源。确认后才会读取源码和开始采集；不会自动批准设计规范或修改代码。');
  }else designSources.value=(run?.manifest.onboarding?.config?.designSourcePaths||[]).join('\n');
  if(selection.resumeJobId){pendingId=selection.resumeJobId;submittedJobs.add(pendingId);setup.open=false;}
  const connection=document.createElement('p');connection.setAttribute('role','status');content.append(connection);
  const advanced=document.createElement('details'),advancedTitle=document.createElement('summary');advancedTitle.textContent=t('高级：预览与项目信息');advanced.append(advancedTitle);content.append(advanced);
  const preview=field('预览地址'),command=field('预览启动程序'),args=field('启动参数 JSON');
  preview.placeholder='http://127.0.0.1:3000';command.placeholder='npm';args.placeholder='["run","dev","--","--port","3000"]';
  const name=field('项目名称'),goal=field('产品目标'),audience=field('目标用户');
  for(const node of [preview,command,args,name,goal,audience])advanced.append(node.parentElement);
  const designSettings=document.createElement('details'),designTitle=document.createElement('summary');designTitle.textContent=t('设计方法与审美设置');designSettings.append(designTitle);advanced.append(designSettings);
  const note=document.createElement('p');note.textContent=t('完整 OJO、Taste、Impeccable 已接入。这里选择参考方法，源码修改仍需确认范围和计划。');designSettings.append(note);
  function designSelect(title,values){const select=document.createElement('select');for(const [value,text] of values){const option=document.createElement('option');option.value=value;option.textContent=t(text);select.append(option);}designSettings.append(label(title,select));return select;}
  const designTaste=designSelect('Taste 使用方式',[['existing','保留现有产品风格'],['app-screen','应用界面与报告'],['public-page','公开网站艺术方向'],['dials-v1','布局、动效与密度参数']]);
  const designIntent=designSelect('本轮设计重点',[['polish','细节打磨'],['layout','布局与层级'],['animate','动效与反馈']]);
  const dialFields={},dialGroup=document.createElement('div');designSettings.append(dialGroup);
  for(const [key,title] of [['DESIGN_VARIANCE','布局变化（1–10）'],['MOTION_INTENSITY','动效强度（1–10）'],['VISUAL_DENSITY','页面密度（1–10）']]){const input=document.createElement('input');input.type='number';input.min='1';input.max='10';input.placeholder=t('留空保留原技能默认值');dialFields[key]=input;dialGroup.append(label(title,input));}
  const initialDesign=run?.manifest.onboarding?.config?.designGuidance;
  if(initialDesign){designTaste.value=initialDesign.taste;designIntent.value=initialDesign.intent;for(const [key,input] of Object.entries(dialFields))input.value=initialDesign.dials?.[key]??'';}
  designTaste.onchange=()=>{dialGroup.hidden=designTaste.value!=='dials-v1';};designTaste.onchange();
  const designProfile=()=>({taste:designTaste.value,intent:designIntent.value,...(designTaste.value==='dials-v1'?{dials:Object.fromEntries(Object.entries(dialFields).filter(([,input])=>input.value!=='').map(([key,input])=>[key,Number(input.value)]))}:{})});
  const project=selection.project||run?.spec.project;
  if(project){task.value=project.task||'';name.value=project.name||'';goal.value=project.goal||'';audience.value=project.audience||'';}
  let detectedRepository='',manualPreview=false;
  for(const node of [preview,command,args])node.addEventListener('input',()=>{manualPreview=true;});
  async function inspectSetup(){
    const directory=repo.value.trim();if(!directory||directory===detectedRepository)return;
    const version=++setupVersion;connection.textContent=t('正在读取项目配置…');
    try{
      const result=await workbenchApi('inspect-project',{repo:directory});
      if(closed||version!==setupVersion||repo.value.trim()!==directory)return;
      detectedRepository=directory;
      if(!name.value.trim())name.value=result.name;
      if(result.detected){
        if(!manualPreview){preview.value=result.url;command.value=result.start.command;args.value=JSON.stringify(result.start.args);}
        connection.textContent=t`已识别 ${result.framework} 项目，将使用项目的 dev 脚本启动本地预览。`;
        if(!result.dependenciesInstalled)connection.textContent+=' '+t('项目依赖尚未安装，请先安装依赖再开始审阅。');
      }else{advanced.open=true;connection.textContent=t('未能自动识别预览方式，请在高级设置中填写。');}
    }catch(error){if(!closed&&version===setupVersion){advanced.open=true;connection.textContent=t('无法读取项目配置')+': '+error.message;}}
  }
  repo.addEventListener('change',()=>{manualPreview=false;detectedRepository='';inspectSetup();});
  // Await discovery before collecting values; typing a different path cannot reuse old settings.
  async function started(job){
    submittedJobs.add(job.id);
    pendingId=job.id;status.textContent=t('正在采集页面并整理问题，请稍候。');
    for(const input of setup.querySelectorAll('input,textarea,select,button'))input.disabled=true;
    if(selection.onStarted){await selection.onStarted(job);dialog.close();}
  }
  const start=button('连接并开始审阅',async()=>{
    await connectionReady;
    const directory=repo.value.trim();
    await inspectSetup();
    if(repo.value.trim()!==directory)throw new Error(t('项目目录已变化，请重新读取配置后继续。'));
    const result=await workbenchApi('configure',{runId:connectionRunId,...(selection.siteHandoff?{siteHandoff:selection.siteHandoff}:{}),designSourcePaths:designSources.value.split(/\r?\n/).map(path=>path.trim()).filter(Boolean),designGuidance:designProfile(),repo:repo.value,task:task.value,name:name.value,goal:goal.value,audience:audience.value,url:preview.value,...(command.value.trim()?{start:{command:command.value.trim(),args:JSON.parse(args.value||'[]')}}:{})});
    if(connectionRunId){await started(await workbenchApi('onboard',{configPath:result.configPath,originRunId:connectionRunId}));}
    else await started(result);
  });
  start.className='button primary project-start';
  const configSection=document.createElement('details'),configTitle=document.createElement('summary');configTitle.textContent=t('已有配置文件');configSection.append(configTitle);content.append(configSection);
  const config=field('项目配置文件');config.placeholder='C:/projects/my-app/project.json';configSection.append(config.parentElement);
  configSection.append(button('使用配置文件开始审阅',async()=>started(await workbenchApi('onboard',{configPath:config.value,...(task.value.trim()?{task:task.value.trim()}:{}),...(run?{originRunId:run.manifest.id}:{})}))));
  if(selection.configPath){config.value=selection.configPath;configSection.open=true;}
  for(const node of [repo.parentElement,task.parentElement,designSources.parentElement,connection,advanced,start,configSection])setup.append(node);
  if(run){
    connectionReady=workbenchApi('state?run='+encodeURIComponent(run.manifest.id)).then(state=>{
      if(closed||repo.value.trim())return;
      if(state.project){repo.value=state.project.repository.root;preview.value=state.project.preview.url||'';manualPreview=true;detectedRepository=repo.value;}
      else connection.textContent=t('尚未关联本地源码');
    }).catch(()=>{connectionRunId=undefined;if(!closed)connection.textContent=t('历史证据没有本地运行记录，连接后会从当前源码开始新的审阅。');});
  }
  if(run&&!selection.connectionOnly){
    const withdrawal=judgmentWithdrawalView(run,input=>workbenchApi('withdraw-judgment',input));if(withdrawal)content.append(withdrawal);
    const hint=document.createElement('p');hint.textContent=t('范围确认、计划执行和最终决定统一在当前审阅顶部完成。');content.append(hint);
    button('返回当前审阅',()=>{dialog.close();location.href=reviewLink(run.manifest.id,'canvas');});
    button('设计基础与版本治理',()=>{dialog.close();location.href=reviewLink(run.manifest.id)+'#foundation-title';});
    workbenchApi('history?run='+encodeURIComponent(run.manifest.id)).then(items=>{if(closed)return;const history=document.createElement('details'),title=document.createElement('summary');title.textContent=t('项目历史');history.append(title);for(const item of items){const link=document.createElement('a');link.href=reviewLink(item.id,'canvas');link.textContent=item.createdAt.slice(0,10)+' · '+item.id+' · '+(item.judgmentWithdrawal?t('本轮决定已撤回'):item.judgment?t(item.judgment.decision):t('尚未审阅'));const row=document.createElement('p');row.append(link);history.append(row);}content.append(history);}).catch(()=>{});
    const manual=document.createElement('details'),manualTitle=document.createElement('summary');manualTitle.textContent=t('高级：人工复核与补充记录');manual.append(manualTitle);content.append(manual);
    const selectedAttachments=new Set();
    const reviewForm=createReviewForm(run,selectedAttachments);content.append(reviewForm.element);
    button('提交独立复核',()=>workbenchApi('action',{runId:run.manifest.id,action:'attest',review:reviewForm.read()}));
    const importSection=document.createElement('details'),importTitle=document.createElement('summary');importTitle.textContent=t('高级：导入复核 JSON');importSection.append(importTitle);content.append(importSection);
    const review=field('独立视觉复核 JSON',true);review.placeholder=t('粘贴独立复核者提供的完整记录');importSection.append(review.parentElement);
    const attachments=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=t('引用画布批注');attachments.append(legend);content.append(attachments);
    workbenchApi('state?run='+encodeURIComponent(run.manifest.id)).then(state=>{
      for(const item of state.reviewAttachments || []) {
        const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.onchange=()=>checkbox.checked?selectedAttachments.add(item.id):selectedAttachments.delete(item.id);
        const row=label(item.notes,checkbox),link=document.createElement('a');link.textContent=t('查看批注图');link.href=`/runs/${encodeURIComponent(run.manifest.id)}/${item.path}`;link.target='_blank';link.rel='noopener';row.append(link);attachments.append(row);
      }
      if(!state.reviewAttachments?.length){const empty=document.createElement('p');empty.textContent=t('在画布中保存批注后，可在这里引用。');attachments.append(empty);}
    }).catch(error=>{status.textContent=error.message;});
    button('导入视觉复核',()=>{const record=JSON.parse(review.value);record.attachmentRefs=[...new Set([...(record.attachmentRefs||[]),...selectedAttachments])];return workbenchApi('action',{runId:run.manifest.id,action:'attest',review:record});});
    importSection.append(content.lastElementChild);
    for(let node=manual.nextElementSibling;node;){const next=node.nextElementSibling;manual.append(node);node=next;}
    const memorySection=document.createElement('details'),memoryTitle=document.createElement('summary');memoryTitle.textContent=t('项目经验候选');memorySection.append(memoryTitle);content.append(memorySection);
    const principle=field('建议保留的原则',true),context=field('适用范围',true),exceptions=field('不适用的情况（可选，每行一项）',true),memoryReason=field('经验记录理由',true);
    memorySection.append(principle.parentElement,context.parentElement,exceptions.parentElement,memoryReason.parentElement);
    const memoryList=document.createElement('div');memorySection.append(memoryList);
    async function refreshMemory(){
      try{
        const items=await workbenchApi('memory?run='+encodeURIComponent(run.manifest.id));memoryList.replaceChildren();
        for(const item of items){
          const row=document.createElement('article'),body=document.createElement('p');
          body.textContent=item.principle+' · '+t(item.status)+' · '+item.source.runId;row.append(body);
          const scope=document.createElement('p');scope.textContent=t('适用范围')+'：'+item.context;row.append(scope);
          for(const exception of item.exceptions||[]){const note=document.createElement('p');note.textContent=t('不适用的情况')+'：'+exception;row.append(note);}
          if(item.retirement){const note=document.createElement('p');note.textContent=item.retirement.reason;row.append(note);}
          if(item.sourceWithdrawal){const note=document.createElement('p');note.textContent=t('来源决定已撤回')+'：'+item.sourceWithdrawal.reason;row.append(note);}
          if(item.runException){const note=document.createElement('p');note.textContent=t(item.runException.decision==='exclude'?'仅本轮不适用':'本轮已恢复使用')+'：'+item.runException.reason;row.append(note);}
          const choices=item.status==='candidate'?['approve','reject','retire']:item.status==='approved'?['retire']:[];
          if(item.status==='approved'&&!run.manifest.executionContext&&!run.manifest.execution&&!run.manifest.captures.after&&!run.manifest.judgment)choices.push('exception');
          for(const verdict of choices){
            const control=document.createElement('button');
            control.textContent=t(verdict==='exception'?(item.runException?.decision==='exclude'?'恢复本轮使用':'仅本轮不适用'):verdict==='approve'?'批准原则':verdict==='reject'?'拒绝原则':item.status==='candidate'?'撤回候选':'停用原则');
            control.onclick=async()=>{control.disabled=true;try{await workbenchApi('memory',{runId:run.manifest.id,id:item.id,principleHash:item.contentHash,action:verdict==='exception'?'exception':verdict==='retire'?'retire':'decide',decision:verdict==='exception'?(item.runException?.decision==='exclude'?'apply':'exclude'):verdict,reason:memoryReason.value});if(verdict==='exception')status.textContent=t('本轮例外已记录，请重新生成计划。');await refreshMemory();}catch(error){status.textContent=t(error.message);}finally{control.disabled=false;}};
            row.append(control);
          }
          memoryList.append(row);
        }
      }catch(error){memoryList.textContent=error.message;}
    }
    memorySection.append(button('提出经验候选',async()=>{await workbenchApi('memory',{runId:run.manifest.id,action:'propose',principle:principle.value,context:context.value,exceptions:exceptions.value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean),reason:memoryReason.value});await refreshMemory();}));
    memorySection.addEventListener('toggle',()=>{if(memorySection.open)refreshMemory();});
  }
  async function refresh(){
    if(closed||refreshing)return;refreshing=true;
    try{
      const all=await workbenchApi('jobs');if(closed)return;
      if(pendingId){const pending=all.find(job=>job.id===pendingId);if(pending&&!['queued','running','cancelling'].includes(pending.status)){
        const id=pending.result?.runId||pending.resultRunId||pending.runId;
        pendingId=null;for(const input of setup.querySelectorAll('input,textarea,select,button'))input.disabled=false;
        if(pending.status==='succeeded'&&id){dialog.close();location.href=reviewLink(id,pending.kind==='onboard'?'directions':'canvas');return;}
        status.textContent=t('操作失败')+': '+(pending.error||t(pending.status));
      }}
      jobList.replaceChildren();
      for(const job of all.filter(item=>run?jobBelongsToRun(item,run.manifest.id)||submittedJobs.has(item.id):submittedJobs.has(item.id)).slice(0,15)){
        const row=document.createElement('article'),name=document.createElement('p');name.textContent=jobLabel(job);row.append(name);
        if(job.result?.reviewError){const warning=document.createElement('p');warning.textContent=t('AI 复核未完成，可重试')+': '+job.result.reviewError;row.append(warning);}
        if(job.error){const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('p');summary.textContent=t('失败详情');body.textContent=job.error;details.append(summary,body);row.append(details);}
        if(['queued','running'].includes(job.status)){const cancel=document.createElement('button');cancel.textContent=t('取消任务');cancel.onclick=()=>workbenchApi('cancel',{id:job.id}).then(refresh).catch(error=>{status.textContent=error.message;});row.append(cancel);}
        const id=job.result?.runId||job.resultRunId||job.runId,recovery=onboardingRecovery(job);
        if(recovery.reconnect){const retry=document.createElement('button');retry.textContent=t('修复连接后重新审阅');retry.onclick=()=>{dialog.close();openOperations(null,{configPath:recovery.configPath});};row.append(retry);}
        if(id&&!['queued','running'].includes(job.status)&&recovery.openReview){const link=document.createElement('a');link.textContent=t('打开审阅报告');link.href=reviewLink(id,'canvas');row.append(link);}
        for(const artifact of job.result?.artifacts||[]){const link=document.createElement('a');link.href=artifact.url;link.textContent=artifact.name;link.target='_blank';link.rel='noopener';row.append(link,document.createElement('br'));}
        jobList.append(row);
      }
    }catch(error){if(!closed)status.textContent=error.message;}finally{refreshing=false;}
  }
  dialog.addEventListener('close',()=>{closed=true;++setupVersion;clearInterval(timer);dialog.remove();});
  document.body.append(dialog);dialog.showModal();refresh();timer=setInterval(refresh,2000);
}
