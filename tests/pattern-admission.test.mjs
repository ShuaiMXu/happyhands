import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fixture,png,files} from './helpers/pattern-fixture.mjs';
import {fakeModel} from './helpers/pattern-model.mjs';
import {runPatternReview} from '../packages/workbench/pattern-review.js';
import {stagePatternAdmission,saveFoundationApproval,saveCapture,loadRun,withdrawJudgment,confirmFinding,savePlan} from '../packages/harness-core/store.js';
import {readPatternAdmissions} from '../packages/harness-core/pattern-admission.js';
import {foundationWithPatternAdmissions,foundationRuleFields} from '../packages/experience-core/foundation.js';
import {codexBrief,bootstrapBrief} from '../packages/experience-core/index.js';
import {exportRun,reindex} from '../packages/harness-core/export.js';
import {workflowState} from '../packages/harness-core/workflow.js';

async function setup(t,{approvedBase=false}={}){
  const data=await fixture(t),{root,repo,run}=data;
  run.spec.designFoundation.components=files.filter(file=>file.path.startsWith('components/')).map(file=>({name:file.path.split('/').pop().split('.')[0],source:file.path,variants:[],states:[],status:approvedBase?'approved':'observed'}));
  run.spec.designFoundation.patterns=[];
  if(approvedBase){run.spec.designFoundation.status='approved';for(const item of [...run.spec.designFoundation.tokens,...run.spec.designFoundation.brand.assets])item.status='approved';}
  await writeFile(join(run.directory,'experience.json'),JSON.stringify(run.spec));
  await mkdir(join(run.directory,'before'));await writeFile(join(run.directory,'before/desktop.png'),png);
  await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png'}}});
  await runPatternReview(run.directory,{repo,source:'components/Panel.jsx',cwd:join(root,'model'),generate:fakeModel});
  const current=await loadRun(run.directory),reviewId=current.manifest.patternReviews[0].id;
  return {...data,run:current,request:{reviewId,repo,expectedFoundation:structuredClone(current.spec.designFoundation)}};
}
function approval(foundation){
  const copy=structuredClone(foundation);copy.status='approved';
  for(const item of [...copy.tokens,...copy.components,...copy.patterns,...copy.brand.assets]){item.status='approved';item.decision={action:'approved',reason:'Synthetic explicit Foundation review only.'};}
  return {schemaVersion:'0.1',foundationVersion:'1.0.0',reviewer:{type:'human',name:'Synthetic fixture reviewer'},reason:'Synthetic version decision, not real product acceptance.',foundation:copy};
}

test('staging preserves approved base, requires final decisions and carries approved conditions into both brief routes',async t=>{
  const {repo,root,run,request}=await setup(t,{approvedBase:true}),before=JSON.stringify(run.spec.designFoundation);
  const references=await Promise.all([stagePatternAdmission(run.directory,request),stagePatternAdmission(run.directory,request)]);
  assert.equal(references[0].id,references[1].id);
  const staged=await loadRun(run.directory),records=await readPatternAdmissions(staged);
  assert.equal(records.length,1);assert.equal(JSON.stringify(staged.spec.designFoundation),before,'staging cannot rewrite an approved base');
  assert.equal(workflowState(staged.manifest).stage,'needs-foundation-approval');
  await assert.rejects(savePlan(run.directory,'F1'),/Foundation version/);
  const foundation=foundationWithPatternAdmissions(staged.spec.designFoundation,records);
  assert.equal(foundation.patterns[0].status,'observed');assert.ok(!codexBrief(staged.spec,'F1').includes('## Approved pattern constraints'));
  const pending=structuredClone(foundation);
  pending.patterns[0].decision={action:'replace',reason:'Unsaved explicit correction'};
  pending.patterns[0].usage.whenToAvoid=['Unsaved condition'];
  assert.deepEqual(foundationWithPatternAdmissions(pending,records),pending,'rendering pending admissions preserves unsaved explicit edits');
  await assert.rejects(saveFoundationApproval(run.directory,{...approval(foundation),foundation}),/explicit decision|approved or deprecated/);
  await saveFoundationApproval(run.directory,approval(foundation));const approved=await loadRun(run.directory);
  const pattern=approved.spec.designFoundation.patterns[0];assert.equal(pattern.status,'approved');
  const reviewBrief=codexBrief(approved.spec,'F1'),firstBrief=bootstrapBrief(approved.spec,{approval:approved.manifest.foundationApproval});
  for(const brief of [reviewBrief,firstBrief])for(const field of ['whenToUse','whenToAvoid','exceptions','limitations','dependencies','tokenReferences','examples'])assert.ok(brief.includes(`"${field}"`),field);
  await assert.rejects(stagePatternAdmission(run.directory,request),/frozen/);
  await confirmFinding(run.directory,'F1','supported','Synthetic review confirmation');await savePlan(run.directory,'F1');
  assert.match(await readFile(join(run.directory,'codex-brief.md'),'utf8'),/Approved pattern constraints/);
  const exported=await exportRun({directory:run.directory,outputRoot:join(root,'public')});assert.ok(exported.files.includes(references[0].path));
  const copy=await loadRun(exported.directory);assert.equal((await readPatternAdmissions(copy)).length,1);
  await writeFile(join(exported.directory,references[0].path),'{}');assert.deepEqual(await reindex(join(root,'public')),[]);
});

