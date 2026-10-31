import {createControl} from '../../packages/ui/controls.js';
import {installWorkbenchControls} from '../../packages/ui/workbench.js';
import {openSiteHandoff,renderSiteHandoff} from './site-handoff.js';
import {appendPageSurfaceLinks} from './page-surface-links.js';
import {projectMemoryView} from './project-memory-view.js';
import {incrementalReviewView} from './incremental-review-view.js';
import {foundationRuleFields,restoreFoundationRule,foundationWithPatternAdmissions} from '../../packages/experience-core/foundation.js';
import { renderReportReviews } from './report/reviews.js';
import './report/style.css';
import { appendVisualCoverage } from './visual-review-coverage.js';
import { openOperations } from './cowart/operations.js';
import { groupReviewHistory } from './review-history.js';
import { primaryActionForStage } from '../../packages/harness-core/primary-action.js';
import { mountReviewAction } from './review-action.js';
import { t, getLanguage, setLanguage, resolveLanguage, LANGUAGE_KEY, localizeShell } from './i18n.js';
import { stageLabel, workflowReason, scoreMessage } from './workflow-copy.js';
import happyclaw from '../../examples/happyclaw-site/experience.json' with { type: 'json' };
import sample from '../../examples/vibe-coded-app/experience.json' with { type: 'json' };
import { assertExperienceSpec, rankedFindings, priority, codexBrief, recordJudgment } from '../../packages/experience-core/index.js';
import { workflowState, visualReviewFor } from '../../packages/harness-core/workflow.js';
import {renderCodeDiff} from './canvas/codediff.js';
import './page-review/style.css';
import { approvalFromDraft, createFoundationDraft, diffFoundations, foundationDecisionSummary, foundationEntries, nextFoundationVersion, summarizeFoundationEvidence, loadFoundationEvidenceRecords } from './foundation-review.js';

installWorkbenchControls(document);
const $ = id => document.getElementById(id);
const cases = { happyclaw, sample };
const RUNS_BASE = '/runs';
const RUN_PREFIX = 'run:';

const params = new URLSearchParams(location.search);
let savedLanguage;
try { savedLanguage = localStorage.getItem(LANGUAGE_KEY); } catch { /* Storage may be disabled. */ }
setLanguage(resolveLanguage(params.get('lang'), savedLanguage));
const updateShellLanguage = localizeShell();
updateShellLanguage();
let caseId = 'happyclaw';
let indexProblem = null;
const syncDirectionLink = () => { $('direction-link').href = 'https://happyhands.cc/components/?provider=systems'; $('direction-link').target='_blank';$('direction-link').rel='noopener noreferrer'; $('legacy-tools-link').href = `?case=${encodeURIComponent(caseId)}&view=canvas&tools=legacy&lang=${getLanguage()}`; };
syncDirectionLink();
delete $('direction-link').dataset.studioView;
const directionStates = new Map();
const directionContainer = createControl('div');
directionContainer.id = 'pd-fs-directions-container';
directionContainer.hidden = true;
$('pd-fs-codediff-container').after(directionContainer);

document.querySelector('.workbench-experiments').hidden = true;
let spec = null;
let selected = null;
let run = null; // Set when an exported harness run is open.
let foundationDraft = null;
let foundationHistory = [];
let foundationFormRunId = null;
const FOUNDATION_REVIEWER_KEY = 'creative-os-foundation-reviewer';
const FOUNDATION_REVIEWER_TYPE_KEY = 'creative-os-foundation-reviewer-type';

const isRun = id => id.startsWith(RUN_PREFIX);
const runIdOf = id => id.slice(RUN_PREFIX.length);

function loadExample(id) {
  const base = structuredClone(cases[id]);
  try {
    const stored = JSON.parse(localStorage.getItem(`pd-review-${id}`) || 'null');
    if (stored && stored.version === base.version && stored.project.source === base.project.source) {
      base.review.judgment = stored.review.judgment;
      base.review.reason = stored.review.reason;
    }
  } catch { /* Invalid local draft is ignored. */ }
  return assertExperienceSpec(base);
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    const error = new Error(`${path} returned HTTP ${response.status}`);
    error.absent = response.status === 404;
    throw error;
  }
  // The Vite dev server answers a missing file with the HTML shell and HTTP 200,
  // so a non-JSON body means "not there", not "corrupt".
  if (!(response.headers.get('content-type') || '').includes('json')) {
    const error = new Error(`${path} did not return JSON`);
    error.absent = true;
    throw error;
  }
  return response.json();
}

