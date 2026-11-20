import {technicalWorkflow} from './evidence-policy.js';
// One self-contained HTML file per run: no server, no build step, no network.
//
// A finished run already holds everything a reviewer needs, but it is spread over
// a 100 KB manifest, several JSON records and a folder of screenshots. This module
// folds it into one file a person can open, attach to a message or archive next to
// the release. It reports state; it never decides acceptance.

import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extname, join, resolve} from 'node:path';
import {loadRun} from './store.js';
import {captureEntries} from './capture-state.js';
import {matchedCriterionStates} from './criterion-evidence.js';
import {criterionSourceChanges} from './criterion-source-evidence.js';
import {experienceFor} from './experience-orchestration.js';
import {readVisualReviewBinding} from './visual-review-binding.js';
import {visualReviewFor} from './workflow.js';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MIME = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif'};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
}

function stageLine(manifest) {
  const technical = technicalWorkflow(manifest, {});
  if (technical) return technical.stage;
  if (manifest.judgment) return 'judged';
  if (manifest.visualReviews?.length) return 'visual QA recorded';
  if (manifest.evaluation) return 'evaluated';
  if (manifest.captures?.after) return 'after capture recorded';
  if (manifest.execution) return 'executed';
  if (manifest.plan) return 'planned';
  if (manifest.confirmation) return 'confirmed';
  if (manifest.diagnosis) return 'diagnosed';
  if (manifest.captures?.before) return 'baseline captured';
  return 'started';
}

async function inlineImage(directory, relativePath) {
  if (!relativePath) return null;
  const mime = MIME[extname(relativePath).toLowerCase()];
  if (!mime) return null;
  try {
    const bytes = await readFile(join(directory, relativePath));
    if (bytes.length > MAX_IMAGE_BYTES) return {src: null, path: relativePath, hash: createHash('sha256').update(bytes).digest('hex'), skipped: 'Image is larger than 12 MB; open it from the run folder.'};
    return {src: `data:${mime};base64,${bytes.toString('base64')}`, path: relativePath, hash: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length};
  } catch (error) {
    if (error.code === 'ENOENT') return {src: null, path: relativePath, hash: null, skipped: 'Screenshot is recorded but missing from the run folder.'};
    throw error;
  }
}

function figure(image, caption) {
  if (!image) return '';
  if (!image.src) return `<figure><div class="missing">${escapeHtml(image.skipped || 'No screenshot.')}</div><figcaption>${escapeHtml(caption)} · ${escapeHtml(image.path)}</figcaption></figure>`;
  return `<figure><img alt="${escapeHtml(caption)}" src="${image.src}"><figcaption>${escapeHtml(caption)} · ${escapeHtml(image.path)}<br><code>${escapeHtml(image.hash.slice(0, 16))}…</code> ${image.bytes ? `${Math.round(image.bytes / 1024)} KB` : ''}</figcaption></figure>`;
}

