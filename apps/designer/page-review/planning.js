import {createControl} from '../../../packages/ui/controls.js';
import {t} from '../i18n.js';
import {workbenchApi,reviewLink} from '../cowart/operations.js';
const el=(tag,text)=>{const node=createControl(tag);if(text)node.textContent=t(text);return node;};

// Planning expands evidence in a new run; it cannot authorize a source edit or
// overwrite the historical screenshots currently displayed in the workspace.
export function reviewPlanning(run,{onChanged=({runId})=>{location.href=reviewLink(runId)+'&view=canvas';}}={}){
  let dialog=null,timer=null,disposed=false;
  function close(){clearTimeout(timer);dialog?.close();dialog?.remove();dialog=null;}
  async function open({rediscover=false}={}){
    if(disposed)return;close();
    const sheet=el('dialog');dialog=sheet;sheet.className='wb-dialog review-action-dialog review-planning-dialog';sheet.setAttribute('aria-label',t('页面与交互计划'));
    const title=el('h2','页面与交互计划'),dismiss=el('button','关闭'),body=el('div'),status=el('p');
    dismiss.type='button';dismiss.className='review-action-close';dismiss.onclick=close;status.setAttribute('role','status');
    sheet.append(title,dismiss,el('p','发现真实页面与控件后，先确认本次采集范围。现有记录保持不变，确认后建立新的基线。'),body,status);document.body.append(sheet);sheet.addEventListener('close',()=>{if(dialog===sheet){clearTimeout(timer);dialog=null;}sheet.remove();});sheet.showModal();
    const extra=el('details'),extraTitle=el('summary','其他页面路径（可选，每行一个）'),routes=el('textarea');routes.rows=3;routes.setAttribute('aria-label',t('其他页面路径（可选，每行一个）'));extra.append(extraTitle,el('p','可补充导航中没有链接的页面，例如 /settings。'),routes);body.append(extra);
    const discover=el('button','发现页面与交互');discover.type='button';discover.disabled=!rediscover;body.append(discover);
    const explain=el('p','发现只读取页面，不点击、不提交表单。菜单展开/收起、弹窗打开/关闭、原生表单错误/恢复会作为候选；自定义状态需补充明确计划。');body.append(explain);
    async function follow(job,onResult){
      if(disposed||dialog!==sheet||!sheet.open)return;
      try{
        const jobs=await workbenchApi('jobs');if(disposed||dialog!==sheet||!sheet.open)return;
        const current=jobs.find(item=>item.id===job.id);
        if(!current||['queued','running','cancelling'].includes(current.status)){
          status.textContent=t('正在发现或采集，请稍候。');timer=setTimeout(()=>follow(job,onResult),1000);return;
        }
        if(current.status!=='succeeded')throw Error(current.error||current.status);
        await onResult(current.result);
      }catch(error){status.textContent=t('操作失败')+': '+error.message;discover.disabled=false;body.querySelector('button[type=submit]')?.removeAttribute('disabled');}
    }
    function showProposal(proposal){
      body.replaceChildren();status.textContent='';
      const retry=el('button','重新发现页面与交互');retry.type='button';retry.onclick=()=>open({rediscover:true});body.append(retry);
      body.append(el('p','这里只显示候选范围，不表示已经采集或通过复核。所有选择和确认默认未勾选。'));
      body.append(el('p','内部滚动区域会列出分段候选。长页面可按设备分次采集；超限不会自动丢弃证据。'));
      body.append(el('p','所选页面会补齐各设备的整页原图；已有计划完整保留。确认只建立采集基线，不授权修改源码。'));
      const form=el('form'),selected=new Map();body.append(form);
      const routes=new Map();for(const candidate of proposal.candidates){const url=candidate.state.start.url;if(!routes.has(url))routes.set(url,[]);routes.get(url).push(candidate);}
      for(const [url,candidates] of routes){
        const group=el('fieldset'),legend=el('legend');legend.textContent=new URL(url).pathname+new URL(url).search;group.append(legend);form.append(group);
        const surfaces=new Map();
        for(const candidate of candidates){
          let parent=group,surfaceGroup=null;
          if(candidate.kind==='scroll-surface'){
            const key=JSON.stringify([candidate.state.configurations,candidate.state.scrollSurface.selector]);
            if(!surfaces.has(key)){
              const details=el('details'),summary=el('summary'),allLabel=el('label','选择此区域全部分段'),all=el('input'),items=el('div');all.type='checkbox';allLabel.prepend(all);details.append(summary,allLabel,items);group.append(details);
              surfaceGroup={details,summary,all,items,boxes:[]};surfaces.set(key,surfaceGroup);
              all.onchange=()=>{for(const box of surfaceGroup.boxes)box.checked=all.checked;all.indeterminate=false;};
            }
            surfaceGroup=surfaces.get(key);parent=surfaceGroup.items;
          }
          const label=el('label'),box=el('input');box.type='checkbox';box.value=candidate.id;selected.set(candidate.id,box);
          label.append(box,document.createTextNode(`${t(candidate.kind)} / ${candidate.title} / ${candidate.state.configurations.join(', ')}`));parent.append(label);
          if(surfaceGroup){surfaceGroup.boxes.push(box);surfaceGroup.summary.textContent=`${t('内部滚动分段')} / ${candidate.state.configurations.join(', ')} / ${surfaceGroup.boxes.length}`;box.onchange=()=>{const checked=surfaceGroup.boxes.filter(item=>item.checked).length;surfaceGroup.all.checked=checked===surfaceGroup.boxes.length;surfaceGroup.all.indeterminate=checked>0&&checked<surfaceGroup.boxes.length;};}
          if(candidate.testData)parent.append(el('small','仅使用合成测试值检查原生校验，不提交表单。'));
          const details=el('details'),summary=el('summary','查看完整动作与预期状态'),pre=el('pre');pre.textContent=JSON.stringify(candidate.state,null,2);details.append(summary,pre);parent.append(details);
        }
      }
      if(!proposal.candidates.length)form.append(el('p','没有可自动规划的状态。请查看缺口，补充路由与明确动作。'));
      const gaps=el('details'),gapTitle=el('summary','未发现或无法推断的状态');gaps.append(gapTitle);
      for(const gap of proposal.gaps||[]){const p=el('p');p.textContent=`${gap.url||''} ${gap.configuration||''} / ${gap.reason}`;gaps.append(p);}form.append(gaps);
      const advanced=el('details'),advancedTitle=el('summary','高级：补充路由与自定义交互'),manualLabel=el('label','补充状态 JSON'),manual=el('textarea');manual.rows=8;manual.value='[]';manual.setAttribute('aria-label',t('补充状态 JSON'));manualLabel.append(manual);advanced.append(advancedTitle,el('p','可声明未链接的路由、自定义菜单、表单、弹窗、失败与重试状态。使用当前预览地址、唯一选择器和明确预期；新增路由会自动补全整页原图。'),manualLabel);form.append(advanced);
      const acknowledge=el('label','我已核对所选页面、交互动作与测试值，同意建立新基线'),confirmed=el('input');confirmed.type='checkbox';confirmed.required=true;acknowledge.prepend(confirmed);form.append(acknowledge);
      const submit=el('button','确认范围并采集');submit.type='submit';submit.className='button primary';form.append(submit);
      form.onsubmit=async event=>{
        event.preventDefault();submit.disabled=true;status.textContent=t('正在执行…');
        try{
          const job=await workbenchApi('confirm-review-plan',{runId:run.manifest.id,proposalId:proposal.id,selectedIds:[...selected].filter(([,box])=>box.checked).map(([id])=>id),manualStates:JSON.parse(manual.value||'[]'),confirmed:confirmed.checked});
          await follow(job,async result=>{close();await onChanged({runId:result.runId});});
        }catch(error){status.textContent=t('操作失败')+': '+error.message;submit.disabled=false;}
      };
    }
    if(!rediscover)workbenchApi('jobs').then(async jobs=>{if(disposed||dialog!==sheet||!sheet.open)return;const previous=jobs.find(job=>job.kind==='discover-review-plan'&&job.runId===run.manifest.id);if(previous?.status==='succeeded')showProposal(previous.result.proposal);else if(previous&&['queued','running','cancelling'].includes(previous.status)){discover.disabled=true;await follow(previous,result=>showProposal(result.proposal));}else discover.disabled=false;}).catch(()=>{discover.disabled=false;});
    discover.onclick=async()=>{
      discover.disabled=true;status.textContent=t('正在执行…');
      try{await follow(await workbenchApi('discover-plan',{runId:run.manifest.id,routes:routes.value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean)}),result=>showProposal(result.proposal));}
      catch(error){status.textContent=t('操作失败')+': '+error.message;discover.disabled=false;}
    };
  }
  return {open,destroy(){disposed=true;close();}};
}
