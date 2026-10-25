import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {createRun,saveCapture,confirmFinding,savePlan} from '../packages/harness-core/store.js';
import {executeSkill} from '../packages/skill-core/runner.js';
import {exportRun} from '../packages/harness-core/export.js';
import {componentReusePlan} from '../packages/experience-core/component-reuse.js';

test('reuse planning distinguishes approved, observed, deprecated and missing inventory',()=>{
 const spec=structuredClone(sample);
 spec.designFoundation.components=[{name:'Button',source:'ui/button.js',status:'approved'},{name:'Dialog',source:'web/dialog.js',status:'observed'},{name:'Old',source:'old.js',status:'deprecated'}];
 const plan=componentReusePlan(spec,spec.findings[0].id);
 assert.deepEqual(plan.components.map(x=>x.name),['Button']);
 assert.deepEqual(plan.observedNeedsReview.map(x=>x.name),['Dialog']);
 delete spec.designFoundation;
 assert.equal(componentReusePlan(spec,spec.findings[0].id).status,'needs-evidence');
 assert.throws(()=>componentReusePlan(spec,'unknown'),/known finding/);
});

test('confirmed planning creates fresh reuse evidence without retrying an old diagnosis artifact',async t=>{
 const root=await mkdtemp(join(tmpdir(),'reuse-plan-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const run=await createRun({spec:structuredClone(sample),url:'http://localhost:4321',outputRoot:root,id:'reuse001'});
 await mkdir(join(run.directory,'before'));await writeFile(join(run.directory,'before','desktop.png'),'test image');
 await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png'}}});
 const findingId=sample.findings[0].id;
 await assert.rejects(savePlan(run.directory,findingId),/Confirm/);
 await assert.rejects(readFile(join(run.directory,'component-reuse-plan.json')),/ENOENT/);
 // Simulate the historical missing-input result without replacing its audit trail.
 await executeSkill({id:'component-reuse-planner',directory:run.directory,registryRoot:resolve('skills/product-design')});
 const old=join(run.directory,'skills','component-reuse-planner.json');
 const original=await readFile(old,'utf8');
 await confirmFinding(run.directory,findingId,'supported','Verified scope');
 await savePlan(run.directory,findingId);
 assert.equal(JSON.parse(await readFile(join(run.directory,'component-reuse-plan.json'))).findingId,findingId);
 assert.equal(await readFile(old,'utf8'),original);
 const output=join(root,'published');await exportRun({directory:run.directory,outputRoot:output});
 assert.equal(JSON.parse(await readFile(join(output,'reuse001','component-reuse-plan.json'))).findingId,findingId);
});