function findingsTable(diagnosis) {
  const findings = diagnosis?.findings || [];
  if (!findings.length) return '<p class="muted">No findings were recorded for this run.</p>';
  const rows = findings.map(finding => `<tr>
    <td><strong>${escapeHtml(finding.title)}</strong><br><span class="muted">${escapeHtml(finding.id)}</span></td>
    <td>${escapeHtml(finding.verificationStatus)}</td>
    <td>${Number(finding.priority).toFixed(1)}</td>
    <td>${escapeHtml(finding.proposal || '')}</td>
  </tr>`).join('');
  return `<table><thead><tr><th>Finding</th><th>Status</th><th>Priority</th><th>Proposal</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function gateList(run) {
  const m = run.manifest;
  const technical = technicalWorkflow(m, {});
  const rows = technical ? [
    ['Evidence level', technical.level],
    ['Declared check', m.evidencePolicy.kind],
    ['Before', m.technicalEvidence?.before?.status || 'missing'],
    ['After', m.technicalEvidence?.after?.status || 'missing'],
    ['Independent visual QA', technical.visual],
    ['Human judgment', 'not recorded']
  ] : [
    ['Baseline capture', m.captures?.before ? 'recorded' : 'missing'],
    ['Diagnosis', m.diagnosis ? 'recorded' : 'missing'],
    ['User confirmation', m.confirmation ? `${m.confirmation.verdict} · ${m.confirmation.note}` : 'missing'],
    ['Plan', m.plan?.path ? `${m.plan.kind || 'plan'} · ${m.plan.path}` : 'missing'],
    ['Execution', m.execution ? `${m.execution.agent?.id || 'agent'} exited ${m.execution.exitCode}${m.execution.boundaryBreaches?.length ? ` · ${m.execution.boundaryBreaches.length} boundary breach(es)` : ''}` : 'missing'],
    ['After capture', m.captures?.after ? 'recorded' : 'missing'],
    ['Evaluation', m.evaluation ? 'recorded (structural checks only)' : 'missing'],
    ['Independent visual QA', m.visualReviews?.length ? `${m.visualReviews.length} review(s)` : 'missing'],
    ['Human judgment', m.judgmentWithdrawal ? `withdrawn · ${m.judgmentWithdrawal.reason}` : m.judgment ? `${m.judgment.decision} · ${m.judgment.reason}` : 'pending']
  ];
  return `<table class="gates"><tbody>${rows.map(([name, value]) => `<tr><th>${escapeHtml(name)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</tbody></table>`;
}

const items = values => values.map(escapeHtml).join('<br>');

function technicalTrace(manifest) {
  const policy = manifest.evidencePolicy;
  const {before, after} = manifest.technicalEvidence || {};
  const target = {
    'node-syntax': () => `${policy.file} parses successfully`,
    'button-name': () => `${policy.selector} has the accessible name “${policy.name}”`,
    'horizontal-overflow': () => 'The document fits the viewport without horizontal overflow'
  }[policy.kind]();
  const key = check => check.key ?? check.file;
  const old = new Map((before?.checks || []).map(check => [key(check), check]));
  const current = new Map((after?.checks || []).map(check => [key(check), check]));
  const both = [...new Set([...old.keys(), ...current.keys()])];
  const results = both.map(state => {
    const a = old.get(state), b = current.get(state);
    const details = b || a;
    const dimensions = details.viewport ? ` · ${details.viewport.width}×${details.viewport.height}` : '';
    const route = details.route ? ` · ${details.route}` : '';
    if (a && b && (a.route !== b.route || a.viewport?.width !== b.viewport?.width || a.viewport?.height !== b.viewport?.height)) return `${state}: before and after did not match`;
    return `${state}${dimensions}${route}: ${a?.status ?? 'missing'} → ${b?.status ?? 'missing'}`;
  });
  return `<h2>Requirement evidence</h2><dl>
  <dt>Declared requirement</dt><dd>${escapeHtml(target)}</dd>
  <dt>Changed files in the candidate</dt><dd>${after?.changedFiles ? items(after.changedFiles) : 'No source delta recorded.'}</dd>
  <dt>Before and after checks</dt><dd>${results.length ? items(results) : 'No checks recorded.'}</dd>
  <dt>Technical result</dt><dd>${escapeHtml(technicalWorkflow(manifest, {}).stage)}${after?.diagnostic ? ` · ${escapeHtml(after.diagnostic)}` : ''}</dd>
  </dl>`;
}

async function visualTrace(run) {
  const {manifest} = run;
  if (!manifest.experienceAudit?.goal) return '';
  let criteria;
  try { criteria = (await experienceFor(run, manifest.designDecision ? 'decision' : 'audit')).audit.task.goal.criteria; }
  catch { return '<h2>Requirement evidence</h2><p>Bound task evidence is missing or changed.</p>'; }
  let assessments = [], sourceChanges, qaStatus = 'not-reviewed';
  try {
    sourceChanges = await criterionSourceChanges(run);
    const reference = visualReviewFor(manifest, 'visual-qa-evaluator');
    if (reference) {
      const {review} = await readVisualReviewBinding(run, reference, {requireBound:true});
      assessments = review.criterionAssessments || [];
      if (!assessments.length) qaStatus = 'no criterion-level assessment recorded';
    } else if (manifest.visualReviews?.some(row => row.skillId === 'visual-qa-evaluator')) qaStatus = 'review is stale';
  } catch { qaStatus = 'review or source evidence is missing or changed'; }
  const rows = criteria.map((requirement, index) => {
    const result = assessments.find(row => row.criterion === index + 1);
    const states = result ? matchedCriterionStates(manifest, result.screenshotRefs).map(row => row.state) : [];
    return `<article><h3>${escapeHtml(requirement)}</h3><dl>
      <dt>Changed files</dt><dd>${result?.changedFiles.length ? items(result.changedFiles) : sourceChanges ? 'No changed files associated with this criterion.' : 'No captured source delta available.'}</dd>
      <dt>Matched states</dt><dd>${states.length ? items(states) : 'No matching before and after state cited.'}</dd>
      <dt>Originals and checks</dt><dd>${items([...(result?.screenshotRefs || []), ...(result?.verificationRefs || [])]) || 'No evidence cited.'}</dd>
      <dt>Independent result</dt><dd>${escapeHtml(result ? `${result.verdict} · ${result.reason}` : qaStatus)}</dd>
    </dl></article>`;
  });
  return `<h2>Requirement evidence</h2>${rows.join('\n')}`;
}

async function imageRows(run) {
  const manifest = run.manifest;
  const before = manifest.captures?.before ? captureEntries(manifest.captures.before) : [];
  const after = manifest.captures?.after ? captureEntries(manifest.captures.after) : [];
  const keyOf = entry => entry.legacy ? entry.configurationId : `${entry.stateId}--${entry.configurationId}`;
  const afterByKey = new Map(after.map(entry => [keyOf(entry), entry]));
  const rows = [];
  for (const entry of before) {
    const key = keyOf(entry);
    const pair = afterByKey.get(key);
    const beforeImage = await inlineImage(run.directory, entry.screenshot);
    const afterImage = pair ? await inlineImage(run.directory, pair.screenshot) : null;
    const viewport = entry.width && entry.height ? `${entry.width}×${entry.height}` : 'viewport';
    rows.push(`<section class="capture"><h3>${escapeHtml(key)} <span class="muted">${escapeHtml(viewport)}</span></h3><div class="pair">${figure(beforeImage, 'before')}${figure(afterImage, pair ? 'after' : 'after (not captured)')}</div></section>`);
  }
  if (!rows.length) rows.push('<p class="muted">This run has no screenshots to show.</p>');
  return rows.join('\n');
}

export async function buildRunReport({directory, outputPath} = {}) {
  if (!directory) throw Error('A run directory is required.');
  const run = await loadRun(directory);
  const manifest = run.manifest;
  let diagnosis = null;
  if (manifest.diagnosis?.path) {
    try { diagnosis = JSON.parse(await readFile(join(directory, manifest.diagnosis.path), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const project = run.spec.project || {};
  const title = project.name || manifest.id;
  const images = await imageRows(run);
  const trace = technicalWorkflow(manifest, {}) ? technicalTrace(manifest) : await visualTrace(run);
  const execution = manifest.execution;
  const ledger = [
    ['Run', manifest.id],
    ['Stage', stageLine(manifest)],
    ['Policy', manifest.experiencePolicy || 'default'],
    ['Preview', manifest.url || '—'],
    ['Created', manifest.createdAt || '—'],
    ['Brief', manifest.plan?.path || '—'],
    ['Brief hash', manifest.plan?.briefHash ? `${manifest.plan.briefHash.slice(0, 16)}…` : '—'],
    ['Diff', execution?.diffStat || '—'],
    ['Independent review', visualReviewFor(manifest, 'visual-qa-evaluator')?.path || '—'],
    ['Specialist check index', manifest.verificationEvidence?.path || '—'],
    ['Changed files', execution?.changedFiles?.join(', ') || '—']
  ];
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · run ${escapeHtml(manifest.id)}</title>
<style>
  :root { color-scheme: light dark; --ink:#1b1b1b; --muted:#6a6a6a; --line:#ddd6c8; --paper:#fbf9f4; }
  @media (prefers-color-scheme: dark) { :root { --ink:#eee; --muted:#a5a5a5; --line:#3a3a3a; --paper:#161616; } }
  body { margin:0 auto; max-width:1080px; padding:32px 24px 64px; font:15px/1.55 system-ui,"Segoe UI",sans-serif; background:var(--paper); color:var(--ink); }
  h1 { font-size:24px; margin:0 0 4px; } h2 { font-size:17px; margin:36px 0 10px; } h3 { font-size:14px; margin:18px 0 8px; }
  .muted { color:var(--muted); font-weight:400; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th,td { text-align:left; vertical-align:top; padding:7px 10px; border-bottom:1px solid var(--line); }
  table.gates th { width:190px; font-weight:600; }
  dt { font-weight:600; } dd { margin:0 0 8px; overflow-wrap:anywhere; }
  .pair { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media (max-width:760px) { .pair { grid-template-columns:1fr; } }
  figure { margin:0; } img { width:100%; height:auto; border:1px solid var(--line); border-radius:6px; background:#fff; }
  figcaption { font-size:12px; color:var(--muted); margin-top:6px; }
  .missing { border:1px dashed var(--line); border-radius:6px; padding:28px; text-align:center; color:var(--muted); font-size:13px; }
  footer { margin-top:40px; font-size:12px; color:var(--muted); border-top:1px solid var(--line); padding-top:12px; }
  code { font-size:12px; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <div class="muted">${escapeHtml(project.task || project.goal || 'No task recorded')} · run ${escapeHtml(manifest.id)} · ${escapeHtml(stageLine(manifest))}</div>
</header>

<h2>Gates</h2>
${gateList(run)}

${trace}
${manifest.technicalEvidence ? `<h2>Technical verification</h2><pre>${escapeHtml(JSON.stringify(manifest.technicalEvidence, null, 2))}</pre>` : ''}
<h2>Findings</h2>
${findingsTable(diagnosis)}

<h2>Screenshots</h2>
${images}

<h2>Ledger</h2>
<table class="gates"><tbody>${ledger.map(([name, value]) => `<tr><th>${escapeHtml(name)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</tbody></table>

<footer>
  Generated by <code>happyhands report</code> at ${escapeHtml(new Date().toISOString())}.
  This page restates what the run recorded. It is evidence, not acceptance: only a person can accept a change,
  and a missing gate above is missing evidence, not a pass.
</footer>
</body>
</html>
`;
  const target = resolve(outputPath || join(directory, 'report.html'));
  await writeFile(target, html, 'utf8');
  return {path: target, bytes: Buffer.byteLength(html), findings: diagnosis?.findings?.length || 0, images: (html.match(/data:image\//g) || []).length};
}
