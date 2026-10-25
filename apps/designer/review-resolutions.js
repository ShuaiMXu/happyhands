import {t} from './i18n.js';
export function appendReviewResolutions(root,review,run){
  if(review?.attempt?.kind!=='evidence-retry')return;
  const note=document.createElement('p');note.className='small-note';note.textContent=t('已根据新反证独立复核，原失败记录保留；这不代表人工接受。');root.append(note);
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=t('查看反证与逐项复核结论');details.append(summary);
  const reason=document.createElement('p');reason.textContent=review.attempt.reason;details.append(reason);
  for(const item of review.findingResolutions||[]){const row=document.createElement('p');row.textContent=`${item.findingId} · ${t('resolution-'+item.verdict)} — ${item.rationale}`;details.append(row);for(const id of item.attachmentRefs){const attachment=run.manifest.reviewAttachments?.find(value=>value.id===id);if(!attachment||attachment.path!==`reviews/attachments/${id}.png`)continue;const link=document.createElement('a');link.textContent=t('查看反证原图');link.href=`${run.base}/${attachment.path}`;link.target='_blank';link.rel='noopener noreferrer';details.append(link);}}
  if(/^reviews\/[a-z0-9-]+\.json$/.test(review.attempt.previousReviewPath)){const link=document.createElement('a');link.textContent=t('打开此前的复核记录');link.href=`${run.base}/${review.attempt.previousReviewPath}`;link.target='_blank';link.rel='noopener noreferrer';details.append(link);}
  root.append(details);
}
