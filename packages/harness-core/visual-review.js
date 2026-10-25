import { wholePageReviewCoverage, missingAfterStates } from './whole-page.js';
import Ajv from 'ajv/dist/2020.js';
import schema from '../../visual-review.schema.json' with { type: 'json' };
import { captureEntries, captureKey, captureOriginals } from './capture-state.js';

const validate = new Ajv({ allErrors: true }).compile(schema);

function availableScreenshots(manifest) {
  const refs = new Set();
  for (const capture of Object.values(manifest.captures || {})) {
    for (const ref of captureOriginals(capture)) refs.add(ref);
  }
  for(const record of manifest.verificationRecords||[])for(const image of record.images)refs.add(image.path);
  return refs;
}

export function assertVisualReview(review, manifest) {
  if (!validate(review)) throw new Error(validate.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; '));
  const available = availableScreenshots(manifest);
  if(review.verificationDigest && review.verificationDigest!==manifest.verificationEvidence?.digest)throw Error('Review verification evidence changed.');
  const records=manifest.verificationRecords||[];
  if(records.length){
    if(review.verificationDigest!==manifest.verificationEvidence?.digest || records.some(record=>!review.verificationRefs?.includes(record.id)))throw Error('Review must acknowledge every assigned verification record.');
    if((review.verificationRefs||[]).some(id=>!records.some(record=>record.id===id)))throw Error('Unknown verification reference.');
    if(records.some(record=>record.images.some(image=>!review.screenshotRefs.includes(image.path))))throw Error('Review must inspect every assigned verification original.');
    if(review.verdict==='pass'&&records.some(record=>record.stage!=='auxiliary'&&record.status!=='pass'))throw Error('Passing QA requires successful normal specialist verification.');
  }

  const refs = new Set([...review.screenshotRefs, ...review.findings.flatMap(item => item.screenshotRefs)]);
  for (const ref of refs) if (!available.has(ref)) throw new Error(`Visual review references a screenshot absent from this run: ${ref}.`);
  for (const id of review.attachmentRefs || []) {
    const attachment = (manifest.reviewAttachments || []).find(item => item.id === id);
    if (!attachment) throw new Error(`Unknown visual review attachment: ${id}`);
    if (!refs.has(attachment.screenshot)) throw new Error('Attachment source must be cited in screenshotRefs.');
  }
  // A run that recorded an absent baseline has no `before/` screenshots to cite. It still has to
  // be looked at, so the pairing requirement relaxes to full coverage of what was rendered.
  const firstRender = !manifest.captures.before && manifest.baseline?.status === 'absent';
  if (review.skillId === 'visual-hierarchy-reviewer' && !firstRender && [...refs].some(ref => ref.startsWith('after/'))) {
    throw new Error('Visual hierarchy review accepts baseline screenshots only.');
  }
  if (review.skillId === 'visual-qa-evaluator') {
    if (!manifest.captures.after) throw new Error('Visual QA requires a rendered capture.');
    if (!manifest.captures.before && !firstRender) throw new Error('Visual QA requires before and after captures.');
    if(review.verdict==='pass'&&missingAfterStates(manifest).length)throw Error('Passing Visual QA requires every planned after state to be captured.');
    for(const phase of ['before','after'])for(const entry of captureEntries(manifest.captures[phase]))for(const surface of entry.pageSurfaces?.surfaces||[])for(const tile of surface.tiles)if(!refs.has(tile.screenshot))throw Error('Visual QA must inspect every page surface original.');
    for(const phase of ['before','after'])for(const entry of captureEntries(manifest.captures[phase]))for(const part of entry.interactionParts||[])if(!refs.has(part.screenshot))throw Error('Visual QA must inspect every interaction original.');
    const baselineEntries = captureEntries(manifest.captures.before);
    const afterEntries = captureEntries(manifest.captures.after);
    for (const entry of captureEntries(firstRender ? manifest.captures.after : manifest.captures.before).filter(item => item.screenshot)) {
      const key = captureKey(entry.stateId, entry.configurationId);
      if (firstRender) {
        if (!refs.has(entry.screenshot)) throw new Error(`Visual QA of a first render must cite state ${entry.stateId} in ${entry.configurationId}; one capture cannot stand in for the others.`);
      } else if (!refs.has(entry.screenshot) || !refs.has(`after/${key}.png`) && !captureEntries(manifest.captures.after).some(item => item.stateId === entry.stateId && item.configurationId === entry.configurationId && refs.has(item.screenshot))) {
        if (entry.legacy) throw new Error(`Visual QA must cite matched before/after ${entry.configurationId} screenshots.`);
        throw new Error(`Visual QA must cite matched before/after state ${entry.stateId} in ${entry.configurationId}.`);
      }
    }
    if (!firstRender) {
      const baselineScreenshots = new Set(baselineEntries.filter(item => item.screenshot).map(item => captureKey(item.stateId, item.configurationId)));
      for (const entry of afterEntries.filter(item => item.screenshot && !baselineScreenshots.has(captureKey(item.stateId, item.configurationId)))) {
        if (!refs.has(entry.screenshot)) throw new Error(`Visual QA must cite newly reachable state ${entry.stateId} in ${entry.configurationId}.`);
      }
    }
  }
  if (review.coverage) {
    if(review.skillId!=='visual-qa-evaluator')throw Error('Whole-page coverage belongs to Visual QA only.');
    const coverage=review.coverage, actual=wholePageReviewCoverage(manifest,review.coverage.kind==='external-page-surfaces'?128:24);
    const same=(left,right)=>JSON.stringify([...left].sort())===JSON.stringify([...right].sort());
    if(coverage.expectedContexts!==actual.expectedContexts||coverage.coveredContexts!==actual.coveredContexts||coverage.exceeded!==actual.exceeded||
      !same(coverage.missingContexts,actual.missingContexts)||!same(coverage.missingStates,actual.missingStates)||
      !same(coverage.wholePageScreenshotRefs,actual.selected.map(item=>item.entry.screenshot)))throw Error('Whole-page coverage does not match this capture plan.');
    if(coverage.crossRegionVerdict!=='not-run'&&!actual.ready)throw Error('Cross-region review requires complete original whole-page evidence.');
    if(coverage.wholePageScreenshotRefs.some(ref=>!refs.has(ref)))throw Error('Whole-page evidence must be cited by the aggregate review.');
    if(review.verdict==='pass'&&(coverage.crossRegionVerdict!=='pass'||coverage.regionalVerdicts.some(value=>value!=='pass')))throw Error('Passing aggregate QA requires every regional and cross-region review to pass.');
  }
  if (review.verdict === 'pass' && review.findings.length) throw new Error('A passing visual review cannot contain unresolved findings.');
  if (review.verdict === 'fail' && !review.findings.length) throw new Error('A failing visual review requires at least one finding.');
  return review;
}
