import {captureEntries,captureKey} from './capture-state.js';
import {memoryForRegressionChecks} from './project-memory.js';
import {sameTechnicalPolicy} from './memory-scope.js';
import {readVerificationEvidence,verificationHash} from './verification.js';
import {readVisualReviewBinding} from './visual-review-binding.js';
import {visualReviewFor} from './workflow.js';

const covers = (expected,actual) => expected.every(value=>actual.includes(value));
const outcome = (result,evidence) => ({status:result==='pass'?'executed':result==='fail'?'failed':'needs-evidence',result,evidence});
const missing = (status,reason) => ({status,reason});

async function checkResult(run,entry,states) {
  const {manifest}=run,check=entry.scope.check;
  if(check.type==='technical'){
    if(!sameTechnicalPolicy(manifest,check))return missing('skipped','The run has a different technical criterion.');
    const before=manifest.technicalEvidence?.before,after=manifest.technicalEvidence?.after;
    if(!after)return missing('selected','The candidate technical check has not run.');
    const inScope=row=>!states.length||states.includes(row.stateId);
    const checks=after.checks.filter(inScope);
    if(!checks.length||!covers(states,checks.map(row=>row.stateId)))return missing('needs-evidence','The recorded check did not replay every matched state.');
    if(!before?.checks.some(row=>inScope(row)&&row.status==='fail'))return missing('needs-evidence','The baseline did not reproduce the technical failure in the matched scope.');
    if(after.status==='needs-evidence')return missing('needs-evidence','The candidate technical verification lacks comparable evidence.');
    const result=checks.some(row=>row.status==='fail')?'fail':'pass';
    return outcome(result,{kind:'technical',source:after.source.commit,states:checks.map(row=>row.key??row.file)});
  }
  if(check.type==='specialist'){
    const configured=manifest.onboarding?.config?.verificationChecks?.find(row=>row.id===check.id);
    if(!configured||verificationHash(configured)!==check.sha256)return missing('skipped','The recorded specialist check version is not configured.');
    if(!manifest.verificationEvidence)return missing('selected','The configured specialist check has not been recorded.');
    const {records}=await readVerificationEvidence(run.directory,manifest);
    const result=records.find(row=>row.id===check.id&&row.checkHash===check.sha256);
    if(!result||!covers(states,result.stateIds))return missing('needs-evidence','The bound check does not cover every matched state.');
    return outcome(result.status,{kind:'specialist',record:result.id,path:result.path,sha256:result.sha256,states:result.stateIds});
  }
  if(!manifest.plan?.remediation?.ruleIds.includes(check.ruleId))return missing('skipped','The exact visual rule was not adopted in the current remediation plan.');
  const reference=visualReviewFor(manifest,'visual-qa-evaluator');
  if(!reference)return missing('not-reviewed','No current independent visual review.');
  const {review}=await readVisualReviewBinding(run,reference,{requireBound:true});
  const expected=captureEntries(manifest.captures.after).filter(row=>row.screenshot&&(!states.length||states.includes(row.stateId)));
  const keys=expected.map(row=>captureKey(row.stateId,row.configurationId)+':'+row.screenshot);
  const results=review.methodChecks.filter(row=>row.ruleId===check.ruleId&&keys.includes(row.stateKey));
  if(!keys.length||results.length!==keys.length||!covers(states,expected.map(row=>row.stateId)))return missing('needs-evidence','The independent review did not cite the rule in every matched after state.');
  const result=results.some(row=>row.status==='fail')?'fail':results.every(row=>row.status==='pass')?'pass':'needs-evidence';
  return outcome(result,{kind:'visual',path:reference.path,states:keys});
}

export async function memoryChecks(run) {
  const context=await memoryForRegressionChecks(run);
  const entries=new Map((context?.entries||[]).map(entry=>[entry.id,entry]));
  const excluded=new Set((context?.excludedEntries||[]).map(entry=>entry.id));
  return Promise.all((context?.recall||[]).map(async row=>{
    const entry=entries.get(row.id);
    if(!entry)return {...row,status:'skipped',reason:excluded.has(row.id)?'run-exception':row.reason};
    let result;
    try{result=await checkResult(run,entry,row.matchedStates);}
    catch{result=missing('needs-evidence','The recorded check evidence is unavailable or changed.');}
    return {...row,failureClass:entry.scope.failureClass,check:entry.scope.check,...result};
  }));
}
