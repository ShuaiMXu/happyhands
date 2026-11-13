import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {publicExecutionBrief} from '../packages/harness-core/export.js';
import {createRun,loadRun,saveCapture,saveDiagnosis,confirmFinding,savePlan,verifiedExecutionBrief,saveEvaluation} from '../packages/harness-core/store.js';
import {diagnoseRun} from '../packages/harness-core/diagnosis.js';
import {diagnoseBaseline} from '../packages/workbench/baseline-diagnosis.js';
import {runAiVisualReview} from '../packages/workbench/ai-review.js';
import {selectResource} from '../packages/harness-core/reference-resources.js';
import {workflowState} from '../packages/harness-core/workflow.js';
import {EXPERIENCE_POLICY,AUDIT_DIMENSIONS,REVIEW_DIMENSIONS,experienceContext,saveExperienceRecord,experienceFor,assertExperienceAssessments} from '../packages/harness-core/experience-orchestration.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
const original='before/desktop.png';
// Synthetic protocol fixtures. These images do not establish real visual quality.
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'hh-experience-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const spec=structuredClone(sample);spec.project={...spec.project,name:'Renewal protocol fixture',goal:'Help domain owners identify an upcoming renewal and decide what to do',audience:'Domain owners',task:'Find upcoming renewal, understand cost and choose next action'};
 const {directory}=await createRun({spec,url:'http://localhost',outputRoot:root,experiencePolicy:EXPERIENCE_POLICY});
 await mkdir(join(directory,'before'));await writeFile(join(directory,original),png);
 await saveCapture(directory,'before',{viewports:{desktop:{screenshot:original}}});
 const file=join(root,'reference.md');await writeFile(file,'# Comparable terms\nAlign term, price and action when comparison is the actual task.');
 await selectResource({directory,file});
 const context=await experienceContext(directory,'public-page'),ref=context.designSources[0];
 const path=context.designGuidance.reference+'/web-taste/upstream/SKILL.md',quote=(await readFile(join(directory,path),'utf8')).split('\n').find(line=>line.trim().length>10);
 const methods=[{path,quote,application:'Use hierarchy to answer the immediate decision before secondary proof; preserve real pricing terms.'}];
 const audit={version:EXPERIENCE_POLICY,surface:'public-page',task:{originalRequest:'Help visitors find a renewal, understand its cost and decide what to do.',user:'Domain owner',scenario:'A renewal is due soon',outcome:'Identify the renewal and a justified next action',constraints:['Preserve calendar and truthful sample scope'],operatorProposals:['Five labelled fields are only a candidate, not a user requirement'],assumptions:[],scope:'First-screen decision and its next action',outOfScope:'Uncaptured account and payment screens'},journey:[{step:'Understand the next renewal',userQuestion:'Which domain needs a decision and at what cost?',action:'Review renewal',observation:'Synthetic protocol context; no real visual judgment',screenshotRefs:[original],unknowns:['Real payment is not tested']}],issues:[{id:'READING-DISTANCE',kind:'hypothesis',problem:'Repeated labels may separate the price from the term and action',impact:'A visitor may need more scanning',rootCause:'Operator prescribed fields before deciding hierarchy',priority:'high',screenshotRefs:[original]}],checks:AUDIT_DIMENSIONS.map(dimension=>({dimension,status:'needs-evidence',observation:'Synthetic protocol coverage, not a real audit',screenshotRefs:[],reason:'Inspect real page and runtime before making a claim'})),designBasis:{sources:[{source:ref.id,sha256:ref.sha256,authority:'reference',section:'# Comparable terms',problem:'Compare price for an equal term',adopt:'Keep comparable cost and term adjacent',preserve:'Original calendar and controls',avoid:'Unrelated visual style or card quota'}],missingSourcesReason:'No project design-system document was supplied; external reference is not approval.'},methods};
 const decision={version:EXPERIENCE_POLICY,findingId:'F1',problemIds:['READING-DISTANCE'],readingOrder:['Urgency and domain','Comparable cost and term','Next action'],grouping:'Group cost with term instead of five equally weighted labels',primaryAction:'Review renewal',content:{show:['Domain, due date and cost for its actual term'],merge:['Price and term in the same reading unit'],defer:['Secondary explanation until details'],reason:'Reduce scanning while preserving decision facts'},layout:'Reuse existing calendar alignment; do not add a new card grid',components:[{source:'Inspect target existing implementation before editing',consumers:['Renewal summary','Comparison detail'],states:['Default','Selected','Keyboard focus'],decision:'Reuse existing control APIs after actual inspection; discovery remains incomplete'}],alternatives:[{kind:'preserve',description:'Keep the existing summary',benefit:'No added reading burden',cost:'Urgency may remain hard to identify'},{kind:'lighter',description:'Reorder existing text and group price with term',benefit:'Answers the immediate decision without more labels',cost:'Moves secondary explanation to details'}],chosen:'A comparison table only inside the details where users compare multiple options',whyBetterForTask:'Rows align equal terms and costs; the first screen keeps one clear decision',tradeoffs:'Details take one action; the calendar remains available',referenceApplications:[{source:ref.id,application:'Use aligned comparable terms in details, preserve summary hierarchy',verification:'Inspect task reading order and equal-term costs in real matched originals'}],verification:[{criterion:'The upcoming domain and equal-term cost are clear before action',method:'Independent inspection and real task replay',expectedEvidence:'Matched originals and actual action records, not field counts'}],methods};
 return {root,directory,audit,decision};
}
test('strict start cannot diagnose or plan without an audit; source adaptation and method provenance cannot be forged',async t=>{
 const f=await fixture(t),run=await loadRun(f.directory);
 assert.equal(workflowState(run.manifest).stage,'needs-experience-audit');
 await assert.rejects(saveDiagnosis(f.directory,diagnoseRun({run})),/experience audit/);
 await assert.rejects(savePlan(f.directory,'F1'),/experience audit/);
 for(const mutate of [a=>a.designBasis.sources[0].sha256='0'.repeat(64),a=>a.designBasis.sources[0].authority='project-rule',a=>a.designBasis.sources[0].section='Nonexistent section',a=>a.methods[0].path='design-guidance/forged.md',a=>a.methods[0].quote='Invented quote',a=>a.checks.pop()]){
  const bad=structuredClone(f.audit);mutate(bad);await assert.rejects(saveExperienceRecord(f.directory,'audit',bad));
 }
 await saveExperienceRecord(f.directory,'audit',f.audit);
 assert.equal((await experienceFor(await loadRun(f.directory))).audit.issues[0].kind,'hypothesis');
 await assert.rejects(selectResource({directory:f.directory,file:join(f.root,'reference.md')}),/frozen/);
 await assert.rejects(saveExperienceRecord(f.directory,'audit',f.audit),/immutable/);
});
test('the actual model context separates operator form from task, and the bound decision reaches execution and independent review',async t=>{
 const f=await fixture(t);await saveExperienceRecord(f.directory,'audit',f.audit);
 let run=await loadRun(f.directory);
 const diagnosis=await diagnoseBaseline(f.directory,diagnoseRun({run}),{cwd:join(f.root,'diagnose'),generate:async(_command,_args,{cwd,input})=>{
  const context=JSON.parse(await readFile(join(cwd,'context.json')));
  assert.equal(context.experience.audit.task.operatorProposals.length,1);
  assert.match(input,/Missing implementation of an operator proposal is not a defect/);
  await writeFile(join(cwd,'result.json'),JSON.stringify({status:'complete',summary:'Protocol fixture, not a visual pass',screenshotRefs:[original],limitations:['Synthetic image'],findings:[]}));
 }});
 await saveDiagnosis(f.directory,diagnosis);await confirmFinding(f.directory,'F1','supported','Fixture scope; not human acceptance');
 await assert.rejects(savePlan(f.directory,'F1'),/experience decision/);
 const bad=structuredClone(f.decision);bad.alternatives=bad.alternatives.map(row=>({...row,kind:'other'}));await assert.rejects(saveExperienceRecord(f.directory,'decision',bad),/lighter alternative/);
 await saveExperienceRecord(f.directory,'decision',f.decision);await savePlan(f.directory,'F1');
 run=await loadRun(f.directory);const brief=await verifiedExecutionBrief(run);
 assert.ok(!publicExecutionBrief(brief).includes(f.audit.task.originalRequest));
 assert.match(brief,/comparison table only inside the details/);assert.match(brief,/operator reasoning to challenge/);
 await mkdir(join(f.directory,'after'));await writeFile(join(f.directory,'after/desktop.png'),png);
 await saveCapture(f.directory,'after',{viewports:{desktop:{screenshot:'after/desktop.png'}}});await saveEvaluation(f.directory,{status:'fixture-functional-pass'});
 await runAiVisualReview(f.directory,{cwd:join(f.root,'review'),signal:new AbortController().signal,generate:async(_command,_args,{cwd,input})=>{
  const context=JSON.parse(await readFile(join(cwd,'review-context.json')));
  assert.equal(context.experience.audit.task.originalRequest,f.audit.task.originalRequest);
  assert.equal(context.experience.decision.chosen,f.decision.chosen);
  assert.match(input,/Challenge a compliant solution that worsens hierarchy/);
  await writeFile(join(cwd,'review-result.json'),JSON.stringify({[context.reviewResponsibility.decisionField]:'needs-evidence',screenshotRefs:[original,'after/desktop.png'],findings:[],rationale:'Synthetic pixels cannot establish task or design quality',limitations:['No actual webpage was reviewed'],experienceAssessments:REVIEW_DIMENSIONS.map(dimension=>({dimension,verdict:'needs-evidence',reason:'Real rendered task evidence missing',screenshotRefs:[]}))}));
 }});
 assert.equal((await loadRun(f.directory)).manifest.judgment,null);
 await writeFile(join(f.directory,original),Buffer.concat([png,Buffer.from('changed')]));
 await assert.rejects(experienceFor(await loadRun(f.directory),'decision'),/evidence or task changed/);
});
test('reported hierarchy regression blocks a pass despite functional success; valid comparison tables are not forbidden',()=>{
 const refs=new Set([original]);const rows=REVIEW_DIMENSIONS.map(dimension=>({dimension,verdict:'pass',reason:'Synthetic protocol only',screenshotRefs:[original]}));
 assert.doesNotThrow(()=>assertExperienceAssessments(rows,'pass',refs));
 rows[1]={...rows[1],verdict:'fail',reason:'Reported regression: label-value distance and equally weighted fields obscure the next decision; functional tests passing does not refute it.'};
 assert.throws(()=>assertExperienceAssessments(rows,'pass',refs),/cannot override/);
 assert.doesNotThrow(()=>assertExperienceAssessments(rows,'fail',refs));
 rows[1].verdict='needs-evidence';assert.throws(()=>assertExperienceAssessments(rows,'pass',refs),/cannot override/);
 rows[1].verdict='not-applicable';assert.throws(()=>assertExperienceAssessments(rows,'pass',refs),/cannot be skipped/);
});
