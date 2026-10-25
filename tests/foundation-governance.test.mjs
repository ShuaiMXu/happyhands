import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildDesignSystemExtraction,evidenceHash} from '../packages/skill-core/design-system.js';
import {observedFoundationFrom,extractFoundationInventory} from '../packages/skill-core/foundation-inventory.js';
import {runHandler} from '../packages/skill-core/handlers.js';
import {createRun,saveCapture,saveFoundationApproval,loadRun} from '../packages/harness-core/store.js';
import {assertFoundationApproval,foundationRuleFields,restoreFoundationRule} from '../packages/experience-core/foundation.js';
import {foundationDecisionSummary,createFoundationDraft} from '../apps/designer/foundation-review.js';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};

const files=[{path:'components/Button.astro',content:`---\ninterface Props {variant: 'primary' | 'quiet'; size?: "small" | "large"}\n---\n<button class="control"><slot /></button><style>@media (max-width:600px){button{width:100%}}</style>`},
 {path:'components/Toolbar.astro',content:"---\nimport Button from './Button.astro';\n---\n<Button />"},
 {path:'admin/components/Button.astro',content:'<button>Other</button>'},
 {path:'theme.css',content:':root{--primitive:#fff;--surface:var(--primitive, #000)} .dark{--surface:#222}'}];

test('component graph, source API and captured region remain observations with explicit missing state coverage',async()=>{
 const snapshot={files,truncated:false},foundation=await runHandler('foundationExtractor',{repo:'fixture',sourceSnapshot:snapshot});
 const region={selector:'.control',source:{file:files[0].path,anchor:'control',fileHash:evidenceHash(files[0].content)},verification:'unique-visible-selector-and-shared-source-anchor'};
 const capture={states:[{stateId:'control',configurationId:'desktop',region,reached:true,screenshot:'before/control.png'},{stateId:'control',configurationId:'mobile',region:{...region,source:{...region.source,fileHash:'stale'}},reached:true,screenshot:'before/mobile.png'}]};
 const extraction=buildDesignSystemExtraction({snapshot,foundation,capture,phase:'before'});
 const button=extraction.components[0],toolbar=extraction.components[1];
 assert.equal(button.variantCandidates.length,2);assert.equal(button.slots[0].name,'default');assert.equal(button.responsiveRules[0].condition,'(max-width:600px)');
 assert.deepEqual(toolbar.composition.map(item=>item.source),[files[0].path]);assert.deepEqual(extraction.components[2].consumers,[]);
 assert.deepEqual(button.renderedCoverage.references.map(ref=>ref.status),['region-captured','needs-evidence']);assert.equal(button.renderedCoverage.status,'needs-evidence');
 const materialized=observedFoundationFrom(null,[{...foundation,skill:{id:'foundation-extractor'}}],extraction);
 assert.deepEqual(materialized.tokens.find(t=>t.name==='--surface').evidence.details.aliases,['--primitive']);
 assert.equal(materialized.components[0].evidence.details.variantCandidates.length,2);assert.deepEqual(materialized.components[0].states,[],'source terms are not approved states');
 assert.equal(materialized.components[0].evidence.provenance.captureHash,evidenceHash(capture));
 assert.equal(extraction.components[2].renderedCoverage.references.length,0);
});

test('truncated scans do not claim complete inventory',async()=>{
 const sourceSnapshot={files,truncated:true};
 for(const handler of ['foundationExtractor','componentInventory'])assert.equal((await runHandler(handler,{repo:'fixture',sourceSnapshot})).status,'needs-evidence');
});