test('approval cannot drop provenance, change rules silently or reference unapproved dependencies',async t=>{
  for(const kind of ['drop-evidence','changed-usage','dependency','token','missing-usage'])await t.test(kind,async sub=>{
    const {run,request}=await setup(sub);await stagePatternAdmission(run.directory,request);
    const current=await loadRun(run.directory),draft=foundationWithPatternAdmissions(current.spec.designFoundation,await readPatternAdmissions(current)),input=approval(draft),pattern=input.foundation.patterns[0];
    if(kind==='drop-evidence')delete pattern.evidence;
    if(kind==='changed-usage')pattern.usage.whenToAvoid=['Silently changed rule'];
    if(kind==='dependency'){const component=input.foundation.components[0];component.status='deprecated';component.decision={action:'deprecated',reason:'Synthetic deprecation'};}
    if(['token','missing-usage'].includes(kind)){
      pattern.decision={action:'replace',reason:'Synthetic replacement request',previous:foundationRuleFields(draft.patterns[0])};
      if(kind==='token')pattern.usage.tokenReferences=['--unknown'];else delete pattern.usage.whenToAvoid;
    }
    await assert.rejects(saveFoundationApproval(run.directory,input),/evidence|replacement|not approved|needs complete/);
    assert.equal((await loadRun(run.directory)).manifest.foundationApproval,null);
  });
});

test('explicit replacement preserves original rules while approving corrected conditions',async t=>{
  const {run,request}=await setup(t);await stagePatternAdmission(run.directory,request);
  const current=await loadRun(run.directory),draft=foundationWithPatternAdmissions(current.spec.designFoundation,await readPatternAdmissions(current)),input=approval(draft),pattern=input.foundation.patterns[0];
  pattern.decision={action:'replace',reason:'Synthetic correction after review',previous:foundationRuleFields(draft.patterns[0])};pattern.usage.whenToAvoid=['Corrected synthetic condition'];
  await saveFoundationApproval(run.directory,input);const saved=(await loadRun(run.directory)).spec.designFoundation.patterns[0];
  assert.deepEqual(saved.usage.whenToAvoid,['Corrected synthetic condition']);assert.deepEqual(saved.decision.previous.usage.whenToAvoid,draft.patterns[0].usage.whenToAvoid);
});

test('withdrawal blocks new admission and active approval, but permits explicit deprecation',async t=>{
  const {run,parent,request}=await setup(t);await stagePatternAdmission(run.directory,request);
  await withdrawJudgment(parent.directory,'Synthetic later withdrawal');
  await assert.rejects(stagePatternAdmission(run.directory,request),/changed/);
  const current=await loadRun(run.directory),input=approval(foundationWithPatternAdmissions(current.spec.designFoundation,await readPatternAdmissions(current)));
  await assert.rejects(saveFoundationApproval(run.directory,input),/changed/);
  input.foundation.patterns[0].status='deprecated';input.foundation.patterns[0].decision={action:'deprecated',reason:'Synthetic withdrawal acknowledgement'};
  await saveFoundationApproval(run.directory,input);
  assert.ok(!codexBrief((await loadRun(run.directory)).spec,'F1').includes('## Approved pattern constraints'));
});

test('source drift, stale Foundation and unregistered reviews cannot stage a pattern',async t=>{
  for(const kind of ['source','foundation','unknown-review'])await t.test(kind,async sub=>{
    const {run,repo,request}=await setup(sub);
    if(kind==='source')await writeFile(join(repo,'PageA.jsx'),'changed source');
    if(kind==='foundation')request.expectedFoundation.brand.voice.push('Stale draft');
    if(kind==='unknown-review')request.reviewId='0'.repeat(64);
    await assert.rejects(stagePatternAdmission(run.directory,request),/changed|registered/);
    assert.equal((await loadRun(run.directory)).manifest.patternAdmissions,undefined);
  });
});
