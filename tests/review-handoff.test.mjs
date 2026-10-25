import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRun,saveCapture,confirmFinding,saveEvaluation,loadRun,saveDesignSystemExtraction} from '../packages/harness-core/store.js';
import {buildDesignSystemExtraction} from '../packages/skill-core/design-system.js';
import {verificationHash,verificationBinding,saveVerificationEvidence} from '../packages/harness-core/verification.js';
import {prepareReviewHandoff,completeReviewHandoff} from '../packages/harness-core/review-handoff.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'handoff-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const spec=JSON.parse(await readFile(new URL('../examples/happyclaw-site/experience.json',import.meta.url)));
 const run=await createRun({spec,url:'http://localhost',outputRoot:root});
 for(const phase of ['before','after']) {
  if(phase==='after')await confirmFinding(run.directory,spec.findings[0].id,'supported','Fixture scope');
  await mkdir(join(run.directory,phase));await writeFile(join(run.directory,phase,'page--mobile.png'),png);
  await saveCapture(run.directory,phase,{states:[{stateId:'page',configurationId:'mobile',start:{url:'http://localhost/'},screenshot:`${phase}/page--mobile.png`,reached:true}],designSystemSource:{repositoryCommit:'a'.repeat(40),dirty:false,status:'capture-scan-match'},verificationPreviewFingerprint:'fixture',verificationSource:{version:1,commit:'a'.repeat(40),dirty:false,contentHash:'b'.repeat(64),fileCount:1},verificationOriginalHashes:{[`${phase}/page--mobile.png`]:verificationHash(png)}});
 }
 await saveEvaluation(run.directory,{status:'fixture'});
 const manifest=(await loadRun(run.directory)).manifest;
 await saveVerificationEvidence(run.directory,{binding:await verificationBinding(run.directory,manifest),records:[{id:'flow',status:'pass',stage:'normal-interaction',method:'Fixture execution',limitations:['Fixture, not real interaction'],stateIds:['page'],result:{status:'pass',allAssertions:['pagination','dialog','return']},images:[png]}]});
 return run.directory;
}
const result=pack=>({reviewer:{type:'model',name:'Fixture',version:'fixture'},reviewedAt:'2026-10-16',verdict:'pass',crossRegionVerdict:'pass',screenshotRefs:pack.originals.map(i=>i.path),verificationRefs:['flow'],findings:[],rationale:'Scoped fixture only',limitations:['Not a real visual review']});
test('independent handoff automatically includes specialist results and originals, and cannot upgrade missing overview evidence',async t=>{
 const directory=await fixture(t),pack=await prepareReviewHandoff(directory);
 assert.equal(pack.originals.length,3);assert.deepEqual(pack.verification.records[0].result.allAssertions,['pagination','dialog','return']);
 assert.equal(pack.coverage.ready,false);
 const review=await completeReviewHandoff(directory,pack,result(pack));
 assert.equal(review.verdict,'needs-evidence');assert.equal(review.coverage.crossRegionVerdict,'not-run');
 const manifest=(await loadRun(directory)).manifest;assert.equal(manifest.judgment,null);assert.equal(manifest.execution,null);
});
test('handoff rejects dropped originals, omitted specialist acknowledgement and changed source inputs',async t=>{
 const directory=await fixture(t),pack=await prepareReviewHandoff(directory);
 await assert.rejects(completeReviewHandoff(directory,pack,{...result(pack),screenshotRefs:pack.originals.slice(1).map(i=>i.path)}),/every supplied original/);
 await assert.rejects(completeReviewHandoff(directory,pack,{...result(pack),verificationRefs:[]}),/every specialist record/);
 const manifest=(await loadRun(directory)).manifest;manifest.evaluation.changed=true;await writeFile(join(directory,'run.json'),JSON.stringify(manifest));
 await assert.rejects(completeReviewHandoff(directory,pack,result(pack)),/inputs changed/);
});
test('tampered original cannot enter the review handoff',async t=>{
 const directory=await fixture(t);await writeFile(join(directory,'after/page--mobile.png'),Buffer.concat([png,Buffer.from('changed')]));
 await assert.rejects(prepareReviewHandoff(directory),/PNG changed/);
});

