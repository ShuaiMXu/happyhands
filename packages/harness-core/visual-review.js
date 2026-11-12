import {assertMethodChecks,HERO_MOTION_RULE,HERO_VERIFICATION_ID,isHomepageHero} from './remediation-validation.js';
import { wholePageReviewCoverage, missingAfterStates, captureRouteKey } from './whole-page.js';
import Ajv from 'ajv/dist/2020.js';
import schema from '../../visual-review.schema.json' with { type: 'json' };
import { captureEntries, captureOriginals, captureKey } from './capture-state.js';

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
  if(review.skillId==='visual-qa-evaluator'&&manifest.plan?.remediation){
    if(review.remediationHash!==manifest.plan.remediation.hash)throw Error('Review remediation contract changed.');
    // Production callers populate these records only after checking the bound
    // verification bundle and every original hash. They supplement each state's
    // required after original; arbitrary paths and replacement anchors still fail.
    assertMethodChecks(review.methodChecks,manifest.plan.remediation.ruleIds,manifest,review.verdict,{supplementalRefs:(manifest.verificationRecords||[]).flatMap(record=>record.images.map(image=>image.path))});
  }
  if(review.verificationDigest && review.verificationDigest!==manifest.verificationEvidence?.digest)throw Error('Review verification evidence changed.');
  const records=manifest.verificationRecords||[];
  if(review.skillId==='visual-qa-evaluator'&&review.verdict==='pass'&&manifest.plan?.remediation?.ruleIds.includes(HERO_MOTION_RULE)){
    const check=records.find(record=>record.id===HERO_VERIFICATION_ID&&record.stage==='normal-interaction'&&record.status==='pass'&&record.images.length>=2);
    const heroAfter=captureEntries(manifest.captures.after).filter(entry=>entry.screenshot&&isHomepageHero(entry));
    const expected=captureEntries(manifest.captures.before).filter(isHomepageHero);
    // Baseline targets keep their original route/viewport expectation. New or
    // newly reachable after targets also require their own motion evidence.
    const required=[...new Map([...heroAfter,...expected].map(entry=>[captureKey(entry.stateId,entry.configurationId),entry])).values()];
    if(!required.length)throw Error('Passing Homepage Hero QA requires captured homepage evidence.');
    const verifiedHero=required.map(before=>{
      const after=heroAfter.find(entry=>entry.stateId===before.stateId&&entry.configurationId===before.configurationId);
      if(!after||captureRouteKey(after)!==captureRouteKey(before)||after.width!==before.width||after.height!==before.height)throw Error('Passing Homepage Hero QA requires the captured homepage route and viewport in every expected state and configuration.');
      return after;
    });
    if(!check||verifiedHero.some(entry=>!check.stateIds.includes(entry.stateId))) {
      throw Error('Passing Homepage Hero QA requires passing source-bound hero-motion browser evidence for the captured homepage.');
    }
    const assignedFrames=new Set(),assignedHashes=new Set();
    for(const entry of verifiedHero){
      const motion=check.result?.heroMotion;
      const contexts=motion?.version===1&&Array.isArray(motion.contexts)?motion.contexts.filter(context=>context.stateId===entry.stateId&&context.configurationId===entry.configurationId):[];
      const context=contexts[0],indexes=context?.frameIndexes;
      if(contexts.length!==1||context.motionObserved!==true||!Array.isArray(indexes)||indexes.length<2||new Set(indexes).size!==indexes.length||indexes.some(index=>!Number.isInteger(index)||index<0||index>=check.images.length))throw Error('Passing Homepage Hero QA requires one motion-observed context with distinct frame indexes for every expected state and configuration.');
      if(indexes.some(index=>assignedFrames.has(index)))throw Error('Homepage Hero configurations require their own original frame sequences.');
      indexes.forEach(index=>assignedFrames.add(index));
      const frames=indexes.map(index=>check.images[index]);
      if(!Number.isInteger(entry.width)||!Number.isInteger(entry.height)||frames.some(image=>image.width!==entry.width||image.height!==entry.height||!/^[a-f0-9]{64}$/.test(image.sha256))||new Set(frames.map(image=>image.sha256)).size<2)throw Error('Passing Homepage Hero QA requires at least two distinct original frames matching each captured configuration viewport.');
      if(frames.some(image=>assignedHashes.has(image.sha256)))throw Error('Homepage Hero configurations require their own original frame sequences.');
      frames.forEach(image=>assignedHashes.add(image.sha256));
      const stateKey=captureKey(entry.stateId,entry.configurationId)+':'+entry.screenshot;
      if(![HERO_MOTION_RULE,'HH-HERO-MARK'].every(ruleId=>review.methodChecks.some(row=>row.ruleId===ruleId&&row.stateKey===stateKey&&row.status==='pass'))) {
        throw Error('The verified homepage Hero states require explicit passes for motion and the single glass mark.');
      }
    }
  }
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
    const stateKey = entry => JSON.stringify([entry.stateId, entry.configurationId]);
    const afterByState = new Map(afterEntries.map(entry => [stateKey(entry), entry]));
    for (const entry of (firstRender ? afterEntries : baselineEntries).filter(item => item.screenshot)) {
      const after = afterByState.get(stateKey(entry));
      if (firstRender) {
        if (!refs.has(entry.screenshot)) throw new Error(`Visual QA of a first render must cite state ${entry.stateId} in ${entry.configurationId}; one capture cannot stand in for the others.`);
      } else if (!refs.has(entry.screenshot) || (after?.screenshot && !refs.has(after.screenshot))) {
        if (entry.legacy) throw new Error(`Visual QA must cite matched before/after ${entry.configurationId} screenshots.`);
        throw new Error(`Visual QA must cite matched before/after state ${entry.stateId} in ${entry.configurationId}.`);
      }
    }
    if (!firstRender) {
      const baselineScreenshots = new Set(baselineEntries.filter(item => item.screenshot).map(stateKey));
      for (const entry of afterEntries.filter(item => item.screenshot && !baselineScreenshots.has(stateKey(item)))) {
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
