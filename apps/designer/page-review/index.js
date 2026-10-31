import {screenshotPreviewLink} from './image-preview.js';
import {createControl} from '../../../packages/ui/controls.js';
import {appendReviewResolutions} from '../review-resolutions.js';
import {appendPageSurfaceLinks} from '../page-surface-links.js';
import { reviewPlanning } from './planning.js';
import { appendVisualCoverage } from '../visual-review-coverage.js';
import {findingSummary} from '../finding-summary.js';
import { t } from '../i18n.js';
import { mountReviewAction } from '../review-action.js';
import { workbenchApi, openOperations, reviewLink } from '../cowart/operations.js';
import { exportedReviewState } from '../cowart/review-state.js';
import { reviewTargets, reviewCoverage, currentPreview, livePreviewAvailable, reviewFindings, reviewAssociations } from './model.js';
import {appendBrandAssessments} from '../report/brand-assessments.js';

const el=(tag,cls,text)=>{const node=createControl(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node;};
const button=(text,fn,pressed)=>{const node=el('button','',t(text));node.type='button';node.onclick=fn;if(pressed!==undefined)node.setAttribute('aria-pressed',String(pressed));return node;};
const label=node=>`${node.entry.title||t(node.entry.stateId)} / ${t(node.entry.configurationId)} / ${t(node.phase==='before'?'修改前':'修改后')} / ${t(node.entry.plannedScrollSurface?'内部滚动分段':node.entry.captureMode==='page-surfaces'?'页面概览与内部区域':['full-page','page-surfaces'].includes(node.entry.captureMode)?'整页原图':'视口截图')}`;
const previewCopy=status=>({
  verified:'受管理预览已绑定基线源码与构建响应。',
  'source-match':'当前仓库与采集提交一致，但运行中的页面构建版本尚未固定。它不会自动重放选中的交互状态。',
  'source-mismatch':'当前仓库提交与采集证据不一致。实时页面不能用于解释这份历史证据。',
  dirty:'当前仓库有未提交修改。实时页面不能归属于已记录的源码版本。',
  'preview-changed':'受管理预览的响应已变化，构建指纹失效。请停止并重新启动预览。',
  'preview-stopped':'受管理预览已经退出。请重新启动后再操作实时页面。',
  'preview-unavailable':'受管理预览当前无法访问。它不能作为对应源码版本的实时证据。',
  unverified:'当前预览的源码版本尚未核对。它不代表历史采集，也不会自动重放选中的交互状态。'
}[status]||'当前预览的源码版本尚未核对。它不代表历史采集，也不会自动重放选中的交互状态。');
const previewStatus=preview=>{
  const messages=[previewCopy(preview?.versionStatus)];
  if(preview?.sourceStatus&&preview.sourceStatus!==preview.versionStatus&&!['source-match','unverified'].includes(preview.sourceStatus))messages.push(previewCopy(preview.sourceStatus));
  return messages.join(' ');
};

export async function renderPageReview(container,run,previous={}) {
  let state=exportedReviewState(run),targets=reviewTargets(run,state.reviews);const findings=reviewFindings(run);
  let associations=reviewAssociations(run,targets,findings);
  let selected=targets.find(node=>node.id===previous.captureId)||targets.find(node=>node.phase==='after'&&node.available&&['full-page','page-surfaces'].includes(node.entry.captureMode))||targets.find(node=>node.phase==='after'&&node.available)||targets[0];
  let imagePreview=null;
  const previewLink=image=>screenshotPreviewLink(image,dialog=>{imagePreview?.close();imagePreview=dialog;});
  let preview=null,previewError='',mode=run.manifest.captures.after?'compare':'evidence',disposed=false,observer=null,resizeFrame=null,activeFrame=null,fitWidth=previous.fitWidth??true,timer=null,refreshing=false;
  const root=el('section','page-review');root.setAttribute('aria-label',t('页面审阅'));container.replaceChildren(root);
  const left=el('nav','page-review-directory'),center=el('section','page-review-main'),right=el('aside','page-review-inspector');
  const metadata=el('div','page-review-metadata');
  const actionContainer=el('div'),panels=el('nav','page-review-panels');panels.setAttribute('aria-label',t('审阅面板'));
  left.id='page-review-directory';left.setAttribute('aria-label',t('全部截图'));right.id='page-review-inspector';
  let directoryOpen=previous.directoryOpen??true,inspectorOpen=previous.inspectorOpen??true;
  const directoryToggle=button('全部截图',()=>{directoryOpen=matchMedia('(max-width:899px)').matches?true:!directoryOpen;syncPanels();if(matchMedia('(max-width:899px)').matches)left.scrollIntoView({block:'start'});});
  const inspectorToggle=button('问题列表',()=>{inspectorOpen=matchMedia('(max-width:899px)').matches?true:!inspectorOpen;syncPanels();if(matchMedia('(max-width:899px)').matches)right.scrollIntoView({block:'start'});});
  directoryToggle.setAttribute('aria-controls',left.id);inspectorToggle.setAttribute('aria-controls',right.id);
  panels.append(directoryToggle,inspectorToggle);
  function syncPanels(){left.hidden=!directoryOpen;right.hidden=!inspectorOpen;root.dataset.directory=String(directoryOpen);root.dataset.inspector=String(inspectorOpen);directoryToggle.setAttribute('aria-expanded',String(directoryOpen));inspectorToggle.setAttribute('aria-expanded',String(inspectorOpen));}
  root.append(actionContainer,panels,metadata,center,right,left);syncPanels();
  const comparisonHashes=new Map();
  const primary=mountReviewAction(actionContainer,run,{onChanged:previous.onChanged,onFoundation:()=>{location.href=reviewLink(run.manifest.id,'list')+'#foundation-title';}});
  const planning=reviewPlanning(run,{onChanged:previous.onChanged});
  let filters=null,pendingFilterFocus=null;
  function renderDirectory(){
    pendingFilterFocus=filters?.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
    const focusedCapture=left.contains(document.activeElement)?document.activeElement.dataset.captureId:null;
    const previousGallery=left.querySelector('.page-review-gallery'),galleryScroll={top:previousGallery?.scrollTop||0,left:previousGallery?.scrollLeft||0};
    const header=el('div','page-review-directory-header');metadata.replaceChildren(header);left.replaceChildren();filters=el('div','page-review-filters');
    const addScope=!state.readOnly?button('补充页面与交互范围',()=>planning.open()):null;
    const approval=run.manifest.onboarding?.config?.reviewPlanApproval;
    if(approval?.discoveryGaps?.length){const gaps=el('section','page-review-scope-gaps');gaps.append(el('h3','',t('计划之外的证据缺口')));for(const gap of approval.discoveryGaps)gaps.append(el('p','review-muted',(gap.url||'')+' / '+gap.reason));metadata.append(gaps);}
    const choose=(candidates)=>{selected=candidates.find(node=>node.entry.stateId===selected?.entry.stateId)||candidates.find(node=>node.available&&['full-page','page-surfaces'].includes(node.entry.captureMode))||candidates.find(node=>node.available)||candidates[0];renderDirectory();renderContent();renderInspector();};
    const field=(name,options,value,onchange)=>{const wrap=el('label','page-review-picker',t(name)),select=el('select');select.setAttribute('aria-label',t(name));for(const [key,text] of options){const option=el('option','',text);option.value=key;select.append(option);}select.value=value||'';select.onchange=()=>onchange(select.value);wrap.append(select);filters.append(wrap);};
    const configurations=[...new Set(targets.map(node=>node.entry.configurationId))];
    field('查看设备',configurations.map(id=>[id,t(id)]),selected?.entry.configurationId,id=>choose(targets.filter(node=>node.entry.configurationId===id&&node.phase===selected?.phase).length?targets.filter(node=>node.entry.configurationId===id&&node.phase===selected?.phase):targets.filter(node=>node.entry.configurationId===id)));
    const phases=[...new Set(targets.filter(node=>node.entry.configurationId===selected?.entry.configurationId).map(node=>node.phase))];
    field('查看版本',phases.map(phase=>[phase,t(phase==='before'?'修改前':'修改后')]),selected?.phase,phase=>choose(targets.filter(node=>node.entry.configurationId===selected?.entry.configurationId&&node.phase===phase)));
    const visible=targets.filter(node=>node.entry.configurationId===selected?.entry.configurationId&&node.phase===selected?.phase);
    field('查看页面状态',visible.map(node=>[node.id,(node.entry.title||t(node.entry.stateId))+(node.available?'':' / '+t('采集失败或缺少截图'))]),selected?.id,id=>{selected=targets.find(node=>node.id===id);renderDirectory();renderContent();renderInspector();});
    if(selected&&!selected.available)metadata.append(el('p','page-review-gap',t('当前状态未采集成功。请查看覆盖详情中的原始失败原因。')));
    const captured=targets.filter(node=>node.available).length,cited=targets.filter(node=>node.cited).length;
    const coverage=reviewCoverage(targets);
    const details=el('div','page-review-coverage-overview');header.append(details);if(addScope)header.append(addScope);
    const failures=targets.filter(node=>!node.available),afterFailures=failures.filter(node=>node.phase==='after');
    if(afterFailures.length)metadata.append(el('p','page-review-gap',t`修改后有 ${afterFailures.length} 个状态缺少证据，暂不能完成复核。`));
    else if(failures.length)metadata.append(el('p','review-muted',t`修改前有 ${failures.length} 个状态未采集成功，原始记录保留在覆盖详情中。`));
    details.append(el('p','review-muted',`${t('已采集')} ${captured}/${targets.length} / ${t('复核已引用')} ${cited}/${targets.length}`));
    details.append(el('p','page-review-coverage',t`路由 ${coverage.routes} / 状态 ${coverage.states} / 交互 ${coverage.interactions}`));
    if(coverage.wholePageEvidence.total)details.append(el('p','review-muted',t`整页截图：已采集 ${coverage.wholePageEvidence.captured}/${coverage.wholePageEvidence.total} / 复核已引用 ${coverage.wholePageEvidence.cited}/${coverage.wholePageEvidence.total}`));
    if(!coverage.interactions)details.append(el('p','page-review-gap',t('尚未计划交互状态。菜单、弹窗、表单和错误恢复仍未审阅。')));
    else {
      const interaction=coverage.interactionEvidence;
      details.append(el('p','review-muted',t`交互证据：已采集 ${interaction.captured}/${interaction.total} / 复核已引用 ${interaction.cited}/${interaction.total}`));
      if(interaction.captured<interaction.total)details.append(el('p','page-review-gap',t('部分交互证据未采集成功。打开“项目与任务”查看失败原因并重新采集。')));
      else if(interaction.cited<interaction.total)details.append(el('p','page-review-gap',t('交互已采集，但独立复核尚未引用全部证据。已采集不等于已通过。')));
    }
    if(coverage.failed)details.append(el('p','page-review-gap',t`${coverage.failed} 个证据采集失败。打开“项目与任务”重新采集，失败原因会保留。`));
    const gallery=el('div','page-review-gallery');left.append(gallery);
    for(const target of targets){
      const entry=button(label(target),()=>{selected=target;renderDirectory();renderContent();renderInspector();},target.id===selected?.id);
      entry.className='page-review-target';entry.dataset.captureId=target.id;entry.textContent='';entry.title=label(target);entry.setAttribute('aria-label',label(target));if(target.available){const thumb=el('img','page-review-thumbnail');thumb.src=`${run.base}/${target.screenshot}`;thumb.alt='';thumb.loading='lazy';entry.prepend(thumb);}if(!target.available)entry.append(el('span','review-target-status',t(!target.available?'采集失败或缺少截图':'复核已引用')));gallery.append(entry);
    }


    gallery.scrollTop=galleryScroll.top;gallery.scrollLeft=galleryScroll.left;
    if(focusedCapture)[...gallery.querySelectorAll('button')].find(node=>node.dataset.captureId===focusedCapture)?.focus({preventScroll:true});
  }
  function renderContent(){
    observer?.disconnect();observer=null;if(resizeFrame!==null)cancelAnimationFrame(resizeFrame);resizeFrame=null;activeFrame=null;
    center.replaceChildren();const toolbar=el('div','page-review-toolbar');
    const tools=el('div','page-review-tools');
    if(run.manifest.captures.after)toolbar.append(button('前后对比',()=>{mode='compare';renderContent();},mode==='compare'));
    const liveReady=livePreviewAvailable(preview),live=button('实时页面',()=>{mode='live';renderContent();},mode==='live');live.disabled=!liveReady;
    tools.append(button('历史证据',()=>{mode='evidence';renderContent();},mode==='evidence'));if(liveReady||preview?.managed)tools.append(live);toolbar.append(tools);
    const canStart=preview&&!preview.managed&&preview.sourceStatus==='source-match'&&['preview-stopped','preview-unavailable'].includes(preview.versionStatus);
    if(preview?.managed||canStart){const managed=button(preview.managed?'停止受管理预览':'启动受管理预览',async()=>{managed.disabled=true;previewError='';try{await workbenchApi(preview.managed?'preview/stop':'preview/start',{runId:run.manifest.id});await refreshState();}catch(error){previewError=error.message;renderContent();}finally{managed.disabled=false;}});tools.append(managed);}
    const zoom=button(fitWidth?'实际尺寸':mode==='evidence'?'完整显示':'适配宽度',()=>{fitWidth=!fitWidth;renderContent();});zoom.disabled=!selected?.available&&mode!=='live';tools.append(zoom);
    if (mode==='evidence' && selected?.available) {
      const annotate=el('a','wb-button',t('批注当前截图'));
      annotate.href=`?case=${encodeURIComponent('run:'+run.manifest.id)}&view=canvas&tools=legacy&capture=${encodeURIComponent(selected.id)}&lang=${document.documentElement.lang.startsWith('en')?'en':'zh'}`;
      tools.append(annotate);
    }
    if(selected)toolbar.append(el('span','review-muted',mode==='live'?`${t(selected.entry.configurationId)} / ${selected.entry.width} × ${selected.entry.height}`:label(selected)));
    center.append(toolbar);
    const evidenceStatus=t('固定截图证据 / 内容来自采集时刻，不是可编辑的设计稿。');
    const statusText=mode==='live'?t(previewStatus(preview)):evidenceStatus+(!liveReady&&preview?` ${t(previewStatus(preview))}`:'');
    const status=el('p','page-review-preview-status',statusText+(mode==='live'&&preview?.versionStatus==='verified'&&preview.fingerprint?` / ${preview.fingerprint.slice(0,12)}`:''));if(mode==='live')center.append(status);
    if(previewError)center.append(el('p','page-review-preview-status',`${t('操作失败')}: ${previewError}`));
    if(mode==='evidence'&&(selected?.entry.plannedScrollSurface||selected?.entry.finalStateEvidence?.length)){
      const surface=selected.entry.scrollSurface,planned=selected.entry.plannedScrollSurface;
      if(planned)center.append(el('p','review-muted',surface?`${t('内部滚动分段')} / ${surface.interval.start}–${surface.interval.end} / ${surface.scrollHeight}px / ${t('仅记录当前可见范围，不代表整页或组件状态通过。')}`:t('滚动分段未采集成功，请查看失败原因。')));
      const details=el('details','page-review-capture-details'),summary=el('summary','',t('查看采集位置与最终状态')),pre=el('pre');pre.textContent=JSON.stringify({planned,surface,finalStateEvidence:selected.entry.finalStateEvidence||[]},null,2);details.append(summary,pre);center.append(details);
    }
    if(mode==='evidence')appendPageSurfaceLinks(center,run.base,selected?.phase,selected?.entry);
    const stage=el('div','page-review-stage');center.append(stage);
    if(mode==='live'&&liveReady){
      const shell=el('div','page-review-frame-shell'),frame=createControl('iframe');
      const width=selected?.entry.width||1280,height=selected?.entry.height||800;
      frame.title=t('当前项目实时预览');frame.src=preview.url;frame.width=width;frame.height=height;
      frame.setAttribute('sandbox','allow-scripts allow-forms allow-same-origin allow-popups');frame.referrerPolicy='no-referrer';frame.className='page-review-frame';shell.append(frame);stage.append(shell);activeFrame=frame;
      const fit=()=>{const scale=fitWidth?Math.min(1,Math.max(.1,(stage.clientWidth-24)/width)):1;shell.style.width=`${width*scale}px`;shell.style.height=`${height*scale}px`;frame.style.transform=`scale(${scale})`;};
      const scheduleFit=()=>{if(resizeFrame!==null)cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{resizeFrame=null;fit();});};
      observer=new ResizeObserver(scheduleFit);observer.observe(stage);scheduleFit();
      const external=el('a','review-preview-link',t('在新窗口操作完整页面'));external.href=preview.url;external.target='_blank';external.rel='noopener noreferrer';stage.append(external);
      stage.append(el('p','review-muted',t('页面可直接滚动与操作；固定证据和覆盖状态需要重新采集后才更新。')));
    }else if(mode==='compare'&&selected?.available&&targets.some(node=>node.key===selected.key&&node.phase!==selected.phase&&node.available)){
      const pair=el('div','page-review-comparison');
      for(const phase of ['before','after']){const target=targets.find(node=>node.key===selected.key&&node.phase===phase),figure=el('figure');figure.append(el('figcaption','',t(phase==='before'?'修改前':'修改后')));const image=el('img','page-review-evidence');image.src=`${run.base}/${target.screenshot}`;image.alt=label(target);const link=previewLink(image);figure.append(link);pair.append(figure);}stage.append(pair);const comparisonStatus=el('p','review-muted',t('前后截图对照，包含未修改的回归页面。'));stage.prepend(comparisonStatus);const refs=pair.querySelectorAll('img');Promise.all([...refs].map(async image=>{if(!comparisonHashes.has(image.src))comparisonHashes.set(image.src,fetch(image.src).then(response=>{if(!response.ok)throw Error('Image unavailable');return response.arrayBuffer();}).then(bytes=>crypto.subtle.digest('SHA-256',bytes)).then(hash=>[...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('')));return comparisonHashes.get(image.src);})).then(([before,after])=>{if(comparisonStatus.isConnected&&before===after)comparisonStatus.textContent=t('当前截图前后完全相同，作为回归对照。');}).catch(()=>{});
    }else if(selected?.available){
      stage.classList.toggle('fit-evidence',fitWidth);
      const image=el('img','page-review-evidence');image.classList.toggle('actual-size',!fitWidth);stage.classList.toggle('actual-size',!fitWidth);image.src=`${run.base}/${selected.screenshot}`;image.alt=label(selected);const original=previewLink(image);stage.append(original);
      if(fitWidth){
        // Fit the whole saved image, not just its width. Preserve original pixels.
        const fit=()=>{if(!image.naturalWidth||!stage.isConnected)return;const style=getComputedStyle(stage),width=stage.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height=stage.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);const scale=Math.min(1,Math.max(1,width)/image.naturalWidth,Math.max(1,height)/image.naturalHeight);image.style.width=`${image.naturalWidth*scale}px`;image.style.height=`${image.naturalHeight*scale}px`;};
        const scheduleFit=()=>{if(resizeFrame!==null)cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{resizeFrame=null;fit();});};
        image.addEventListener('load',scheduleFit,{once:true});observer=new ResizeObserver(scheduleFit);observer.observe(stage);scheduleFit();
      }
      const counterpart=targets.find(node=>node.key===selected.key&&node.phase!==selected.phase);
      if(counterpart)toolbar.insertBefore(button(selected.phase==='before'?'查看修改后':'查看修改前',()=>{selected=counterpart;renderDirectory();renderContent();renderInspector();}),toolbar.querySelector('span'));
    }else{stage.append(el('p','page-review-unavailable',selected?.entry.error||t('没有可用截图。请补齐采集后再判断。')));}
  }
  function renderInspector(){
    const expanded=new Set([...right.querySelectorAll('details[data-review-detail]')].filter(item=>item.open).map(item=>item.dataset.reviewDetail));
    const preserve=(details,key)=>{details.dataset.reviewDetail=key;details.open=expanded.has(key);return details;};
    const focusedFilter=pendingFilterFocus||(filters?.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null);pendingFilterFocus=null;
    const inspectorHeader=el('div','page-review-inspector-header');inspectorHeader.append(el('h2','',t('问题列表')),filters);right.replaceChildren(inspectorHeader);if(!run.manifest.captures.after&&run.diagnosis?.modelDiagnosis){const summary=el('details','page-review-diagnosis');summary.append(el('summary','',t('诊断摘要')),el('p','',run.diagnosis.modelDiagnosis.summary));right.append(summary);}
    const excluded=(run.diagnosis?.findings||[]).length-findings.length;if(excluded>0){const note=el('details','page-review-unverified');note.append(el('summary','',t('未录入的诊断建议')+` (${excluded})`),el('p','review-muted',t('这些旧建议或规则命中缺少当前录入标准要求的明确依据，不算已确认问题，也不会自动修复。')));const raw=el('a','',t('查看原始诊断记录'));raw.href=run.base+'/diagnosis.json';raw.target='_blank';raw.rel='noopener noreferrer';note.append(raw);right.append(note);}
    const currentCount=associations.filter(item=>item.regions.some(region=>region.targetId===selected?.id)).length;
    if(selected&&findings.length)right.append(el('p','page-review-region-summary',currentCount?`${t('引用当前截图的问题记录')} / ${currentCount}`:t('当前截图没有对应的已录入问题，以下是其他页面的问题。')));
    if(!findings.length)right.append(el('p','',t('尚未形成有证据的问题。请先完成采集与诊断。')));
    for(const [index,finding] of findings.entries()){
      const association=associations.find(item=>item.findingId===finding.id)||{components:[],regions:[],locations:[],unlocated:true};
      const relatesToSelected=association.regions.some(region=>region.targetId===selected?.id);
      const summary=findingSummary(finding);
      const card=el('article',`page-review-finding${relatesToSelected?' is-current-region':''}`);card.append(el('h3','',summary.title));

      if(relatesToSelected)card.append(el('span','page-review-association-badge',t('证据引用此截图，具体缺陷以判断依据为准')));
      if(finding.findingBasis){const basis=finding.findingBasis,details=el('details','page-review-finding-basis');details.open=true;details.append(el('summary','',t('依据与错误判断')));for(const [key,name]of[['observed','实际观察'],['expected','预期'],['whyWrong','为何属于错误']])details.append(el('p','',t(name)+'：'+basis[key]));for(const ref of basis.skillRefs){const row=el('p','page-review-skill-ref');const source=el('a','',`${ref.path}:${ref.line} / ${ref.section}`);source.href=run.base+'/'+ref.path.split('/').map(encodeURIComponent).join('/');source.target='_blank';source.rel='noopener noreferrer';row.append(source,el('span','',ref.quote),el('span','',t(ref.authority==='requirement'?'明确要求':'参考原则')+'：'+ref.application));details.append(row);}details.append(el('p','',t('已排除的正常取舍')+'：'+basis.alternativesChecked.join(' / ')));card.append(details);}
      const sourceDetails=preserve(el('details'),'source:'+finding.id);sourceDetails.append(el('summary','',t('查看关联页面与源码')));if(association.components.length||association.locations.length||association.regions.length)card.append(sourceDetails);
      if(association.components.length){
        for(const component of association.components){
          const source=el('p','page-review-source');source.append(el('strong','',`${t('组件')} / ${component.name}`),el('span','',component.source));sourceDetails.append(source);
        }
      }
      if(association.locations.length){
        for(const location of association.locations){
          const source=el('p','page-review-source-location');source.append(el('strong','',`${t('已核验源码位置')} / ${location.source.component||t('页面区域')}`),el('span','',`${location.source.file}:${location.source.line}`),el('span','',`${t('DOM 选择器')} / ${location.selector}`));sourceDetails.append(source);
        }
      }
      if(association.regions.length){
        const regionGroup=el('div','page-review-regions');regionGroup.append(el('span','review-muted',t('页面区域')));
        for(const region of association.regions){
          const target=targets.find(item=>item.id===region.targetId);if(!target)continue;
          const regionButton=button('',()=>{selected=target;renderDirectory();renderContent();renderInspector();},target.id===selected?.id);
          regionButton.textContent=`${t(region.confidence==='verified'?'证据引用':'候选关联')} / ${label(target)}`;
          regionButton.className=`page-review-region ${region.confidence}`;regionButton.title=t(region.confidence==='verified'?'证据引用此状态，不代表该页面已被确认存在缺陷':'组件名称与采集状态名称相同，仍需人工确认');regionGroup.append(regionButton);
        }
        sourceDetails.append(regionGroup);
      }else if(association.unlocated)sourceDetails.append(el('p','review-muted',t('未定位：现有证据没有明确页面状态或唯一组件来源。')));
      if(summary.proposal)card.append(el('p','',summary.proposal));
      const original=preserve(el('details'),'finding:'+finding.id);original.append(el('summary','',t('查看原始诊断')),el('p','',finding.title),el('p','',(finding.evidenceRefs||finding.evidenceIds||[]).join(' / ')));card.append(original);
      if(state.workflow?.stage==='awaiting-confirmation'&&!state.readOnly)card.append(button('修复此问题',()=>primary.open(finding.id)));
      right.append(card);
    }

    const qa=state.reviews?.find(review=>review.skillId==='visual-qa-evaluator');right.append(el('h2','',t('独立复核')));
    if(qa){right.append(el('span','page-review-verdict',t(qa.verdict)));appendVisualCoverage(right,qa);appendReviewResolutions(right,qa,run);const brand=appendBrandAssessments(right,qa,run);if(brand)preserve(brand,'brand-assessments');const details=preserve(el('details',''),'qa'),summary=el('summary','',t('查看完整复核与证据'));details.append(summary,el('p','',qa.rationale));for(const finding of qa.findings||[])right.append(el('p','page-review-gap',finding.title+': '+finding.observation));for(const ref of qa.screenshotRefs){const link=el('a','',ref);link.href=`${run.base}/${ref}`;link.target='_blank';link.rel='noopener noreferrer';details.append(link);}for(const item of qa.limitations)details.append(el('p','',item));right.append(details);}
    else right.append(el('p','review-muted',t('尚无独立复核结论。已采集不等于已通过。')));
    if(qa?.verificationRefs?.length)right.append(el('p','review-muted',`${t('已自动带入专项验证')}：${qa.verificationRefs.join(' / ')}`));
    const history=state.reviewHistory||run.manifest.visualReviewHistory||[];
    if(history.length){const details=preserve(el('details'),'qa-history');details.append(el('summary','',t('查看补证前的复核记录')));for(const review of history){if(!/^reviews\/[a-z0-9-]+\.json$/.test(review.path||''))continue;const link=el('a','',`${review.reviewedAt} / ${t(review.verdict)}`);link.href=`${run.base}/${review.path}`;link.target='_blank';link.rel='noopener noreferrer';details.append(link);}right.append(details);}
    if(state.readOnly)right.append(el('p','review-muted',t('这是导出的审阅记录；连接原始运行后才能复核或记录决定。')));
    const advanced=el('div','page-review-active-jobs');right.append(advanced);
    for(const job of (state.jobs||[]).filter(job=>['queued','running','cancelling','failed'].includes(job.status))){const card=el('p','review-job',`${t(job.kind)} / ${t(job.status)}`);if(job.error)card.append(el('span','',job.error));advanced.append(card);}
    if(focusedFilter)[...filters.querySelectorAll('select')].find(node=>node.getAttribute('aria-label')===focusedFilter)?.focus({preventScroll:true});
  }
  renderDirectory();renderContent();renderInspector();
  async function refreshState(){
    if(disposed||refreshing)return;
    refreshing=true;
    try{
      const next=await workbenchApi('state?run='+encodeURIComponent(run.manifest.id));
      if(disposed)return;
      const selectedId=selected?.id,hadLivePreview=livePreviewAvailable(preview);
      const previousPreview=JSON.stringify(preview),previousTargets=JSON.stringify(targets),previousState=JSON.stringify(state);
      state={...next,readOnly:!next.project};targets=reviewTargets(run,state.reviews);associations=reviewAssociations(run,targets,findings);
      selected=targets.find(node=>node.id===selectedId)||targets.find(node=>node.phase==='after'&&node.available)||targets[0];
      preview=currentPreview(next.project?.preview,location.origin);
      const hasLivePreview=livePreviewAvailable(preview);
      // Preserve active device/state controls while unchanged background polls complete.
      if(previousTargets!==JSON.stringify(targets)||JSON.parse(previousState).readOnly!==state.readOnly)renderDirectory();
      if(!hasLivePreview&&mode==='live')mode=run.manifest.captures.after?'compare':'evidence';
      if(previousPreview!==JSON.stringify(preview))renderContent();
      if(previousState!==JSON.stringify(state))renderInspector();
    }finally{refreshing=false;}
  }
  try{await refreshState();}catch{/* Exported evidence remains useful without a live run. */}
  timer=setInterval(()=>refreshState().catch(()=>{}),3000);
  return {snapshot:()=>({captureId:selected?.id,directoryOpen,inspectorOpen,fitWidth}),destroy:async()=>{imagePreview?.close();disposed=true;planning.destroy();primary.destroy();clearInterval(timer);observer?.disconnect();if(resizeFrame!==null)cancelAnimationFrame(resizeFrame);if(activeFrame)activeFrame.src='about:blank';root.remove();}};
}