async function postJson(path, body) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`);
  return value;
}

async function waitForJob(id,{attempts=240}={}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const jobs = await fetchJson('/api/workbench/jobs');
    const job = jobs.find(item => item.id === id);
    if (!job) throw new Error('Task disappeared from the local queue.');
    if (job.status === 'succeeded') return job;
    if (['failed', 'cancelled', 'interrupted'].includes(job.status)) throw new Error(job.error || `Approval ${job.status}.`);
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Task is still running. Reload the run to check its state.');
}

// Exported runs are optional, so a missing index is the ordinary state before
// anyone runs `pnpm harness export`. Anything else — a wrong base path, a
// corrupt index — is reported, because a silent empty list looks identical to
// "no runs exported" and hides the real cause.
async function loadRunIndex() {
  try {
    const index = await fetchJson(`${RUNS_BASE}/index.json`);
    if (!Array.isArray(index.runs)) throw new Error('its "runs" field is not an array');
    return { runs: index.runs, problem: null };
  } catch (error) {
    if (error.absent) return { runs: [], problem: null };
    return { runs: [], problem: error.message };
  }
}

// `experience.json` is schema-checked by assertExperienceSpec; `run.json` has no
// schema, so check the shape this page dereferences before rendering it.
function assertRunManifest(manifest) {
  const fail = reason => { throw new Error(`Unusable run.json: ${reason}.`); };
  if (!manifest || typeof manifest !== 'object') fail('it is not an object');
  if (typeof manifest.id !== 'string') fail('it has no id');
  if (!manifest.captures || typeof manifest.captures !== 'object') fail('it has no captures');
  if (!Array.isArray(manifest.skills)) manifest.skills = [];
  if (manifest.judgment && typeof manifest.judgment.decision !== 'string') fail('the judgment has no decision');
  if (manifest.confirmation && typeof manifest.confirmation.verdict !== 'string') fail('the confirmation has no verdict');
  if (manifest.baseline && typeof manifest.baseline.reason !== 'string') fail('the recorded baseline has no reason');
  if (manifest.evaluation && (!manifest.evaluation.views || typeof manifest.evaluation.views !== 'object')) fail('the evaluation has no views');
  if (!Array.isArray(manifest.visualReviews)) manifest.visualReviews = [];
  return manifest;
}

const SAFE_REVIEW = /^reviews\/[a-z0-9-]+\.json$/;

async function loadReviews(manifest, base) {
  return Promise.all(manifest.visualReviews.map(async item => {
    if (!SAFE_REVIEW.test(item.path || '')) return { ...item, document: null, problem: 'Invalid review artifact path.' };
    try { return { ...item, document: await fetchJson(`${base}/${item.path}`), problem: null }; }
    catch (error) { return { ...item, document: null, problem: error.message }; }
  }));
}

async function loadComponentInventory(manifest, base) {
  const record = manifest.skills.find(item => item.id === 'component-inventory');
  if (!record || !/^skills\/component-inventory\.json$/.test(record.path || '')) return null;
  try { return await fetchJson(`${base}/${record.path}`); } catch { return null; }
}

const FOUNDATION_SKILLS = new Set(['foundation-extractor', 'brand-foundation-extractor', 'component-inventory', 'pattern-library-curator']);

async function loadFoundationEvidence(manifest, base) {
  const records = manifest.skills.filter(item => FOUNDATION_SKILLS.has(item.id));
  return loadFoundationEvidenceRecords(records, path => fetchJson(`${base}/${path}`));
}

async function loadBrief(manifest, base) {
  if (manifest.plan?.path !== 'codex-brief.md') return null;
  try {
    const response = await fetch(`${base}/codex-brief.md`, { cache: 'no-store' });
    return response.ok ? await response.text() : null;
  } catch { return null; }
}

async function loadRun(id) {
  const base = `${RUNS_BASE}/${encodeURIComponent(id)}`;
  const [manifest, runSpec] = await Promise.all([
    fetchJson(`${base}/run.json`),
    fetchJson(`${base}/experience.json`)
  ]);
  // A run before `harness diagnose` has no diagnosis; the page falls back to the
  // spec's authored findings rather than showing nothing.
  let diagnosis = null;
  if (manifest.diagnosis) {
    try {
      diagnosis = await fetchJson(`${base}/${manifest.diagnosis.path || 'diagnosis.json'}`);
    } catch { /* The ledger names it but the file was not published; fall back. */ }
  }
  assertRunManifest(manifest);
  const approval = manifest.foundationApproval?.path
    ? await fetchJson(`${base}/${manifest.foundationApproval.path}`).catch(() => null)
    : null;
  const [reviews, brief, componentInventory, foundationEvidence, patternReviews] = await Promise.all([loadReviews(manifest, base), loadBrief(manifest, base), loadComponentInventory(manifest, base), loadFoundationEvidence(manifest, base),
    Promise.all((Array.isArray(manifest.patternReviews)?manifest.patternReviews:[]).map(async reference=>{
      if(!/^[a-f0-9]{64}$/.test(reference.id||'')||reference.path!==`pattern-reviews/${reference.id}/review.json`)return {source:reference.source,unavailable:true};
      try{
        const [record,input]=await Promise.all([fetchJson(`${base}/${reference.path}`),fetchJson(`${base}/pattern-reviews/${reference.id}/input.json`)]);
        if(record.runId!==manifest.id||record.inputHash!==reference.id||record.status!=='proposal-only'||!Array.isArray(input.images)||input.candidate?.source!==reference.source)throw Error('Invalid pattern record');
        return {...record,source:reference.source,id:reference.id,language:input.language,images:input.images.filter(image=>/^[a-f0-9]{64}$/.test(image.hash||'')&&image.file===`images/${image.hash}.png`).slice(0,12)};
      }catch{return {source:reference.source,unavailable:true};}
    }))]);
  const patternAdmissions=await Promise.all((Array.isArray(manifest.patternAdmissions)?manifest.patternAdmissions:[]).map(async reference=>{
    try{
      if(!/^[a-f0-9-]{36}$/.test(reference.id||'')||reference.path!==`pattern-admissions/${reference.id}.json`)throw Error('Invalid admission path');
      const record=await fetchJson(`${base}/${reference.path}`),entry=record.entry;
      if(record.runId!==manifest.id||record.id!==reference.id||record.action!=='stage-for-foundation-review'||entry?.status!=='observed'
        ||entry.evidence?.provenance?.admissionId!==reference.id||entry.evidence.provenance.runId!==manifest.id||!entry.usage)throw Error('Invalid admission');
      return record;
    }catch{return {id:reference.id,unavailable:true};}
  }));
  return { manifest, spec: assertExperienceSpec(runSpec), diagnosis, reviews, brief, approval, componentInventory, foundationEvidence, patternReviews, patternAdmissions, base };
}

async function loadFoundationHistory(id) {
  if (!id) return { available: false, entries: [] };
  try {
    const result = await fetchJson(`/api/workbench/foundation-history?run=${encodeURIComponent(id)}`);
    if (Array.isArray(result)) return { available: true, refreshAvailable: true, entries: result };
    return { available: result?.available === true, refreshAvailable: (result?.refreshAvailable ?? result?.available) === true, entries: Array.isArray(result?.entries) ? result.entries : [] };
  } catch { return { available: false, entries: [] }; }
}

// The two sources describe a finding differently. Render from one shape so the
// list, the brief and the selection keep working whichever is present.
const LOOP_STEPS = [
  ['needs-baseline', 'Baseline captured'],
  ['needs-diagnosis', 'Evidence diagnosed'],
  ['awaiting-confirmation', '修复任务已准备'],
  ['needs-plan', 'Scope planned'],
  ['needs-execution', 'Agent edit executed'],
  ['needs-after-capture', 'Result re-rendered'],
  ['needs-structural-evaluation', 'Structural checks run'],
  ['needs-visual-qa', 'Independent Visual QA'],
  ['awaiting-judgment', 'Human decision']
];

function normalisedFindings(spec, diagnosis) {
  if (!diagnosis) {
    return rankedFindings(spec).map(item => ({
      id: item.id,
      title: item.title,
      priority: priority(item),
      status: 'authored-candidate',
      evidence: item.evidenceIds,
      proposal: item.proposal,
      impact: item.impact, confidence: item.confidence, effort: item.effort,
      inSpec: true
    }));
  }
  return diagnosis.findings.map(item => ({
    id: item.id,
    title: item.title,
    priority: item.priority,
    status: item.verificationStatus,
    evidence: item.evidenceRefs,
    proposal: item.proposal,
    impact: item.impact, confidence: item.confidence, effort: item.effort,
    inSpec: spec.findings.some(entry => entry.id === item.id)
  }));
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = createControl('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stage(manifest) {
  if (manifest.judgment) return t`JUDGED / ${t(manifest.judgment.decision)}`;
  const qa = visualReviewFor(manifest,'visual-qa-evaluator');
  if (qa) return t`VISUAL QA / ${t(qa.verdict)}`;
  if (manifest.evaluation) return t('EVALUATED');
  if (manifest.captures.after) return t('AFTER CAPTURED');
  if (manifest.execution) return t('EXECUTED');
  if (manifest.plan) return t('PLANNED');
  if (manifest.confirmation?.authority==='user-delegated') return t('自动修复已请求');
  if (manifest.confirmation) return t`CONFIRMED / ${t(manifest.confirmation.verdict)}`;
  return t('BASELINE ONLY');
}

// Mirrors the export guard: a reference that does not name a file inside this
// run's own capture folder is treated as missing rather than requested. The ID
// alphabet matches captureKey, underscores included.
const SAFE_SHOT = /^(before|after)\/[a-z0-9_-]+\.png$/;

function captureItems(capture) {
  if (Array.isArray(capture?.states)) return capture.states;
  return Object.entries(capture?.viewports || {}).map(([configurationId, view]) => ({
    stateId: 'page', configurationId, legacy: true, reached: true, ...view
  }));
}

function shot(base, phase, entry) {
  const figure = createControl('figure');
  const caption = createControl('figcaption');
  const state = entry?.stateId || 'page';
  const configuration = entry?.configurationId || 'unknown';
  caption.textContent = `${t(phase)} / ${t(state)} / ${t(configuration)} / ${t(entry?.captureMode==='page-surfaces'?'页面概览与内部区域':entry?.captureMode==='full-page'?'整页原图':'视口截图')}`;
  let reference = entry?.screenshot;
  if (reference && !SAFE_SHOT.test(reference)) reference = null;
  if (!reference) {
    const missing = createControl('p');
    missing.className = 'run-missing';
    missing.dataset.error = entry?.reached === false ? 'true' : 'false';
    missing.textContent = entry?.reached === false
      ? t`State not reached: ${entry.error || t('replay failed')}`
      : t('Not captured');
    figure.append(missing, caption);
    return figure;
  }
  const image = createControl('img');
  image.loading = 'lazy';
  image.decoding = 'async';
  image.alt = t`${t(phase)} screenshot of ${t(state)} in ${t(configuration)}`;
  image.src = `${base}/${reference}`;
  const link=createControl('a');link.href=image.src;link.target='_blank';link.rel='noopener noreferrer';link.append(image);const original=createControl('a');original.href=image.src;original.target='_blank';original.rel='noopener noreferrer';original.textContent=t('打开原始截图');caption.append(original);figure.append(link,caption);appendPageSurfaceLinks(figure,base,phase,entry);
  return figure;
}

function renderReviews() { renderReportReviews($('run-reviews'),run); }

let reportAction = null, codeAction = null;
function openFoundationStep() {
  if (currentView !== 'list') { location.href = `?case=${encodeURIComponent(caseId)}&view=list&lang=${getLanguage()}#foundation-title`; return; }
  $('foundation-section').open = true;
  $('foundation-title').scrollIntoView({ block: 'start' });
  $('foundation-save').focus();
}
async function actionChanged({runId}) {
  if (runId && runId !== run?.manifest.id) {
    const {runs} = await loadRunIndex();
    const summary = runs.find(item => item.id === runId);
    if (summary) for (const picker of [$('case-select'), $('studio-run-select')]) {
      if ([...picker.options].some(option => option.value === 'run:' + runId)) continue;
      const option = createControl('option');option.value = 'run:' + runId;option.dataset.runSummary = JSON.stringify(summary);picker.append(option);
    }
    const record = await loadRun(runId);
    if (record.manifest.diagnosis && !record.manifest.confirmation && !record.manifest.execution) params.set('view', 'canvas');
    updateRunOptions();await select('run:' + runId);$('case-select').value = caseId;return;
  }
  await refreshRun(true);
}
function renderLoop() {
  reportAction?.destroy(); reportAction = null;
  const panel = $('loop-panel');
  if (!run) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  if (currentView === 'list') reportAction = mountReviewAction($('report-primary-action'), run, {onChanged: actionChanged, onFoundation: openFoundationStep, getFindingId: () => selected});
  const state = workflowState(run.manifest);
  $('loop-stage').textContent = stageLabel(state.stage);
  $('loop-next').textContent = t(primaryActionForStage(state.stage)?.description || '重新读取当前证据后继续。');
  const reason = $('loop-reason');
  reason.hidden = !state.reason;
  reason.textContent = workflowReason(state, run.manifest);
  reason.dataset.blocked = state.blocked ? 'true' : 'false';

  // A stage earlier in the order than the current one has produced its artifact.
  const current = LOOP_STEPS.findIndex(([id]) => id === state.stage);
  const track = $('loop-track');
  track.replaceChildren();
  for (const [index, [, label]] of LOOP_STEPS.entries()) {
    const item = createControl('li');
    const done = state.stage === 'complete' || (current !== -1 && index < current);
    item.dataset.state = done ? 'done' : (current === index ? 'current' : 'pending');
    item.textContent = t(label);
    track.append(item);
  }
}

function renderScore() {
  const box = $('score');
  const score = run?.diagnosis?.experienceScore;
  if (!score) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.replaceChildren();
  const headline = createControl('p');
  headline.className = 'score-headline';
  headline.textContent = score.status === 'scored'
    ? t`Experience Score ${score.score} / 100 / ${score.evaluator?.name || t('evaluator')}@${score.evaluator?.version || '?'}`
    : t('Experience Score withheld — insufficient evidence');
  box.append(headline);
  const detail = createControl('p');
  detail.className = 'score-detail';
  detail.textContent = score.status === 'scored'
    ? t`Evidence coverage ${Math.round((score.evidenceCoverage || 0) * 100)}%. A score is a heuristic quality signal, not conversion or user research.`
    : (score.missing || []).map(scoreMessage).join(' ') || t('No rubric supplied.');
  box.append(detail);
}