test('item decisions need reasons and cannot strip or alter captured provenance through the approval API',async t=>{
 const root=await mkdtemp(join(tmpdir(),'foundation-governance-'));t.after(()=>rm(root,{recursive:true,force:true}));const repo=join(root,'repo');await mkdir(join(repo,'components'),{recursive:true});
 await writeFile(join(repo,'components/Button.astro'),files[0].content);await writeFile(join(repo,'theme.css'),files[3].content);
 const spec=structuredClone(sample);delete spec.designFoundation;
 const run=await createRun({spec,url:'http://localhost:4321',outputRoot:root,id:'governance'});
 await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png',dom:{title:'Fixture',h1:[],visibleCopy:[]}}}});
 await extractFoundationInventory({directory:run.directory,repo});
 const stored=await loadRun(run.directory),foundation=structuredClone(stored.spec.designFoundation);
 const entries=[...foundation.tokens,...foundation.components,...foundation.brand.assets];
 for(const item of entries)item.status='approved';
 const input={schemaVersion:'0.1',foundationVersion:'1.0.0',reviewer:{type:'human',name:'Fixture'},reason:'Test only',foundation};
 assert.throws(()=>assertFoundationApproval(input),/decision and reason/);assert.equal(foundationDecisionSummary(foundation).pending,entries.length);
 for(const item of entries)item.decision={action:'approved',reason:'Verified fixture evidence'};
 for(const stripEvidence of [false,true]){
  const duplicate=structuredClone(input),copy=structuredClone(duplicate.foundation.tokens[0]);copy.value='bypass';if(stripEvidence)delete copy.evidence;duplicate.foundation.tokens.push(copy);
  await assert.rejects(saveFoundationApproval(run.directory,duplicate),/exactly once/);
 }
 const overwritten=structuredClone(input);overwritten.foundation.tokens[1]=structuredClone(overwritten.foundation.tokens[0]);await assert.rejects(saveFoundationApproval(run.directory,overwritten),/exactly once/);
 const omitted=structuredClone(input);omitted.foundation.tokens.pop();await assert.rejects(saveFoundationApproval(run.directory,omitted),/exactly once/);
 const stripped=structuredClone(input);delete stripped.foundation.tokens[0].evidence;
 await assert.rejects(saveFoundationApproval(run.directory,stripped),/evidence must be retained/);
 const altered=structuredClone(input);altered.foundation.tokens[0].evidence.details.value='forged';
 await assert.rejects(saveFoundationApproval(run.directory,altered),/evidence must be retained/);
 const replaced=structuredClone(input);replaced.foundation.tokens[0].decision.action='replace';
 await assert.rejects(saveFoundationApproval(run.directory,replaced),/preserve previous values/);
 for(const [field,value]of [['value','changed'],['themes',{dark:'#000'}],['variants',['new']],['category','motion'],['usage','Changed usage']]){
  const changed=structuredClone(input);changed.foundation.tokens[0][field]=value;await assert.rejects(saveFoundationApproval(run.directory,changed),/replacement decision/);
 }
 const previous=foundationRuleFields(input.foundation.tokens[0]);assert.equal(previous.category,input.foundation.tokens[0].category);assert.equal(previous.name,input.foundation.tokens[0].name);assert.equal(previous.evidence,undefined);
 const restored={...input.foundation.tokens[0],usage:'Added during replacement'};restoreFoundationRule(restored,previous);assert.equal(restored.usage,undefined);assert.ok(restored.evidence);
 const changedAsset={name:'logo',source:'logo.svg',description:'Old',role:'logo',status:'observed',evidence:{status:'observed'}};assert.deepEqual(foundationRuleFields(changedAsset),{description:'Old',name:'logo',role:'logo',source:'logo.svg'});

 const replacement=structuredClone(input);replacement.foundation.tokens[0].decision={action:'replace',reason:'Fixture theme replacement',previous};replacement.foundation.tokens[0].themes={light:'#fff',dark:'#000'};
 await saveFoundationApproval(run.directory,replacement);
 const saved=await loadRun(run.directory);assert.equal(saved.spec.designFoundation.tokens[0].evidence.status,'observed');assert.equal(saved.manifest.judgment,null);
 await writeFile(join(repo,'theme.css'),':root{--changed:red}');await assert.rejects(extractFoundationInventory({directory:run.directory,repo}),/no longer matches Foundation capture/);
 assert.deepEqual((await loadRun(run.directory)).spec.designFoundation,saved.spec.designFoundation);
});

