import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Tldraw, AssetRecordType, createShapeId, getSnapshot, useEditor, useValue } from 'tldraw';
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite';
import 'tldraw/tldraw.css';
import { CowartAnnotationTool, ANNOTATION_TOOL_ID } from './annotation.js';
import { CowartRegionCommentTool, REGION_COMMENT_TOOL_ID, regionCommentInstructions } from './region-comment.js';
import { buildNodes, safeScreenshot } from '../canvas/nodes.js';
import { t, getLanguage } from '../i18n.js';
import './editor.css';
import { workbenchApi, jobLabel, openOperations, reviewLink } from './operations.js';
import { exportedReviewState } from './review-state.js';

const assetUrls = getAssetUrlsByImport();
const cowartTools = [CowartRegionCommentTool, CowartAnnotationTool], cowartOptions = { maxPages: 1 };
const components = { Toolbar: Tools, MainMenu: null, PageMenu: null, StylePanel: null, ActionsMenu: null, HelpMenu: null, NavigationPanel: null, QuickActions: null, SharePanel: null, DebugPanel: null, ContextMenu: null };
const overrides = { tools(editor, tools) { return { ...tools, [REGION_COMMENT_TOOL_ID]: { id: REGION_COMMENT_TOOL_ID, label: 'tool.cowart-region-comment', icon: 'tool-frame', kbd: 'c', onSelect: () => editor.setCurrentTool(REGION_COMMENT_TOOL_ID) }, [ANNOTATION_TOOL_ID]: { id: ANNOTATION_TOOL_ID, label: 'tool.cowart-annotation', icon: 'tool-arrow', kbd: 'a', onSelect: () => editor.setCurrentTool(ANNOTATION_TOOL_ID) } }; }, translations: { en: { 'tool.cowart-region-comment': 'Region comment', 'tool.cowart-annotation': 'Arrow' }, 'zh-cn': { 'tool.cowart-region-comment': '局部批注', 'tool.cowart-annotation': '箭头', 'page-menu.max-pages-reached': '已达到页面数量上限', 'page-menu.resize': '调整大小' } } };

function Tools() {
  const editor = useEditor();
  const current = useValue('current tool', () => editor.getCurrentToolId(), [editor]);
  return <div className="cowart-tools">
    {[['select', '选择'], [REGION_COMMENT_TOOL_ID, '局部批注'], [ANNOTATION_TOOL_ID, '箭头'], ['draw', '画笔'], ['hand', '抓手']].map(([id, label]) => <button key={id} type="button" className={id===REGION_COMMENT_TOOL_ID?'cowart-comment-tool':''} aria-pressed={current === id} aria-keyshortcuts={id===REGION_COMMENT_TOOL_ID?'C':undefined} title={id===REGION_COMMENT_TOOL_ID?t('拖动框选局部，然后输入批注'):undefined} onClick={() => editor.setCurrentTool(id)}>{t(label)}</button>)}
    <span />
    <button type="button" onClick={() => editor.undo()}>{t('撤销')}</button>
    <button type="button" onClick={() => editor.redo()}>{t('重做')}</button>
    <button type="button" onClick={() => editor.zoomToFit({ animation: { duration: 0 }, inset: 72 })}>{t('适应')}</button>
  </div>;
}