function renderRun() {
  const panel = $('run-panel');
  if (!run) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const { manifest, base } = run;
  $('run-id').textContent = manifest.id;
  $('run-stage').textContent = stage(manifest);

  const shots = $('run-shots');
  shots.replaceChildren();
  // Union both phases: a state captured only after a change still has to be
  // visible, rather than silently dropped because the baseline lacks it.
  const before = new Map(captureItems(manifest.captures.before).map(item => [`${item.stateId}--${item.configurationId}`, item]));
  const after = new Map(captureItems(manifest.captures.after).map(item => [`${item.stateId}--${item.configurationId}`, item]));
  const keys = [...new Set([...before.keys(), ...after.keys()])];
  const picker=$('report-evidence-picker'),oldSelect=picker.querySelector('select');
  const oldKey=picker.dataset.runId===manifest.id?oldSelect?.value:null;
  const selectedKey=keys.includes(oldKey)?oldKey:keys.find(key=>(after.get(key)||before.get(key)).captureMode==='full-page'||(after.get(key)||before.get(key)).captureMode==='page-surfaces')||keys[0];
  picker.dataset.runId=manifest.id;picker.replaceChildren();
  const label=createControl('label');label.textContent=t('对照页面与设备');
  const select=createControl('select');select.setAttribute('aria-label',t('对照页面与设备'));
  for(const key of keys){const item=after.get(key)||before.get(key),option=createControl('option');option.value=key;option.textContent=`${item.title||t(item.stateId)} / ${t(item.configurationId)}`;if(!before.get(key)?.screenshot||!after.get(key)?.screenshot)option.textContent+=' / '+t('存在缺失证据');select.append(option);}
  select.value=selectedKey||'';select.disabled=!keys.length;label.append(select);picker.append(label);
  const drawPair=()=>{shots.replaceChildren();const key=select.value;if(!key)return;const beforeEntry=before.get(key),afterEntry=after.get(key),identity=beforeEntry||afterEntry;const pair=createControl('div');pair.className='run-pair';pair.append(shot(base,'Before',beforeEntry||{stateId:identity.stateId,configurationId:identity.configurationId}),shot(base,'After',afterEntry||{stateId:identity.stateId,configurationId:identity.configurationId}));shots.append(pair);};
  select.onchange=drawPair;drawPair();
  const note=createControl('p');note.className='small-note';note.textContent=t('一次对照一个状态，所有原始截图仍可切换查看。');picker.append(note);
  renderReviews();

  const rows = [];
  if (manifest.confirmation) {
    rows.push([t`Finding ${manifest.confirmation.findingId}`, `${t(manifest.confirmation.verdict)} — ${manifest.confirmation.note}`]);
  }
  if (manifest.execution) {
    rows.push([t('Agent execution'), t`branch ${manifest.execution.branch} / log ${manifest.execution.logRetained ? t('retained locally, not published') : t('not retained')}`]);
  }
  for (const skill of manifest.skills) {
    rows.push([t`Skill ${skill.id}`, `${t(skill.status)} / v${skill.version}`]);
  }
  if (manifest.evaluation) {
    for (const [viewport, view] of Object.entries(manifest.evaluation.views)) {
      const failed = Object.entries(view.checks).filter(([, ok]) => !ok).map(([name]) => t(name));
      rows.push([t`Checks ${t(viewport)}`, failed.length ? t`failed: ${failed.join(', ')}` : t('page responded, heading present, no horizontal overflow')]);
    }
  }
  if (manifest.judgment) {
    rows.push([t('Recorded decision'), `${t(manifest.judgment.decision)} — ${manifest.judgment.reason}`]);
  }
  const checks = $('run-checks');
  checks.replaceChildren();
  for (const [label, value] of rows) {
    const row = createControl('div');
    row.className = 'run-check';
    const name = createControl('span');
    name.textContent = label;
    const detail = createControl('p');
    detail.textContent = value;
    row.append(name, detail);
    checks.append(row);
  }

  const missing = [];
  if (!manifest.captures.after) missing.push(t('no after capture'));
  if (!manifest.execution) missing.push(t('no agent execution in this run'));
  if (!manifest.evaluation) missing.push(t('not evaluated'));
  if (!manifest.judgment) missing.push(t('no human decision yet'));
  $('run-note').textContent = missing.length
    ? t`Incomplete run: ${missing.join('; ')}. Structural checks alone cannot show that the user task improved.`
    : t('Complete run. The decision above was recorded by a person against these screenshots, not derived from the structural checks.');
}

function foundationCollection(draft, name) {
  return name === 'assets' ? draft.brand.assets : draft[name];
}

function editableFoundation() {
  return Boolean(run && run.foundationWritable === true && !run.approval && !run.manifest.plan && !run.manifest.execution && (run.manifest.captures.before || run.manifest.baseline));
}

function setFoundationField(collection, index, field, value) {
  const entry = foundationCollection(foundationDraft, collection)[index];
  entry[field] = ['variants', 'states'].includes(field) ? value.split(',').map(item => item.trim()).filter(Boolean) : value;
}

function foundationDecisionControl(collection, item, index, readOnly) {
  const wrap = createControl('div');
  wrap.className = 'foundation-item-actions';
  const current = item.decision?.action || item.status;
  for (const [value, label] of [['approved', '批准'], ['replace', '替换'], ['deprecated', '弃用'], ['deferred', '暂不纳入本轮约束']]) {
    const button = createControl('button');
    button.type = 'button'; button.textContent = t(label); button.dataset.decision = value;
    button.setAttribute('aria-pressed', String(current === value));
    button.disabled = readOnly;
    button.addEventListener('click', () => {
      item.decision={action:value,reason:item.decision?.reason||'',previous:item.decision?.previous||foundationRuleFields(item)};
      if(value!=='replace'&&item.decision.previous)restoreFoundationRule(item,item.decision.previous);
      item.status = value === 'deferred' ? 'observed' : value === 'deprecated' ? 'deprecated' : 'approved';
      renderFoundation();
    });
    wrap.append(button);
  }
  return { wrap, current };
}

function foundationReplacementFields(collection, item, index, visible, readOnly) {
  const fields = collection === 'tokens' ? ['value', 'source']
    : collection === 'components' ? ['source', 'variants', 'states']
    : ['description', 'source'];
  const form = createControl('div');
  form.className = 'foundation-replacement'; form.hidden = !visible;
  for (const field of fields) {
    if (!(field in item) && field === 'description' && collection === 'assets') continue;
    const fieldLabels = { value: '值', source: '来源', description: '说明', variants: '变体', states: '状态' };
    const label = createControl('label'); label.textContent = t(fieldLabels[field] || field);
    const input = createControl('input'); input.value = Array.isArray(item[field]) ? item[field].join(', ') : (item[field] || '');
    input.disabled = readOnly; input.setAttribute('aria-label', `${item.name} ${t(fieldLabels[field] || field)}`);
    input.addEventListener('input', event => setFoundationField(collection, index, field, event.target.value));
    label.append(input); form.append(label);
  }
  if(collection==='patterns'&&item.usage)for(const [field,title]of [['whenToUse','When to use'],['whenToAvoid','When to avoid'],['exceptions','Exceptions'],['limitations','Evidence limits'],['dependencies','Component dependencies'],['tokenReferences','Token references']]){
    const label=createControl('label'),input=createControl('textarea');label.textContent=t(title);input.rows=3;input.disabled=readOnly;
    input.value=(item.usage[field]||[]).join('\n');input.setAttribute('aria-label',`${item.name} ${t(title)}`);
    input.addEventListener('input',()=>{item.usage[field]=input.value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);});label.append(input);form.append(label);
  }
  return form;
}

function renderFoundationDiff() {
  const root = $('foundation-diff'); root.replaceChildren();
  const selected = foundationHistory.find(item => item.foundationVersion === $('foundation-compare').value);
  if (!selected || !foundationDraft) return;
  const changes = diffFoundations(selected.approval.foundation, foundationDraft);
  const changed = changes.filter(item => item.type !== 'unchanged');
  const summary = createControl('p');
  summary.className = 'foundation-diff-summary';
  summary.textContent = changed.length ? t`${changed.length} changes against v${selected.foundationVersion}` : t`No changes against v${selected.foundationVersion}`;
  root.append(summary);
  for (const change of changed) {
    const row = createControl('div'); row.className = 'foundation-diff-row'; row.dataset.change = change.type;
    const kind = createControl('span'); kind.textContent = t(change.type);
    const name = createControl('strong'); name.textContent = change.item.name;
    const detail = createControl('small'); detail.textContent = change.key.split(':')[0];
    row.append(kind, name, detail); root.append(row);
  }
}