import {sourceFiles} from '../packages/skill-core/scan.js';
import {cssDeclarations} from '../packages/skill-core/css-tokens.js';
test('offline JSON template retains aliases, media/motion contexts and separate source coordinates without executing its loader',async t=>{
 const template='<html><style>:root{--primitive:#fff;--semantic:var(--primitive,#000);--duration:160ms}@media(max-width:600px){:root{--duration:0ms}}</style><body><button>Ready</button></body></html>';
 const file={path:'kit.html',content:`<script>throw Error('never execute')</script>\n<script type="__bundler/template">${JSON.stringify(template)}</script>`};
 const parsed=cssDeclarations(file);assert.equal(parsed.error,null);assert.equal(parsed.declarations.length,4);assert.equal(parsed.declarations[0].line,2);assert.equal(parsed.declarations[0].embedded.line,1);
 const result=await runHandler('foundationExtractor',{repo:'fixture',sourceSnapshot:{files:[file],truncated:false}});
 const tokens=result.proposedUpdates[0].tokens;assert.deepEqual(tokens.find(t=>t.name==='--semantic').aliases,['--primitive']);assert.ok(tokens.find(t=>t.name==='--duration').declarations.some(d=>d.contexts.some(c=>c.includes('max-width'))));assert.equal(result.proposedUpdates[0].components[0].kind,'inline-document');
 assert.ok(cssDeclarations({path:'bad.html',content:'<script type="__bundler/template">not JSON</script>'}).error);
 const root=await mkdtemp(join(tmpdir(),'offline-limit-'));t.after(()=>rm(root,{recursive:true,force:true}));await writeFile(join(root,'kit.html'),file.content+' '.repeat(600000));
 assert.equal((await sourceFiles(root)).truncated,false);const limited=await sourceFiles(root,{maxBytes:512000});assert.equal(limited.truncated,true);assert.equal(limited.omissions[0].reason,'file-size-limit');
 assert.equal((await sourceFiles(root,{maxTotalBytes:100})).truncated,true);
});

import {embeddedAssetInventory} from '../packages/skill-core/source-content.js';
test('offline brand inventory exports only metadata and keeps license and usage unverified',()=>{
 const file={path:'kit.html',content:'<script type="__bundler/manifest">{"a":{"mime":"image/png","data":"secret-blob","compressed":true}}</script><script type="__bundler/ext_resources">[{"id":"brand_logo","uuid":"a"}]</script>'};
 const result=embeddedAssetInventory(file);assert.equal(result.assets[0].name,'brand_logo');assert.equal(result.assets[0].licenseStatus,'unknown');assert.equal(result.assets[0].status,'observed');assert.equal(result.assets[0].data,undefined);assert.equal(JSON.stringify(result).includes('secret-blob'),false);
 assert.equal(embeddedAssetInventory({...file,content:'<script type="__bundler/manifest">bad</script>'}).errors.length,1);
});

test('mixed legacy and observed collections preserve unchanged legacy rules but require replacement for every modification',async t=>{
 const root=await mkdtemp(join(tmpdir(),'foundation-mixed-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const spec=structuredClone(sample);spec.designFoundation={status:'observed',brand:{principles:[],voice:[],assets:[]},patterns:[],components:[],tokens:[
 {name:'legacy',category:'color',value:'#fff',source:'legacy.css',status:'approved'},
 {name:'current',category:'color',value:'#000',source:'current.css',status:'observed',evidence:{schemaVersion:'0.1',status:'observed',details:{name:'current',source:'current.css'}}}]};
 const run=await createRun({spec,url:'http://localhost:4321',outputRoot:root,id:'mixed'});await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png',dom:{}}}});
 const input={schemaVersion:'0.1',foundationVersion:'1.0.0',reviewer:{type:'human',name:'Fixture'},reason:'Fixture only',foundation:structuredClone(spec.designFoundation)};
 input.foundation.tokens[1].status='approved';input.foundation.tokens[1].decision={action:'approved',reason:'Fixture evidence'};
 const changed=structuredClone(input);changed.foundation.tokens[0].value='#f00';await assert.rejects(saveFoundationApproval(run.directory,changed),/replacement decision/);
 changed.foundation.tokens[0].status='deprecated';changed.foundation.tokens[0].decision={action:'deprecated',reason:'Fixture'};await assert.rejects(saveFoundationApproval(run.directory,changed),/replacement decision/);
 await saveFoundationApproval(run.directory,input);assert.equal((await loadRun(run.directory)).manifest.judgment,null);
});