export function editingSources(run) {
  const nodes = buildNodes(run).filter(node => node.entry.reached !== false && safeScreenshot(node.phase, node.entry));
  const latest = new Map();
  for (const node of nodes) if (!latest.has(node.key) || node.phase === 'after') latest.set(node.key, node);
  return [...latest.values()];
}
const download = (name, content, mime) => {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export async function renderCowart(container, run, previous = {}) {
  let pendingPlanJobId=null;
  container.replaceChildren();
  const root = createRoot(container);
  const sources = editingSources(run);
  let selected = sources.find(source => source.id === previous.captureId) || sources[0];
  let editor = null, draft = null, initialSnapshot, notes = '', dirty = false, timer, queued = Promise.resolve(), disposed = false, stopListen;
  let rerender, reportStatus;
  const endpoint = () => `/api/workbench/cowart?run=${encodeURIComponent(run.manifest.id)}&capture=${encodeURIComponent(selected.id)}`;
  const report = (key, detail = '') => reportStatus?.({ text: t(key), detail });
  const instructions = () => [notes.trim(), editor ? regionCommentInstructions(editor) : ''].filter(Boolean).join('\n\n');
  async function save(task = false, requestNotes = notes) {
    clearTimeout(timer);
    const operation = queued.catch(() => {}).then(async () => {
      if (!editor || !draft || (!dirty && !task)) return;
      report('正在保存…');
      const snapshot = getSnapshot(editor.store);
      dirty = false;
      try {
        const response = await fetch(endpoint(), { method: task ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: draft.revision, fingerprint: draft.source.fingerprint, snapshot, notes, ...(task ? { requestNotes } : {}) }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        draft = { ...draft, ...data, snapshot, notes };
        report(task ? '修改任务已保存，尚未执行代码修改。' : '已保存到本地');
        return data;
      } catch (error) {
        dirty = true;
        report('保存失败，请重试；离开前请导出备份。', error.message);
        throw error;
      }
    });
    queued = operation;
    return operation;
  }
  function schedule() { dirty = true; clearTimeout(timer); timer = setTimeout(() => save().catch(() => {}), 600); }
  async function load(source) {
    if (editor) await save();
    selected = source;
    stopListen?.(); stopListen = null; editor = null; draft = null;
    rerender?.();
    report('正在读取画布…');
    try {
      const response = await fetch(endpoint(), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (disposed) return;
      draft = data; initialSnapshot = data.snapshot || undefined; notes = data.notes || ''; dirty = false;
      const feedback=sessionStorage.getItem('review-feedback:'+run.manifest.id);
      if(feedback){notes=feedback;dirty=true;sessionStorage.removeItem('review-feedback:'+run.manifest.id);}
      report('已保存到本地'); rerender?.();
    } catch (error) { report('画布读取失败，请重试。', error.message); rerender?.(); }
  }
  function mount(nextEditor) {
    editor = nextEditor;
    editor.user.updateUserPreferences({ locale: getLanguage() === 'en' ? 'en' : 'zh-cn', colorScheme: 'light' });
    if (!draft.snapshot) {
      const assetId = AssetRecordType.createId(), shapeId = createShapeId();
      const width = selected.entry.width || 1280, height = selected.entry.height || 800;
      editor.createAssets([{ id: assetId, typeName: 'asset', type: 'image', props: { name: selected.key, src: `${run.base}/${safeScreenshot(selected.phase, selected.entry)}`, w: width, h: height, mimeType: 'image/png', isAnimated: false }, meta: { evidence: draft.source } }]);
      editor.createShape({ id: shapeId, type: 'image', x: 0, y: 0, isLocked: true, props: { assetId, w: width, h: height }, meta: { evidence: draft.source } });
      editor.zoomToFit({ animation: { duration: 0 }, inset: 100 });
      dirty = true;
    }
    stopListen = editor.store.listen(schedule, { source: 'user', scope: 'all' });
    queueMicrotask(() => { if (!disposed) rerender?.(); });
    if (dirty) schedule();
  }
  async function makeRequest() {
    const requestNotes = instructions();
    if (!requestNotes) { report('请框选一个局部并写下批注，或补充整体说明。'); return; }
    const result = await save(true, requestNotes);
    if (!result?.request) return;
    const brief = `# UI change request\n\nStatus: draft — not executed\nRun: ${run.manifest.id}\nCapture: ${selected.id}\nEvidence: ${draft.source.screenshot}\nSHA-256: ${draft.source.fingerprint}\nRequest: ${result.request.id}\nSaved annotations and instructions: ${result.request.path}\n\n## User instructions (original)\n${requestNotes}\n\n## Execution requirements\nUse the saved Cowart snapshot and annotations as the edit brief. Inspect the actual project source before changing code. Preserve the original evidence. Follow the existing harness scope, isolated execution, recapture, structural evaluation, independent visual review and human judgment gates. A marked screenshot is not proof of a code change.\n`;
    download(`ui-request-${result.request.id}.md`, brief, 'text/markdown');
  }
  async function submitCreative(kind, confirmed) {
    const requestNotes = instructions();
    if (!requestNotes) throw new Error(t('请框选一个局部并写下批注，或补充整体说明。'));
    await save();
    const reference = await editor.toImageDataUrl([...editor.getCurrentPageShapeIds()], { format: 'png', scale: 1 });
    const input = { kind, runId: run.manifest.id, captureId: selected.id, fingerprint: draft.source.fingerprint, notes:requestNotes, language:getLanguage(), annotation: reference.url, snapshot: getSnapshot(editor.store), confirmed };
    const job=await workbenchApi(kind === 'source' ? 'source' : 'create', input);
    if(kind==='source')pendingPlanJobId=job.id;
    report('任务已提交，可在下方查看进度。');
  }
  async function saveAttachment() {
    const requestNotes = instructions();
    if (!requestNotes) throw new Error(t('请框选一个局部并写下批注，或补充整体说明。'));
    await save();
    const reference = await editor.toImageDataUrl([...editor.getCurrentPageShapeIds()], {format:'png',scale:1});
    await workbenchApi('attachment',{runId:run.manifest.id,captureId:selected.id,fingerprint:draft.source.fingerprint,notes:requestNotes,annotation:reference.url});
    report('复核附件已保存，请在视觉复核中选择引用。');
    openOperations(run);
  }
  async function insertResult(job) {
    if (!editor || !job.result?.preview) return;
    if(job.fingerprint !== draft.source.fingerprint) throw new Error(t('原始截图已变化，请重新生成。'));
    const existing = editor.getCurrentPageShapes().find(shape => shape.meta?.jobId === job.id);
    if (existing) { editor.select(existing.id); editor.zoomToSelection(); return; }
    const assetId = AssetRecordType.createId(), shapeId = createShapeId(), w = job.result.width, h = job.result.height;
    const bounds = editor.getCurrentPageBounds();
    editor.createAssets([{ id: assetId, typeName:'asset', type:'image', props:{ name: job.kind, src: job.result.preview, w, h, mimeType:'image/png',isAnimated:false },meta:{ jobId:job.id } }]);
    editor.createShape({id:shapeId,type:'image',x:bounds ? bounds.maxX+80 : 0,y:0,props:{assetId,w,h},meta:{jobId:job.id,artifact:job.result.artifact}});
    editor.select(shapeId); editor.zoomToSelection(); schedule(); await save();
  }
  function App() {
    const [, update] = useState(0), [status, setStatus] = useState({ text: t('正在读取画布…'), detail: '' }), [busy, setBusy] = useState(false), [mode,setMode] = useState('draft'), [confirmed,setConfirmed] = useState(false), [jobs,setJobs] = useState([]), [panel,setPanel] = useState('adjust'), [reviewState,setReviewState] = useState(() => exportedReviewState(run));
    useEffect(() => { let active=true; let pending=false; const poll=async()=>{if(pending)return;pending=true;try{const [items,state]=await Promise.all([workbenchApi('jobs'),workbenchApi('state?run='+encodeURIComponent(run.manifest.id))]);if(active){if(pendingPlanJobId){const job=items.find(item=>item.id===pendingPlanJobId);if(job?.status==='succeeded'&&job.result?.awaiting==='plan-confirmation'){pendingPlanJobId=null;location.href=reviewLink(job.result.runId,'canvas');return;}if(job&&['failed','cancelled','interrupted'].includes(job.status))pendingPlanJobId=null;}setJobs(items);setReviewState({...state,readOnly:false});}}catch(error){if(active){setJobs([]);setReviewState(exportedReviewState(run));}}finally{pending=false;}}; poll(); const timer=setInterval(poll,2000); return ()=>{active=false;clearInterval(timer);}; }, []);
    rerender = () => update(value => value + 1); reportStatus = setStatus;
    const action = async fn => { setBusy(true); try { await fn(); } catch (error) { report('操作失败', error.message); } finally { setBusy(false); } };
    const qa=reviewState?.reviews?.find(item=>item.skillId==='visual-qa-evaluator');
    const reviewing=jobs.some(job=>job.runId===run.manifest.id&&job.kind==='ai-review'&&['queued','running'].includes(job.status));
    return <section className="cowart-workspace" aria-label={t('UI 调整画布')}>
      <header className="cowart-edit-bar">
        <div><span className="cowart-session-label">{t('当前项目')}</span><strong>{run.spec.project.name}</strong></div>
        {selected && <label>{t('当前界面')}<select aria-label={t('当前界面')} value={selected.id} disabled={busy} onChange={event => action(() => load(sources.find(source => source.id === event.target.value)))}>{sources.map(source => <option key={source.id} value={source.id}>{t(source.entry.stateId)} · {t(source.entry.configurationId)}</option>)}</select></label>}

      </header>
      <div className="cowart-edit-body">
        <div className="cowart-editor">
          {draft ? <Tldraw licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY} key={selected.id} snapshot={initialSnapshot} assetUrls={assetUrls} tools={cowartTools} components={components} overrides={overrides} onMount={mount} options={cowartOptions} /> : <div className="cowart-empty"><p>{sources.length ? status.text : t('暂无可编辑的截图，请先采集界面。')}</p>{sources.length > 0 && <button onClick={() => action(() => load(selected))} disabled={busy}>{t('重新读取')}</button>}</div>}
        </div>
        <aside className="cowart-brief">
          <div className="cowart-panel-tabs" role="group" aria-label={t('工作面板')}><button aria-pressed={panel==='adjust'} onClick={()=>setPanel('adjust')}>{t('调整')}</button><button aria-pressed={panel==='review'} onClick={()=>setPanel('review')}>{t('AI 复核')}{qa&&<span className="cowart-status-dot" />}</button></div>
          {panel==='review' ? <div className="cowart-review-panel">
            {reviewState?.readOnly&&<p>{t('这是导出的审阅记录；连接原始运行后才能复核或记录决定。')}</p>}<span className="cowart-powered">{t('独立检查')}</span><h2>{t(qa?'复核结果':reviewing?'正在检查界面':'让 AI 检查这次修改')}</h2>
            <p>{t(qa?'结合前后截图，查看改动是否符合预期。':'修改并采集完成后，AI 会检查结果和潜在问题。')}</p>
            {qa ? <><span className="cowart-verdict" data-verdict={qa.verdict}>{t(qa.verdict)}</span><p className="cowart-review-summary">{qa.rationale}</p>{qa.findings.map(item=><article className="cowart-review-finding" key={item.id}><strong>{item.title}</strong><p>{item.observation}</p></article>)}<details><summary>{t('查看证据与限制')}</summary>{qa.screenshotRefs.map(ref=><a key={ref} href={`/runs/${encodeURIComponent(run.manifest.id)}/${ref}`} target="_blank" rel="noopener noreferrer">{ref}</a>)}<p>{qa.limitations.join(' · ')}</p></details><button className="cowart-primary" onClick={()=>{location.href=reviewLink(run.manifest.id,'canvas');}}>{t('返回当前审阅')}</button><button onClick={()=>setPanel('adjust')}>{t('继续调整')}</button></> : <div className="cowart-review-empty"><span aria-hidden="true">◎</span><p>{t(reviewing?'正在对照截图，请稍候。':'准备好修改后的截图，再开始复核。')}</p><button className="cowart-primary" onClick={()=>{location.href=reviewLink(run.manifest.id,'canvas');}}>{t('返回当前审阅')}</button></div>}
          </div> : <div className="cowart-adjust-panel">
          <span className="cowart-powered">{t('界面调整')}</span><h2>{t('选一个局部，告诉 AI 怎么改')}</h2>
          <p>{t('点击“局部批注”，拖动框选界面中的区域，然后直接输入批注。选区、坐标、原图和当前审阅记录会自动绑定。')}</p>
          <label htmlFor="cowart-mode">{t('操作')}</label><select id="cowart-mode" value={mode} disabled={busy} onChange={event=>{setMode(event.target.value);setConfirmed(false);}}>{[['draft','保存修改草稿'],['image','生成图片'],['edit-image','按批注改图'],['html','生成 HTML 草稿'],['slides','生成演示文稿'],['source','准备源码修改计划']].map(([value,title])=><option key={value} value={value}>{t(title)}</option>)}</select>
          <label htmlFor="cowart-request">{t('补充整体说明（可选）')}</label>
          <textarea id="cowart-request" key={selected?.id + (draft ? '-ready' : '-loading')} defaultValue={notes} disabled={!draft || busy} placeholder={t('局部批注会自动带入。这里补充整体目标或约束。')} onChange={event => { notes = event.target.value; schedule(); }} />
          {mode === 'source' && <label className="cowart-confirm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} />{t('我已核对证据并确认本轮修改范围')}</label>}
          <button className="cowart-primary" disabled={!draft || busy || mode==='source'&&!confirmed} onClick={() => action(() => mode==='draft' ? makeRequest() : submitCreative(mode,confirmed))}>{t(mode==='draft'?'生成修改任务':mode==='source'?'生成计划并审阅':'开始创作')}</button>
          <details className="cowart-exports"><summary>{t('导出与备份')}</summary><button disabled={!draft || busy} onClick={() => action(async () => { if (!editor) return; const image = await editor.toImageDataUrl([...editor.getCurrentPageShapeIds()], { format: 'png', scale: 1 }); const response = await fetch(image.url); download('ui-annotations.png', await response.blob(), 'image/png'); })}>{t('导出批注图')}</button>
          <button disabled={!editor} onClick={() => download('cowart-draft.json', JSON.stringify({ snapshot: getSnapshot(editor.store), notes, source: draft?.source }, null, 2), 'application/json')}>{t('导出画布备份')}</button><button disabled={!draft || busy} onClick={()=>action(saveAttachment)}>{t('保存为复核附件')}</button><button disabled={!draft||busy} onClick={()=>action(()=>save())}>{t('保存')}</button></details>
          <p className="cowart-boundary">{t(mode==='source'?'先准备完整计划，确认执行后再修改源码、复核并记录决定。':mode==='draft'?'这是界面修改草稿。生成任务不会自动修改项目代码。':'创作结果可放回画布；HTML 与演示文稿可单独预览。')}</p>

          </div>}
          <div className="cowart-jobs">{jobs.filter(job=>job.runId===run.manifest.id&&(job.kind==='ai-review'||job.captureId===selected?.id&&(!job.fingerprint||job.fingerprint===draft?.source.fingerprint))).slice(0,5).map(job=><article key={job.id}><strong>{jobLabel(job)}</strong>{job.result?.reviewError&&<p>{t('AI 复核未完成，可重试')}: {job.result.reviewError}</p>}{job.error&&<details><summary>{t('失败详情')}</summary><p>{job.error}</p></details>}{['queued','running'].includes(job.status)&&<button onClick={()=>action(()=>workbenchApi('cancel',{id:job.id}))}>{t('取消任务')}</button>}{job.status==='succeeded'&&job.result?.preview&&<><button onClick={()=>action(()=>insertResult(job))}>{t('放到画布')}</button><a href={job.result.artifact} target="_blank" rel="noopener noreferrer">{t('预览作品')}</a><a href={job.result.artifact+'&download=1'}>{t('下载作品')}</a></>}{(job.result?.runId||job.resultRunId)&&<a href={reviewLink(job.result?.runId||job.resultRunId)}>{t('打开审阅报告')}</a>}</article>)}</div>
          <div className="cowart-save-status" role="status" aria-live="polite">{status.text}{status.detail && <details><summary>{t('详情')}</summary>{status.detail}</details>}</div>

        </aside>
      </div>
    </section>;
  }
  root.render(<App />);
  // Initial render must finish before load can publish React state.
  await new Promise(resolve => requestAnimationFrame(resolve));
  if (selected) await load(selected);
  const unload = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
  window.addEventListener('beforeunload', unload);
  return { snapshot: () => ({ captureId: selected?.id }), destroy: async () => { await save(); disposed = true; clearTimeout(timer); stopListen?.(); window.removeEventListener('beforeunload', unload); root.unmount(); } };
}
