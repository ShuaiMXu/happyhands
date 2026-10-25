import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewTargets, reviewCoverage, currentPreview, livePreviewAvailable, reviewFindings, reviewAssociations } from '../apps/designer/page-review/model.js';
const entry=(phase,id='hero',reached=true)=>({stateId:id,configurationId:'desktop',width:1280,height:800,reached,...(reached?{screenshot:`${phase}/${id}--desktop.png`}:{error:'Target missing'})});
const qa={schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'model',name:'Independent',version:'1'},reviewedAt:'2026-09-30',verdict:'needs-evidence',screenshotRefs:['before/hero--desktop.png','after/hero--desktop.png'],findings:[],rationale:'Reviewed this captured viewport.',limitations:['Not a full-page review.']};
function run(){return {manifest:{captures:{before:{states:[entry('before'),entry('before','menu',false)]},after:{states:[entry('after')]}},visualReviews:[{skillId:'visual-qa-evaluator',verdict:'pass'}]},reviews:[{skillId:'visual-qa-evaluator',document:qa}],spec:{findings:[]}};}
test('page review retains both phases and failed states; capture coverage never invents missing evidence',()=>{
 const targets=reviewTargets(run());assert.equal(targets.length,3);assert.equal(targets.filter(x=>x.available).length,2);assert.equal(targets.filter(x=>x.cited).length,2);assert.equal(targets.find(x=>x.entry.stateId==='menu').available,false);
 const unpublished=run();unpublished.reviews=[];assert.ok(reviewTargets(unpublished).every(x=>!x.cited));
 assert.equal(reviewTargets(unpublished,[qa]).filter(x=>x.cited).length,2);
 assert.ok(reviewTargets(run(),[]).every(x=>!x.cited));
 const invalid=run();invalid.manifest.captures.after.states[0].screenshot='../../secret.png';assert.equal(reviewTargets(invalid).find(x=>x.phase==='after').available,false);assert.ok(reviewTargets(invalid).every(x=>!x.cited));
});
test('page review reports route, interaction, failure and uncited coverage without treating scroll as an interaction',()=>{
 const value=run();
 value.manifest.captures.before.states[0].start={url:'http://127.0.0.1:4321/'};
 value.manifest.captures.before.states[0].actions=[{type:'scroll-to',selector:'#hero'}];
 value.manifest.captures.before.states[1].start={url:'http://127.0.0.1:4321/'};
 value.manifest.captures.before.states[1].actions=[{type:'click',role:'button',name:'Menu'}];
 const coverage=reviewCoverage(reviewTargets(value));
 assert.deepEqual(coverage,{routes:1,states:2,interactions:1,interactionEvidence:{total:1,captured:0,cited:0},wholePageEvidence:{total:0,captured:0,cited:0},failed:1,uncited:0});
 const unpublished=reviewCoverage(reviewTargets(value,[]));
 assert.equal(unpublished.uncited,2);
});

test('interaction coverage separates planned, captured and cited phase evidence',()=>{
 const value=run();
 value.manifest.captures.before.states[0].actions=[{type:'click'}];
 value.manifest.captures.after.states[0].actions=[{type:'fill'}];
 value.manifest.captures.before.states[1].actions=[{type:'click'}];
 const coverage=reviewCoverage(reviewTargets(value));
 assert.equal(coverage.interactions,2);
 assert.deepEqual(coverage.interactionEvidence,{total:3,captured:2,cited:2});
 assert.deepEqual(reviewCoverage(reviewTargets(value,[])).interactionEvidence,{total:3,captured:2,cited:0});
 value.manifest.captures.after.states[0].reached=false;
 assert.deepEqual(reviewCoverage(reviewTargets(value)).interactionEvidence,{total:3,captured:1,cited:1});
});

