import {createControl} from '../../packages/ui/controls.js';
import {t} from './i18n.js';

export function judgmentWithdrawalView(run,submit,onChanged=()=>location.reload()) {
  if(!run.manifest.judgment)return null;
  const details=createControl('details'),summary=createControl('summary');
  summary.textContent=t(run.manifest.judgmentWithdrawal?'本轮决定已撤回':'撤回本轮决定');details.append(summary);
  const original=createControl('p');original.textContent=t('原决定')+'：'+t(run.manifest.judgment.decision)+' / '+run.manifest.judgment.reason;details.append(original);
  if(run.manifest.judgmentWithdrawal){const note=createControl('p');note.textContent=t('撤回理由')+'：'+run.manifest.judgmentWithdrawal.reason;details.append(note);return details;}
  const note=createControl('p');note.textContent=t('撤回会停用由这次决定产生的项目经验。原决定和证据会保留；重新判断需要开始新审阅。');details.append(note);
  const label=createControl('label'),reason=createControl('textarea');label.append(document.createTextNode(t('撤回理由')),reason);reason.maxLength=10000;details.append(label);
  const control=createControl('button'),status=createControl('p');control.type='button';control.textContent=t('撤回这次决定');status.setAttribute('role','status');details.append(control,status);
  control.onclick=async()=>{
    control.disabled=true;
    try{
      const result=await submit({runId:run.manifest.id,reason:reason.value});
      status.textContent=result.exportError?t('决定已撤回，但导出尚未更新。')+' '+result.exportError:t('决定已撤回。');
      reason.disabled=true;
      if(!result.exportError)onChanged();
    }catch(error){status.textContent=error.message;control.disabled=false;}
  };
  return details;
}