function renderFoundationEvidence(summary) {
  const root = $('foundation-evidence');
  const patternsOpen=Boolean(root.querySelector('[data-pattern-candidates]')?.open);
  root.replaceChildren();
  const hasDesignSystem=['before','after'].some(phase=>run?.manifest.designSystemExtractions?.[phase]?.path===`${phase}/design-system.json`);
  root.hidden = !summary.skills.length&&!hasDesignSystem;
  if (root.hidden) return;

  const heading = createControl('div'); heading.className = 'foundation-evidence-heading';
  const copy = createControl('div');
  const title = createControl('h3'); title.id = 'foundation-evidence-title'; title.textContent = t('Automatic extraction review');
  const description = createControl('p');
  description.textContent = summary.filesScanned
    ? t`${summary.filesScanned} source files were scanned. Review conflicts and limits before approving any candidate.`
    : t('Review conflicts and limits before approving any candidate.');
  copy.append(title, description);
  const issueCount = createControl('span'); issueCount.className = 'foundation-evidence-count';
  issueCount.dataset.warning = String(summary.findings.length > 0 || summary.incompleteCount > 0);
  issueCount.textContent = summary.incompleteCount ? t('Extraction evidence incomplete')
    : summary.findings.length ? t`${summary.findings.length} items need review` : t('No extraction conflicts found');
  heading.append(copy, issueCount); root.append(heading);

  const skills = createControl('div'); skills.className = 'foundation-skill-list';
  const labels = {
    'foundation-extractor': t('Tokens and themes'),
    'brand-foundation-extractor': t('Brand assets and voice evidence'),
    'component-inventory': t('Components and consumers'),
    'pattern-library-curator': t('Accepted pattern candidates')
  };
  for (const skill of summary.skills) {
    const row = createControl('div'); row.className = 'foundation-skill';
    const name = createControl('strong'); name.textContent = labels[skill.id] || skill.id;
    const state = createControl('span'); state.dataset.status = skill.status;
    state.textContent = skill.findingCount ? t`${skill.findingCount} findings` : t(skill.status);
    const record = run?.manifest.skills.find(item => item.id === skill.id);
    if (/^skills\/[a-zA-Z0-9_-]+\.json$/.test(record?.path || '')) {
      const source = createControl('a'); source.href = `${run.base}/${record.path}`; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = t('Raw result');
      row.append(name, state, source);
    } else row.append(name, state);
    skills.append(row);
  }
  root.append(skills);
  for(const inventory of summary.brandDeclarations){
    const categoryLabels={promise:'Product promise',audience:'Target audience',voice:'Brand voice',terminology:'Core terminology',cta:'Action language',error:'Error language',trust:'Trust claims',prohibited:'Prohibited claims',visual:'Visual language',principle:'Brand principles'};
    const categoryLabel=value=>t(categoryLabels[value]||value);
    const details=createControl('details'),label=createControl('summary');details.className='foundation-limitations';label.textContent=t('Declared brand intent');details.append(label);
    const note=createControl('p');note.textContent=t('Source declarations are evidence, not approved rules. Differences may belong to different versions or platforms.');details.append(note);
    for(const entry of (Array.isArray(inventory.declarations)?inventory.declarations:[]).filter(entry=>entry&&typeof entry.text==='string'&&typeof entry.source==='string'&&typeof entry.category==='string').slice(0,128)){
      const item=createControl('p');item.style.overflowWrap='anywhere';item.textContent=`${categoryLabel(entry.category)} / ${entry.source}:${entry.line} — ${entry.text}`;details.append(item);
    }
    if(inventory.alternatives?.length){const note=createControl('p');note.textContent=t('Conflicting declarations need review.');details.append(note);}
    const missing=createControl('p');missing.textContent=t('Undocumented categories')+': '+(Array.isArray(inventory.missingCategories)?inventory.missingCategories:[]).map(categoryLabel).join(', ');details.append(missing);root.append(details);
  }
  if(summary.patternCandidates.length){
    const details=createControl('details');details.className='foundation-limitations';details.dataset.patternCandidates='true';details.open=patternsOpen;
    const label=createControl('summary');label.textContent=t('Accepted pattern candidates');details.append(label);
    const note=createControl('p');note.textContent=t('These repeated compositions still need usage guidance and design review before becoming shared patterns.');details.append(note);
    for(const candidate of summary.patternCandidates){
      const section=createControl('section'),title=createControl('h4'),source=createControl('p');
      title.textContent=candidate.name;source.textContent=candidate.source;section.append(title,source);
      const list=createControl('ul');
      for(const example of (Array.isArray(candidate.examples)?candidate.examples:[]).slice(0,16)){
        const item=createControl('li');item.textContent=`${example.route||''} / ${example.stateId||''} / ${example.configurationId||''}`;
        if(/^[a-z0-9][a-z0-9_-]{0,63}$/.test(example.runId||'')&&[...$('case-select').options].some(option=>option.value==='run:'+example.runId)){
          const link=createControl('a');link.href=`/apps/designer/?case=${encodeURIComponent('run:'+example.runId)}&view=canvas&lang=${getLanguage()}`;
          link.textContent=t('Open source review');item.append(' / ',link);
        }else item.append(' / ',t('Source review is not exported.'));
        list.append(item);
      }
      section.append(list);
      const review=(run.patternReviews||[]).filter(item=>item.source===candidate.source&&(item.unavailable||item.language===getLanguage())).at(-1);
      if(review){
        const heading=createControl('h5');heading.textContent=t('Usage guidance draft');section.append(heading);
        const verdict=createControl('p');verdict.textContent=t(review.guidance?.verdict==='propose'?'Proposed guidance':review.guidance?.verdict==='not-reusable'?'Not reusable with current evidence':'More evidence needed');section.append(verdict);
        const text=createControl('p');text.textContent=review.unavailable?t('Pattern guidance is unavailable. Reload the source record.'):review.guidance?.summary||'';section.append(text);
        for(const [field,label] of [['whenToUse','When to use'],['whenToAvoid','When to avoid'],['exceptions','Exceptions'],['limitations','Evidence limits']]){
          const items=review.guidance?.[field];if(!Array.isArray(items)||!items.length)continue;
          const title=createControl('strong'),list=createControl('ul');title.textContent=t(label);
          for(const value of items.slice(0,24)){const item=createControl('li');item.textContent=String(value);list.append(item);}
          section.append(title,list);
        }
        const note=createControl('p');note.textContent=t('Model guidance is a proposal. It has not changed the approved design system.');section.append(note);
        for(const [index,image] of (review.images||[]).entries()){
          const link=createControl('a');link.href=`${run.base}/pattern-reviews/${review.id}/${image.file}`;link.target='_blank';link.rel='noopener noreferrer';
          link.textContent=t('Reviewed original')+` ${index+1}`;section.append(link,createControl('br'));
        }
      }
      if(editableFoundation()){
        const button=createControl('button');button.type='button';button.textContent=t('Draft usage guidance');
        button.addEventListener('click',async()=>{
          const id=run.manifest.id;button.disabled=true;button.textContent=t('Reviewing original evidence…');
          try{
            const job=await postJson('/api/workbench/pattern-review',{runId:id,source:candidate.source,language:getLanguage()});
            await waitForJob(job.id,{attempts:2400});
            if(run?.manifest.id===id){const loaded=await loadRun(id);run.patternReviews=loaded.patternReviews;run.manifest.patternReviews=loaded.manifest.patternReviews;renderFoundation();}
          }catch(error){$('notice').textContent=error.message;}finally{button.disabled=false;button.textContent=t('Draft usage guidance');}
        });section.append(button);
        if(review?.guidance?.verdict==='propose'){
          const staged=(run.manifest.patternAdmissions||[]).some(item=>item.source===candidate.source),admit=createControl('button');admit.type='button';
          admit.disabled=staged;admit.textContent=t(staged?'Already in Foundation review':'Add to Foundation review');
          admit.addEventListener('click',async()=>{
            const id=run.manifest.id;admit.disabled=true;
            try{
              const job=await postJson('/api/workbench/pattern-admit',{runId:id,reviewId:review.id,expectedFoundation:run.spec.designFoundation});await waitForJob(job.id);
              if(run?.manifest.id===id){const loaded=await loadRun(id);run.patternAdmissions=loaded.patternAdmissions;run.manifest.patternAdmissions=loaded.manifest.patternAdmissions;render();}
            }catch(error){$('notice').textContent=error.message;admit.disabled=false;}
          });section.append(admit);
        }
      }
      details.append(section);
    }
    root.append(details);
  }
  for(const phase of ['before','after']){
    const record=run?.manifest.designSystemExtractions?.[phase];
    if(record?.path!==`${phase}/design-system.json`)continue;
    const row=createControl('p'),link=createControl('a');
    link.href=`${run.base}/${record.path}`;link.target='_blank';link.rel='noopener noreferrer';
    link.textContent=getLanguage()==='zh'?(phase==='before'?'整改前：设计系统与组件证据':'整改后：设计系统与组件证据'):(phase==='before'?'Before: design system and component evidence':'After: design system and component evidence');
    row.append(link);root.append(row);
  }

  if (summary.findings.length) {
    const alert = createControl('div'); alert.className = 'foundation-evidence-alert';
    const alertTitle = createControl('strong'); alertTitle.textContent = t('Resolve these before approval');
    const list = createControl('ul');
    for (const finding of summary.findings) { const item = createControl('li'); item.textContent = finding.title; list.append(item); }
    alert.append(alertTitle, list); root.append(alert);
  }
  if (summary.limitations.length) {
    const details = createControl('details'); details.className = 'foundation-limitations';
    const label = createControl('summary'); label.textContent = t`${summary.limitations.length} extraction limits`;
    const list = createControl('ul');
    for (const limitation of summary.limitations) { const item = createControl('li'); item.textContent = t(limitation.message); list.append(item); }
    details.append(label, list); root.append(details);
  }
}

function foundationItemMeta(collection, item, summary) {
  const meta = createControl('div'); meta.className = 'foundation-item-meta';
  const detail = createControl('span');
  detail.textContent = collection === 'tokens' ? `${item.value || t('No value')} / ${item.source || t('Unknown source')}` : item.source || item.description || t('Unknown source');
  meta.append(detail);
  if (collection === 'tokens') {
    const labels = { conflict: t('Conflicting values'), 'unresolved-alias': t('Unresolved alias'), 'alias-cycle': t('Alias cycle') };
    for (const flag of summary.tokenFlags.get(item.name) || []) {
      const warning = createControl('small'); warning.className = 'foundation-item-warning'; warning.textContent = labels[flag]; meta.append(warning);
    }
  }
  if(item.evidence){
    const details=createControl('details'),summary=createControl('summary'),pre=createControl('pre');
    summary.textContent=t('查看来源、依赖与覆盖缺口');pre.textContent=JSON.stringify(item.evidence,null,2);details.append(summary,pre);meta.append(details);
  }
  if(item.usage){
    const details=createControl('details'),label=createControl('summary');label.textContent=t('Pattern conditions and dependencies');details.append(label);
    for(const [field,title]of [['whenToUse','When to use'],['whenToAvoid','When to avoid'],['exceptions','Exceptions'],['limitations','Evidence limits'],['dependencies','Component dependencies'],['tokenReferences','Token references']]){
      const values=item.usage[field];if(!Array.isArray(values)||!values.length)continue;
      const heading=createControl('strong'),list=createControl('ul');heading.textContent=t(title);
      for(const value of values){const li=createControl('li');li.textContent=value;list.append(li);}details.append(heading,list);
    }
    meta.append(details);
  }
  return meta;
}

function foundationDecisionReason(item,readOnly){
  const label=createControl('label');label.className='foundation-decision-reason';label.hidden=!item.decision;label.textContent=t('本项判断原因');
  const input=createControl('textarea');input.rows=2;input.disabled=readOnly;input.value=item.decision?.reason||'';input.setAttribute('aria-label',`${item.name} ${t('本项判断原因')}`);
  input.addEventListener('input',()=>{item.decision.reason=input.value;const decisions=foundationDecisionSummary(foundationDraft);prefillFoundationApproval(decisions,summarizeFoundationEvidence(run?.foundationEvidence||[]));$('foundation-decision-summary').dataset.pending=String(decisions.pending>0);$('foundation-decision-summary').textContent=decisions.pending?t`${decisions.pending} pending / ${decisions.approved} approved / ${decisions.deprecated} deprecated / ${decisions.deferred} deferred`:t`${decisions.approved} approved / ${decisions.deprecated} deprecated / ${decisions.deferred} deferred`;$('foundation-save').disabled=decisions.pending>0||![...foundationDraft.tokens,...foundationDraft.components,...foundationDraft.patterns].some(entry=>entry.status==='approved');});
  label.append(input);return label;
}

