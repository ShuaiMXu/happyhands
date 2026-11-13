// Browser-safe policy and independent-review contract. No filesystem or model dependencies.
export const EXPERIENCE_POLICY='task-design-review@1';
export const REVIEW_DIMENSIONS=['task','hierarchy','interaction','design-system','regression'];
export function experienceRequired(run){return run.manifest.experiencePolicy===EXPERIENCE_POLICY;}
export function assertExperienceAssessments(rows,verdict,available){
 if(!Array.isArray(rows)||rows.length!==REVIEW_DIMENSIONS.length||new Set(rows.map(row=>row.dimension)).size!==rows.length)throw Error('Independent review requires all five experience dimensions.');
 for(const row of rows){
  if(!REVIEW_DIMENSIONS.includes(row.dimension)||!['pass','fail','needs-evidence','not-applicable'].includes(row.verdict)||typeof row.reason!=='string'||!row.reason.trim()||!Array.isArray(row.screenshotRefs)||row.screenshotRefs.some(ref=>!available.has(ref))||(['pass','fail'].includes(row.verdict)&&!row.screenshotRefs.length))throw Error('Invalid experience assessment or original citation.');
  if(['task','hierarchy'].includes(row.dimension)&&row.verdict==='not-applicable')throw Error('Task and hierarchy cannot be skipped.');
 }
 if(verdict==='pass'&&rows.some(row=>['fail','needs-evidence'].includes(row.verdict)))throw Error('Functional compliance cannot override an unresolved experience assessment.');
}
