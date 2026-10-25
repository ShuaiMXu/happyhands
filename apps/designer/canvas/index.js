import { t } from '../i18n.js';
import { stageLabel, workflowReason } from '../workflow-copy.js';
import { Stage } from './stage.js';
import { buildNodes, renderNode, safeScreenshot } from './nodes.js';
import { autoLayout, loadLayout, saveLayout, clearLayout } from './layout.js';
import { workflowState } from '../../../packages/harness-core/workflow.js';
export { renderCodeDiff } from './codediff.js';
const $=id=>document.getElementById(id);
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
const message=text=>{if($('studio-message'))$('studio-message').textContent=text;};
export function stageCommand(run){
 const m=run.manifest,s=workflowState(m).stage,dir=`.harness/runs/${m.id}`,f=m.findingId || run.diagnosis?.findings?.[0]?.id || t('‹问题 ID›');
 const prefix=`pnpm harness `,newRun=`${prefix}init --spec ${dir}/experience.json${m.url ? ` --url ${JSON.stringify(m.url)}` : ' --mode bootstrap'}`;
 const commands={
 'needs-baseline':t`capture --run ${dir} --phase before --url ‹预览地址›`,
 'needs-diagnosis':`diagnose --run ${dir}`,'awaiting-confirmation':t`confirm --run ${dir} --finding ${f} --verdict supported --note ‹确认理由›`,
 'needs-plan':`plan --run ${dir} --finding ${f}`,'needs-execution':t`execute --run ${dir} --repo ‹项目仓库路径› --agent codex`,
 'needs-after-capture':t`capture --run ${dir} --phase after --url ‹隔离工作区预览地址›`,
 'needs-structural-evaluation':`evaluate --run ${dir}`,'needs-visual-qa':`attest --run ${dir} --input ‹visual-qa.json›`,
 'visual-qa-failed':t`judge --run ${dir} --decision reject --reason ‹拒绝理由›`,
 'awaiting-judgment':t`judge --run ${dir} --decision ‹accept/reject› --reason ‹判断理由›`,
 'complete':`skill --run ${dir} --skill judgment-distiller`,
 'needs-absent-baseline':t`baseline --run ${dir} --reason ‹缺少基线的原因›`,
 'needs-foundation-approval':t`foundation-approve --run ${dir} --input ‹批准文件.json›`,
 'needs-first-render-plan':`plan --run ${dir}`};
 return {command:commands[s] ? prefix+commands[s]:newRun,newRun};
}
export async function renderCanvas(container,run,previous={}){
 const abort=new AbortController(),on=(el,type,fn,options={})=>el?.addEventListener(type,fn,{...options,signal:abort.signal});
 container.replaceChildren();
 let evaluation=null;
 if(run.manifest.evaluation){try{const r=await fetch(`${run.base}/evaluation.json`,{cache:'no-store'});if(!r.ok)throw Error();evaluation=await r.json();}catch{message(t('结构评估读取失败；截图仍可审阅，结构变化筛选不可用。'));}}
 const rawNodes=buildNodes({...run,evaluation}),keyOrder=[...new Set(rawNodes.map(n=>n.key))];
 const nodes=rawNodes.sort((a,b)=>keyOrder.indexOf(a.key)-keyOrder.indexOf(b.key) || (a.phase==='before'?-1:1)),nodeMap=new Map(nodes.map(n=>[n.id,n])),elements=new Map();
 const findings=run.diagnosis?.findings || [];
 const stageEl=make('div','pd-canvas-stage');stageEl.tabIndex=0;stageEl.setAttribute('aria-label',t('界面对照画布，空格拖动平移，Ctrl 加滚轮缩放'));
 const layer=make('div','pd-canvas-layer');stageEl.append(layer);container.append(stageEl);
 const stage=new Stage(stageEl),layout=autoLayout(nodes.map(n=>n.entry),{hasAfter:nodes.some(n=>n.phase==='after') && nodes.some(n=>n.phase==='before')});
 let saved=loadLayout(run.manifest.id),selected=previous.selected || null,diff=Boolean(previous.diff && evaluation),focusedFinding=null,dragged=false;
 const hasBefore=nodes.some(n=>n.phase==='before');
 const objectBar=make('div','studio-object-tools');objectBar.hidden=true;objectBar.setAttribute('aria-label',t('选中截图操作'));
 const openObject=make('button','',t('放大查看')),pairObject=make('button','',t('定位对照')),detailObject=make('button','',t('证据详情'));
 for(const b of [openObject,pairObject,detailObject])b.type='button';objectBar.append(openObject,pairObject,detailObject);container.append(objectBar);
 on(openObject,'click',()=>{if(selected)lightbox(nodeMap.get(selected));});
 on(pairObject,'click',()=>{const n=nodeMap.get(selected);const other=n && nodeMap.get(`${n.phase==='before'?'after':'before'}:${n.key}`);if(other)choose(other,true);});
 on(detailObject,'click',()=>{const n=nodeMap.get(selected);if(n){$('fullscreen-shell').classList.remove('studio-hide-inspector');$('studio-toggle-inspector').setAttribute('aria-pressed','true');inspect(n);}});
 function updateObjectBar(){const n=nodeMap.get(selected);if(!n || focusedFinding || matchMedia('(max-width:899px)').matches){objectBar.hidden=true;return;}const r=elements.get(n.id)?.getBoundingClientRect(),c=container.getBoundingClientRect();if(!r || r.bottom<c.top || r.top>c.bottom || r.right<c.left || r.left>c.right){objectBar.hidden=true;return;}objectBar.hidden=false;openObject.disabled=!safeScreenshot(n.phase,n.entry)||n.entry.reached===false;pairObject.disabled=!n.paired;const width=objectBar.offsetWidth;objectBar.style.left=`${Math.max(12,Math.min(c.width-width-12,r.left-c.left+r.width/2-width/2))}px`;objectBar.style.top=`${Math.max(12,Math.min(c.height-52,r.top-c.top-52))}px`;}
 const setTool=mode=>{stage.mode=mode;stageEl.dataset.tool=mode;stageEl.style.cursor=mode==='hand'?'grab':'';$('studio-select-tool').setAttribute('aria-pressed',String(mode==='select'));$('studio-hand-tool').setAttribute('aria-pressed',String(mode==='hand'));};
 on($('studio-select-tool'),'click',()=>setTool('select'));on($('studio-hand-tool'),'click',()=>setTool('hand'));setTool(previous.tool || 'select');
 let grid=previous.grid !== false;stageEl.classList.toggle('studio-grid-off',!grid);$('studio-grid-tool').setAttribute('aria-pressed',String(grid));on($('studio-grid-tool'),'click',()=>{grid=!grid;stageEl.classList.toggle('studio-grid-off',!grid);$('studio-grid-tool').setAttribute('aria-pressed',String(grid));});
 const resize=new ResizeObserver(()=>updateObjectBar());resize.observe(container);

 const refsFor=n=>[`capture:${n.phase}:${n.key}`,...(n.entry.legacy?[`capture:${n.phase}:${n.entry.configurationId}`]:[])];
 const targets=f=>nodes.filter(n=>(f.evidenceRefs || []).some(ref=>refsFor(n).includes(ref)));
 const related=n=>findings.filter(f=>(f.evidenceRefs || []).some(ref=>refsFor(n).includes(ref)));
 function position(n){const p=layout.positions.get(n.key);return {...p,x:n.phase==='after' && hasBefore?p.afterX:p.x,...saved.get(n.id)};}
 function applyDimming(){for(const n of nodes){elements.get(n.id)?.classList.toggle('pd-dim',focusedFinding?!targets(focusedFinding).some(t=>t.id===n.id):diff && n.changed===false);} $('pd-fs-diff').setAttribute('aria-pressed',String(diff));updateObjectBar();}
 function fitAll(){const positions=nodes.map(position);const maxX=Math.max(layout.totalWidth,...positions.map(p=>p.x+p.w)),maxY=Math.max(layout.totalHeight,...positions.map(p=>p.y+p.h+40));stage.fit(maxX,maxY);}
 function choose(n,focus=false){selected=n.id;focusedFinding=null;for(const [id,el] of elements){el.classList.toggle('pd-selected',id===selected);}for(const button of $('pd-sidebar-tree').querySelectorAll('[data-node]'))button.setAttribute('aria-pressed',String(button.dataset.node===selected));inspect(n);applyDimming();if(focus)stage.fitNode(elements.get(n.id));}
 function row(label,value){const e=make('div','studio-detail-row');e.append(make('span','',label),make('strong','',String(value ?? '—')));return e;}
 function evidenceButton(text,action){const b=make('button','studio-evidence-link',text);b.type='button';on(b,'click',action);return b;}
 function inspect(n){const body=$('pd-inspector-body');body.replaceChildren();if(!n){body.append(make('div','studio-empty-icon','⌗'),make('h2','',t('把注意力放在界面上')),make('p','',t('选择截图查看状态与检查结果。选择问题，追溯它引用的证据。')),make('p','',t('双击截图可放大查看；前后对照仅在相同状态和配置间配对。')));return;}
  body.append(make('span','studio-eyebrow',n.phase==='before'?t('BASELINE / 修改前'):t('RESULT / 修改后')),make('h2','',t(n.entry.stateId)),row(t('配置'),t(n.entry.configurationId)),row(t('视口'),`${n.entry.width ?? '—'} × ${n.entry.height ?? '—'}`),row(t('可达状态'),n.entry.reached===false?t('未到达'):`HTTP ${n.entry.status ?? '—'}`),row(t('页面地址'),n.entry.finalUrl || n.entry.start?.url || run.manifest.url));
  const shot=safeScreenshot(n.phase,n.entry);if(shot)body.append(evidenceButton(t('放大查看截图 ↗'),()=>lightbox(n)));
  if(n.checks){body.append(make('h3','studio-section-label',t('结构检查 · 不代表视觉质量')));for(const [key,ok] of Object.entries(n.checks))body.append(make('span',`studio-badge ${ok?'pass':'fail'}`,`${ok?t('通过'):t('未通过')} · ${t(key)}`));}else body.append(make('p','',t('尚无此状态的结构评估。')));
  const issues=related(n);body.append(make('h3','studio-section-label',t`关联问题 · ${issues.length}`));for(const f of issues)body.append(evidenceButton(`${f.id} · ${f.title}`,()=>inspectFinding(f)));
  if(!issues.length)body.append(make('p','',run.diagnosis?t('没有问题明确引用这张截图。'):t('尚未生成诊断证据图。')));
  if(run.manifest.execution?.changedFiles?.length){body.append(make('h3','studio-section-label',t('本次执行涉及文件')));for(const path of run.manifest.execution.changedFiles)body.append(make('p','',path));body.append(make('p','',t('文件清单属于本次执行，尚无截图与代码行的因果映射。')));}
 }
 function inspectFinding(f){focusedFinding=f;applyDimming();const body=$('pd-inspector-body');body.replaceChildren(make('span','studio-eyebrow',t`FINDING / ${f.id}`),make('h2','',f.title),row(t('证据状态'),t(f.verificationStatus || '待确认')),row(t('排序值'),Number.isFinite(f.priority)?f.priority.toFixed(1):t('未提供')));if(f.proposal)body.append(make('p','',typeof f.proposal==='string'?f.proposal:JSON.stringify(f.proposal)));body.append(make('h3','studio-section-label',t('引用证据')));
  for(const ref of f.evidenceRefs || []){const target=nodes.find(n=>refsFor(n).includes(ref));body.append(target?evidenceButton(`${target.phase==='before'?t('修改前'):t('修改后')} · ${t(target.entry.stateId)} / ${t(target.entry.configurationId)}`,()=>choose(target,true)):make('p','',ref));}
  body.append(make('p','',t('修改后请在对应状态上观察此问题是否解决。这里不会自动宣称问题已修复。')));
 }
 function lightbox(n){const shot=safeScreenshot(n.phase,n.entry);if(!shot || n.entry.reached===false)return;const dialog=$('studio-lightbox');$('studio-lightbox-title').textContent=`${n.phase==='before'?t('修改前'):t('修改后')} · ${t(n.entry.stateId)} / ${t(n.entry.configurationId)}`;$('studio-lightbox-image').src=`${run.base}/${shot}`;$('studio-lightbox-image').alt=$('studio-lightbox-title').textContent;$('studio-lightbox-original').href=`${run.base}/${shot}`;dialog.showModal();}
 function paint(){layer.replaceChildren();elements.clear();for(const state of layout.states){const label=make('div','pd-row-label',t(state));label.style.top=`${layout.rowOffsets.get(state)}px`;label.append(make('small','',t('同状态 · 同配置')));layer.append(label);}
  for(const n of nodes){const p=position(n),el=renderNode(n,run.base);el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;el.style.width=`${p.w}px`;elements.set(n.id,el);layer.append(el);
   on(el,'click',e=>{if(e.target.closest('button') || dragged || stage.mode==='hand' || stage.space)return;choose(n);});on(el,'keydown',e=>{if(e.target!==el)return;if(e.key==='Enter'){e.preventDefault();choose(n);}if(e.key===' '){e.preventDefault();choose(n);}});on(el,'dblclick',e=>{if(!e.target.closest('button'))lightbox(n);});
   on(el.querySelector('[data-jump]'),'click',e=>{e.stopPropagation();const other=nodeMap.get(`${n.phase==='before'?'after':'before'}:${n.key}`);if(other)choose(other,true);});
   if(n.phase==='before'){const group=make('div','studio-pin-list');for(const f of related(n)){const b=make('button','pd-pin',`${f.id} · ${f.title}`);b.type='button';b.title=f.title;b.dataset.status=f.verificationStatus || '';on(b,'click',e=>{e.stopPropagation();inspectFinding(f);});group.append(b);}if(group.childElementCount)el.append(group);}
   let drag=null;on(el,'pointerdown',e=>{if(e.button!==0 || stage.space || stage.mode==='hand' || e.target.closest('button') || matchMedia('(max-width:899px)').matches)return;dragged=false;const at=position(n);drag={x:e.clientX,y:e.clientY,ox:at.x,oy:at.y};el.setPointerCapture(e.pointerId);});
   on(el,'pointermove',e=>{if(!drag)return;const dx=(e.clientX-drag.x)/stage.scale,dy=(e.clientY-drag.y)/stage.scale;if(Math.abs(dx)+Math.abs(dy)<4&&!dragged)return;dragged=true;const pos={x:Math.max(0,drag.ox+dx),y:Math.max(0,drag.oy+dy)};saved.set(n.id,pos);el.style.left=`${pos.x}px`;el.style.top=`${pos.y}px`;updateObjectBar();});
   on(el,'pointerup',()=>{if(drag && dragged)saveLayout(run.manifest.id,saved);drag=null;setTimeout(()=>{dragged=false;},0);});on(el,'pointercancel',()=>{drag=null;});
  }applyDimming();if(selected && nodeMap.has(selected))choose(nodeMap.get(selected));
 }
 paint();
 if(nodes.length>60){
  const ns='http://www.w3.org/2000/svg',map=document.createElementNS(ns,'svg');map.classList.add('studio-minimap');map.setAttribute('viewBox',`0 0 ${layout.totalWidth} ${layout.totalHeight}`);map.setAttribute('aria-label',t('画布小地图，点击定位'));
  for(const n of nodes){const p=position(n),rect=document.createElementNS(ns,'rect');for(const [k,v] of Object.entries({x:p.x,y:p.y,width:p.w,height:p.h}))rect.setAttribute(k,v);map.append(rect);}
  const view=document.createElementNS(ns,'rect');view.classList.add('viewport');map.append(view);container.append(map);
  stage.onChange(()=>{const r=stageEl.getBoundingClientRect();for(const [k,v] of Object.entries({x:-stage.x/stage.scale,y:-stage.y/stage.scale,width:r.width/stage.scale,height:r.height/stage.scale}))view.setAttribute(k,v);});
  on(map,'pointerdown',e=>{map.setPointerCapture(e.pointerId);moveMap(e);});on(map,'pointermove',e=>{if(e.buttons===1)moveMap(e);});
  function moveMap(e){const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(map.getScreenCTM().inverse());const r=stageEl.getBoundingClientRect();stage.x=r.width/2-point.x*stage.scale;stage.y=r.height/2-point.y*stage.scale;stage.refresh();}
 }
 const tree=$('pd-sidebar-tree');tree.replaceChildren();for(const state of layout.states){tree.append(make('h3','studio-tree-heading',t(state)));for(const n of nodes.filter(n=>n.entry.stateId===state)){const b=make('button','studio-tree-item');b.type='button';b.dataset.node=n.id;b.setAttribute('aria-pressed',String(selected===n.id));b.append(make('i',`studio-tree-dot ${n.phase}`),make('span','',t(n.entry.configurationId)),make('span','',n.phase==='before'?t('修改前'):t('修改后')));on(b,'click',()=>choose(n,true));tree.append(b);}}
 tree.append(make('h3','studio-tree-heading',t`诊断问题 · ${findings.length}`));for(const f of findings)tree.append(evidenceButton(`${f.id} · ${f.title}`,()=>inspectFinding(f)));if(!findings.length)tree.append(make('p','studio-sidebar-note',t('尚无诊断。可先审阅已有截图，再运行诊断。')));
 $('studio-state-count').textContent=String(layout.states.length);$('pd-fs-count').textContent=t`${layout.states.length} 个状态 / ${nodes.length} 张证据卡`;$('pd-fs-eval-status').textContent=evaluation?t('已记录结构评估 · 视觉需独立复核'):t('结构评估待完成');
 const diffButton=$('pd-fs-diff');diffButton.disabled=!evaluation;diffButton.title=evaluation?t('按检查结果、标题与可达性筛选，不是像素差异'):t('需先运行 evaluate 并导出结果');
 const toggle=()=>{if(!evaluation)return;focusedFinding=null;diff=!diff;applyDimming();};on(diffButton,'click',toggle);
 on($('pd-fs-fit'),'click',fitAll);on($('pd-fs-reset'),'click',()=>{clearLayout(run.manifest.id);saved=new Map();paint();fitAll();message(t('已恢复自动布局。'));});
 const zoom=factor=>{const r=stageEl.getBoundingClientRect();stage.zoomAt(r.width/2,r.height/2,factor);};on($('pd-zoom-in'),'click',()=>zoom(1.25));on($('pd-zoom-out'),'click',()=>zoom(.8));stage.onChange(()=>{$('pd-zoom-label').textContent=`${Math.round(stage.scale*100)}%`;updateObjectBar();});
 on(document,'keydown',e=>{if(container.hidden || e.target.closest('input,textarea,select,summary') || $('studio-lightbox').open || e.ctrlKey || e.metaKey || e.altKey)return;if(e.key.toLowerCase()==='v')setTool('select');if(e.key.toLowerCase()==='h')setTool('hand');if(e.key.toLowerCase()==='d'){e.preventDefault();toggle();}if(e.key.toLowerCase()==='f'){e.preventDefault();if(!e.shiftKey && selected && elements.has(selected))stage.fitNode(elements.get(selected));else fitAll();}});
 on(stageEl,'click',e=>{if(stage.panMoved || e.target!==stageEl && e.target!==layer)return;selected=null;focusedFinding=null;for(const el of elements.values())el.classList.remove('pd-selected');inspect(null);applyDimming();});on($('studio-lightbox-close'),'click',()=>$('studio-lightbox').close());
 if(!nodes.length){container.append(make('div','pd-canvas-empty',t('此记录没有可展示的截图。请按右侧下一步指引采集并导出证据。')));stageEl.hidden=true;}
 if(previous.transform){Object.assign(stage,previous.transform);stage.refresh();}else fitAll();
 if(selected && nodeMap.has(selected))choose(nodeMap.get(selected));else{inspect(null);if(selected)message(t('所选状态已不在最新数据中。'));selected=null;}
 const state=workflowState(run.manifest),{command,newRun}=stageCommand(run);$('pd-stage-title').textContent=stageLabel(state.stage);$('pd-stage-badge').textContent=state.stage==='complete'?t('已记录'):state.blocked?t('需要确认'):t('待完成');$('pd-stage-card').dataset.blocked=String(state.blocked);
 const descriptions={'needs-diagnosis':t('截图已就绪。运行诊断，将问题与当前证据关联。'),'awaiting-confirmation':t('先查看问题引用的截图，再确认本次要解决的问题与范围。'),'needs-after-capture':t('先启动隔离工作区的预览，再采集相同状态与视口。'),'needs-visual-qa':t('由独立审阅者检查全部配对截图，记录视觉复核证明。'),'awaiting-judgment':t('依据结构检查和视觉复核，记录接受或拒绝的理由。'),'complete':t('判断已保留在记录中。下一轮从新的证据开始。'),'needs-foundation-approval':t('新页面必须遵循人工批准的设计基础。'),'visual-qa-failed':t('存在未解决的视觉问题，只能记录拒绝。')};
 $('pd-stage-desc').textContent=descriptions[state.stage] || workflowReason(state, run.manifest) || t('在本地终端完成操作，再导出记录并重新读取。');$('pd-stage-cmd-text').textContent=command;
 const follow=$('studio-followup');follow.replaceChildren();if(state.stage==='complete'){if(run.manifest.judgment)follow.append(make('p','',`${t(run.manifest.judgment.decision)} · ${run.manifest.judgment.reason}`));const next=findings.find(f=>f.id!==run.manifest.findingId);follow.append(make('p','',next?t`下一项：${next.id} · ${next.title}`:t('本轮没有剩余诊断问题。')));const pre=make('code','',newRun);pre.style.overflowWrap='anywhere';follow.append(pre);}
 on($('pd-stage-copy'),'click',async()=>{try{await navigator.clipboard.writeText(command);message(t('操作命令已复制。占位项需替换为你的项目信息。'));}catch{const range=document.createRange();range.selectNodeContents($('pd-stage-cmd-text'));const sel=getSelection();sel.removeAllRanges();sel.addRange(range);message(t('请按 Ctrl+C / ⌘C 复制所选命令。'));}});
 if(location.hash===`#stage=${state.stage}`){$('studio-command-details').open=true;}
 return {snapshot:()=>({selected,diff,tool:stage.mode,grid,transform:{x:stage.x,y:stage.y,scale:stage.scale}}),destroy:()=>{resize.disconnect();abort.abort();stage.destroy();}};
}
