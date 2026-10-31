import {createControl} from '../../packages/ui/controls.js';
import {t} from './i18n.js';

export function projectMemoryView(memory) {
  const entries=memory?.context?.entries;
  const excluded=memory?.context?.excludedEntries||[];
  if(!Array.isArray(entries)||!entries.length&&!excluded.length)return null;
  const details=createControl('details');details.id='diagnosis-project-memory';
  const summary=createControl('summary');summary.textContent=t('诊断时参考的项目经验')+` / ${entries.length+excluded.length}`;details.append(summary);
  const note=createControl('p');note.textContent=t('这是本次诊断保存的历史经验，不代表当前页面存在问题，也不替代本轮证据。');details.append(note);
  for(const entry of [...entries,...excluded]){
    const article=createControl('article');
    for(const value of [entry.principle,t('适用范围')+'：'+entry.context,...(entry.exceptions||[]).map(value=>t('不适用的情况')+'：'+value),t('来源审阅')+'：'+entry.source?.runId]){
      const line=createControl('p');line.textContent=value;article.append(line);
    }
    details.append(article);
    if(entry.exclusion){const note=createControl('p');note.textContent=t('仅本轮不适用')+'：'+entry.exclusion.reason;article.append(note);}
  }
  return details;
}