test('a new version starts decisions from current rules while historical replacement evidence stays immutable',async t=>{
 const root=await mkdtemp(join(tmpdir(),'foundation-version-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const spec=structuredClone(sample),original={name:'surface',category:'color',value:'#fff',source:'theme.css'};
 spec.designFoundation={status:'approved',brand:{principles:[],voice:[],assets:[]},patterns:[],components:[],tokens:[{...original,value:'#000',status:'approved',evidence:{schemaVersion:'0.1',status:'observed',details:original},decision:{action:'replace',reason:'Previous version',previous:original}}]};
 const historical=JSON.stringify(spec.designFoundation);assert.equal(createFoundationDraft(spec.designFoundation).tokens[0].decision.previous.value,'#fff');
 const draft=createFoundationDraft(spec.designFoundation,{preserveDecisions:false}),item=draft.tokens[0];assert.equal(item.value,'#000');assert.equal(item.status,'observed');assert.equal(item.decision,undefined);
 item.decision={action:'replace',reason:'New draft',previous:foundationRuleFields(item)};item.value='#f00';restoreFoundationRule(item,item.decision.previous);item.status='approved';item.decision.action='approved';
 assert.equal(item.value,'#000');assert.equal(JSON.stringify(spec.designFoundation),historical);
 const run=await createRun({spec,url:'http://localhost:4321',outputRoot:root,id:'next-version'});await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png',dom:{}}}});
 await saveFoundationApproval(run.directory,{schemaVersion:'0.1',foundationVersion:'2.0.0',reviewer:{type:'human',name:'Fixture'},reason:'Fixture next version',foundation:draft});
 assert.equal((await loadRun(run.directory)).spec.designFoundation.tokens[0].value,'#000');assert.equal(JSON.stringify(spec.designFoundation),historical);
});

test('brand asset candidates exclude verification outputs without excluding application asset scripts',async()=>{const sourceSnapshot={truncated:false,files:[{path:'scripts/verify-ui.mjs',content:'const shot = "normal-${width}.png"; const expected = "product-logo.svg";'}, {path:'tests/render.test.tsx',content:'const shot="fixture.png";'}, {path:'scripts/asset-map.ts',content:'export const logo="product-logo.svg";'}, {path:'src/components/Hero.astro',content:'<img src="/hero.webp" />'}]};const run={manifest:{captures:{before:{viewports:{desktop:{screenshot:'before/test.png',dom:{title:'Fixture',h1:[],visibleCopy:[]}}}}}}};const result=await runHandler('brandFoundationExtractor',{repo:'/fixture',sourceSnapshot,run,spec:structuredClone(sample)});const assets=result.proposedUpdates[0].assets;assert.deepEqual(assets.map(item=>item.path).sort(),['/hero.webp','product-logo.svg']);assert.deepEqual(assets.find(item=>item.path==='product-logo.svg').sources,['scripts/asset-map.ts']);assert.deepEqual(result.evidence[0].excludedAssetSources,['scripts/verify-ui.mjs','tests/render.test.tsx']);});

test('scoped approval retains deferred evidence without approving or deprecating it',async t=>{
 const root=await mkdtemp(join(tmpdir(),'foundation-scoped-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const spec=structuredClone(sample);spec.designFoundation={status:'observed',brand:{principles:[],voice:[],assets:[]},patterns:[],components:[],tokens:['approved-rule','uncertain-rule'].map(name=>({name,category:'color',value:'#fff',source:'theme.css',status:'observed',evidence:{schemaVersion:'0.1',status:'observed',details:{name}}}))};
 const run=await createRun({spec,url:'http://localhost',outputRoot:root,id:'scoped'});await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png',dom:{}}}});
 const input={schemaVersion:'0.1',foundationVersion:'1.0.0',reviewer:{type:'human',name:'Fixture'},reason:'Only the confirmed rule is binding',foundation:structuredClone(spec.designFoundation)};
 input.foundation.tokens[0].status='approved';input.foundation.tokens[0].decision={action:'approved',reason:'Explicitly confirmed'};
 input.foundation.tokens[1].decision={action:'deferred',reason:'Uncertain and outside current scope'};
 assert.deepEqual(foundationDecisionSummary(input.foundation),{total:2,approved:1,deprecated:0,deferred:1,pending:0});
 const bad=structuredClone(input);bad.foundation.tokens[1].status='approved';assert.throws(()=>assertFoundationApproval(bad),/remain observed/);
 const edited=structuredClone(input);edited.foundation.tokens[1].value='#000';await assert.rejects(saveFoundationApproval(run.directory,edited),/replacement decision/);
 await saveFoundationApproval(run.directory,input);const saved=await loadRun(run.directory);
 assert.equal(saved.spec.designFoundation.tokens[1].status,'observed');assert.deepEqual(saved.spec.designFoundation.tokens[1].evidence,spec.designFoundation.tokens[1].evidence);assert.equal(saved.manifest.judgment,null);
});
