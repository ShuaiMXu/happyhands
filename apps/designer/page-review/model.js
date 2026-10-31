import {isReportableFinding} from '../../../packages/harness-core/finding-admission.js';
import { buildNodes, safeScreenshot } from '../canvas/nodes.js';
import { exportedReviewState } from '../cowart/review-state.js';

export function reviewTargets(run, reviews = exportedReviewState(run).reviews) {
  const cited = new Set(reviews.flatMap(review => review.screenshotRefs));
  return buildNodes(run).map(node => {
    const screenshot = safeScreenshot(node.phase, node.entry);
    return { ...node, screenshot, available: Boolean(screenshot && node.entry.reached !== false), cited: Boolean(screenshot && cited.has(screenshot)) };
  });
}

export function reviewCoverage(targets) {
  const stateKeys = new Set(), routes = new Set(), interactions = new Set();
  const interactionEvidence = { total: 0, captured: 0, cited: 0 };
  const wholePageEvidence = {total:0,captured:0,cited:0};
  let failed = 0, uncited = 0;
  for (const target of targets) {
    const key = target.key || `${target.entry.stateId}--${target.entry.configurationId}`;
    stateKeys.add(key);
    try {
      const url = new URL(target.entry.start?.url);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) {
        // Before and after previews use separate loopback ports for one project.
        // Their transport addresses must not inflate reviewed route coverage.
        const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        routes.add(`${loopback ? 'local-preview' : url.origin}${url.pathname}${url.search}`);
      }
    } catch { /* Legacy captures may not record their start URL. */ }
    if ((target.entry.actions || []).some(action => ['click', 'fill', 'scroll-horizontal','click-selector','fill-selector','press-key','validate-form','hover-selector','focus-selector'].includes(action.type)||(action.type==='specialist-sequence'&&Boolean(target.entry.specialist)))) {
      interactions.add(key);
      interactionEvidence.total += 1;
      if (target.available) {
        interactionEvidence.captured += 1;
        if (target.cited) interactionEvidence.cited += 1;
      }
    }
    if(target.entry.captureMode==='full-page'){wholePageEvidence.total++;if(target.available){wholePageEvidence.captured++;if(target.cited)wholePageEvidence.cited++;}}
    if (!target.available) failed += 1;
    else if (!target.cited) uncited += 1;
  }
  return { routes: routes.size, states: stateKeys.size, interactions: interactions.size, interactionEvidence, wholePageEvidence, failed, uncited };
}

export function currentPreview(preview, workbenchOrigin) {
  if (!preview?.url) return null;
  try {
    const url = new URL(preview.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.origin === workbenchOrigin) return null;
    const allowed = new Set(['verified', 'source-match', 'source-mismatch', 'dirty', 'unverified', 'preview-changed', 'preview-stopped', 'preview-unavailable']);
    const fingerprint = typeof preview.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(preview.fingerprint) ? preview.fingerprint : null;
    let versionStatus = allowed.has(preview.versionStatus) ? preview.versionStatus : 'unverified';
    const sourceStatus = allowed.has(preview.sourceStatus) && !preview.sourceStatus.startsWith('preview-') ? preview.sourceStatus : null;
    if (versionStatus === 'verified' && (preview.managed !== true || !fingerprint)) versionStatus = 'unverified';
    return { url: url.href, versionStatus, ...(sourceStatus ? { sourceStatus } : {}), ...(preview.reachable === true ? { reachable: true } : {}), ...(preview.managed === true ? { managed: true } : {}), ...(fingerprint ? { fingerprint } : {}) };
  } catch { return null; }
}

export function livePreviewAvailable(preview) {
  return Boolean(preview?.reachable && ['verified', 'source-match'].includes(preview.versionStatus));
}

export function reviewFindings(run) {
  const authored = new Map((run.spec.findings || []).map(item => [item.id, item]));
  const diagnosed = run.diagnosis?.findings || [];
  return diagnosed.length ? diagnosed.filter(isReportableFinding).map(item => ({ ...item, ...authored.get(item.id) })) : [...authored.values()].filter(isReportableFinding);
}

function evidenceSource(value) {
  const direct = value?.value?.source || value?.source;
  if (direct && /\.[a-z0-9]+$/i.test(direct)) return direct.replaceAll('\\','/');
  if (typeof value?.observation !== 'string' || !value.observation.trim().startsWith('{')) return null;
  try { const parsed=JSON.parse(value.observation);return parsed?.value?.source?.replaceAll('\\','/') || null; } catch { return null; }
}

export function reviewAssociations(run, targets = reviewTargets(run), findings = reviewFindings(run)) {
  const evidence = new Map((run.diagnosis?.evidence || []).map(item => [item.id,item]));
  const components = (run.componentInventory?.proposedUpdates || []).find(item => item.type === 'component-inventory')?.components || [];
  const bySource = new Map();
  for (const component of components) {
    const source=component.source?.replaceAll('\\','/');if(!source)continue;
    for(const key of [source,source.split('/').pop()]){const list=bySource.get(key)||[];list.push(component);bySource.set(key,list);}
  }
  return findings.map(finding=>{
    const refs=(finding.evidenceRefs || finding.evidence || []).map(item=>typeof item==='string'?evidence.get(item):item).filter(Boolean);
    const sources=[...new Set(refs.map(evidenceSource).filter(Boolean))];
    const matched=[];
    for(const source of sources){const exact=bySource.get(source)||bySource.get(source.split('/').pop())||[];if(exact.length===1&&!matched.includes(exact[0]))matched.push(exact[0]);}
    const directStates=new Set(refs.flatMap(item=>[item.state,item.value?.state]).filter(Boolean).map(value=>String(value).split('--')[0]));
    const directScreens=new Set(refs.map(item=>item.source).filter(value=>typeof value==='string'&&/\.png$/i.test(value)));
    const regions=targets.flatMap(target=>{
      if(directStates.has(target.entry.stateId)||directScreens.has(target.screenshot))return [{targetId:target.id,stateId:target.entry.stateId,confidence:'verified',reason:'finding evidence cites this captured state'}];
      if(target.entry.region?.verification==='unique-visible-selector-and-shared-source-anchor'&&matched.some(component=>component.source.replaceAll('\\','/')===target.entry.region.source?.file))return [{targetId:target.id,stateId:target.entry.stateId,confidence:'verified',reason:'finding source matches the captured region source anchor'}];
      if(matched.some(component=>component.name.toLowerCase()===target.entry.stateId.toLowerCase()))return [{targetId:target.id,stateId:target.entry.stateId,confidence:'candidate',reason:'capture state ID exactly matches the evidenced component name'}];
      return [];
    });
    const locations=regions.flatMap(region=>{const target=targets.find(item=>item.id===region.targetId),mapping=target?.entry.region;if(mapping?.verification!=='unique-visible-selector-and-shared-source-anchor')return [];return [{targetId:target.id,selector:mapping.selector,bounds:mapping.bounds,source:mapping.source,confidence:'verified'}];});
    return {findingId:finding.id,sources,components:matched.map(component=>({name:component.name,source:component.source,consumers:component.consumers||[]})),regions,locations,unlocated:!matched.length&&!regions.length};
  });
}
