import { t } from '../i18n.js';
import { captureEntries, safeScreenshot } from '../canvas/nodes.js';

export function reviewScreenshots(manifest, skillId) {
  return ['before','after'].flatMap(phase => skillId === 'visual-hierarchy-reviewer' && phase === 'after' ? [] : captureEntries(manifest.captures?.[phase]).map(entry => safeScreenshot(phase,entry)).filter(Boolean));
}
export function buildReviewRecord(input, manifest, now = new Date().toISOString()) {
  const required = (value,key) => { if(typeof value !== 'string' || !value.trim()) throw new Error(t(key)); return value.trim(); };
  if(!input.independent) throw new Error(t('请确认你未参与本轮修改，并已独立查看证据。'));
  if(!['pass','fail','needs-evidence'].includes(input.verdict)) throw new Error(t('请选择复核结论'));
  const allowed = new Set(reviewScreenshots(manifest,input.skillId));
  const refs = [...new Set(input.screenshotRefs || [])];
  if(!refs.length || refs.some(ref=>!allowed.has(ref))) throw new Error(t('请选择已查看的有效截图'));
  const findings = (input.findings || []).map((item,index)=>({id:`VISUAL_${index+1}`,title:required(item.title,'请填写问题标题'),observation:required(item.observation,'请填写具体观察'),impact:Number(item.impact),confidence:item.confidence,screenshotRefs:refs}));
  if(input.verdict === 'pass' && findings.length || input.verdict === 'fail' && !findings.length) throw new Error(t('未通过需要记录问题；通过时不能保留未解决问题。'));
  return {schemaVersion:'0.1',skillId:input.skillId,reviewer:{type:'human',name:required(input.name,'请填写复核者姓名'),version:'human-review-form@1'},reviewedAt:now,verdict:input.verdict,screenshotRefs:refs,findings,rationale:required(input.rationale,'请填写复核理由'),limitations:required(input.limitations,'请说明复核限制或未覆盖范围').split('\n').map(value=>value.trim()).filter(Boolean),attachmentRefs:input.attachmentRefs || []};
}

export function createReviewForm(run, attachmentRefs) {
  const root=document.createElement('section');root.className='review-form';
  function field(title,tag='input') { const wrap=document.createElement('label'),node=document.createElement(tag);wrap.textContent=t(title);wrap.append(node);root.append(wrap);if(tag==='input'||tag==='textarea')node.maxLength=20000;return node; }
  function options(node,values) { for(const [value,title] of values){const option=document.createElement('option');option.value=value;option.textContent=t(title);node.append(option);} }
  const intro=document.createElement('p');intro.textContent=t('由未参与修改的复核者填写。批注用于辅助说明，不能代替查看原始截图。');root.append(intro);
  const skill=field('复核类型','select');options(skill,[['visual-qa-evaluator','修改后视觉复核'],['visual-hierarchy-reviewer','基线视觉审阅']]);
  if(!run.manifest.captures?.after)skill.value='visual-hierarchy-reviewer';
  const name=field('复核者姓名');name.autocomplete='name';
  const screenshots=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=t('逐项确认已查看的截图');screenshots.append(legend);root.append(screenshots);
  const selected=new Set();
  function renderScreenshots(){selected.clear();screenshots.replaceChildren(legend);for(const ref of reviewScreenshots(run.manifest,skill.value)){
    const row=document.createElement('label'),check=document.createElement('input'),link=document.createElement('a');check.type='checkbox';check.onchange=()=>check.checked?selected.add(ref):selected.delete(ref);link.textContent=ref;link.href=`/runs/${encodeURIComponent(run.manifest.id)}/${ref}`;link.target='_blank';link.rel='noopener';row.append(check,link);screenshots.append(row);
  }if(!screenshots.querySelector('input')){const empty=document.createElement('p');empty.textContent=t('暂无可用截图，请先采集。');screenshots.append(empty);}}
  skill.onchange=renderScreenshots;renderScreenshots();
  const verdict=field('复核结论','select');options(verdict,[['','请选择复核结论'],['needs-evidence','证据不足'],['fail','未通过'],['pass','通过']]);
  const rationale=field('复核理由','textarea'),limitations=field('复核限制或未覆盖范围','textarea');
  const findings=document.createElement('div');root.append(findings);const rows=[];
  const add=document.createElement('button');add.type='button';add.textContent=t('添加复核问题');root.append(add);
  add.onclick=()=>{const row=document.createElement('fieldset');findings.append(row);const controls={};for(const [key,title,tag] of [['title','问题标题','input'],['observation','具体观察','textarea'],['impact','影响程度','select'],['confidence','判断把握','select']]){const node=field(title,tag);row.append(node.parentElement);controls[key]=node;}options(controls.impact,[[1,'1'],[2,'2'],[3,'3'],[4,'4'],[5,'5']]);controls.impact.value='3';options(controls.confidence,[['low','低'],['medium','中'],['high','高']]);controls.confidence.value='medium';const remove=document.createElement('button');remove.type='button';remove.textContent=t('移除问题');remove.onclick=()=>{rows.splice(rows.indexOf(controls),1);row.remove();};row.append(remove);rows.push(controls);controls.title.focus();};
  const independent=field('我未参与本轮修改，并已独立查看所引用的截图');independent.type='checkbox';
  return {element:root,read:()=>buildReviewRecord({skillId:skill.value,name:name.value,verdict:verdict.value,rationale:rationale.value,limitations:limitations.value,screenshotRefs:[...selected],findings:rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,node])=>[key,node.value]))),independent:independent.checked,attachmentRefs:[...attachmentRefs]},run.manifest)};
}
