import {createControl} from '../../../packages/ui/controls.js';
import {appendReviewResolutions} from '../review-resolutions.js';
import {appendPageSurfaceLinks} from '../page-surface-links.js';
import {t} from '../i18n.js';
import {exportedReviewState} from '../cowart/review-state.js';
import {appendVisualCoverage} from '../visual-review-coverage.js';
import {appendBrandAssessments} from './brand-assessments.js';

const el=(tag,text,className)=>{const node=createControl(tag);if(text)node.textContent=text;if(className)node.className=className;return node;};
const safeReference=/^(?:reviews\/[a-z0-9-]+\.json|verification\/[a-f0-9-]+\/(?:index\.json|result\.json|image-\d+\.png))$/;
function evidenceLink(run,path,text){if(!safeReference.test(path||''))return null;const link=el('a',text);link.href=`${run.base}/${path}`;link.target='_blank';link.rel='noopener noreferrer';return link;}
function details(text,...children){const node=el('details');node.append(el('summary',t(text)),...children);return node;}

// Use the same validity gate as the editor and decision dialog. A stale pass
// must never become the report headline just because its JSON still exists.
export function renderReportReviews(root,run){
  const opened=new Set([...root.querySelectorAll('details[data-detail]')].filter(node=>node.open).map(node=>node.dataset.detail));
  const previousRun=root.dataset.runId;root.dataset.runId=run.manifest.id;root.replaceChildren();
  const state=exportedReviewState(run),qa=state.reviews.find(item=>item.skillId==='visual-qa-evaluator');
  const card=el('article',null,'report-verdict');card.dataset.verdict=qa?.verdict||'needs-evidence';
  const heading=el('div',null,'report-verdict-heading');heading.append(el('h3',t('独立复核')),el('span',t(qa?.verdict||'尚未复核'),'page-review-verdict'));card.append(heading);
  card.append(el('p',t(qa?.verdict==='pass'?'本次计划内的独立复核已通过，仍需你的最终判断。':qa?.verdict==='fail'?'复核发现未解决的问题，请查看下方原因。':'当前尚无有效的独立复核结论，请先补齐证据。'),'report-verdict-lead'));
  if(qa){
    appendVisualCoverage(card,qa);
    appendReviewResolutions(card,qa,run);
    appendBrandAssessments(card,qa,run);
    for(const finding of qa.findings||[]){const row=el('div',null,'report-review-finding');row.append(el('strong',finding.title),el('p',finding.observation));card.append(row);}
    const complete=details('查看完整复核与证据',el('p',qa.rationale));complete.dataset.detail='qa';
    const meta=el('p',`${qa.reviewer?.name||''} / ${qa.reviewedAt||''}`,'small-note');complete.append(meta);
    if(qa.attempt?.kind==='protocol-retry'){
      complete.append(el('p',t('评审规范已更新。此前结论已保留。'),'small-note'),el('p',qa.attempt.reason,'small-note'));
      const previous=evidenceLink(run,qa.attempt.previousReviewPath,t('打开此前的复核记录'));if(previous)complete.append(previous);
    }
    const review=run.manifest.visualReviews?.find(item=>item.skillId===qa.skillId);const link=evidenceLink(run,review?.path,t('打开原始复核记录'));if(link)complete.append(link);
    card.append(complete);
    if(qa.limitations?.length){const limits=details('验证范围与限制');limits.dataset.detail='limits';const list=el('ul');for(const text of qa.limitations)list.append(el('li',text));limits.append(list);card.append(limits);}
  }
  const judgment=run.manifest.judgment;card.append(el('p',judgment?`${t('Recorded decision')} / ${t(judgment.decision)} — ${judgment.reason}`:t('尚未记录人工决定。独立复核通过不等于已经接受。'),'report-human-decision'));
  if(run.manifest.judgmentWithdrawal)card.append(el('p',t('本轮决定已撤回')+' / '+run.manifest.judgmentWithdrawal.reason,'report-human-decision'));
  root.append(card);
  if(run.manifest.verificationRecords?.length){
    const checks=details('专项验证记录');checks.dataset.detail='verification';
    checks.append(el('p',t('原始专项记录与截图已保留；只有当前复核引用的记录才计入本轮结论。'),'small-note'));
    for(const record of run.manifest.verificationRecords){const row=el('article',null,'report-verification-row');row.append(el('strong',`${record.id} / ${t(record.status)}`),el('span',t(qa?.verificationRefs?.includes(record.id)?'复核已引用':'已采集 / 未复核')),el('p',record.method));for(const limit of record.limitations||[])row.append(el('p',limit,'small-note'));const link=evidenceLink(run,record.path,t('打开专项原始记录'));if(link)row.append(link);for(const [index,image] of (record.images||[]).entries()){const link=evidenceLink(run,image.path,`${t('专项截图')} ${index+1}`);if(link)row.append(link);}checks.append(row);}root.append(checks);
  }
  const surfaces=details('页面与交互分段原图');surfaces.dataset.detail='surfaces';let tileCount=0;
  for(const phase of ['before','after'])for(const entry of run.manifest.captures?.[phase]?.states||[]){
    if(!entry.pageSurfaces&&!entry.interactionParts?.length)continue;
    const group=details(`${phase} / ${entry.stateId} / ${entry.configurationId}`);
    appendPageSurfaceLinks(group,run.base,phase,entry);tileCount+=entry.interactionParts?.length||0;tileCount+=entry.pageSurfaces?.surfaces?.reduce((n,s)=>n+(s.tiles?.length||0),0)||0;surfaces.append(group);
  }
  if(tileCount)root.append(surfaces);
  const history=run.manifest.visualReviewHistory||[];
  if(history.length){const older=details('查看此前的复核记录');older.dataset.detail='history';for(const review of history){const link=evidenceLink(run,review.path,`${review.reviewedAt||''} / ${t(review.verdict)}`);if(link)older.append(link);}root.append(older);}
  if(!qa){
    const prior=run.reviews?.find(item=>item.skillId==='visual-qa-evaluator');
    if(prior){const retained=details('查看未生效的原始复核');retained.dataset.detail='invalid-qa';retained.append(el('p',t('这份记录未通过当前证据校验，不能作为本轮通过结论。')));if(prior.document?.rationale)retained.append(el('p',prior.document.rationale));for(const finding of prior.document?.findings||[])retained.append(el('p',`${finding.title}: ${finding.observation}`));const link=evidenceLink(run,prior.path,t('打开原始复核记录'));if(link)retained.append(link);root.append(retained);}
  }
  // Other review kinds remain available in full, even if they are invalid.
  for(const item of run.reviews||[]){if(item.skillId==='visual-qa-evaluator') {if(item.problem)root.append(el('p',item.problem,'report-review-finding'));continue;}const itemDetails=details(item.skillId,el('p',item.problem||item.document?.rationale||t('No rationale was exported.')));for(const finding of item.document?.findings||[])itemDetails.append(el('p',`${finding.title}: ${finding.observation}`));root.append(itemDetails);}
  if(previousRun===run.manifest.id)for(const node of root.querySelectorAll('details[data-detail]'))node.open=opened.has(node.dataset.detail);
}
