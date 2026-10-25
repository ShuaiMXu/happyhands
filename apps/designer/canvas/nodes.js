import { t } from '../i18n.js';
export function captureEntries(capture) {
  if (Array.isArray(capture?.states)) return capture.states;
  return Object.entries(capture?.viewports || {}).map(([configurationId, e]) => ({stateId:'page', configurationId, legacy:true, ...e}));
}
export function safeScreenshot(phase, entry) {
  const expected = entry.legacy ? `${phase}/${entry.configurationId}.png` : `${phase}/${entry.stateId}--${entry.configurationId}.png`;
  return /^[a-z]+\/[a-zA-Z0-9_-]+\.png$/.test(expected) && entry.screenshot === expected ? expected : null;
}
export function buildNodes(run) {
  const before = captureEntries(run.manifest.captures?.before), after = captureEntries(run.manifest.captures?.after);
  const nodes = [];
  for (const [phase, entries] of [['before',before],['after',after]]) for (const entry of entries) {
    const key = `${entry.stateId}--${entry.configurationId}`;
    const b = before.find(e => `${e.stateId}--${e.configurationId}` === key);
    const a = after.find(e => `${e.stateId}--${e.configurationId}` === key);
    const view = run.evaluation?.views?.[key] || (entry.legacy ? run.evaluation?.views?.[entry.configurationId] : null);
    const changed = !view || !a ? null : Boolean(a && (Object.values(view.checks || {}).some(v => v === false) || JSON.stringify(view.beforeH1) !== JSON.stringify(view.afterH1) || b?.reached === false && a.reached !== false));
    nodes.push({id:`${phase}:${key}`,key,phase,entry,checks:view?.checks ?? null,changed,paired:Boolean(b && a)});
  }
  return nodes;
}
export function renderNode(node, base) {
  const el = document.createElement('article');
  el.className='pd-node'; el.dataset.key=node.key; el.dataset.phase=node.phase; el.tabIndex=0;
  el.setAttribute('aria-label',`${t(node.entry.stateId)} ${t(node.entry.configurationId)} ${node.phase === 'before' ? t('修改前') : t('修改后')}`);
  const cap=document.createElement('div'); cap.className='pd-node-caption';
  const phase=document.createElement('span'); phase.className=`phase-tag ${node.phase}`; phase.textContent=node.phase === 'before' ? t('修改前') : t('修改后');
  const label=document.createElement('span'); label.textContent=`${t(node.entry.configurationId)} · ${node.entry.width || '—'} × ${node.entry.height || '—'}`;
  cap.append(phase,label); el.append(cap);
  const shot=safeScreenshot(node.phase,node.entry);
  const error=(message,retry=false)=>{
    const box=document.createElement('div'); box.className='pd-node-error'; box.textContent=message;
    if(retry){const btn=document.createElement('button');btn.textContent=t('重新加载截图');btn.onclick=e=>{e.stopPropagation();box.remove();loadImage();};box.append(btn);}
    el.append(box);
  };
  function loadImage(){
    const img=document.createElement('img');img.alt=el.getAttribute('aria-label');img.loading='lazy';img.decoding='async';
    if(node.entry.width && node.entry.height){img.width=node.entry.width;img.height=node.entry.height;}
    img.onerror=()=>{img.remove();error(t('截图读取失败，证据暂不可用。'),true);};img.src=`${base}/${shot}`;el.append(img);
  }
  if(node.entry.reached===false)error(t`此状态未到达：${node.entry.error || t('重放失败')}${node.entry.failedAction !== undefined ? t` · 操作 ${node.entry.failedAction}` : ''}`);
  else if(!shot)error(t('未提供可用截图，无法进行视觉审阅。'));else loadImage();
  const foot=document.createElement('div');foot.className='pd-node-foot';const status=document.createElement('span');
  status.textContent=node.entry.reached===false?t('未到达'):`HTTP ${node.entry.status ?? '—'}${node.phase==='after' ? node.changed===null?t(' · 待评估'):node.changed?t(' · 有结构变化'):t(' · 结构指标一致'):''}`;
  foot.append(status);
  if(node.paired){const jump=document.createElement('button');jump.type='button';jump.dataset.jump='true';jump.textContent=node.phase==='before'?t('修改后 ↗'):t('↖ 修改前');foot.append(jump);}
  el.append(foot);return el;
}