test('external handoff carries capture-bound brand declarations and rejects missing or changed assessments',async t=>{
 const directory=await fixture(t),run=await loadRun(directory);
 const extraction=buildDesignSystemExtraction({snapshot:{files:[{path:'BRAND.md',content:'Voice: Direct'}],truncated:false},foundation:{status:'complete',proposedUpdates:[{type:'design-foundation',tokens:[]}]},capture:run.manifest.captures.after,phase:'after'});
 await saveDesignSystemExtraction(directory,extraction);
 const pack=await prepareReviewHandoff(directory);assert.equal(pack.brandReviewReferences.length,1);assert.match(pack.brandReviewInstructions,/NOT approved rules/);
 await assert.rejects(completeReviewHandoff(directory,pack,result(pack)),/every capture-bound/);
 const input={...result(pack),brandAssessments:pack.brandReviewReferences.map(item=>({reference:item.reference,verdict:'needs-evidence',observation:'Synthetic originals cannot prove brand language.',screenshotRefs:[]}))};
 const review=await completeReviewHandoff(directory,pack,input);assert.equal(review.brandAssessments.length,1);assert.equal(review.verdict,'needs-evidence');
 await writeFile(join(directory,'after/design-system.json'),'changed');await assert.rejects(prepareReviewHandoff(directory),/extraction changed/);
});
test('surface originals are automatically handed off, exported and protected against omission or tampering',async t=>{
 const directory=await fixture(t);
 const manifest=(await loadRun(directory)).manifest;
 // Replace the fixture capture before re-binding a new immutable specialist index.
 const path=`after/surface-${'c'.repeat(24)}-1.png`;
 await writeFile(join(directory,path),png);
 manifest.captures.after.states[0].pageSurfaces={surfaces:[{tiles:[{screenshot:path}]}]};
 manifest.captures.after.verificationOriginalHashes[path]=verificationHash(png);
 const part='after/part-'+ 'd'.repeat(24)+'-1.png';await writeFile(join(directory,part),png);manifest.captures.after.states[0].interactionParts=[{screenshot:part}];manifest.captures.after.verificationOriginalHashes[part]=verificationHash(png);
 // Old specialist binding must fail rather than silently accepting changed capture input.
 await writeFile(join(directory,'run.json'),JSON.stringify(manifest));
 await assert.rejects(prepareReviewHandoff(directory),/binding|source|changed/i);
 delete manifest.verificationEvidence;delete manifest.verificationHistory;await writeFile(join(directory,'run.json'),JSON.stringify(manifest));
 await saveVerificationEvidence(directory,{binding:await verificationBinding(directory,manifest),records:[{id:'flow',status:'pass',stage:'normal-interaction',method:'Surface fixture',limitations:['Fixture only'],stateIds:['page'],result:{status:'pass'},images:[]}]});
 const pack=await prepareReviewHandoff(directory);assert.ok(pack.originals.some(item=>item.path===path));assert.ok(pack.originals.some(item=>item.path===part));
 await assert.rejects(completeReviewHandoff(directory,pack,{...result(pack),screenshotRefs:pack.originals.filter(item=>item.path!==part).map(item=>item.path)}),/every supplied original/);
 await assert.rejects(completeReviewHandoff(directory,pack,{...result(pack),screenshotRefs:pack.originals.filter(item=>item.path!==path).map(item=>item.path)}),/every supplied original/);
 const {exportRun}=await import('../packages/harness-core/export.js');const out=await mkdtemp(join(tmpdir(),'surface-export-'));t.after(()=>rm(out,{recursive:true,force:true}));
 await exportRun({directory,outputRoot:out});assert.deepEqual(await readFile(join(out,manifest.id,path)),png);assert.deepEqual(await readFile(join(out,manifest.id,part)),png);
 await writeFile(join(directory,path),Buffer.concat([png,Buffer.from('tampered')]));await assert.rejects(prepareReviewHandoff(directory),/PNG changed/);
});
