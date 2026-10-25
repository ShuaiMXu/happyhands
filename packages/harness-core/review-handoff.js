// Complete, source-bound handoff for an independently run reviewer. No review
// execution, truncation, inferred visual pass or human judgment happens here.
import {loadRun,saveVisualReview} from './store.js';
import {readVerificationEvidence,readVerificationFile,verificationHash,verificationBinding} from './verification.js';
import {wholePageReviewCoverage} from './whole-page.js';
import {designSystemContext} from '../skill-core/design-system.js';
import {brandReviewReferences,brandReviewOriginals,brandReviewInstructions,assertBrandAssessments} from '../skill-core/brand-review.js';

export async function prepareReviewHandoff(directory) {
  const run=await loadRun(directory);
  if(!run.manifest.captures.after||!run.manifest.evaluation)throw Error('Capture and evaluate before preparing independent review.');
  const verification=await readVerificationEvidence(directory,run.manifest);
  const binding=await verificationBinding(directory,run.manifest);
  const references=[...Object.keys(binding.originalHashes),...verification.records.flatMap(record=>record.images.map(image=>image.path))];
  const originals=[];
  for(const path of references)originals.push({path,sha256:verificationHash(await readVerificationFile(directory,path,24*1024*1024))});
  // External handoff explicitly inspects ALL originals; it is not the 24-image AI session.
  const whole=wholePageReviewCoverage(run.manifest,128);
  const payload={version:1,runId:run.manifest.id,spec:run.spec,binding,captures:run.manifest.captures,evaluation:run.manifest.evaluation,confirmation:run.manifest.confirmation,verification,coverage:{...whole,selected:whole.selected.map(({phase,entry})=>({phase,screenshot:entry.screenshot}))},originals};
  payload.designSystem=await designSystemContext(run);
  payload.brandReviewReferences=brandReviewReferences(payload.designSystem);
  payload.brandReviewOriginals=brandReviewOriginals(Object.keys(binding.originalHashes));
  payload.brandReviewInstructions=brandReviewInstructions;
  return {...payload,digest:verificationHash(payload)};
}

export async function completeReviewHandoff(directory,handoff,result) {
  const current=await prepareReviewHandoff(directory);
  if(current.digest!==handoff.digest)throw Error('Independent review inputs changed; prepare and review again.');
  assertBrandAssessments(result,current.designSystem);
  const expected=current.originals.map(item=>item.path);
  if(!Array.isArray(result.screenshotRefs)||expected.some(path=>!result.screenshotRefs.includes(path))||result.screenshotRefs.some(path=>!expected.includes(path)))throw Error('Independent review must inspect every supplied original, without foreign references.');
  // Never silently add an acknowledgement for a record the reviewer omitted.
  const records=current.verification.records;
  if(records.some(record=>!result.verificationRefs?.includes(record.id)))throw Error('Independent review must acknowledge every specialist record.');
  const actual=current.coverage;
  const cross=actual.ready?(result.crossRegionVerdict||'not-run'):'not-run';
  const blocked=!actual.ready||cross!=='pass';
  const review={schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:result.reviewer,reviewedAt:result.reviewedAt,verdict:result.verdict==='pass'&&blocked?'needs-evidence':result.verdict,screenshotRefs:result.screenshotRefs,findings:result.findings,rationale:result.rationale,limitations:[...(result.limitations||[]),...(blocked?['Harness coverage gate: independent scoped conclusions do not complete missing original overviews, after states or cross-region review. Human judgment remains pending.']:[])],...(current.verification.digest?{verificationDigest:current.verification.digest,verificationRefs:result.verificationRefs}:{}),coverage:{kind:'external-page-surfaces',regionalVerdicts:[result.verdict],crossRegionVerdict:cross,expectedContexts:actual.expectedContexts,coveredContexts:actual.coveredContexts,missingContexts:actual.missingContexts,missingStates:actual.missingStates,exceeded:actual.exceeded,wholePageScreenshotRefs:actual.selected.map(item=>item.screenshot)}};
  if(result.brandAssessments)review.brandAssessments=result.brandAssessments;
  // Capture/source/index identity was checked above; save rechecks originals
  // and current specialist binding under the existing run lock.
  await saveVisualReview(directory,review,{screenshotHashes:Object.fromEntries(current.originals.map(item=>[item.path,item.sha256]))});
  return review;
}
