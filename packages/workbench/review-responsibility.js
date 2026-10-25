const verdicts=new Set(['pass','fail','needs-evidence']);

export function reviewResponsibility(purpose,originals){
  const regional=purpose==='regional-batch';
  return {schemaVersion:'0.1',kind:regional?'regional-batch':purpose==='cross-region'?'cross-region':'scoped-task',
    decisionField:regional?'regionalVerdict':'verdict',assignedOriginals:[...originals],
    taskCompletion:regional?'Reserved for the independent final session; the confirmed change remains context.':'Verify the confirmed task within the supplied evidence and preserve missing proof.'};
}

export function responsibilityInstructions(responsibility){
  if(responsibility.kind==='regional-batch')return '\nFINAL RESPONSE CONTRACT: Return regionalVerdict, not verdict. This is ONLY the local visual judgment of your assigned originals and states. Keep the full confirmed task in context to distinguish intended changes from regressions, but its completion is reserved for the independent final session. Main-task proof assigned elsewhere is not a local evidence gap. Actual missing/unreadable assigned originals, unresolved local regressions and unsupported local states still require fail or needs-evidence as appropriate. Preserve declaration-level uncertainty in brandAssessments and limitations; do not certify unseen declarations or turn an unapproved declaration alone into a regression. A local pass never accepts the complete task.\n';
  return '\nFINAL RESPONSE CONTRACT: Return verdict, not regionalVerdict. This session must verify the confirmed task using its supplied originals and recorded evidence. Missing or inconclusive task proof remains needs-evidence. Passing cannot override a regional failure or needs-evidence, and never means human acceptance.\n';
}

// Select an explicitly named decision, never reinterpret or upgrade its value.
export function readResponsibilityVerdict(result,responsibility){
  const field=responsibility.decisionField,other=field==='verdict'?'regionalVerdict':'verdict';
  if(!result||Object.hasOwn(result,other)||!verdicts.has(result[field]))throw Error(`Review responsibility requires exactly ${field}; ambiguous or missing decisions are rejected.`);
  return result[field];
}