function prefillFoundationApproval(decisions, evidenceSummary) {
  const newRun = foundationFormRunId !== run?.manifest.id;
  if (newRun) {
    foundationFormRunId = run?.manifest.id || null;
    $('foundation-version').value = '';
    $('foundation-reason').value = '';
    $('foundation-reason').dataset.manual = 'false';
  }
  $('foundation-version').value ||= nextFoundationVersion(foundationHistory[0]?.foundationVersion);
  try {
    $('foundation-reviewer').value ||= localStorage.getItem(FOUNDATION_REVIEWER_KEY) || t('Local reviewer');
    if (newRun) $('foundation-reviewer-type').value = localStorage.getItem(FOUNDATION_REVIEWER_TYPE_KEY) || 'human';
  } catch { $('foundation-reviewer').value ||= t('Local reviewer'); }
  if ($('foundation-reason').dataset.manual !== 'true') {
    $('foundation-reason').value = t`${decisions.total} candidates reviewed: ${decisions.approved} approved and ${decisions.deprecated} deprecated / ${decisions.deferred} deferred. The decision considered ${evidenceSummary.filesScanned} scanned source files and ${evidenceSummary.findings.length} extraction findings.`;
  }
  $('foundation-approval-guidance').textContent = decisions.pending
    ? t`Complete ${decisions.pending} candidate decisions before confirming this version.`
    : t('All candidates have a decision. Review the suggested record or confirm this version now.');
}

function renderFoundation() {
  const foundation = run?.approval?.foundation || spec.designFoundation;
  const root = $('foundation-groups');
  root.replaceChildren();
  if (!foundation) {
    $('foundation-status').textContent = run?.manifest.foundationInventory?.status === 'failed' ? t('EXTRACTION FAILED') : t('NOT INVENTORIED');
    $('foundation-summary').textContent = t('0 artifacts');
    const empty = createControl('p');
    empty.className = 'foundation-empty';
    empty.textContent = t('This case has no brand, token, component or pattern inventory yet.');
    root.append(empty);
    $('foundation-approval').hidden = true;
    $('foundation-evidence').hidden = true;
    $('foundation-toolbar').hidden = !run;
    $('foundation-extract').hidden = !run;
    $('foundation-version-note').textContent = run?.manifest.foundationInventory?.status === 'failed'
      ? t`Automatic extraction failed: ${run.manifest.foundationInventory.error || ''}`
      : t('No design foundation has been extracted yet.');
    return;
  }
  if (!foundationDraft) foundationDraft = createFoundationDraft(foundation,{preserveDecisions:!editableFoundation()});
  foundationDraft=foundationWithPatternAdmissions(foundationDraft,(run?.patternAdmissions||[]).filter(record=>!record.unavailable));
  const draft = foundationDraft;
  const evidenceSummary = summarizeFoundationEvidence(run?.foundationEvidence || []);
  const readOnly = !editableFoundation();
  $('foundation-toolbar').hidden = false;
  const inventory = run?.manifest.foundationInventory;
  $('foundation-status').textContent = run?.approval
    ? t`APPROVED / v${run.approval.foundationVersion}`
    : inventory?.status === 'failed' ? t('OBSERVED / EXTRACTION FAILED')
    : inventory?.status === 'partial' ? t('OBSERVED / PARTIAL EXTRACTION')
    : inventory?.materialized ? t('OBSERVED / AUTO-EXTRACTED')
    : t(draft.status);
  const groups = [
    ['assets', t('Brand assets'), draft.brand.assets],
    ['tokens', t('Tokens'), draft.tokens],
    ['components', t('Components'), draft.components],
    ['patterns', t('Patterns'), draft.patterns]
  ];
  const total = groups.reduce((count, [, , items]) => count + items.length, 0);
  $('foundation-summary').textContent = t`${total} artifacts`;
  renderFoundationEvidence(evidenceSummary);
  const guidance = createControl('article'); guidance.className = 'foundation-guidance';
  const guidanceTitle = createControl('h3'); guidanceTitle.textContent = t('Brand guidance'); guidance.append(guidanceTitle);
  for (const [field, label] of [['principles', 'Principles'], ['voice', 'Voice']]) {
    const control = createControl('label'); control.textContent = t(label);
    const textarea = createControl('textarea'); textarea.rows = 3; textarea.value = draft.brand[field].join('\n'); textarea.disabled = readOnly;
    textarea.addEventListener('input', event => { draft.brand[field] = event.target.value.split('\n').map(item => item.trim()).filter(Boolean); });
    control.append(textarea); guidance.append(control);
  }
  root.append(guidance);
  for (const [collection, label, items] of groups) {
    const group = createControl('article');
    const title = createControl('h3');
    title.textContent = `${label} / ${items.length}`;
    group.append(title);
    if (!items.length) {
      const empty = createControl('p');
      empty.textContent = t('Not documented');
      group.append(empty);
    }
    for (const [index, item] of items.entries()) {
      const row = createControl('div');
      row.className = 'foundation-item';
      row.dataset.foundationCollection = collection;
      row.dataset.foundationName = item.name;
      const body = createControl('div'); body.className = 'foundation-item-body';
      const name = createControl('span');
      name.textContent = item.name;
      const status = createControl('small');
      status.dataset.status = item.status;
      status.textContent = t(item.status);
      const { wrap: actions, current } = foundationDecisionControl(collection, item, index, readOnly);
      body.append(name, status); row.append(body, actions, foundationItemMeta(collection, item, evidenceSummary), foundationReplacementFields(collection, item, index, current === 'replace', readOnly),foundationDecisionReason(item,readOnly));
      group.append(row);
    }
    root.append(group);
  }
  const approval = $('foundation-approval'); approval.hidden = readOnly;
  if (!readOnly) {
    const decisions = foundationDecisionSummary(draft);
    prefillFoundationApproval(decisions, evidenceSummary);
    $('foundation-decision-summary').dataset.pending = String(decisions.pending > 0);
    $('foundation-decision-summary').textContent = decisions.pending
      ? t`${decisions.pending} pending / ${decisions.approved} approved / ${decisions.deprecated} deprecated / ${decisions.deferred} deferred`
      : t`${decisions.approved} approved / ${decisions.deprecated} deprecated / ${decisions.deferred} deferred`;
    const hasUsableApproved = [...draft.tokens, ...draft.components, ...draft.patterns].some(item => item.status === 'approved');
    $('foundation-save').disabled = decisions.pending > 0 || !hasUsableApproved;
  }
  $('foundation-version-note').textContent = run?.approval
    ? t`Reviewed by ${run.approval.reviewer.name} / ${run.approval.reviewedAt || ''}`
    : inventory?.status === 'failed' ? t`Automatic extraction failed: ${inventory.error || ''}`
    : !run || run.foundationWritable === false ? t('This exported record is read-only. Open its connected local run to review or approve the foundation.')
    : readOnly ? t('Foundation decisions are frozen after planning begins.') : t('Automatically extracted candidates still need an explicit decision before generation can use them.');
  $('foundation-extract').hidden = !run || run.foundationWritable === false || Boolean(run.approval) || Boolean(run.manifest.plan || run.manifest.execution);
  if(run?.patternAdmissions?.some(record=>record.unavailable)){
    $('foundation-save').disabled=true;$('foundation-version-note').textContent=t('A staged pattern is unavailable. Reload its source record before approving.');
  }
  const compare = $('foundation-compare'), previousValue = compare.value;
  compare.replaceChildren(new Option(t('Choose a prior version'), ''));
  for (const item of foundationHistory.filter(item => item.foundationVersion !== run?.approval?.foundationVersion)) compare.append(new Option(`v${item.foundationVersion} / ${item.reviewer.name}`, item.foundationVersion));
  compare.value = [...compare.options].some(option => option.value === previousValue) ? previousValue : (compare.options[1]?.value || '');
  renderFoundationDiff();
}

function noticeFor() {
  if (run) {
    return t('此报告保留本轮截图与复核证据。打开复核结果，选择接受或继续调整。');
  }
  return caseId === 'happyclaw'
    ? t('Repository-based review. The live site currently has different content; exportable before/after artifacts and real user-task validation are still needed.')
    : t('Fictional walkthrough. This illustrates the workflow; it is not evidence from a real product.');
}

