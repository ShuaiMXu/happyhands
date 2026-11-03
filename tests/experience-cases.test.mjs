import {judgmentHash} from '../packages/harness-core/judgment-withdrawal.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectExperienceCase,readExperienceCase,admitExperienceCase,listExperienceCases,relatedExperienceCases,experienceCaseBrief,verifyExperienceCaseBrief} from '../packages/harness-core/experience-cases.js';
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'hh-cases-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const directory=join(root,'runs','first');await mkdir(directory,{recursive:true});
 await writeFile(join(directory,'experience.json'),'{}');
 for(const phase of ['before','after']){await mkdir(join(directory,phase));await writeFile(join(directory,phase,'desktop.png'),'Synthetic fixture image');}
 const run={directory,manifest:{id:'first',captures:{before:{viewports:{desktop:{screenshot:'before/desktop.png'}}},after:{viewports:{desktop:{screenshot:'after/desktop.png'}}}},onboarding:{repository:{root:'/fixture/product',commit:'abc'}},visualReviews:[{skillId:'visual-qa-evaluator',verdict:'pass'}],judgment:{decision:'accept'}}};
 return run;
}
const input=id=>({id,kind:'preserved',reason:'Retain the observed task-specific hierarchy',tags:['card','hierarchy']});
test('automatic candidates are idempotent, explicit admission required, searchable',async t=>{
 const run=await fixture(t),first=await collectExperienceCase(run);assert.deepEqual(await collectExperienceCase(run),first);assert.equal(run.manifest.experienceCases.length,1);
 assert.equal((await listExperienceCases(run,{acceptedOnly:true})).length,0);
 await admitExperienceCase(run,input(first.id));assert.equal((await listExperienceCases(run,{acceptedOnly:true,query:'hierarchy'})).length,1);
 assert.equal((await listExperienceCases(run,{query:'absent-word'})).length,0);
});
test('changed or missing source evidence cannot be admitted or reused',async t=>{
 const run=await fixture(t),{id}=await collectExperienceCase(run);await admitExperienceCase(run,input(id));
 await writeFile(join(run.directory,'experience.json'),'changed');assert.equal((await readExperienceCase(run,id)).current,false);
 assert.equal((await listExperienceCases(run,{acceptedOnly:true})).length,0);await assert.rejects(admitExperienceCase(run,input(id)),/stale/);
});
test('regression and withdrawal require matching human disposition; old positives expire',async t=>{
 const run=await fixture(t),{id}=await collectExperienceCase(run);await assert.rejects(admitExperienceCase(run,{...input(id),kind:'regressed'}),/judgment/);
 run.manifest.judgment={decision:'reject',reason:'Introduced regression'};const negative=await collectExperienceCase(run);await admitExperienceCase(run,{...input(negative.id),kind:'regressed'});
 run.manifest.judgmentWithdrawal={reason:'Reassess evidence'};const withdrawn=await collectExperienceCase(run);await admitExperienceCase(run,{...input(withdrawn.id),kind:'withdrawn'});
 assert.equal((await listExperienceCases(run,{acceptedOnly:true})).length,1);
 await assert.rejects(admitExperienceCase(run,input(withdrawn.id)),/judgment/);
});
test('tampering and unsafe case identifiers fail closed',async t=>{
 const run=await fixture(t),{id,path}=await collectExperienceCase(run);await assert.rejects(readExperienceCase(run,'../../file'),/Unknown/);
 await writeFile(join(run.directory,path),'{}');await assert.rejects(readExperienceCase(run,id),/changed/);
});
test('same-project retrieval enters plan context and later withdrawal blocks execution',async t=>{
 const run=await fixture(t),{id}=await collectExperienceCase(run);await admitExperienceCase(run,input(id));
 await writeFile(join(run.directory,'run.json'),JSON.stringify(run.manifest));
 const next={directory:join(run.directory,'..','second'),manifest:{onboarding:run.manifest.onboarding}};
 const brief=await experienceCaseBrief(next);assert.match(brief,/historical examples/);await verifyExperienceCaseBrief(next,brief);assert.equal((await relatedExperienceCases(next)).length,1);
 run.manifest.judgmentWithdrawal={schemaVersion:'0.1',runId:'first',judgmentHash:judgmentHash(run.manifest.judgment),reason:'Later regression found',withdrawnAt:new Date().toISOString()};await writeFile(join(run.directory,'judgment-withdrawal.json'),JSON.stringify(run.manifest.judgmentWithdrawal));await writeFile(join(run.directory,'run.json'),JSON.stringify(run.manifest));await assert.rejects(verifyExperienceCaseBrief(next,brief),/replan/);
 next.manifest={onboarding:{repository:{root:'/other'}}};assert.equal((await relatedExperienceCases(next)).length,0);
});
