import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm,readdir,mkdir,symlink,rename} from 'node:fs/promises';import {join,dirname} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
import {loadDesignGuidance,stageDesignGuidance,designGuidancePrompt,designGuidanceProfile} from '../packages/skill-core/design-guidance.js';
const vendor=new URL('../skills/vendor/',import.meta.url),hash=value=>createHash('sha256').update(value).digest('hex');
async function temporary(t){const directory=await mkdtemp(join(tmpdir(),'design-guidance-'));t.after(()=>rm(directory,{recursive:true,force:true}));return directory;}
async function copyVendors(directory){for(const id of ['taste','impeccable','taste-v2'])await cp(new URL(id+'/',vendor),join(directory,id),{recursive:true});}
test('complete Taste and Impeccable packages preserve all original resources and license notices',async()=>{
 const bundle=await loadDesignGuidance();assert.deepEqual(bundle.packs.map(pack=>[pack.metadata.id,pack.documents.length]),[['taste',46],['impeccable',65],['taste-v2',41]]);
 const taste=bundle.packs[0],impeccable=bundle.packs[1];assert.equal(taste.documents.filter(file=>/\/SKILL.md$/.test(file.path)).length,14);assert.ok(taste.documents.some(file=>file.path.endsWith('/scripts/inspect.mjs')));assert.ok(taste.documents.some(file=>file.path.endsWith('/library/directions.json')));
 assert.ok(impeccable.documents.some(file=>file.path==='upstream/NOTICE.md'));assert.ok(impeccable.documents.some(file=>file.path.endsWith('/reference/animate.md')));assert.ok(impeccable.documents.some(file=>file.path.endsWith('/reference/layout.md')));
 for(const pack of bundle.packs)for(const file of pack.documents){const content=(await readFile(new URL(pack.metadata.id+'/'+file.path,vendor),'utf8')).replaceAll('\r\n','\n');assert.equal(file.content,content);assert.equal(file.sha256,hash(content));}
 assert.equal(taste.metadata.license,'MIT');assert.equal(impeccable.metadata.license,'Apache-2.0');
});
test('default existing-product review routes full audit/critique without public-page house style or edit playbooks',async()=>{
 const review=await loadDesignGuidance('review');assert.deepEqual(review.packs[0].metadata.readFirst,['ADAPTER.md']);assert.deepEqual(review.packs[2].metadata.readFirst,['ADAPTER.md','upstream/skills/taste-skill/SKILL.md','upstream/skills/taste-skill/references/app-screens.md']);
 const first=review.packs[1].metadata.readFirst;assert.ok(first.some(path=>path.endsWith('audit.md')));assert.ok(first.some(path=>path.endsWith('critique.md')));assert.ok(!first.some(path=>path.endsWith('polish.md')));assert.match(review.metadata.availability,/not independently proven/);
});
test('explicit public-page, layout/animate and legacy dial profiles route without rewriting upstream skill defaults',async()=>{
 const publicPage=await loadDesignGuidance('implementation',{taste:'public-page',intent:'layout'});assert.ok(publicPage.packs[2].metadata.readFirst.some(path=>path.endsWith('taste-skill/SKILL.md')));assert.ok(publicPage.packs[1].metadata.readFirst.some(path=>path.endsWith('layout.md')));
 const dial=await loadDesignGuidance('implementation',{taste:'dials-v1',intent:'animate',dials:{DESIGN_VARIANCE:3,MOTION_INTENSITY:2,VISUAL_DENSITY:7}});assert.ok(dial.packs[0].metadata.readFirst.some(path=>path.endsWith('taste-skill-v1/SKILL.md')));assert.ok(dial.packs[1].metadata.readFirst.some(path=>path.endsWith('animate.md')));assert.equal(dial.metadata.profile.dials.VISUAL_DENSITY,7);
 assert.match(dial.packs[0].documents.find(file=>file.path.endsWith('taste-skill-v1/SKILL.md')).content,/DESIGN_VARIANCE: 8/);assert.notEqual(dial.metadata.bundleHash,publicPage.metadata.bundleHash);
 assert.throws(()=>designGuidanceProfile({taste:'public-page',dials:{DESIGN_VARIANCE:3}}),/v2 has no dials/);
 for(const value of [null,[],{taste:'../outside'},{intent:'publish'},{taste:'dials-v1',dials:{MOTION_INTENSITY:11}},{taste:'dials-v1',dials:{VISUAL_DENSITY:'3'}},{taste:'dials-v1',dials:{unknown:1}},{command:'node'}])assert.throws(()=>designGuidanceProfile(value));
});
test('atomic snapshots retain complete sources, recover concurrent publication and reject changed evidence',async t=>{
 const directory=await temporary(t),bundles=await Promise.all(Array.from({length:4},()=>stageDesignGuidance(directory,'review'))),bundle=bundles[0];
 for(const current of bundles)assert.deepEqual(current.metadata,bundle.metadata);assert.deepEqual(await readdir(join(directory,'design-guidance/v1')),[bundle.metadata.bundleHash]);
 for(const pack of bundle.packs)for(const file of pack.documents)assert.equal(await readFile(join(directory,bundle.metadata.reference,pack.metadata.id,file.path),'utf8'),file.content);
 const prompt=designGuidancePrompt(bundle,directory);assert.match(prompt,/read-only/);assert.match(prompt,/not auto-executed/);assert.ok(prompt.includes(bundle.metadata.bundleHash));
 await writeFile(join(directory,bundle.metadata.reference,'taste/upstream/skills/taste-skill/scripts/inspect.mjs'),'changed');await assert.rejects(stageDesignGuidance(directory,'review'),/snapshot changed/);
});
test('modified vendor source, manifest inventories and external symlinks fail before staging',async t=>{
 const directory=await temporary(t);await copyVendors(directory);const path=join(directory,'taste/upstream/skills/redesign-skill/SKILL.md');const original=await readFile(path);
 await writeFile(path,'changed');await assert.rejects(loadDesignGuidance('review',{},directory),/hash mismatch/);await writeFile(path,original);
 const sourceFile=join(directory,'taste/source.json'),source=JSON.parse(await readFile(sourceFile));source.files[0].path='../outside';await writeFile(sourceFile,JSON.stringify(source));await assert.rejects(loadDesignGuidance('review',{},directory),/source inventory/);
 await cp(new URL('taste/source.json',vendor),sourceFile);
 if(process.platform==='win32'){
  const outside=join(directory,'external');await rename(dirname(path),outside);await symlink(outside,dirname(path),'junction');
 }else{
  const outside=join(directory,'external.txt');await writeFile(outside,original);await rm(path);await symlink(outside,path);
 }
 await assert.rejects(loadDesignGuidance('review',{},directory),/outside its bundle/);
});
test('adapter and profile changes alter provenance; text checkout line endings do not',async t=>{
 const directory=await temporary(t);await copyVendors(directory);const before=await loadDesignGuidance('review',{},directory);
 for(const pack of before.packs){for(const file of pack.documents){await writeFile(join(directory,pack.metadata.id,file.path),file.content.replaceAll('\n','\r\n'));}const path=join(directory,pack.metadata.id,'source.json');await writeFile(path,(await readFile(path,'utf8')).replaceAll('\n','\r\n'));}
 assert.equal((await loadDesignGuidance('review',{},directory)).metadata.bundleHash,before.metadata.bundleHash);
 await writeFile(join(directory,'taste/ADAPTER.md'),before.packs[0].adapter+'\nTest routing clarification.\n');assert.notEqual((await loadDesignGuidance('review',{},directory)).metadata.bundleHash,before.metadata.bundleHash);
 await assert.rejects(loadDesignGuidance('unknown'),/Unknown/);
});
test('interrupted snapshots remain intact and cannot hide missing published files',async t=>{
 const directory=await temporary(t),bundle=await loadDesignGuidance(),pending=join(directory,'design-guidance/v1','.pending-'+bundle.metadata.bundleHash+'-interrupted');await mkdir(pending,{recursive:true});await writeFile(join(pending,'bundle.json'),'partial');
 const staged=await stageDesignGuidance(directory,'review');assert.equal(await readFile(join(pending,'bundle.json'),'utf8'),'partial');await rm(join(directory,staged.metadata.reference,'impeccable/upstream/LICENSE'));await assert.rejects(stageDesignGuidance(directory,'review'),/snapshot changed.*missing/);
});