test('navigation, waits, scrolls and unknown actions do not imply UI interaction coverage',()=>{
 const value=run();
 for(const target of value.manifest.captures.before.states)target.actions=[{type:'navigate'},{type:'wait-for'},{type:'scroll-to'},{type:'unknown'}];
 const coverage=reviewCoverage(reviewTargets(value));
 assert.equal(coverage.interactions,0);
 assert.deepEqual(coverage.interactionEvidence,{total:0,captured:0,cited:0});
});
test('current preview rejects unsafe URLs and preserves only server-issued source provenance',()=>{
 const origin='http://127.0.0.1:4190';for(const url of ['javascript:alert(1)','file:///tmp/x','http://user:secret@localhost:44321',origin+'/api/workbench/artifact', 'invalid'])assert.equal(currentPreview({url},origin),null);
 assert.equal(currentPreview(null,origin),null);
 assert.deepEqual(currentPreview({url:'http://127.0.0.1:44321/',versionStatus:'source-match'},origin),{url:'http://127.0.0.1:44321/',versionStatus:'source-match'});
 assert.deepEqual(currentPreview({url:'http://127.0.0.1:44321/',versionStatus:'verified'},origin),{url:'http://127.0.0.1:44321/',versionStatus:'unverified'});
 assert.equal(currentPreview({url:'http://127.0.0.1:44321/',versionStatus:'verified',managed:true,fingerprint:'a'.repeat(64)},origin).versionStatus,'verified');
});

test('route coverage counts the same page once across before and after preview ports',()=>{
 const value=run();
 value.manifest.captures.before.states[0].start={url:'http://127.0.0.1:44321/?tab=home#hero'};
 value.manifest.captures.after.states[0].start={url:'http://localhost:44322/?tab=home#quickstart'};
 assert.equal(reviewCoverage(reviewTargets(value)).routes,1);
 value.manifest.captures.before.states[1].start={url:'http://[::1]:44323/settings?tab=home'};
 assert.equal(reviewCoverage(reviewTargets(value)).routes,2);
 value.manifest.captures.after.states[0].start={url:'http://localhost:44322/?tab=account'};
 assert.equal(reviewCoverage(reviewTargets(value)).routes,3);
});