function render() {
  $('case-select').value = caseId;
  $('notice').textContent = run ? '' : noticeFor();
  $('report-result-panel').hidden = !run;
  $('report-empty').hidden = Boolean(run);
  const model=run?.diagnosis?.modelDiagnosis;
  $('baseline-model').hidden=!run;
  $('baseline-model-status').textContent=model? t(model.status==='complete'?'页面诊断已完成，可一键修复。修改后再审阅最终结果。':model.status==='needs-evidence'?'页面诊断缺少证据，不能据此判定页面通过。':'模型诊断未完成；当前仅保留规则候选。')+' '+model.summary:t('此记录尚未运行模型页面诊断。');
  $('baseline-model-limits').textContent=(model?.limitations||[]).join(' ');
  $('baseline-model-retry').hidden=!run||run.foundationWritable!==true||!['needs-diagnosis','awaiting-confirmation'].includes(workflowState(run.manifest).stage)||Boolean(run.manifest.confirmation||run.manifest.plan||run.manifest.execution);
  $('foundation-new-review').disabled=!run||run.foundationRefreshAvailable!==true;
  $('project-name').textContent = spec.project.name;
  $('project-source').textContent = spec.project.source;
  $('project-goal').textContent = spec.project.goal;
  $('project-audience').textContent = spec.project.audience;
  $('project-task').textContent = spec.project.task;
  renderFoundation();
  renderLoop();
  renderRun();
  renderScore();
  const list = normalisedFindings(spec, run?.diagnosis);
  if (!list.some(item => item.id === selected)) selected = list[0]?.id ?? null;
  $('finding-count').textContent = t`${list.length} FINDINGS`;
  $('findings-source').textContent = run?.diagnosis
    ? t`From ${run.manifest.diagnosis.evaluatorVersion || t('the run diagnosis')}, merging Experience Spec observations with completed Skill results. Priority is impact × confidence ÷ effort; confirm it against a real user task before acting.`
    : t('Priority is an explicit draft calculation: impact × confidence ÷ effort. Confirm it with a real user task before acting.');
  $('diagnosis-project-memory')?.remove();
  const memoryView=projectMemoryView(run?.diagnosis?.projectMemory);
  if(memoryView)$('findings-source').after(memoryView);
  $('incremental-review-context')?.remove();
  const incrementalView=incrementalReviewView(run?.manifest.onboarding?.incrementalReview,{onFullReview:run?.foundationWritable?async()=>{
    const job=await postJson('/api/workbench/refresh-review',{runId:run.manifest.id,fullReview:true});
    const completed=await waitForJob(job.id),url=new URL(location.href);url.searchParams.set('case','run:'+completed.result.runId);url.searchParams.set('view','canvas');location.href=url.href;
  }:null});
  if(incrementalView)$('findings-source').after(incrementalView);
  const evidenceList = $('evidence-list');
  evidenceList.replaceChildren();
  for (const evidence of spec.evidence) {
    const item = createControl('div');
    item.className = 'evidence-item';
    const label = createControl('span');
    label.textContent = `${evidence.id} / ${t(evidence.state)}`;
    const observation = createControl('p');
    observation.textContent = evidence.observation;
    item.append(label, observation);
    evidenceList.append(item);
  }
  const findings = $('findings');
  findings.replaceChildren();
  for (const item of list) {
    const button = createControl('button');
    button.type = 'button';
    button.className = 'finding';
    button.dataset.status = item.status;
    button.setAttribute('aria-pressed', item.id === selected ? 'true' : 'false');
    const top = createControl('span');
    top.className = 'finding-top';
    top.textContent = t`${item.id} / PRIORITY ${item.priority.toFixed(1)}`;
    const status = createControl('em');
    status.className = 'finding-status';
    status.textContent = t(item.status);
    top.append(status);
    const title = createControl('strong');
    title.textContent = item.title;
    const explanation = createControl('small');
    explanation.textContent = t`Impact ${item.impact}/5 / Confidence ${item.confidence}/5 / Effort ${item.effort}/5 / ${item.evidence.length} evidence`;
    button.append(top, title, explanation);
    button.addEventListener('click', () => { selected = item.id; render(); });
    findings.append(button);
  }
  const finding = list.find(item => item.id === selected) || null;
  const firstRender = run?.manifest.plan?.kind === 'bootstrap';
  $('selected-title').textContent = finding?.title ?? (firstRender ? t('No finding: this run built the surface for the first time') : t('No findings in this run'));
  $('selected-proposal').textContent = finding?.proposal ?? (firstRender
    ? t('With nothing rendered there was no evidence to diagnose, so the change was constrained by the approved design foundation.')
    : t('Run `harness diagnose` to build an evidence graph for this run.'));
  $('selected-evidence').textContent = finding
    ? t`Evidence: ${finding.evidence.join(', ')}. Status ${t(finding.status)}; this is a proposed priority with no behavioural data attached.`
    : '';
  // A Skill-derived finding has no Experience Spec entry, so there is nothing to
  // write a scoped brief from. Say so instead of throwing.
  $('brief').textContent = finding?.inSpec
    ? codexBrief(spec, selected)
    : run?.brief || t('This finding came from a Skill result rather than the Experience Spec, so no scoped brief can be generated from it. Record it in the spec first.');
  $('download-brief').disabled = !finding?.inSpec && !run?.brief;
  $('review-before').textContent = run ? t(run.manifest.captures.before ? '已采集基线' : '尚未采集基线') : t`Before: ${spec.review.before}`;
  $('review-after').textContent = run ? t(run.manifest.captures.after ? '已采集修改结果' : '尚未采集修改结果') : t`After: ${spec.review.after}`;
  $('review-status').textContent = spec.review.status === 'needs-evidence'
    ? t('Needs deployment match and user-task validation')
    : spec.review.status === 'ready-for-human-review' ? t('Ready for human review') : t('Change not started');
  if (run) $('review-status').textContent = run.manifest.judgmentWithdrawal ? t('本轮决定已撤回') : run.manifest.judgment ? t(run.manifest.judgment.decision) : t(run.manifest.evaluation ? '等待人工判断' : '尚未完成复评');
  $('decision').value = run ? run.manifest.judgment?.decision || 'pending' : spec.review.judgment;
  $('reason').value = run ? run.manifest.judgment?.reason || '' : spec.review.reason;
  // Live runs use the independent review flow; examples retain a local decision form.
  const readOnly = Boolean(run);
  $('manual-decision').hidden = readOnly;
  $('decision').disabled = readOnly;
  $('reason').disabled = readOnly;
  $('save-judgment').hidden = Boolean(run);
  $('save-judgment').disabled = false;
  $('save-judgment').textContent = readOnly ? t('查看 AI 复核与决定') : t('Save judgment');
}

async function select(id) {
  foundationDraft = null; foundationHistory = [];
  if (isRun(id)) {
    const loaded = await loadRun(runIdOf(id));
    const foundationState = await loadFoundationHistory(loaded.manifest.id);
    loaded.foundationWritable = foundationState.available;
    loaded.foundationRefreshAvailable = foundationState.refreshAvailable === true;
    run = loaded;
    spec = loaded.spec;
    foundationHistory = foundationState.entries;
  } else {
    run = null;
    spec = loadExample(id);
  }
  caseId = id;
  for (const picker of [$('case-select'), $('studio-run-select')]) {
    picker.value = id;
    picker.title = picker.selectedOptions[0]?.title || '';
  }
  renderSiteHandoff(run);
  renderReviewHistory();
  syncDirectionLink();
  selected = normalisedFindings(spec, run?.diagnosis)[0]?.id ?? null;
  params.set('case', id);
  history.replaceState(null, '', `?${params.toString()}${location.hash}`);
  render();
  await applyView(params.get('view') || (run ? 'canvas' : 'list'));
}

// The local workbench owns all three views and preserves its state across reloads.
// Floating tools belong to the canvas, not the fixed page toolbar.
const floatingTools = document.querySelector('.studio-controls');
document.querySelector('.studio-center').append(floatingTools);
for (const [id, className] of [['studio-toggle-sidebar', 'studio-hide-sidebar'], ['studio-toggle-inspector', 'studio-hide-inspector']]) {
  $(id).addEventListener('click', () => {
    const hidden = $('fullscreen-shell').classList.toggle(className);
    $(id).setAttribute('aria-pressed', String(!hidden));
  });
}
let currentView = 'list';
let reportScroll = 0;
let canvasController = null;
let canvasState = null;
let canvasRunId = null;
let refreshing = false;
let refreshedAt = null;
let changingLanguage = false;
document.querySelectorAll('[data-language-toggle]').forEach(picker => picker.addEventListener('click', async () => {
  if (changingLanguage) return;
  changingLanguage = true;
  const draft = { decision: $('decision').value, reason: $('reason').value };
  document.querySelectorAll('[data-language-toggle]').forEach(select => { select.disabled = true; });
  try {
    setLanguage(getLanguage() === 'zh' ? 'en' : 'zh');
    params.set('lang', getLanguage());
    updateShellLanguage();
    showIndexProblem(indexProblem);
    syncDirectionLink();
    $('studio-message').textContent = t('证据来自本地导出记录');
    updateRunOptions();
    if (spec) {
      render();
      $('decision').value = draft.decision;
      $('reason').value = draft.reason;
      await applyView(currentView);
    }
  } finally {
    document.querySelectorAll('[data-language-toggle]').forEach(select => { select.disabled = false; });
    changingLanguage = false;
  }
}));
function updateRunOptions() {
  document.querySelectorAll('option[data-run-summary]').forEach(option => {
    const summary = JSON.parse(option.dataset.runSummary);
    const when = summary.createdAt ? summary.createdAt.slice(0, 10) : t('undated');
    const purpose = summary.findingTitle || t('基线审阅');
    const compact = [...purpose].length > 18 ? [...purpose].slice(0, 18).join('') + '…' : purpose;
    option.textContent = `${when} / ${compact} / ${summary.id}`;
    option.title = `${summary.project} / ${when} / ${purpose} / ${summary.id}`;
  });
  for (const picker of [$('case-select'), $('studio-run-select')]) picker.title = picker.selectedOptions[0]?.title || '';
  renderReviewHistory();
}

