import {createControl} from '../../../packages/ui/controls.js';
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
  const root=createControl('section');root.className='review-form';
  function field(title,tag='input') { const wrap=createControl('label'),node=createControl(tag);wrap.textContent=t(title);node.setAttribute('aria-label',t(title));wrap.append(node);root.append(wrap);if(tag==='input'||tag==='textarea')node.maxLength=20000;return node; }
  function options(node,values) { for(const [value,title] of values){const option=createControl('option');option.value=value;option.textContent=t(title);node.append(option);} }
  const intro=createControl('p');intro.textContent=t('由未参与修改的复核者填写。批注用于辅助说明，不能代替查看原始截图。');root.append(intro);
  const skill=field('复核类型','select');options(skill,[['visual-qa-evaluator','修改后视觉复核'],['visual-hierarchy-reviewer','基线视觉审阅']]);
  if(!run.manifest.captures?.after)skill.value='visual-hierarchy-reviewer';
  const name=field('复核者姓名');name.autocomplete='name';
  const screenshots=createControl('fieldset'),legend=createControl('legend');screenshots.className='review-evidence';legend.textContent=t('已查看的截图');screenshots.append(legend);root.append(screenshots);
  const search=createControl('input');search.type='search';search.placeholder=t('搜索页面或设备');search.setAttribute('aria-label',t('搜索待复核截图'));
  const progress=createControl('p');progress.className='review-evidence-progress';progress.setAttribute('role','status');
  const list=createControl('div');list.className='review-evidence-list';list.tabIndex=0;list.setAttribute('aria-label',t('待复核截图'));
  screenshots.append(search,progress,list);
  const selected=new Set();
  function renderScreenshots(){
    const allowed=new Set(reviewScreenshots(run.manifest,skill.value));for(const ref of selected)if(!allowed.has(ref))selected.delete(ref);
    list.replaceChildren();let visible=0;const query=search.value.trim().toLocaleLowerCase();
    for(const phase of ['before','after']){
      const group=createControl('section'),heading=createControl('h3');heading.textContent=t(phase==='before'?'修改前':'修改后');group.append(heading);
      for(const entry of captureEntries(run.manifest.captures?.[phase])){
        const ref=safeScreenshot(phase,entry);if(!allowed.has(ref))continue;
        const title=t(entry.title||entry.stateId||'页面'),device=t(entry.configurationId);
        if(query&&!`${title} ${device} ${ref}`.toLocaleLowerCase().includes(query))continue;
        visible++;const row=createControl('div'),label=createControl('label'),check=createControl('input'),caption=createControl('span'),name=createControl('span'),meta=createControl('span'),link=createControl('a');
        row.className='review-evidence-row';check.type='checkbox';check.checked=selected.has(ref);check.dataset.screenshotRef=ref;
        check.onchange=()=>{check.checked?selected.add(ref):selected.delete(ref);updateProgress();};
        name.textContent=title;meta.textContent=device;meta.className='review-evidence-device';caption.append(name,meta);label.append(check,caption);
        link.textContent=t('查看原图');link.setAttribute('aria-label',`${t('查看原图')} / ${title} / ${device} / ${heading.textContent}`);link.title=ref;link.href=`/runs/${encodeURIComponent(run.manifest.id)}/${ref}`;link.target='_blank';link.rel='noopener';row.append(label,link);group.append(row);
      }
      if(group.children.length>1)list.append(group);
    }
    if(!visible){const empty=createControl('p');empty.textContent=t(allowed.size?'没有匹配的截图':'暂无可用截图，请先采集。');list.append(empty);}
    updateProgress();
  }
  function updateProgress(){progress.textContent=t`${selected.size} / ${reviewScreenshots(run.manifest,skill.value).length} 张已确认`;}
  search.oninput=renderScreenshots;skill.onchange=renderScreenshots;renderScreenshots();
  const verdict=field('复核结论','select');options(verdict,[['','请选择复核结论'],['needs-evidence','证据不足'],['fail','未通过'],['pass','通过']]);
  const rationale=field('复核理由','textarea'),limitations=field('复核限制或未覆盖范围','textarea');
  const findings=createControl('div');root.append(findings);const rows=[];
  const add=createControl('button');add.type='button';add.textContent=t('添加复核问题');root.append(add);
  add.onclick=()=>{const row=createControl('fieldset');findings.append(row);const controls={};for(const [key,title,tag] of [['title','问题标题','input'],['observation','具体观察','textarea'],['impact','影响程度','select'],['confidence','判断把握','select']]){const node=field(title,tag);row.append(node.parentElement);controls[key]=node;}options(controls.impact,[[1,'1'],[2,'2'],[3,'3'],[4,'4'],[5,'5']]);controls.impact.value='3';options(controls.confidence,[['low','低'],['medium','中'],['high','高']]);controls.confidence.value='medium';const remove=createControl('button');remove.type='button';remove.textContent=t('移除问题');remove.onclick=()=>{rows.splice(rows.indexOf(controls),1);row.remove();};row.append(remove);rows.push(controls);controls.title.focus();};
  const independent=field('我未参与本轮修改，并已独立查看所引用的截图');independent.type='checkbox';independent.parentElement.className='review-independence';independent.parentElement.prepend(independent);
  return {element:root,read:()=>buildReviewRecord({skillId:skill.value,name:name.value,verdict:verdict.value,rationale:rationale.value,limitations:limitations.value,screenshotRefs:[...selected],findings:rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,node])=>[key,node.value]))),independent:independent.checked,attachmentRefs:[...attachmentRefs]},run.manifest)};
}
