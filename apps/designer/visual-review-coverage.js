import { t } from './i18n.js';

export function appendVisualCoverage(container, review) {
  const coverage=review?.coverage;
  const composite=coverage?.kind==='external-page-surfaces';
  if(!coverage)return;
  const section=document.createElement('section');section.className='visual-review-coverage';
  const title=document.createElement('strong');title.textContent=t(composite?'页面概览与内部区域复核':'整页与跨区域复核');
  const regions=document.createElement('p');const passed=coverage.regionalVerdicts.filter(value=>value==='pass').length;
  regions.textContent=t`分区批次复核 ${passed}/${coverage.regionalVerdicts.length} 通过`;
  const overview=document.createElement('p');overview.textContent=composite?t`页面证据 ${coverage.coveredContexts}/${coverage.expectedContexts} 已采集`:t`整页原图 ${coverage.coveredContexts}/${coverage.expectedContexts} 已采集`;
  const cross=document.createElement('p');cross.textContent=t('跨区域结论')+' · '+t(coverage.crossRegionVerdict==='not-run'?'尚未复核':coverage.crossRegionVerdict);
  section.append(title,regions,overview,cross);
  if(coverage.missingContexts.length){const gap=document.createElement('p');gap.textContent=t(composite?'部分页面或设备缺少页面概览或内部区域证据。请补齐后重新审阅。':'部分页面或设备缺少默认状态的整页原图。请补齐采集计划后重新审阅。');section.append(gap);}
  if(coverage.missingStates.length){const gap=document.createElement('p');gap.textContent=t('部分交互或页面状态未采集成功，不能作为完整复核通过。');section.append(gap);}
  if(coverage.exceeded){const gap=document.createElement('p');gap.textContent=t('整页证据超过当前复核容量，跨区域结论仍未完成。');section.append(gap);}
  const scope=document.createElement('p');scope.textContent=t('结论只覆盖本次计划内的页面、设备与状态，仍需你的最终判断。');section.append(scope);container.append(section);
}