const reviewFolderState = new Map();
function renderReviewHistory() {
  const list = $('review-history-list');
  list.replaceChildren();
  const options = [...$('case-select').options].sort((a, b) => Number(Boolean(b.dataset.runSummary)) - Number(Boolean(a.dataset.runSummary)));
  const groups = groupReviewHistory(options.map(option => ({ option, value: option.value, summary: option.dataset.runSummary ? JSON.parse(option.dataset.runSummary) : null })));
  for (const group of groups) {
    const folder = createControl('details'); folder.className = 'review-project-folder'; folder.dataset.projectKey = group.key;
    const current = Boolean(spec) && group.records.some(record => record.value === caseId);
    folder.open = reviewFolderState.has(group.key) ? reviewFolderState.get(group.key) : current;
    const heading = createControl('summary');
    heading.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>';
    const label = createControl('span'); label.textContent = group.examples ? t('示例') : group.name; label.title = group.key;
    heading.addEventListener('click', () => reviewFolderState.set(group.key, !folder.open));
    heading.append(label); folder.append(heading);
    const children = createControl('div'); children.className = 'review-project-records'; folder.append(children); list.append(folder);
    for (const { option, summary } of group.records) {
    const title = summary ? (summary.findingTitle==='Repair current diagnosis candidates'?t('本轮修复'):summary.findingTitle) || `${t('基线审阅')} / ${summary.createdAt?.slice(5, 10) || t('undated')}` : option.textContent;
    const button = createControl('button');
    button.type = 'button'; button.dataset.reviewId = option.value;
    button.title = summary ? option.title : title;
    button.setAttribute('aria-current', String(option.value === caseId));
    const name = createControl('span'); name.textContent = title;
    button.append(name);
    button.onclick = async () => {
      const previousId = caseId;
      list.querySelectorAll('button').forEach(item => { item.disabled = true; });
      try { await select(option.value); if (matchMedia('(max-width:899px)').matches) $('review-history').open = false; }
      catch (error) { caseId = previousId; renderReviewHistory(); $('studio-message').textContent = t`无法读取记录：${error.message}`; $('notice').textContent = t`无法读取记录：${error.message}`; }
      finally { list.querySelectorAll('button').forEach(item => { item.disabled = false; }); }
    };
    children.append(button);
    if (option.value === caseId) document.querySelectorAll('[data-current-review]').forEach(item => { item.textContent = title; item.title = button.title; });
  }
  }
}

const historyLayout = matchMedia('(max-width:899px)');
$('review-history').open = !historyLayout.matches;
historyLayout.addEventListener('change', event => { $('review-history').open = !event.matches; });

function renderEmptyEvidenceView(view) {
  const isCanvas = view === 'canvas';
  $('fullscreen-shell').classList.toggle('codediff-empty-mode', !isCanvas);
  $('pd-fs-run-name').textContent = spec.project.name;
  $('studio-task').textContent = spec.project.task || t('审阅已采集的项目证据。');
  $('studio-run-select').value = caseId;
  $('pd-fs-count').textContent = t('尚无运行证据');
  $('pd-fs-eval-status').textContent = t('等待 Harness 采集');
  $('studio-message').textContent = t('当前项目可以浏览工作区，但还没有可展示的运行证据。');
  $('pd-fs-last-update').textContent = '';
  $('pd-stage-card').hidden = false;
  $('pd-stage-title').textContent = isCanvas ? t('先采集界面证据') : t('先执行一次受控修改');
  $('pd-stage-desc').textContent = isCanvas
    ? t('运行 Harness 基线采集后，截图、状态和标注会出现在这里。')
    : t('代码改动只展示 Harness 隔离执行后保存的 diff.patch，不会根据描述伪造差异。');
  $('studio-command-details').hidden = true;
  $('studio-followup').textContent = t('你仍然可以切换到其他页面；缺少证据不会锁住工作台导航。');
  $('pd-sidebar-tree').replaceChildren();
  const directoryEmpty = createControl('p');
  directoryEmpty.className = 'studio-empty-copy';
  directoryEmpty.textContent = t('完成一次采集后，这里会列出页面、状态和视口。');
  $('pd-sidebar-tree').append(directoryEmpty);
  $('pd-inspector-body').replaceChildren();
  const inspectorEmpty = createControl('div');
  inspectorEmpty.className = 'studio-empty-state';
  const inspectorTitle = createControl('h2');
  inspectorTitle.textContent = t('暂无可检查的证据');
  const inspectorCopy = createControl('p');
  inspectorCopy.textContent = isCanvas
    ? t('Canvas 会在基线采集完成后显示真实界面，而不是占位截图。')
    : t('Code diff 会在受控执行完成后显示真实补丁。');
  inspectorEmpty.append(inspectorTitle, inspectorCopy);
  $('pd-inspector-body').append(inspectorEmpty);

  const target = isCanvas ? $('pd-fs-canvas') : $('pd-fs-codediff-container');
  target.replaceChildren();
  const empty = createControl('article');
  empty.className = 'pd-canvas-empty workbench-empty-view';
  const title = createControl('h3');
  title.textContent = isCanvas ? t('开始第一次页面审阅') : t('代码改动已打开');
  const copy = createControl('p');
  copy.textContent = isCanvas
    ? t('连接本地项目后，工作台会采集真实页面并带你查看首条有证据的问题。')
    : t('当前项目还没有可审阅的 diff.patch。完成一次隔离修改后，这里会显示真实代码差异。');
  empty.append(title, copy);
  if (isCanvas) {
    const start = createControl('button');
    start.type = 'button';
    start.className = 'button primary';
    start.textContent = t('连接项目并开始审阅');
    start.addEventListener('click', () => openOperations(null,{connectionOnly:true}));
    empty.append(start);
  }
  target.append(empty);
}

async function applyView(view) {
  // Historical report/direction URLs keep their run and capture selection, but
  // all primary review work now lives in the page workspace.
  if((view==='list'&&location.hash!=='#foundation-title')||view==='directions'){view='canvas';const url=new URL(location.href);url.searchParams.set('view','canvas');history.replaceState(null,'',url);}
  reportAction?.destroy(); reportAction = null;codeAction?.destroy();codeAction = null;
  if (currentView === 'list') reportScroll = window.scrollY;
  if (!['list', 'canvas', 'codediff', 'directions'].includes(view)) view = run ? 'canvas' : 'list';
  $('fullscreen-shell').setAttribute('aria-busy', 'true');
  document.querySelectorAll('[data-studio-view], .pd-view-jump').forEach(button => { button.disabled = true; });
  try {
  if (canvasController) { if (currentView === 'canvas') canvasState = canvasController.snapshot(); if (currentView === 'directions') directionStates.set(canvasRunId, canvasController.snapshot()); await canvasController.destroy(); canvasController = null; }
  if (canvasRunId !== run?.manifest.id) canvasState = null;
  canvasRunId = run?.manifest.id;
  currentView = view;
  const legacyTools = view === 'canvas' && params.get('tools') === 'legacy';
  $('fullscreen-shell').classList.toggle('cowart-mode', legacyTools);
  $('fullscreen-shell').classList.toggle('page-review-mode', view === 'canvas' && !legacyTools);
  $('fullscreen-shell').classList.toggle('codediff-mode', view === 'codediff');
  $('fullscreen-shell').classList.toggle('directions-mode', view === 'directions');
  if (view !== 'codediff') $('fullscreen-shell').classList.remove('codediff-empty-mode');
  params.set('view', view);
  params.set('case', caseId);
  history.replaceState(null, '', `?${params.toString()}${location.hash}`);
  $('workbench-shell').hidden = view !== 'list';
  $('fullscreen-shell').hidden = view === 'list';
  document.body.style.overflow = view === 'list' || matchMedia('(max-width:899px)').matches ? '' : 'hidden';
  document.querySelectorAll('[data-studio-view]').forEach(button => {
    const active = button.dataset.studioView === view;
    button.setAttribute('aria-pressed', String(active));
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  document.querySelector('.studio-local').textContent = legacyTools ? t('本地 / 可编辑草稿') : t('本地 / 审阅记录');
  $('workbench-view-title').textContent = view === 'directions' ? t('设计方向') : view === 'codediff' ? t('代码改动') : t('页面审阅');
  if (view === 'list') requestAnimationFrame(() => window.scrollTo(0, reportScroll));
  else window.scrollTo(0, 0);
  if (view === 'list') {renderLoop();if(location.hash==='#foundation-title')requestAnimationFrame(openFoundationStep);return;}
  $('pd-fs-run-name').textContent = (run?.spec || spec).project.name;
  $('studio-task').textContent = (run?.spec || spec).project.task || t('审阅已采集的项目证据。');
  $('studio-run-select').value = caseId;
  $('pd-fs-canvas').hidden = view !== 'canvas';
  $('pd-fs-codediff-container').hidden = view !== 'codediff';
  directionContainer.hidden = view !== 'directions';
  if (view === 'directions') {
    $('studio-message').textContent = run ? t('证据来自本地导出记录') : t('当前项目可以浏览工作区，但还没有可展示的运行证据。');
    refreshedAt = run ? Date.now() : null;
    $('pd-fs-last-update').textContent = run ? t('刚刚读取 / ') + run.manifest.id : '';
    const { renderRunDirections } = await import('./directions/run-directions.js');
    canvasController = renderRunDirections(directionContainer, run, {
      previous: directionStates.get(run?.manifest.id),
      onNavigate: applyView, onFoundation: openFoundationStep,
      onChanged: async result => { const oldId = run?.manifest.id; await actionChanged(result); if (!result.runId || result.runId === oldId) await applyView('canvas'); },
      onConnect: () => openOperations(run)
    });
    return;
  }
  document.querySelector('.studio-controls').hidden = view === 'codediff';
  document.querySelector('.studio-board-footer').hidden = view === 'codediff';
  $('studio-board-title').textContent = view === 'canvas' ? t('界面对照') : t('执行改动 / Code diff');
  $('studio-message').textContent = run
    ? t('证据来自本地导出记录')
    : t('当前项目可以浏览工作区，但还没有可展示的运行证据。');
  if (!run) {
    renderEmptyEvidenceView(view);
    return;
  }
  $('pd-stage-card').hidden = false;
  $('studio-command-details').hidden = false;
  // Populate shared context even when opening the code view directly.
  if (view === 'canvas') {
    if (legacyTools) {
      const { renderCowart } = await import('./cowart/editor.jsx');
      canvasController = await renderCowart($('pd-fs-canvas'), run, canvasState || { captureId: params.get('capture') });
    } else {
      const { renderPageReview } = await import('./page-review/index.js');
      canvasController = await renderPageReview($('pd-fs-canvas'), run, {...(canvasState || {}), onChanged: actionChanged});
    }
  }
  else {
    await renderCodeDiff($('pd-fs-codediff-container'), run, run.base);
    const codePrimary = createControl('div');codePrimary.id = 'code-primary-action';$('pd-fs-codediff-container').prepend(codePrimary);
    codeAction = mountReviewAction(codePrimary, run, {onChanged: actionChanged, onFoundation: openFoundationStep});
  }
  refreshedAt = Date.now();
  $('pd-fs-last-update').textContent = t('刚刚读取 / ') + run.manifest.id;
  } finally {
    $('fullscreen-shell').setAttribute('aria-busy', 'false');
    document.querySelectorAll('[data-studio-view], .pd-view-jump').forEach(button => {
      button.disabled = false;
    });
  }
}
async function refreshRun(manual = false) {
  if (!run || (['list', 'canvas', 'directions'].includes(currentView) && !manual) || refreshing || $('studio-lightbox').open) return;
  refreshing = true;
  const id = run.manifest.id;
  $('studio-refresh').disabled = true;
  try {
    const loaded = await loadRun(id);
    const foundationState = await loadFoundationHistory(id);
    loaded.foundationWritable = foundationState.available;
    loaded.foundationRefreshAvailable = foundationState.refreshAvailable === true;
    if (run.manifest.id !== id) return;
    if (manual || JSON.stringify(loaded) !== JSON.stringify(run)) {
      run = loaded; spec = loaded.spec; foundationDraft = null;
      foundationHistory = foundationState.entries;
      render();
      await applyView(currentView);
      $('studio-message').textContent = t('已读取最新导出证据，保留画布位置。');
    }
    refreshedAt = Date.now();
    $('pd-fs-last-update').textContent = t('刚刚读取 / ') + id;
  } catch {
    $('studio-message').textContent = t('读取失败，保留上次证据。请重新导出后重试。');
  } finally { refreshing = false; $('studio-refresh').disabled = false; }
}
$('studio-refresh').addEventListener('click', () => refreshRun(true));
let refreshTimer;
const scheduleRefresh = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => refreshRun(), 300); };
window.addEventListener('focus', scheduleRefresh);
document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRefresh(); });
setInterval(() => { if (refreshedAt && run) $('pd-fs-last-update').textContent = t`${Math.floor((Date.now()-refreshedAt)/60000)} 分钟前读取 / ${run.manifest.id}`; }, 60000);
matchMedia('(max-width:899px)').addEventListener('change', event => { document.body.style.overflow = event.matches || currentView === 'list' ? '' : 'hidden'; });
document.querySelectorAll('[data-studio-view], .pd-view-jump').forEach(button => {
  button.addEventListener('click', event => { event.preventDefault(); params.delete('tools'); applyView(button.dataset.studioView || button.dataset.view).catch(() => { $('studio-message').textContent = t('无法读取页面，请重试。'); }); });
});
$('studio-run-select').addEventListener('change', async event => {
  try { await select(event.target.value); $('case-select').value = caseId; }
  catch (error) { event.target.value = caseId; $('studio-message').textContent = t`无法读取记录：${error.message}`; }
});

