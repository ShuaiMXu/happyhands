import {createControl} from '../../packages/ui/controls.js';
import {t,getLanguage} from './i18n.js';
const reasons={
  'verified-source-delta':'已根据本轮源码变化选择检查项。',
  'unaccepted-parent':'上次审阅没有有效的接受记录，本轮使用完整范围。',
  'different-project':'上次审阅属于其他项目，本轮使用完整范围。',
  'baseline-inputs-missing':'上次审阅缺少完整源码对照，本轮使用完整范围。',
  'current-source-dirty':'当前源码有未提交改动，无法生成可靠的增量范围。',
  'source-binding-unavailable':'源码对照无法核验，本轮使用完整范围。',
  'unchanged-source':'源码输入未变化，仍会按配置检查本轮任务。',
  'unsupported-changes':'变动包含尚未映射的文件类型，本轮使用完整范围。'
};
export function incrementalReviewView(plan,{onFullReview}={}){
  if(!plan)return null;
  const root=createControl('details');root.id='incremental-review-context';
  const title=createControl('summary');title.textContent=t('本轮变动范围');root.append(title);
  const lead=createControl('p');lead.textContent=t(reasons[plan.reasonCode]||'源码对照无法核验，本轮使用完整范围。');root.append(lead);
  const baseline=plan.delta?.baselineRunId;
  if(typeof baseline==='string'){
    const link=createControl('a');link.textContent=t('对照审阅')+' / '+baseline;link.href=`?case=${encodeURIComponent('run:'+baseline)}&view=list&lang=${getLanguage()}`;root.append(link);
  }
  const changes=Array.isArray(plan.delta?.changes)?plan.delta.changes:[];
  if(changes.length){
    const label=createControl('p');label.textContent=t('变动文件')+' / '+changes.length;root.append(label);
    const list=createControl('pre');list.textContent=changes.map(change=>`${t(change.kind==='added'?'新增文件':change.kind==='deleted'?'删除文件':'修改文件')} / ${change.path}`).join('\n');list.tabIndex=0;list.style.maxHeight='16rem';list.style.overflow='auto';list.setAttribute('aria-label',t('变动文件'));root.append(list);
  }
  const impact=plan.delta?.impact;
  const selection=plan.delta?.captureSelection;
  if(selection?.status==='selected'){
    for(const [label,ids] of [['本轮采集状态',selection.selectedStateIds],['未纳入本轮复查',selection.excludedStateIds]]){
      const item=createControl('p');item.textContent=t(label)+' / '+ids.join(', ');root.append(item);
    }
  }
  if(impact&&selection?.status!=='selected'){
    const heading=createControl('p');heading.textContent=t('源码关联的页面状态');root.append(heading);
    const list=createControl('ul');
    for(const state of impact.states||[]){
      const item=createControl('li');item.textContent=`${state.stateId} / ${state.urls.join(', ')} / ${t(state.status==='potentially-affected'?'可能受影响':'影响范围待确认')}`;list.append(item);
    }
    root.append(list);
    const limit=createControl('p');limit.textContent=t('依赖关系用于定位可能受影响的页面，不能证明其他页面无需复查。');root.append(limit);
  }
  const note=createControl('p');note.textContent=t(selection?.status==='selected'?'本轮按已声明的入口依赖采集关联状态。其余页面未复查，不代表没有问题。':'页面采集仍按配置执行。未采集的页面不代表已复查。');root.append(note);
  if(selection?.status==='selected'&&onFullReview){
    const button=createControl('button'),status=createControl('p');button.type='button';button.textContent=t('重新完整审阅');status.setAttribute('role','status');
    button.addEventListener('click',async()=>{button.disabled=true;status.textContent=t('正在建立完整审阅记录…');try{await onFullReview();}catch(error){status.textContent=error.message;button.disabled=false;}});root.append(button,status);
  }
  return root;
}
