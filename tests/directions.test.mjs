import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {directionService} from '../packages/workbench/directions.js';
test('direction decisions preserve constraints, deduplicate, reject unknown scopes without authorizing execution', async()=>{
 const root=await mkdtemp(join(tmpdir(),'hh-direction-'));
 try{await mkdir(join(root,'apps/designer/directions'),{recursive:true});await copyFile(new URL('../apps/designer/directions/review.json',import.meta.url),join(root,'apps/designer/directions/review.json'));
 const service=directionService(root),input={reviewId:'happyclaw-full-page-review-v2',decisions:{tokens:{decision:'接受建议'},proof:{reason:'只使用可验证证据'}}};
 const first=await service.save(input);assert.equal(first.executionAuthorized,false);assert.deepEqual(first.steps.map(s=>s.id),['tokens']);assert.equal(first.decisions.proof.reason,'只使用可验证证据');assert.equal((await service.save(input)).id,first.id);assert.equal((await service.list()).length,1);
 assert.equal(first.status,'awaiting-plan-preparation');assert.equal(first.steps[0].status,'accepted');
 await assert.rejects(service.authorize({taskId:first.id,stepId:'tokens'}),/确认/);
 await assert.rejects(service.authorize({taskId:first.id,stepId:'brand',confirmed:true}),/已接受/);
 const authorized=await service.authorize({taskId:first.id,stepId:'tokens',confirmed:true});assert.equal(authorized.executionAuthorized,false);assert.equal(authorized.executionAuthorizations.length,0);assert.equal(authorized.preparedStepId,'tokens');assert.equal(authorized.planAuthorizations.length,1);assert.equal((await service.get(first.id)).planAuthorizations[0].scope,first.steps[0].scope);
 await assert.rejects(service.save({...input,reviewId:'stale'}));await assert.rejects(service.save({...input,decisions:{unknown:{decision:'接受建议'}}}));await assert.rejects(service.save({...input,decisions:{}}));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('run-bound directions are accepted only for the reviewed project and source revision',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hh-direction-run-'));
 try{
  await mkdir(join(root,'apps/designer/directions'),{recursive:true});
  await copyFile(new URL('../apps/designer/directions/review.json',import.meta.url),join(root,'apps/designer/directions/review.json'));
  const runDirectory=join(root,'.harness','runs','run-current');await mkdir(runDirectory,{recursive:true});
  const manifest={id:'run-current',onboarding:{repository:{commit:'fc4709b1234567890'}},captures:{before:{desktop:{screenshot:'before.png'}}},skills:[]};
  const spec={project:{source:'https://github.com/ShuaiMXu/happyclaw-site'}};
  await writeFile(join(runDirectory,'run.json'),JSON.stringify(manifest));await writeFile(join(runDirectory,'experience.json'),JSON.stringify(spec));
  const service=directionService(root),input={reviewId:'happyclaw-full-page-review-v2',runId:'run-current',decisions:{tokens:{decision:'接受建议'}}};
  const task=await service.save(input);assert.equal(task.runId,'run-current');assert.equal(task.sourceCommit,manifest.onboarding.repository.commit);assert.match(task.evidenceHash,/^[a-f0-9]{64}$/);
  manifest.captures.before.mobile={screenshot:'mobile.png'};await writeFile(join(runDirectory,'run.json'),JSON.stringify(manifest));
  await assert.rejects(service.authorize({taskId:task.id,stepId:'tokens',confirmed:true}),/evidence changed/);
  delete manifest.captures.before.mobile;await writeFile(join(runDirectory,'run.json'),JSON.stringify(manifest));
  assert.equal((await service.authorize({taskId:task.id,stepId:'tokens',confirmed:true})).preparedStepId,'tokens');
  spec.project.source='https://example.com/other';await writeFile(join(runDirectory,'experience.json'),JSON.stringify(spec));
  await assert.rejects(service.save({...input,decisions:{components:{decision:'接受建议'}}}),/do not belong/);
  spec.project.source='https://github.com/ShuaiMXu/happyclaw-site';manifest.onboarding.repository.commit='deadbeef';await writeFile(join(runDirectory,'experience.json'),JSON.stringify(spec));await writeFile(join(runDirectory,'run.json'),JSON.stringify(manifest));
  await assert.rejects(service.save({...input,decisions:{components:{decision:'接受建议'}}}),/different source revision/);
 }finally{await rm(root,{recursive:true,force:true});}
});
