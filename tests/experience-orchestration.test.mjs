import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {configureReviewCosts,reviewCostReport} from '../packages/harness-core/review-costs.js';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {exportRun,publicExecutionBrief} from '../packages/harness-core/export.js';
import {createRun,loadRun,saveCapture,saveDiagnosis,confirmFinding,savePlan,readVerifiedExecutionPlan,saveEvaluation,saveVisualReview} from '../packages/harness-core/store.js';
import {captureWithDesignSystem} from '../packages/harness-core/design-system.js';
import {buildRunReport} from '../packages/harness-core/report.js';
import {assertVisualReview} from '../packages/harness-core/visual-review.js';
import {diagnoseRun} from '../packages/harness-core/diagnosis.js';
import {diagnoseBaseline} from '../packages/workbench/baseline-diagnosis.js';
import {runAiVisualReview} from '../packages/workbench/ai-review.js';
import {selectResource} from '../packages/harness-core/reference-resources.js';
import {workflowState} from '../packages/harness-core/workflow.js';
import {EXPERIENCE_INSTRUCTIONS,EXPERIENCE_POLICY,AUDIT_DIMENSIONS,REVIEW_DIMENSIONS,confirmedRepairImpact,experienceContext,saveExperienceRecord,experienceFor,assertExperienceAssessments} from '../packages/harness-core/experience-orchestration.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
const original='before/desktop.png';
// Synthetic protocol fixtures. These images do not establish real visual quality.
async function fixture(t,{sourceBound=false}={}){
 const root=await mkdtemp(join(tmpdir(),'hh-experience-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const spec=structuredClone(sample);spec.project={...spec.project,name:'Renewal protocol fixture',goal:'Help domain owners identify an upcoming renewal and decide what to do',audience:'Domain owners',task:'Find upcoming renewal, understand cost and choose next action'};
 const {directory}=await createRun({spec,url:'http://localhost',outputRoot:root,experiencePolicy:EXPERIENCE_POLICY});
 const capture=async phase=>{
  const path=`${phase}/desktop.png`;
  await mkdir(join(directory,phase));await writeFile(join(directory,path),png);
  return {viewports:{desktop:{screenshot:path,finalUrl:'http://localhost/renewals',reached:true,width:1280,height:800}}};
 };
 const repo=join(root,'product');
 const boundCapture=phase=>captureWithDesignSystem({directory,repo,phase,extract:false,bindVerificationSource:true,verificationUrl:'http://localhost/renewals',fingerprintPreview:async()=> 'f'.repeat(64),capture:()=>capture(phase)});
 if(sourceBound){
  await mkdir(repo);await writeFile(join(repo,'renewal.html'),'<h1>Renewals</h1>');
  const git=(...args)=>promisify(execFile)('git',args,{cwd:repo});
  await git('init','-q');await git('add','.');await git('-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','Fixture');
  await boundCapture('before');
 }else await saveCapture(directory,'before',await capture('before'));
 const file=join(root,'reference.md');await writeFile(file,'# Comparable terms\nAlign term, price and action when comparison is the actual task.');
 await selectResource({directory,file});
 const context=await experienceContext(directory,'public-page'),ref=context.designSources[0];
 const route=context.readingPlan.groups.find(group=>group.id==='web-taste');
 assert.equal(context.readingPlan.stage,'audit');
 assert.ok(route.mustRead.some(file=>file.path.endsWith('/sections.md')));
 assert.equal(context.embeddedAdapters.filter(adapter=>adapter.path===route.embedded[0].path).length,1);
 assert.match(context.instructions,/Follow readingPlan/);
 const path=context.designGuidance.reference+'/web-taste/upstream/SKILL.md',quote=(await readFile(join(directory,path),'utf8')).split('\n').find(line=>line.trim().length>10);
 const methods=[{path,quote,application:'Use hierarchy to answer the immediate decision before secondary proof; preserve real pricing terms.'}];
 const audit={version:EXPERIENCE_POLICY,surface:'public-page',task:{originalRequest:'Help visitors find a renewal, understand its cost and decide what to do.',user:'Domain owner',scenario:'A renewal is due soon',outcome:'Identify the renewal and a justified next action',constraints:['Preserve calendar and truthful sample scope'],operatorProposals:['Five labelled fields are only a candidate, not a user requirement'],assumptions:[],scope:'First-screen decision and its next action',outOfScope:'Uncaptured account and payment screens'},journey:[{step:'Understand the next renewal',userQuestion:'Which domain needs a decision and at what cost?',action:'Review renewal',observation:'Synthetic protocol context; no real visual judgment',screenshotRefs:[original],unknowns:['Real payment is not tested']}],issues:[{id:'READING-DISTANCE',kind:'hypothesis',problem:'Repeated labels may separate the price from the term and action',impact:'A visitor may need more scanning',rootCause:'Operator prescribed fields before deciding hierarchy',priority:'high',screenshotRefs:[original]}],checks:AUDIT_DIMENSIONS.map(dimension=>({dimension,status:'needs-evidence',observation:'Synthetic protocol coverage, not a real audit',screenshotRefs:[],reason:'Inspect real page and runtime before making a claim'})),designBasis:{sources:[{source:ref.id,sha256:ref.sha256,authority:'reference',section:'# Comparable terms',problem:'Compare price for an equal term',adopt:'Keep comparable cost and term adjacent',preserve:'Original calendar and controls',avoid:'Unrelated visual style or card quota'}],missingSourcesReason:'No project design-system document was supplied; external reference is not approval.'},methods};
 const decision={version:EXPERIENCE_POLICY,findingId:'F1',problemIds:['READING-DISTANCE'],readingOrder:['Urgency and domain','Comparable cost and term','Next action'],grouping:'Group cost with term instead of five equally weighted labels',primaryAction:'Review renewal',content:{show:['Domain, due date and cost for its actual term'],merge:['Price and term in the same reading unit'],defer:['Secondary explanation until details'],reason:'Reduce scanning while preserving decision facts'},layout:'Reuse existing calendar alignment; do not add a new card grid',components:[{source:'Inspect target existing implementation before editing',consumers:['Renewal summary','Comparison detail'],states:['Default','Selected','Keyboard focus'],decision:'Reuse existing control APIs after actual inspection; discovery remains incomplete'}],alternatives:[{kind:'preserve',description:'Keep the existing summary',benefit:'No added reading burden',cost:'Urgency may remain hard to identify'},{kind:'lighter',description:'Reorder existing text and group price with term',benefit:'Answers the immediate decision without more labels',cost:'Moves secondary explanation to details'}],chosen:'A comparison table only inside the details where users compare multiple options',whyBetterForTask:'Rows align equal terms and costs; the first screen keeps one clear decision',tradeoffs:'Details take one action; the calendar remains available',referenceApplications:[{source:ref.id,application:'Use aligned comparable terms in details, preserve summary hierarchy',verification:'Inspect task reading order and equal-term costs in real matched originals'}],verification:[{criterion:'The upcoming domain and equal-term cost are clear before action',method:'Independent inspection and real task replay',expectedEvidence:'Matched originals and actual action records, not field counts'}],methods};
 return {root,directory,audit,decision,repo,boundCapture};
}
test('strict start cannot diagnose or plan without an audit; source adaptation and method provenance cannot be forged',async t=>{
 const f=await fixture(t),run=await loadRun(f.directory);
 assert.equal(workflowState(run.manifest).stage,'needs-experience-audit');
 run.manifest.onboarding={config:{designGuidance:{taste:'public-page'}}};
 await writeFile(join(f.directory,'run.json'),JSON.stringify(run.manifest));
 const configuredContext=await experienceContext(f.directory);
 assert.equal(configuredContext.surface,'public-page');
 assert.ok(configuredContext.readingPlan.groups.find(group=>group.id==='web-taste').mustRead.some(file=>file.path.endsWith('/sections.md')));
 assert.equal((await experienceContext(f.directory,'app-screen')).surface,'app-screen');
 await assert.rejects(saveDiagnosis(f.directory,diagnoseRun({run})),/experience audit/);
 await assert.rejects(savePlan(f.directory,'F1'),/experience audit/);
 for(const mutate of [a=>a.designBasis.sources[0].sha256='0'.repeat(64),a=>a.designBasis.sources[0].authority='project-rule',a=>a.designBasis.sources[0].section='Nonexistent section',a=>a.methods[0].path='design-guidance/forged.md',a=>a.methods[0].quote='Invented quote',a=>a.checks.pop()]){
  const bad=structuredClone(f.audit);mutate(bad);await assert.rejects(saveExperienceRecord(f.directory,'audit',bad));
 }
 await saveExperienceRecord(f.directory,'audit',f.audit);
 const decisionContext=await experienceContext(f.directory);
 assert.equal(decisionContext.surface,'public-page');
 assert.equal(decisionContext.readingPlan.stage,'decision');
 assert.match(decisionContext.instructions,/Write the decision against decisionSchema/);
 assert.doesNotMatch(decisionContext.instructions,/write the audit against auditSchema/);
 assert.ok(decisionContext.readingPlan.groups.find(group=>group.id==='local-experience').mustRead.some(file=>file.path.endsWith('/fix-planner/SKILL.md')));
 await assert.rejects(experienceContext(f.directory,'app-screen'),/surface is frozen/);
 assert.equal((await experienceFor(await loadRun(f.directory))).audit.issues[0].kind,'hypothesis');
 await assert.rejects(selectResource({directory:f.directory,file:join(f.root,'reference.md')}),/frozen/);
 await assert.rejects(saveExperienceRecord(f.directory,'audit',f.audit),/immutable/);
});
test('the actual model context separates operator form from task, and the bound decision reaches execution and independent review',async t=>{
 const f=await fixture(t);
 f.audit.task.goal={version:'design-goal@1',kind:'repair',requestQuote:'Help visitors',criteria:['Keep renewal term and price legible'],preserve:['Calendar'],allowedChanges:['Grouping in the single renewal summary']};
 f.decision.repairImpact='local';
 f.decision.components[0].consumers=['Renewal summary'];
 await saveExperienceRecord(f.directory,'audit',f.audit);
 let run=await loadRun(f.directory);
 const diagnosis=await diagnoseBaseline(f.directory,diagnoseRun({run}),{cwd:join(f.root,'diagnose'),generate:async(_command,_args,{cwd,input})=>{
  const context=JSON.parse(await readFile(join(cwd,'context.json')));
  assert.equal(context.experience.audit.task.operatorProposals.length,1);
  assert.equal(context.readingPlan.stage,'diagnosis');
  assert.equal(context.readingPlan.repairImpact,'unknown');
  const web=context.readingPlan.groups.find(group=>group.id==='web-taste');
  assert.ok(web.mustRead.some(file=>file.path.endsWith('/sections.md')));
  assert.ok(input.includes(join(cwd,web.mustRead.find(file=>file.path.endsWith('/sections.md')).path)));
  assert.match(input,/Missing implementation of an operator proposal is not a defect/);
  await writeFile(join(cwd,'result.json'),JSON.stringify({status:'complete',summary:'Protocol fixture, not a visual pass',screenshotRefs:[original],limitations:['Synthetic image'],findings:[]}));
 }});
 await saveDiagnosis(f.directory,diagnosis);await confirmFinding(f.directory,'F1','supported','Fixture scope; not human acceptance');
 await assert.rejects(savePlan(f.directory,'F1'),/experience decision/);
 const bad=structuredClone(f.decision);bad.alternatives=bad.alternatives.map(row=>({...row,kind:'other'}));await assert.rejects(saveExperienceRecord(f.directory,'decision',bad),/lighter alternative/);
 await saveExperienceRecord(f.directory,'decision',f.decision);await savePlan(f.directory,'F1');
 run=await loadRun(f.directory);const {brief,experience}=await readVerifiedExecutionPlan(run);
 assert.equal(confirmedRepairImpact(run,experience),'local');
 const shared=structuredClone(experience);
 shared.decision.components[0].consumers.push('Account renewals');
 assert.equal(confirmedRepairImpact(run,shared),'broad');
 const multipleFindings=structuredClone(experience);
 multipleFindings.decision.problemIds.push('SECOND-PROBLEM');
 assert.equal(confirmedRepairImpact(run,multipleFindings),'broad');
 const legacy=structuredClone(experience);
 delete legacy.decision.repairImpact;
 assert.equal(confirmedRepairImpact(run,legacy),'unknown');
 const delegated={manifest:{confirmation:{...run.manifest.confirmation,authority:'user-delegated'}}};
 assert.equal(confirmedRepairImpact(delegated,experience),'unknown');
 assert.ok(!publicExecutionBrief(brief).includes(f.audit.task.originalRequest));
 assert.match(brief,/comparison table only inside the details/);assert.match(brief,/operator reasoning to challenge/);
 await mkdir(join(f.directory,'after'));await writeFile(join(f.directory,'after/desktop.png'),png);
 await saveCapture(f.directory,'after',{viewports:{desktop:{screenshot:'after/desktop.png'}}});await saveEvaluation(f.directory,{status:'fixture-functional-pass'});
 await runAiVisualReview(f.directory,{cwd:join(f.root,'review'),signal:new AbortController().signal,generate:async(_command,_args,{cwd,input})=>{
  const context=JSON.parse(await readFile(join(cwd,'review-context.json')));
  assert.equal(context.experience.audit.task.originalRequest,f.audit.task.originalRequest);
  assert.equal(context.readingPlan.stage,'review');
  assert.equal(context.readingPlan.repairImpact,'local');
  assert.equal(context.readingPlan.groups.find(group=>group.id==='web-taste').mustRead.length,1);
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

test('new goal-bound audits require explicit goals and cannot downgrade; old records remain readable',async t=>{
 const f=await fixture(t);let run=await loadRun(f.directory);run.manifest.experiencePolicy='task-design-review@2';await writeFile(join(f.directory,'run.json'),JSON.stringify(run.manifest));
 await assert.rejects(saveExperienceRecord(f.directory,'audit',f.audit),/downgrade/);
 f.audit.version='task-design-review@2';await assert.rejects(saveExperienceRecord(f.directory,'audit',f.audit),/goal/);
 f.audit.task.goal={version:'design-goal@1',kind:'mixed',requestQuote:'Help visitors',criteria:['Improve task hierarchy'],preserve:['Brand and calendar'],allowedChanges:['Reading order and grouping']};
 await saveExperienceRecord(f.directory,'audit',f.audit);run=await loadRun(f.directory);assert.equal(run.manifest.experienceAudit.goal.kind,'mixed');assert.equal((await experienceFor(run)).audit.task.goal.kind,'mixed');
 run.manifest.experienceAudit.goal.kind='repair';await writeFile(join(f.directory,'run.json'),JSON.stringify(run.manifest));await assert.rejects(experienceFor(await loadRun(f.directory)),/goal reference changed/);
});
test('repair goals may preserve design; improvement/mixed require improved final comparison',async()=>{
 const {assertReviewGoal}=await import('../packages/harness-core/review-goal.js');
 for(const kind of ['improvement','mixed'])for(const verdict of [undefined,'preserved','regressed','needs-evidence'])assert.throws(()=>assertReviewGoal({verdict:'pass',...(verdict?{designComparison:{verdict}}:{})},{version:'design-goal@1',kind}),/requires an explicit improved/);
 assert.doesNotThrow(()=>assertReviewGoal({verdict:'pass',designComparison:{verdict:'preserved'}},{version:'design-goal@1',kind:'repair'}));
 assert.doesNotThrow(()=>assertReviewGoal({verdict:'pass',designComparison:{verdict:'improved'}},{version:'design-goal@1',kind:'mixed'}));
 assert.doesNotThrow(()=>assertReviewGoal({verdict:'pass'},null));
});

test('next prepares a budgeted review, which still rejects a preservation pass for an improvement goal',async t=>{
 const f=await fixture(t);f.audit.version='task-design-review@2';f.audit.task.goal={version:'design-goal@1',kind:'improvement',requestQuote:'Help visitors',criteria:['Clearer hierarchy for the next decision'],preserve:['Original brand'],allowedChanges:['Grouping and reading order']};f.decision.version=f.audit.version;
 await saveExperienceRecord(f.directory,'audit',f.audit);let run=await loadRun(f.directory);await saveDiagnosis(f.directory,diagnoseRun({run}));await confirmFinding(f.directory,'F1','supported','Synthetic scope, not human acceptance');await saveExperienceRecord(f.directory,'decision',f.decision);await savePlan(f.directory,'F1');
 await mkdir(join(f.directory,'after'));await writeFile(join(f.directory,'after/desktop.png'),png);await saveCapture(f.directory,'after',{viewports:{desktop:{screenshot:'after/desktop.png'}}});await saveEvaluation(f.directory,{status:'synthetic-functional-pass'});
 const cli = fileURLToPath(new URL('../scripts/harness.mjs', import.meta.url));
 const invoke = async (...args) => JSON.parse((await promisify(execFile)(process.execPath, [cli, ...args])).stdout);
 const next = async () => (await invoke('next', '--run', f.directory)).cli.steps;
 await configureReviewCosts(f.directory, {maxInputTokens: 50000}, 'Fixture token budget without a call ceiling');
 const [preflight, review] = await next();
 assert.equal(preflight.argv.at(-2), '--preflight-only');
 const preview = await invoke(...preflight.argv);
 assert.equal(preview.status, 'preflight-only');
 assert.equal(preview.plan.potentialModelCalls, 1);
 assert.equal((await reviewCostReport(f.directory)).totals.calls, 0);
 assert.deepEqual(review.argv.slice(-2), ['--max-model-calls', 'MAX_MODEL_CALLS']);
 assert.ok(review.needs.MAX_MODEL_CALLS);
 await configureReviewCosts(f.directory, {maxInputTokens: 50000, maxCalls: 1}, 'Fixture cumulative call ceiling');
 assert.deepEqual((await next()).map(step => step.argv), [['model-review', '--run', f.directory]]);
 await assert.rejects(runAiVisualReview(f.directory,{cwd:join(f.root,'goal-review'),signal:new AbortController().signal,generate:async(c,a,{cwd})=>{
  const context=JSON.parse(await readFile(join(cwd,'review-context.json'))),refs=[original,'after/desktop.png'];await writeFile(join(cwd,'review-result.json'),JSON.stringify({[context.reviewResponsibility.decisionField]:'pass',screenshotRefs:refs,findings:[],rationale:'Synthetic scoped repair only',limitations:['Not actual visual evidence'],designComparison:{verdict:'preserved',reason:'Only a local repair; no hierarchy benefit established',screenshotRefs:refs},experienceAssessments:REVIEW_DIMENSIONS.map(dimension=>({dimension,verdict:'pass',reason:'Synthetic contract result only',screenshotRefs:refs}))}));
 }}),/design improvement goal requires/);
 assert.equal((await loadRun(f.directory)).manifest.visualReviews.length,0);assert.equal((await loadRun(f.directory)).manifest.judgment,null);
});

test('a new goal-bound decision requires independently cited criteria and the report preserves their source links',async t=>{
 const f=await fixture(t,{sourceBound:true});
 f.audit.version=f.decision.version='task-design-review@2';
 f.audit.task.goal={version:'design-goal@1',kind:'repair',requestQuote:'Help visitors',criteria:['Explain the renewal price','Keep the primary action visible'],preserve:['Existing navigation'],allowedChanges:['Renewal content']};
 await saveExperienceRecord(f.directory,'audit',f.audit);
 await saveDiagnosis(f.directory,diagnoseRun({run:await loadRun(f.directory)}));
 await confirmFinding(f.directory,'F1','supported','Fixture scope, no human acceptance');
 await saveExperienceRecord(f.directory,'decision',f.decision);
 await savePlan(f.directory,'F1');
 await writeFile(join(f.repo,'renewal.html'),'<h1>Renewals</h1><p>$15 per year</p>');
 await f.boundCapture('after');
 await saveEvaluation(f.directory,{status:'synthetic-functional-pass'});
 const refs=[original,'after/desktop.png'];
 const review={schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'human',name:'Fixture reviewer',version:'fixture'},reviewedAt:new Date().toISOString(),verdict:'pass',screenshotRefs:refs,findings:[],rationale:'Fixture only',limitations:['Synthetic originals.'],experienceAssessments:REVIEW_DIMENSIONS.map(dimension=>({dimension,verdict:'pass',reason:'Fixture only',screenshotRefs:refs}))};
 await assert.rejects(saveVisualReview(f.directory,review),/every design goal criterion/);
 const first={criterion:1,verdict:'pass',reason:'Price is grouped with its term',changedFiles:['renewal.html'],screenshotRefs:refs,verificationRefs:[]};
 const second={...first,criterion:2,reason:'The primary action remains visible',changedFiles:[]};
 const mismatched=(await loadRun(f.directory)).manifest;
 mismatched.captures.after.viewports.desktop.dom={language:'de'};
 assert.throws(()=>assertVisualReview({...review,criterionAssessments:[first,second]},mismatched),/matched, reached/);
 await assert.rejects(saveVisualReview(f.directory,{...review,criterionAssessments:[first,first]}),/exactly once/);
 await assert.rejects(saveVisualReview(f.directory,{...review,criterionAssessments:[{...first,screenshotRefs:[original]},second]}),/matched, reached/);
 await assert.rejects(saveVisualReview(f.directory,{...review,criterionAssessments:[{...first,changedFiles:['unchanged.html']},second]}),/without a recorded change/);
 await assert.rejects(saveVisualReview(f.directory,{...review,criterionAssessments:[first,{...second,verdict:'not-applicable'}]}),/unresolved design goal/);
 await runAiVisualReview(f.directory,{cwd:join(f.root,'criteria-review'),signal:new AbortController().signal,maxModelCalls:1,generate:async(_command,_args,{cwd,input})=>{
  const context=JSON.parse(await readFile(join(cwd,'review-context.json'),'utf8'));
  assert.deepEqual(context.criterionEvidence,{changedFiles:['renewal.html'],additionalChangedFiles:0});
  assert.match(input,/return criterionAssessments/);
  await writeFile(join(cwd,'review-result.json'),JSON.stringify({...review,[context.reviewResponsibility.decisionField]:'pass',criterionAssessments:[first,second]}));
 }});
 const report=await buildRunReport({directory:f.directory});
 const html=await readFile(report.path,'utf8');
 assert.match(html,/Explain the renewal price[\s\S]*?renewal\.html[\s\S]*?page--desktop[\s\S]*?pass · Price is grouped with its term/);
 assert.match(html,/Keep the primary action visible[\s\S]*?No changed files associated/);
 assert.match(html,/Human judgment<\/th><td>pending/);
 const exported=await exportRun({directory:f.directory,outputRoot:join(f.root,'exported')});
 const exportedReview=JSON.parse(await readFile(join(exported.directory,'reviews/visual-qa-evaluator.json'),'utf8'));
 assert.deepEqual(exportedReview.criterionAssessments,[first,second]);
 const inventory=join(f.directory,'after/repository-inputs.json');
 await writeFile(inventory,(await readFile(inventory,'utf8'))+'\n');
 await buildRunReport({directory:f.directory});
 assert.match(await readFile(report.path,'utf8'),/review or source evidence is missing or changed/);
});


test('the independent design-system assessment gates parallel component implementations',()=>{
 assert.match(EXPERIENCE_INSTRUCTIONS,/same-purpose instances across affected surfaces/);
 assert.match(EXPERIENCE_INSTRUCTIONS,/fail proven parallel implementations/);
 const available=new Set(['after/desktop.png']);
 const assessments=REVIEW_DIMENSIONS.map(dimension=>({
  dimension,verdict:'pass',reason:'Verified with the scoped before and after evidence',screenshotRefs:['after/desktop.png']
 }));
 const designSystem=assessments.find(row=>row.dimension==='design-system');
 designSystem.verdict='fail';
 designSystem.reason='The Design.md preview introduced a different button implementation for the same purpose.';
 assert.throws(()=>assertExperienceAssessments(assessments,'pass',available),/unresolved experience assessment/);
 designSystem.verdict='needs-evidence';
 designSystem.reason='The actual source relationship is unavailable.';
 assert.throws(()=>assertExperienceAssessments(assessments,'pass',available),/unresolved experience assessment/);
});