$('case-select').addEventListener('change', async event => {
  const next = event.target.value;
  try {
    await select(next);
  } catch (error) {
    event.target.value = caseId;
    $('notice').textContent = t`Could not open ${next}: ${error.message}`;
  }
});

$('foundation-compare').addEventListener('change', renderFoundationDiff);
$('foundation-reason').addEventListener('input', () => { $('foundation-reason').dataset.manual = 'true'; });
$('foundation-extract').addEventListener('click', async event => {
  if (!run) return;
  const button = event.currentTarget;
  button.disabled = true;
  $('foundation-version-note').textContent = t('Extracting design foundation…');
  try {
    const job = await postJson('/api/workbench/action', { runId: run.manifest.id, action: 'foundation' });
    await waitForJob(job.id);
    run = await loadRun(run.manifest.id); run.foundationWritable = true; run.foundationRefreshAvailable = true; spec = run.spec; foundationDraft = null;
    render();
  } catch (error) {
    $('foundation-version-note').textContent = error.message;
  } finally { button.disabled = false; }
});
$('foundation-approval').addEventListener('submit', async event => {
  event.preventDefault();
  if (!run || !foundationDraft) return;
  const save = $('foundation-save'), status = $('foundation-save-status');
  save.disabled = true; status.textContent = t('Saving approval…');
  try {
    const approval = approvalFromDraft({
      foundation: foundationDraft,
      version: $('foundation-version').value,
      reviewer: $('foundation-reviewer').value,
      reviewerType: $('foundation-reviewer-type').value,
      reason: $('foundation-reason').value
    });
    try {
      localStorage.setItem(FOUNDATION_REVIEWER_KEY, $('foundation-reviewer').value.trim());
      localStorage.setItem(FOUNDATION_REVIEWER_TYPE_KEY, $('foundation-reviewer-type').value);
    } catch { /* Session-only when storage is unavailable. */ }
    const job = await postJson('/api/workbench/action', { runId: run.manifest.id, action: 'foundation-approve', approval });
    await waitForJob(job.id);
    run = await loadRun(run.manifest.id); run.foundationWritable = true; run.foundationRefreshAvailable = true; spec = run.spec; foundationDraft = null;
    foundationHistory = (await loadFoundationHistory(run.manifest.id)).entries;
    status.textContent = t`Foundation v${approval.foundationVersion} approved and frozen.`;
    render();
  } catch (error) { status.textContent = error.message; save.disabled = false; }
});

$('download-brief').addEventListener('click', () => {
  const finding = normalisedFindings(spec, run?.diagnosis).find(item => item.id === selected);
  const brief = finding?.inSpec ? codexBrief(spec, selected) : run?.brief;
  if (!brief) return;
  download(`${caseId.replace(':', '-')}-agent-brief.md`, brief, 'text/markdown');
  $('notice').textContent = t('Agent brief downloaded. Review the real app and confirm the diagnosis before applying an edit.');
});

$('save-judgment').addEventListener('click', () => {
  try {
    if (run) { openOperations(run); return; }
    const judgment = $('decision').value;
    if (judgment === 'pending') throw new Error(t('Choose accept or reject before saving.'));
    spec = recordJudgment(spec, judgment, $('reason').value);
    localStorage.setItem(`pd-review-${caseId}`, JSON.stringify(spec));
    $('notice').textContent = t`Your ${t(judgment)} decision and reason were saved in this browser. Export the Experience Spec to keep a portable copy.`;
  } catch (error) {
    $('notice').textContent = error.message;
  }
});

$('download-spec').addEventListener('click', () => {
  download(`${caseId.replace(':', '-')}-experience.json`, JSON.stringify(spec, null, 2), 'application/json');
});

// Refresh the history in place: current selection, draft inputs and open
// evidence must survive a recovery attempt, including another failed request.
function mergeRunSummaries(runs) {
  const available = new Set(runs.map(summary => `${RUN_PREFIX}${summary.id}`));
  for (const picker of [$('case-select'), $('studio-run-select')]) {
    for (const option of [...picker.querySelectorAll('option[data-run-summary]')]) {
      // Preserve the loaded review, but stop offering other removed exports.
      if (!available.has(option.value) && option.value !== caseId) option.remove();
    }
  }
  for (const summary of runs) for (const picker of [$('case-select'), $('studio-run-select')]) {
    const value = `${RUN_PREFIX}${summary.id}`;
    const option = [...picker.options].find(item => item.value === value) || createControl('option');
    option.value = value;
    option.dataset.runSummary = JSON.stringify(summary);
    if (!option.parentNode) picker.append(option);
  }
  updateRunOptions();
}
function showIndexProblem(problem) {
  indexProblem = problem;
  $('report-index-problem').hidden = !problem;
  $('report-index-problem-detail').textContent = problem
    ? t`Could not read ${RUNS_BASE}/index.json: ${problem}. Exported runs are not listed.` : '';
}

async function start() {
  const picker = $('case-select');
  const { runs, problem } = await loadRunIndex();
  // A failed history listing is separate from the current case's scope notice.
  // Keep its recovery visible and the raw request/error text available on demand.
  showIndexProblem(problem);
  mergeRunSummaries(runs);
  const requested = params.get('case');
  const available = [...picker.options].map(option => option.value);
  try {
    await select(available.includes(requested) ? requested : (!requested && runs.length ? `${RUN_PREFIX}${runs[0].id}` : 'happyclaw'));
    picker.value = caseId;
    if (requested && !available.includes(requested)) $('notice').textContent = t('未找到请求的审阅记录。请先将它导出到本地工作台。');
  } catch (error) {
    await select('happyclaw');
    $('notice').textContent = t`Could not open ${requested}: ${error.message}`;
    return;
  }
}

start().then(()=>openSiteHandoff(openOperations));

$('report-index-retry').addEventListener('click', async () => {
  const button = $('report-index-retry');
  button.disabled = true;
  try {
    const { runs, problem } = await loadRunIndex();
    if (!problem) mergeRunSummaries(runs);
    showIndexProblem(problem);
  } finally { button.disabled = false; }
});

for (const button of document.querySelectorAll('[data-workbench-operations]')) button.addEventListener('click', () => openOperations(run));

$('report-empty-connect').addEventListener('click', () => openOperations(run, {connectionOnly:true}));

$('baseline-model-retry').addEventListener('click',async event=>{
  if(!run)return;const button=event.currentTarget;button.disabled=true;
  try{const job=await postJson('/api/workbench/action',{runId:run.manifest.id,action:'diagnose'});await waitForJob(job.id,{attempts:2640});await select('run:'+run.manifest.id);}
  catch(error){$('baseline-model-status').textContent=error.message;}finally{button.disabled=false;}
});
$('foundation-new-review').addEventListener('click',async event=>{
  if(!run)return;const button=event.currentTarget;button.disabled=true;
  try{const job=await postJson('/api/workbench/refresh-review',{runId:run.manifest.id,fullReview:true});const result=await waitForJob(job.id,{attempts:2640});const url=new URL(location.href);url.searchParams.set('case','run:'+result.result.runId);url.searchParams.set('view','list');url.hash='foundation-title';location.href=url.href;}
  catch(error){$('foundation-version-note').textContent=error.message;}finally{button.disabled=false;}
});
function revealFoundationFromHash(){if(location.hash==='#foundation-title')$('foundation-section').open=true;}
window.addEventListener('hashchange',revealFoundationFromHash);revealFoundationFromHash();
