import {createControl} from '../../../packages/ui/controls.js';
import {t} from '../i18n.js';

export function appendBrandAssessments(parent,review,run){
  if(!Array.isArray(review?.brandAssessments)||!review.brandAssessments.length)return;
  const details=createControl('details'),summary=createControl('summary');summary.textContent=t('Brand declaration comparison');details.append(summary);
  details.dataset.brandAssessments='true';
  details.dataset.detail='brand-assessments';
  for(const entry of review.brandAssessments){
    const match=/^(before|after):[a-f0-9]{64}:([1-9][0-9]*):([a-z-]+)$/.exec(entry?.reference||'');if(!match)continue;
    const section=createControl('section'),label=createControl('strong'),observation=createControl('p');
    label.textContent=t('brand-assessment-'+entry.verdict);observation.textContent=entry.observation;observation.style.overflowWrap='anywhere';section.append(label,observation);
    const source=createControl('a');source.href=`${run.base}/${match[1]}/design-system.json`;source.textContent=t('Open declaration evidence')+` / ${t(match[1]==='before'?'修改前':'修改后')} / ${match[2]}`;source.target='_blank';source.rel='noopener noreferrer';section.append(source);
    for(const path of entry.screenshotRefs||[]){if(!review.screenshotRefs?.includes(path))continue;const link=createControl('a');link.href=`${run.base}/${path}`;link.textContent=path;link.target='_blank';link.rel='noopener noreferrer';section.append(document.createTextNode(' / '),link);}
    details.append(section);
  }
  parent.append(details);
  return details;
}
