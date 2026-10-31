import {createControl} from '../../packages/ui/controls.js';
import {decodeSiteHandoff,assertSiteHandoff} from '../../packages/workbench/site-handoff-contract.js';
import {workbenchApi,reviewLink} from './cowart/operations.js';
import {t} from './i18n.js';

export async function openSiteHandoff(openOperations) {
  if (!location.hash.startsWith('#handoff=')) return;
  const encoded = location.hash.slice(9);
  history.replaceState(null,'',location.pathname+location.search);
  try {
    const value = decodeSiteHandoff(encoded);
    const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(assertSiteHandoff(value))));
    const digest = [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    const receipt = await workbenchApi('site-handoff?id='+value.id+'&digest='+digest);
    if (receipt.job?.status === 'succeeded' && receipt.runId) {
      location.replace('/apps/designer/'+reviewLink(receipt.runId,'list'));
      return;
    }
    openOperations(null,{connectionOnly:!receipt.job,siteHandoff:value,...(receipt.job?{resumeJobId:receipt.job.id}:{})});
  } catch (error) {
    const notice=document.getElementById('notice');
    notice.textContent=t('无法接收官网资料，请确认已启动新版本地工作台。')+' '+error.message;
    notice.setAttribute('role','alert');
  }
}

export function renderSiteHandoff(run) {
  document.getElementById('site-handoff-receipt')?.remove();
  const config=run?.manifest.onboarding?.config;
  if (!config?.siteHandoff) return;
  const details=createControl('details');details.id='site-handoff-receipt';details.className='panel';
  const title=createControl('summary');title.textContent=t('来自官网的本次审阅');
  const note=createControl('p');note.textContent=t('项目设计来源已绑定到这份运行记录，仍需正常确认规范、修改范围和最终结果。');
  const link=createControl('a');link.href='/apps/designer/'+reviewLink(run.manifest.id,'list');link.textContent=t('本次结果记录')+' / '+run.manifest.id;
  const list=createControl('ul');
  for(const ref of config.designSources||[]){const item=createControl('li');item.textContent=ref.path+' / '+ref.sha256.slice(0,12);list.append(item);}
  details.append(title,note,link,list);
  document.getElementById('notice').after(details);
}
