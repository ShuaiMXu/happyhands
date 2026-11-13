import {captureEntries,captureOriginals} from './capture-state.js';
export const PAGE_STRUCTURE_RULE = 'UX-page-structure';
export const STRUCTURE_DIMENSIONS = ['grid','spacing','alignment','components','responsive'];

// This proves review coverage and traceable annotations, not automatic aesthetic truth.
export function assertPageStructureReview(review, manifest) {
  const entries = ['before','after'].flatMap(phase => captureEntries(manifest.captures?.[phase])).filter(e => e.screenshot);
  const refs = [...new Set(['before','after'].flatMap(phase=>captureOriginals(manifest.captures?.[phase])))];
  const afterRefs = new Set(captureOriginals(manifest.captures?.after));
  const checks = review.structureChecks;
  if (!refs.length || !Array.isArray(checks)) throw Error('Page structure requires original captures and structured checks.');
  const expected = new Set(refs.flatMap(ref => STRUCTURE_DIMENSIONS.map(d => ref+'|'+d)));
  const seen = new Set();
  for (const row of checks) {
    const key = row.screenshot+'|'+row.dimension;
    if (!expected.has(key) || seen.has(key)) throw Error('Missing, duplicate or unknown page structure context.');
    seen.add(key);
    if (!review.screenshotRefs.includes(row.screenshot)) throw Error('Structure evidence must be inspected original screenshots.');
    if (review.verdict === 'pass' && (row.status === 'needs-evidence' || row.status === 'fail' && (afterRefs.has(row.screenshot) || !afterRefs.size))) throw Error('Unresolved page structure check prevents passing QA.');
  }
  // Do not relabel an original defect as pass; require matched after evidence for its dimension.
  if (review.verdict === 'pass') for (const row of checks.filter(r=>r.status==='fail'&&!afterRefs.has(r.screenshot))) {
    const original = captureEntries(manifest.captures?.before).find(e=>captureOriginals({states:[e]}).includes(row.screenshot));
    const matched = captureEntries(manifest.captures?.after).find(e=>e.stateId===original?.stateId&&e.configurationId===original?.configurationId);
    const resolved = matched && captureOriginals({states:[matched]}).every(ref=>checks.some(r=>r.screenshot===ref&&r.dimension===row.dimension&&r.status==='pass'));
    if (!resolved) throw Error('Baseline failure requires passing matched after structure evidence.');
  }
  if (seen.size !== expected.size) throw Error('Every original requires grid, spacing, alignment, components and responsive checks.');
  const annotations = review.annotations || [];
  const ids = new Set();
  for (const a of annotations) {
    const finding = review.findings.find(f => f.id === a.findingId);
    if (ids.has(a.id) || !finding || !refs.includes(a.screenshot) || !finding.screenshotRefs.includes(a.screenshot)) throw Error('Annotation must uniquely link a finding to its original screenshot.');
    ids.add(a.id);
    const b = a.box;
    if (!b || ![b.x,b.y,b.width,b.height].every(Number.isFinite) || b.x < 0 || b.y < 0 || b.width <= 0 || b.height <= 0 || b.x+b.width > 1 || b.y+b.height > 1) throw Error('Annotation box must fit normalized original image coordinates.');
  }
  for (const finding of review.findings) {
    if (!annotations.some(a => a.findingId === finding.id)) throw Error('Every reported problem needs an original-image annotation.');
  }
}

export function pageStructurePrompt(manifest) {
  if (!manifest.plan?.remediation?.ruleIds.includes(PAGE_STRUCTURE_RULE)) return '';
  return '\nPAGE STRUCTURE EVIDENCE: Return structureChecks for each original before/after screenshot and each dimension grid, spacing, alignment, components, responsive. Row: {screenshot,dimension,status:pass|fail|needs-evidence|not-applicable,observed,expected,basis,method}. Explain measurements and adopted target contract; do not invent pixel values or impose a universal grid. Unknown interaction/device evidence is needs-evidence. Include surface tiles and interaction originals. Preserve genuine before defects as fail; only resolved after evidence can support aggregate pass. Also return annotations: [{id,findingId,screenshot,label,box:{x,y,width,height}}] for every finding, using fractions of the uncropped original image and exact finding IDs. Keep originals unchanged, never cite a redrawn image as evidence. Empty annotations are valid only with no findings. This does not certify automatic visual truth.\n';
}
export function aggregateStructureReviews(regions, cross) {
  const checks=new Map(), annotations=[];
  const ranks={pass:0,'not-applicable':1,'needs-evidence':2,fail:3};
  for(const [i,review] of [...regions,...(cross?[cross]:[])].entries()) {
    const prefix=i<regions.length?'B'+(i+1)+'_':'X_';
    for(const row of review.structureChecks||[]) {const key=row.screenshot+'|'+row.dimension,old=checks.get(key);if(!old||ranks[row.status]>ranks[old.status])checks.set(key,row);}
    for(const a of review.annotations||[])annotations.push({...a,id:prefix+a.id,findingId:prefix+a.findingId});
  }
  return {structureChecks:[...checks.values()],annotations};
}