test('vendor templates and tool scripts cannot become observed application Foundation sources',async t=>{
 const root=await temporary(t);await writeFile(join(root,'styles.css'),':root{--brand:#009689}');
 for(const id of ['taste','impeccable','taste-v2']){const directory=join(root,'skills/vendor',id,'upstream');await mkdir(directory,{recursive:true});await writeFile(join(directory,'base.css'),':root{--brand:#ff0000}');await writeFile(join(directory,'tool.js'),'export const vendorScript=true;');}
 await mkdir(join(root,'app'));await writeFile(join(root,'app/vendor-component.css'),'.component{color:var(--brand)}');const {sourceFiles}=await import('../packages/skill-core/scan.js');const files=(await sourceFiles(root)).files.map(file=>file.path);
 assert.deepEqual(files.sort(),['app/vendor-component.css','styles.css']);
});

test('App Screen selection survives staging and review with distinct immutable provenance',async t=>{
 const directory=await temporary(t);
 const app=await stageDesignGuidance(directory,'review',{taste:'app-screen'});
 const existing=await stageDesignGuidance(directory,'review');
 const page=await stageDesignGuidance(directory,'review',{taste:'public-page'});
 assert.notEqual(app.metadata.bundleHash,existing.metadata.bundleHash);assert.notEqual(app.metadata.bundleHash,page.metadata.bundleHash);
 const current=app.packs.find(pack=>pack.metadata.id==='taste-v2');
 assert.equal(current.metadata.revision,'6010f91a9935f1c167dfc500fb1a475681892e6b');
 assert.equal(current.documents.filter(file=>file.path.startsWith('upstream/skills/taste-skill/')).length,38);
 for(const path of current.metadata.readFirst)assert.ok((await readFile(join(directory,app.metadata.reference,'taste-v2',path),'utf8')).length);
 assert.ok(!page.packs[2].metadata.readFirst.some(path=>path.endsWith('app-screens.md')));
 const prompt=designGuidancePrompt(app,directory).replaceAll('\\','/');assert.ok(prompt.includes('taste-v2/upstream/skills/taste-skill/references/app-screens.md'));assert.match(prompt,/public-page run does not apply/);
 await writeFile(join(directory,app.metadata.reference,'taste-v2/upstream/skills/taste-skill/references/app-screens.md'),'abridged');
 await assert.rejects(stageDesignGuidance(directory,'review',{taste:'app-screen'}),/snapshot changed/);
});

test('project UI profile is preserved in review and implementation snapshots and tampering is rejected',async t=>{
 const directory=await temporary(t);
 const original=(await readFile(new URL('../skills/happyhands-ui/SKILL.md',import.meta.url),'utf8')).replaceAll('\r\n','\n');
 for(const mode of ['review','implementation']){
  const bundle=await stageDesignGuidance(directory,mode);
  const path=join(directory,bundle.metadata.reference,'happyhands-ui/SKILL.md');
  assert.equal(await readFile(path,'utf8'),original);
  assert.equal(bundle.metadata.uiRulesHash,hash(original));
  assert.ok(designGuidancePrompt(bundle,directory).includes(path));
  assert.match(designGuidancePrompt(bundle,directory),/does NOT establish target ownership or adoption/);
  assert.match(designGuidancePrompt(bundle,directory),/do not claim it adopted them/);
  await writeFile(path,'truncated');
  await assert.rejects(stageDesignGuidance(directory,mode),/snapshot changed/);
 }
});