test('route coverage keeps remote origins distinct and ignores invalid page addresses',()=>{
 const value=run();
 value.manifest.captures.before.states[0].start={url:'https://one.example/'};
 value.manifest.captures.after.states[0].start={url:'https://two.example/'};
 assert.equal(reviewCoverage(reviewTargets(value)).routes,2);
 for(const url of ['file:///tmp/index.html','javascript:alert(1)','invalid','https://user:secret@one.example/']){
  value.manifest.captures.before.states[1].start={url};
  assert.equal(reviewCoverage(reviewTargets(value)).routes,2);
 }
});
test('live preview is available only when the page is reachable and its source is trustworthy',()=>{
 assert.equal(livePreviewAvailable(currentPreview({url:'http://127.0.0.1:44321/',versionStatus:'source-match',sourceStatus:'source-match',reachable:true},'http://127.0.0.1:4190')),true);
 assert.equal(livePreviewAvailable({versionStatus:'verified',reachable:true}),true);
 for(const versionStatus of ['source-mismatch','dirty','unverified','preview-changed','preview-stopped','preview-unavailable'])assert.equal(livePreviewAvailable({versionStatus,reachable:true}),false);
 assert.equal(livePreviewAvailable({versionStatus:'source-match',reachable:false}),false);
});
test('human-corrected findings take precedence over raw model attribution without rewriting the raw diagnosis',()=>{
 const value=run();value.diagnosis={findings:[{id:'CTA',title:'Hover contrast',priority:20}]};value.spec.findings=[{id:'CTA',title:'Default contrast',proposal:'Darken only the CTA'}];assert.equal(reviewFindings(value)[0].title,'Default contrast');assert.equal(reviewFindings(value)[0].priority,20);assert.equal(value.diagnosis.findings[0].title,'Hover contrast');
});
test('review associations use explicit evidence and keep name-only region matches as candidates',()=>{
 const value=run();value.diagnosis={evidence:[{id:'E',type:'skill-evidence',value:{source:'Hero.astro'}}],findings:[{id:'CTA',title:'CTA contrast',evidenceRefs:['E']}]};
 value.componentInventory={proposedUpdates:[{type:'component-inventory',components:[{name:'Hero',source:'src/components/Hero.astro',consumers:['src/pages/index.astro']}]}]};
 const association=reviewAssociations(value)[0];assert.deepEqual(association.sources,['Hero.astro']);assert.equal(association.components[0].source,'src/components/Hero.astro');assert.equal(association.regions[0].stateId,'hero');assert.equal(association.regions[0].confidence,'candidate');
 value.diagnosis.evidence[0].value.state='hero--desktop';assert.equal(reviewAssociations(value)[0].regions[0].confidence,'verified');
});
test('review associations remain unlocated when evidence has no state or unique source match',()=>{
 const value=run();value.diagnosis={evidence:[{id:'E',type:'skill-evidence',value:{source:'Unknown.astro'}}],findings:[{id:'X',title:'Unknown',evidenceRefs:['E']}]};value.componentInventory={proposedUpdates:[{type:'component-inventory',components:[]}]};
 const association=reviewAssociations(value)[0];assert.equal(association.unlocated,true);assert.deepEqual(association.components,[]);assert.deepEqual(association.regions,[]);
});
test('review associations reject ambiguous component basenames',()=>{
 const value=run();value.diagnosis={evidence:[{id:'E',value:{source:'Hero.astro'}}],findings:[{id:'X',title:'Ambiguous',evidenceRefs:['E']}]};value.componentInventory={proposedUpdates:[{type:'component-inventory',components:[{name:'Hero',source:'src/a/Hero.astro'},{name:'Hero',source:'src/b/Hero.astro'}]}]};
 const association=reviewAssociations(value)[0];assert.equal(association.unlocated,true);assert.deepEqual(association.components,[]);assert.deepEqual(association.regions,[]);
});
test('review associations understand inline model evidence and captured screenshots',()=>{
 const value=run();value.diagnosis={findings:[{id:'X',title:'Hero issue',evidence:[{source:'Hero.astro',observation:'Source evidence'},{source:'before/hero--desktop.png',observation:'Screenshot evidence'}]}]};value.componentInventory={proposedUpdates:[{type:'component-inventory',components:[{name:'Hero',source:'src/components/Hero.astro'}]}]};
 const association=reviewAssociations(value)[0];assert.equal(association.components[0].name,'Hero');assert.deepEqual(association.regions.filter(item=>item.confidence==='verified').map(item=>item.targetId),['before:hero--desktop']);
});
test('review associations promote a source-matched captured region to a verified file line',()=>{
 const value=run(),target=value.manifest.captures.before.states[0];target.region={selector:'#hero',bounds:{x:0,y:0,width:800,height:400},source:{file:'src/components/Hero.astro',line:12,anchor:'id="hero"',component:'Hero',fileHash:'a'.repeat(64)},verification:'unique-visible-selector-and-shared-source-anchor'};
 value.diagnosis={evidence:[{id:'E',value:{source:'Hero.astro'}}],findings:[{id:'X',title:'Hero issue',evidenceRefs:['E']}]};value.componentInventory={proposedUpdates:[{type:'component-inventory',components:[{name:'Hero',source:'src/components/Hero.astro'}]}]};
 const association=reviewAssociations(value)[0],region=association.regions.find(item=>item.targetId==='before:hero--desktop');assert.equal(region.confidence,'verified');assert.equal(association.locations[0].source.line,12);assert.equal(association.locations[0].selector,'#hero');
});

test('whole-page capture counts distinguish uncited and failed original evidence',()=>{
 const value=run();for(const entry of value.manifest.captures.before.states)entry.captureMode='full-page';
 assert.deepEqual(reviewCoverage(reviewTargets(value)).wholePageEvidence,{total:2,captured:1,cited:1});
 assert.deepEqual(reviewCoverage(reviewTargets(value,[])).wholePageEvidence,{total:2,captured:1,cited:0});
});
test('specialist replay is visible as interaction evidence without inventing native action validation',()=>{
 const value=run();const e=value.manifest.captures.after.states[0];e.actions=[{type:'specialist-sequence',record:'confirmed-flow'}];
 assert.equal(reviewCoverage(reviewTargets(value,[])).interactions,0);
 e.specialist={state:'hero',sha256:'a'.repeat(64)};
 assert.deepEqual(reviewCoverage(reviewTargets(value,[])).interactionEvidence,{total:1,captured:1,cited:0});
});
