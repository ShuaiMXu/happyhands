import {createControl} from '../../packages/ui/controls.js';
import {isReportableFinding} from '../../packages/harness-core/finding-admission.js';
import { t, getLanguage } from './i18n.js';
import { stageLabel, workflowReason } from './workflow-copy.js';
import { primaryActionForStage } from '../../packages/harness-core/primary-action.js';
import { exportedReviewState } from './cowart/review-state.js';
import { workbenchApi, openOperations } from './cowart/operations.js';
import { reviewSteps, reviewStep } from './review-journey.js';
import {findingSummary} from './finding-summary.js';

const node = (tag, text) => { const element=createControl(tag);if(text)element.textContent=t(text);return element; };

// The same controller is used by page review, report and code review.
export function mountReviewAction(container, run, { onChanged = () => location.reload(), onFoundation, getFindingId, getRepairFindingId, poll = true } = {}) {
  let state=exportedReviewState(run), disposed=false, submitting=false, pendingId=null, timer=null, refreshing=false, dialog=null, reviewErrorMessage=null;
  container.className='review-primary-action';container.setAttribute('aria-label',t('本阶段下一步'));
  const copy=node('div'),journey=node('ol'),heading=node('strong'),description=node('p'),controls=node('div'),primary=node('button'),status=node('p');
  journey.className='review-journey';journey.setAttribute('aria-label',t('审阅进度'));
  primary.type='button';primary.className='button primary review-action-button';primary.dataset.reviewPrimary='true';
  status.setAttribute('role','status');status.className='review-action-status';copy.append(journey,heading,description);controls.append(primary);container.replaceChildren(copy,controls,status);

  function update(next) {
    state=next;
    const action=primaryActionForStage(state.workflow?.stage,{...run.manifest,judgment:state.judgment||run.manifest.judgment});
    const step=reviewStep(state.workflow?.stage,state.readOnly);
    journey.replaceChildren(...reviewSteps.map((label,index)=>{const item=node('li');item.textContent=t(label);if(index===step)item.setAttribute('aria-current','step');return item;}));
    const noFindings=action?.kind==='repair'&&!(run.diagnosis?.findings||run.spec.findings).filter(isReportableFinding).length;
    const busy=Boolean(pendingId)||(state.jobs||[]).some(job=>['queued','running','cancelling'].includes(job.status));
    heading.textContent=state.readOnly?t('先连接原项目'):stageLabel(state.workflow?.stage||'needs-baseline');
    description.textContent=state.readOnly?t('这是历史导出证据。连接原项目后，才能继续当前审阅。'):t(action?.description||'重新读取当前证据后继续。');
    if(!state.readOnly&&state.workflow?.reason&&state.workflow.stage!=='awaiting-confirmation')description.textContent+=' '+workflowReason(state.workflow,run.manifest);
    if(noFindings&&!state.readOnly){heading.textContent=t('尚无已录入问题');description.textContent=t('本轮尚未形成有来源的问题。补充想检查的任务或页面范围后，再开始审阅。');}
    primary.textContent=t(submitting||busy?'任务正在进行':state.readOnly?'连接原项目':noFindings?'补充任务或检查范围':action?.label||'重新读取审阅');
    primary.disabled=submitting||busy||(!state.readOnly&&!action);
    const latest=(state.jobs||[])[0];
    const reviewPending=['needs-visual-qa','visual-qa-needs-evidence','visual-qa-failed','needs-specialist-verification'].includes(state.workflow?.stage);
    if(!reviewPending&&reviewErrorMessage&&status.textContent===reviewErrorMessage){status.textContent='';reviewErrorMessage=null;}
    if(!submitting&&!pendingId&&!status.textContent&&latest){
      if(latest.result?.reviewError&&reviewPending){reviewErrorMessage=t('AI 复核未完成，可重试')+': '+latest.result.reviewError;status.textContent=reviewErrorMessage;}
      else if(['failed','cancelled','interrupted'].includes(latest.status))status.textContent=t('操作失败')+': '+(latest.error||t(latest.status));
    }
  }

  async function refresh() {
    if(disposed||refreshing)return;
    refreshing=true;
    try {
      let next;
      try { next={...await workbenchApi('state?run='+encodeURIComponent(run.manifest.id)),localAvailable:true}; }
      catch(error) {
        if(!pendingId)throw error;
        next={...exportedReviewState(run),jobs:(await workbenchApi('jobs')).filter(job=>job.id===pendingId)};
      }
      if(disposed)return;
      if(pendingId) {
        const job=(next.jobs||[]).find(item=>item.id===pendingId);
        if(job&&!['queued','running','cancelling'].includes(job.status)) {
          pendingId=null;
          if(job.status==='succeeded') {dialog?.close();await onChanged({runId:job.result?.runId||job.runId||run.manifest.id});return;}
          else {status.textContent=t('操作失败')+': '+(job.error||t(job.status));if(dialog)dialog.querySelector('[role=status]').textContent=status.textContent;}
        }
      }
      update({...next,readOnly:!next.project});
    } catch { if(!pendingId)update(exportedReviewState(run)); }
    finally {refreshing=false;}
  }

  async function submit(input, expectedStage) {
    if(submitting||disposed)return;
    submitting=true;update(state);status.textContent=t('正在执行…');
    try {
      const job=await workbenchApi('advance',{runId:run.manifest.id,expectedStage,language:getLanguage(),...input});
      pendingId=job.id;dialog?.close();status.textContent=t('任务已提交，可在下方查看进度。');
    } catch(error) {status.textContent=t('操作失败')+': '+t(error.message);if(dialog)dialog.querySelector('[role=status]').textContent=status.textContent;}
    finally {submitting=false;update(state);await refresh();}
  }

  function showForm(action, findingId) {
    dialog?.close();
    const sheet=node('dialog');sheet.className='wb-dialog review-action-dialog';sheet.setAttribute('aria-label',t(action.label));dialog=sheet;
    const title=node('h2',action.label),close=node('button','关闭'),form=node('form'),error=node('p');
    close.type='button';close.className='review-action-close';close.onclick=()=>sheet.close();error.setAttribute('role','status');
    sheet.append(title,close,node('p',action.description),form,error);
    const fields={};
    function field(label,element){element.setAttribute('aria-label',t(label));const wrap=node('label',label);wrap.append(element);form.append(wrap);return element;}
    if(action.kind==='judge') {
      const qa=state.reviews?.find(item=>item.skillId==='visual-qa-evaluator');
      form.append(node('p',qa?.rationale||''));
      if(qa){const details=node('details'),summary=node('summary','查看证据与限制');details.append(summary);for(const ref of qa.screenshotRefs||[]){const link=node('a');link.href=`${run.base}/${ref}`;link.textContent=ref;link.target='_blank';link.rel='noopener';details.append(link);}for(const limitation of qa.limitations||[])details.append(node('p',limitation));form.append(details);}
      const choice=node('select');fields.decision=field('决定',choice);choice.required=true;
      for(const [value,label] of [['','请选择决定'],...(action.stage==='visual-qa-failed'?[['reject','拒绝'],...(qa?.reviewer?.type==='model'?[['re-review','提交反证重新复核']]:[])]:[['accept','接受'],['reject','拒绝']])]){const option=node('option',label);option.value=value;choice.append(option);}
      fields.reason=field('人工判断理由',node('textarea'));fields.reason.required=false;fields.reason.rows=3;
      const syncReason=()=>{fields.reason.required=choice.value==='reject'||choice.value==='re-review';fields.reason.placeholder=t(fields.reason.required?'请说明原因':'选填');};
      choice.addEventListener('change',syncReason);syncReason();
      if(action.stage==='visual-qa-failed'){
        const evidence=node('fieldset');evidence.hidden=true;evidence.append(node('legend','选择新的补充证据'));form.append(evidence);fields.evidence=[];
        const all=state.reviewAttachments||run.manifest.reviewAttachments||[],used=new Set(qa?.attachmentRefs||[]),hashes=new Set(all.filter(item=>used.has(item.id)).map(item=>item.imageHash));
        for(const item of all.filter(item=>!used.has(item.id)&&!hashes.has(item.imageHash))){const input=node('input');input.type='checkbox';input.value=item.id;fields.evidence.push(input);const label=node('label',item.notes);label.append(input);evidence.append(label);}
        evidence.append(node('p','反证需说明操作方法、实际结果和限制；原失败记录会保留，新复核通过后再由你判断。'));
        const source=node('select');fields.evidenceSource=source;
        const sourceLabel=node('label','反证对应的原始截图');sourceLabel.append(source);evidence.append(sourceLabel);
        for(const ref of qa?.screenshotRefs||[]){if(!/^(before|after)\/[a-z0-9][a-z0-9_-]*\.png$/.test(ref))continue;const option=node('option');option.value=ref;option.textContent=ref;source.append(option);}
        fields.evidenceFile=node('input');fields.evidenceFile.type='file';fields.evidenceFile.accept='image/png';const upload=node('label','或上传新的 PNG 反证');upload.append(fields.evidenceFile);evidence.append(upload);
        choice.onchange=()=>{const retry=choice.value==='re-review';evidence.hidden=!retry;save.textContent=t(retry?'提交反证重新复核':'记录决定');};
      }

    }
    if(action.kind==='baseline'){fields.reason=field('起始界面缺失原因',node('textarea'));fields.reason.required=true;fields.reason.rows=3;}
    if(action.kind==='restart'){fields.confirmed=field('我已检查源码和保留的改动，可以重新采集当前项目',node('input'));fields.confirmed.type='checkbox';fields.confirmed.required=true;}
    const save=node('button',action.kind==='judge'?'记录决定':action.label);save.type='submit';save.className='button primary';form.append(save);
    form.onsubmit=async event=>{
      event.preventDefault();if(!form.reportValidity()||(fields.confirmed&&!fields.confirmed.checked))return;
      const retry=fields.decision?.value==='re-review';let evidenceIds=fields.evidence?.filter(input=>input.checked).map(input=>input.value)||[];
      const file=fields.evidenceFile?.files?.[0];
      if(retry&&!evidenceIds.length&&!file){error.textContent=t('请选择新的补充证据');return;}
      save.disabled=true;
      try{
        if(retry&&file){
          if(file.type!=='image/png'||file.size>12*1024*1024)throw Error(t('反证必须是小于 12 MB 的 PNG 图片'));
          const annotation=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error(t('无法读取反证图片')));reader.readAsDataURL(file);});
          const item=await workbenchApi('attachment',{runId:run.manifest.id,screenshot:fields.evidenceSource.value,annotation,notes:fields.reason.value});evidenceIds.push(item.id);
        }
        await submit({...(fields.finding?{findingId:fields.finding.value}:{}),...(fields.note?{note:fields.note.value}:{}),...(fields.reason?{reason:fields.reason.value}:{}),...(fields.decision?{decision:fields.decision.value}:{}),...(retry?{evidenceIds}:{}),...(fields.confirmed?{confirmed:fields.confirmed.checked}:{}),...(action.kind==='execute'?{findingId:run.manifest.findingId}:{})},action.stage);
      }catch(failure){error.textContent=failure.message;}finally{if(sheet.isConnected)save.disabled=false;}
    };
    sheet.onclose=()=>{sheet.remove();if(dialog===sheet)dialog=null;};document.body.append(sheet);sheet.showModal();
  }

  async function open(findingId) {
    await refresh();if(disposed||primary.disabled)return;
    const action=primaryActionForStage(state.workflow.stage,{...run.manifest,judgment:state.judgment||run.manifest.judgment});
    if(state.readOnly||action?.kind==='reconnect'||action?.kind==='repair'&&!(run.diagnosis?.findings||run.spec.findings).filter(isReportableFinding).length) {
      const configPath=(state.jobs||[]).find(job=>job.configPath)?.configPath;
      openOperations(state.localAvailable?run:null,{project:run.spec.project,connectionOnly:true,configPath,restartAfterConnect:action?.kind==='reconnect'||Boolean(run.manifest.onboarding?.configDigest),onStarted:async job=>{pendingId=job.id;await refresh();},onConnected:()=>onChanged({runId:run.manifest.id})});return;
    }
    if(action.kind==='foundation'){onFoundation?.();return;}
    if(action.kind==='open-pr'){const url=run.manifest.pullRequest?.url;if(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/.test(url||''))window.open(url,'_blank','noopener,noreferrer');return;}
    if(action.kind==='pull-request'){await submit({publishRequested:true},action.stage);return;}
    if(action.kind==='repair'){const selected=findingId||getRepairFindingId?.();await submit({repairRequested:true,...(selected?{findingId:selected}:{})},action.stage);return;}
    if(['judge','baseline','restart'].includes(action.kind)){showForm(action,findingId||getFindingId?.());return;}
    await submit({},action.stage);
  }
  primary.onclick=()=>open().catch(error=>{status.textContent=error.message;});
  update(state);refresh();if(poll)timer=setInterval(refresh,1500);
  return {update,open,destroy(){disposed=true;clearInterval(timer);dialog?.close();container.replaceChildren();}};
}
