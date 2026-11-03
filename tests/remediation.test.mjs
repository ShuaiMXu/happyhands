import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {remediationProfile,remediationDefinition,stageRemediation,readRemediation,collectRemediation,assertExecutionResult,assertMethodChecks,aggregateMethodChecks,methodStateEntries,executionMethodPrompt,RESULT_FILE} from '../packages/harness-core/remediation.js';
import {designGuidanceProfile} from '../packages/skill-core/design-guidance.js';
import {assertVisualReview} from '../packages/harness-core/visual-review.js';
const profile={profile:'happyhands',adoptionReason:'Explicit fixture project adoption for this review'};
async function fixture(t){
 const directory=await mkdtemp(join(tmpdir(),'hh-remediation-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const run={directory,manifest:{onboarding:{config:{designGuidance:{remediation:profile}},repository:{commit:'a'.repeat(40)}},captures:{after:{states:[{stateId:'default',configurationId:'desktop',screenshot:'after/desktop.png'}]}}}};
 run.manifest.plan={remediation:await stageRemediation(run,'F1')};const method=await readRemediation(run);
 const row={status:'preserved',observed:'Inspected the supplied source and actual surface',decision:'Keep the existing approved behavior and layout',files:[],verification:'Actual checks still require independent review'};
 const result={contractHash:method.hash,checks:method.contract.rules.map(r=>({...row,ruleId:r.id})),issues:[{...row,id:'F1'}]};return {run,method,result};
}
test('strict profile requires explicit adoption and preserves legacy profiles',()=>{
 assert.equal(remediationProfile(undefined),null);assert.deepEqual(designGuidanceProfile(),{taste:'existing',intent:'polish'});
 for(const value of [true,{}, {profile:'happyhands'}, {...profile,approve:true}])assert.throws(()=>remediationProfile(value));
 assert.deepEqual(designGuidanceProfile({remediation:profile}).remediation,profile);
});
test('project profile retains task/grid/state methods without imposing owned UI preferences',async()=>{
 const project=await remediationDefinition({...profile,profile:'project'}),owned=await remediationDefinition(profile);
 assert.equal(project.rules.length,5);assert.equal(owned.rules.length,29);assert.ok(project.rules.some(r=>r.id==='UX-grid'));assert.ok(owned.rules.some(r=>r.id==='AS-19'));
});
test('execution receives the own Skill and specific complete OJO references',async t=>{
 const {run,method}=await fixture(t);const prompt=executionMethodPrompt(method,run.directory,'ojo/verified');
 for(const text of ['remediation-SKILL.md','component-recipe.md','visual-tokens.md','motion-system.md','icon-guidelines.md',RESULT_FILE,'gutters'])assert.ok(prompt.includes(text));
});
test('missing, duplicate and unknown rules and issue IDs are rejected',async t=>{
 const {method,result}=await fixture(t);
 for(const edit of [r=>r.checks.pop(),r=>r.checks[0]=r.checks[1],r=>r.checks[0].ruleId='unknown',r=>r.issues=[],r=>r.issues[0].id='unknown']){const r=structuredClone(result);edit(r);assert.throws(()=>assertExecutionResult(r,method.contract,method.hash));}
});
test('fixed requires changed files and blocked cannot become successful execution',async t=>{
 const {method,result}=await fixture(t);result.checks[0].status='fixed';assert.throws(()=>assertExecutionResult(result,method.contract,method.hash),/changed source/);
 result.checks[0].files=['page.css'];assert.throws(()=>assertExecutionResult(result,method.contract,method.hash),/unknown changed/);
 assertExecutionResult(result,method.contract,method.hash,['page.css']);result.issues[0].status='blocked';assert.throws(()=>assertExecutionResult(result,method.contract,method.hash,['page.css']),/blocked/);
});
test('report archived outside target, bound to hash and revalidated',async t=>{
 const {run,result}=await fixture(t);const worktree=await mkdtemp(join(tmpdir(),'hh-target-'));t.after(()=>rm(worktree,{recursive:true,force:true}));
 await writeFile(join(worktree,RESULT_FILE),JSON.stringify(result));const record=await collectRemediation(run,worktree,[]);
 await assert.rejects(readFile(join(worktree,RESULT_FILE)),/ENOENT/);run.manifest.execution={remediation:record,changedFiles:[]};await readRemediation(run,{execution:true});
 await writeFile(join(run.directory,record.path),'{}');await assert.rejects(readRemediation(run,{execution:true}),/changed/);
});
test('missing result and symlink report never satisfy execution',async t=>{
 const {run}=await fixture(t);await assert.rejects(collectRemediation(run,run.directory,[]),/ENOENT/);
 await symlink(join(run.directory,'remediation-contract.json'),join(run.directory,RESULT_FILE));await assert.rejects(collectRemediation(run,run.directory,[]),/Invalid/);
});
test('adoption and Skill snapshot cannot change after planning',async t=>{
 const {run}=await fixture(t);run.manifest.onboarding.config.designGuidance.remediation={...profile,profile:'project'};await assert.rejects(readRemediation(run),/adoption changed/);
 run.manifest.onboarding.config.designGuidance.remediation=profile;await writeFile(join(run.directory,'remediation-SKILL.md'),'changed');await assert.rejects(readRemediation(run),/Skill changed/);
});
test('coverage is rule times assigned state, not one screenshot for a whole page set',()=>{
 const manifest={captures:{after:{states:[{stateId:'default',configurationId:'desktop',screenshot:'after/desktop.png'},{stateId:'open',configurationId:'mobile',screenshot:'after/mobile.png'}]}}};
 const rules=['UX-grid','AS-19'],rows=rules.flatMap(ruleId=>methodStateEntries(manifest).map(s=>({ruleId,stateKey:s.key,status:'pass',reason:'Verified the assigned original and recorded state',screenshotRefs:[s.screenshot]})));
 assertMethodChecks(rows,rules,manifest,'pass');assert.throws(()=>assertMethodChecks(rows.slice(1),rules,manifest,'pass'),/Missing/);
 rows[0].status='not-applicable';rows[0].reason='';assert.throws(()=>assertMethodChecks(rows,rules,manifest,'pass'),/reason/);
 rows[0].reason='This state has no applicable object in the original';rows[0].status='needs-evidence';assert.throws(()=>assertMethodChecks(rows,rules,manifest,'pass'),/prevents/);assertMethodChecks(rows,rules,manifest,'needs-evidence');
});
test('aggregation cannot hide regional failures behind cross-region passes',()=>{
 const row={ruleId:'UX-grid',stateKey:'x',status:'fail',reason:'Grid clips the content',screenshotRefs:['after/x.png']};
 assert.equal(aggregateMethodChecks([{methodChecks:[row]},{methodChecks:[{...row,status:'pass'}]}])[0].status,'fail');
});
test('existing visual QA entry rejects missing contract checks before acceptance',async t=>{
 const {run}=await fixture(t);const review={schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'model',name:'Fixture',version:'1'},reviewedAt:new Date().toISOString(),verdict:'pass',screenshotRefs:['after/desktop.png'],findings:[],rationale:'Fixture only',limitations:['Not real visual evidence']};
 assert.throws(()=>assertVisualReview(review,run.manifest),/contract changed/);review.remediationHash=run.manifest.plan.remediation.hash;assert.throws(()=>assertVisualReview(review,run.manifest),/per-rule/);
});

test('explicit strict adoption cannot silently lose its plan contract',async t=>{
 const {run}=await fixture(t);delete run.manifest.plan.remediation;
 await assert.rejects(readRemediation(run),/Missing required/);
});
test('every own rule supplies a concrete repair method and verification instruction',async()=>{
 const definition=await remediationDefinition(profile);
 for(const rule of definition.rules){assert.ok(rule.remediation.length>30,rule.id);assert.ok(rule.verification.length>30,rule.id);}
});
