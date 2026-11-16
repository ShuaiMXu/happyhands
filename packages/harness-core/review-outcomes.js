// Display-only projection of a validated review, never an acceptance gate.
export function reviewOutcomes(review,judgment=null,goal=null){
 return {
  goal:goal?.kind??'legacy-unassessed',
  reviewVerdict:review?.verdict??'not-run',
  repairOutcome:'See finding-specific verification; a visual pass alone does not establish a repair.',
  designImprovement:review?.designComparison?.verdict??'not-assessed',
  designReason:review?.designComparison?.reason??'No explicit comparative design judgment was recorded.',
  regression:review?.experienceAssessments?.find(row=>row.dimension==='regression')?.verdict??'not-assessed',
  humanAcceptance:judgment?'recorded-separately':'pending'
 };
}
