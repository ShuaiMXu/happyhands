export const brandReviewInstructions=`
## Declared brand intent and rendered evidence
Read designSystem.before/after.brandEvidence in the supplied context. These are capture-time source declarations, NOT approved rules. Match each declaration to the assigned original screenshots, visible copy and recorded states. Distinguish declared intent, actual implementation and unsupported inference. Check terminology, CTA/error language, prohibited/trust claims and visual identity only where originals support them. Different versions/platforms may legitimately differ; preserve alternatives and missing categories rather than choosing the most frequent value. Never infer unseen routes, interactions, motion or product facts. Do not turn an unapproved declaration into a requirement or fail an unrelated scoped fix solely for not following it.
Return brandAssessments: an array with exactly one entry per supplied brandReviewReferences item, using {reference,verdict,observation,screenshotRefs}. verdict is aligned|conflict|not-visible|needs-evidence|out-of-scope. observation must explain the concrete comparison or missing evidence. aligned/conflict require at least one assigned original screenshot reference. Use out-of-scope for declarations not covered by this batch; do not invent evidence to complete the list. Report actionable in-scope conflicts in ordinary findings, and preserve unsupported scope or intent in limitations. A citation and an assessment are reviewer claims, not human approval or proof of professional attention.
When writing review-result.json, load review-context.json programmatically and copy each opaque reference ID directly from brandReviewReferences; do not retype or reconstruct hashes. Select screenshot paths directly from the supplied evidence and phase-specific brandReviewOriginals arrays. Before returning, check exact reference membership and preserve the one-to-one declaration list. These checks validate citations only: they must not fabricate observations or upgrade any verdict.
For EACH brand assessment, screenshotRefs may ONLY use paths in brandReviewOriginals for that reference's phase (before or after). Verification/specialist images and annotations are NOT phase-bound brand originals, even when they appear in the overall screenshotRefs; cite them only in the overall specialist/interaction review. Do not mix before and after paths in one declaration assessment. If the eligible originals cannot support a comparison, keep the declaration and use not-visible, needs-evidence or out-of-scope with an explanation and no invented references.
`;

// One shared allowlist per phase avoids duplicating thousands of original paths
// for every declaration in a complete external handoff.
export function brandReviewOriginals(originals){
  return Object.fromEntries(['before','after'].map(phase=>[phase,[...new Set(originals.filter(path=>typeof path==='string'&&path.startsWith(phase+'/')))]]));
}

export function brandReviewReferences(context){
  return ['before','after'].flatMap(phase=>(context?.[phase]?.brandEvidence?.declarations||[]).map(entry=>({reference:`${phase}:${entry.fileHash}:${entry.line}:${entry.category}`,phase,...entry})));
}

export function assertBrandAssessments(review,context){
  const expected=brandReviewReferences(context),rows=review.brandAssessments;
  if(!expected.length&&!rows)return;
  if(!Array.isArray(rows)||rows.length!==expected.length)throw Error('Review must assess every capture-bound brand declaration.');
  const seen=new Set(),available=new Set(review.screenshotRefs||[]);
  for(const row of rows){
    const entry=expected.find(item=>item.reference===row?.reference);
    if(!row||Object.keys(row).some(key=>!['reference','verdict','observation','screenshotRefs'].includes(key))||seen.has(row.reference)||!expected.some(item=>item.reference===row.reference)
      ||!['aligned','conflict','not-visible','needs-evidence','out-of-scope'].includes(row.verdict)||typeof row.observation!=='string'||!row.observation.trim()||row.observation.length>2500
      ||!Array.isArray(row.screenshotRefs)||new Set(row.screenshotRefs).size!==row.screenshotRefs.length||row.screenshotRefs.some(path=>!available.has(path)||!path.startsWith(entry.phase+'/'))
      ||['aligned','conflict'].includes(row.verdict)&&!row.screenshotRefs.length)throw Error('Invalid brand declaration assessment or original reference.');
    seen.add(row.reference);
  }
}

export function aggregateBrandAssessments(reviews,context){
  const expected=brandReviewReferences(context);if(!expected.length)return undefined;
  for(const review of reviews)assertBrandAssessments(review,context);
  return expected.map(entry=>{
    const rows=reviews.map(review=>review.brandAssessments.find(item=>item.reference===entry.reference));
    const applicable=rows.filter(item=>item.verdict!=='out-of-scope');
    const verdict=applicable.some(item=>item.verdict==='conflict')?'conflict':applicable.some(item=>item.verdict==='needs-evidence')?'needs-evidence':applicable.some(item=>item.verdict==='not-visible')?'not-visible':applicable.length?'aligned':'out-of-scope';
    const observation=rows.map((row,index)=>`Session ${index+1} [${row.verdict}]: ${row.observation}`).join('\n');
    if(observation.length>2500)throw Error('Brand assessment aggregation exceeds its evidence budget; use a complete external review.');
    return {reference:entry.reference,verdict,observation,screenshotRefs:[...new Set(rows.flatMap(row=>row.screenshotRefs))]};
  });
}
