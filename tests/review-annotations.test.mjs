import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PNG} from 'pngjs';
import {buildReviewAnnotationArtifacts,assertReviewAnnotationArtifacts} from '../packages/harness-core/review-annotations.js';
import {verificationHash as hash} from '../packages/harness-core/verification.js';
async function fixture(t) {
 const directory=await mkdtemp(join(tmpdir(),'hh-annotations-'));t.after(()=>rm(directory,{recursive:true,force:true}));await mkdir(join(directory,'before'));
 const original=PNG.sync.write(new PNG({width:100,height:80,fill:true}));await writeFile(join(directory,'before/desktop.png'),original);
 const manifest={captures:{before:{viewports:{desktop:{screenshot:'before/desktop.png'}},verificationOriginalHashes:{'before/desktop.png':hash(original)}}}};
 const review={screenshotRefs:['before/desktop.png'],findings:[{id:'F1',title:'Button alignment',observation:'Button has inconsistent edge.'}],annotations:[{id:'A1',findingId:'F1',screenshot:'before/desktop.png',label:'Misaligned button',box:{x:.1,y:.2,width:.3,height:.4}}],structureChecks:[{screenshot:'before/desktop.png',dimension:'alignment',status:'fail',observed:'10px edge offset',expected:'Shared container edge',basis:'Adopted product layout',method:'DOM and original'}]};review.findings[0].screenshotRefs=review.screenshotRefs;
 return {directory,manifest,review,original};
}
test('deterministic self-contained original-size SVG includes boxes and evidence legend',async t=>{
 const f=await fixture(t),artifacts=await buildReviewAnnotationArtifacts(f);assert.equal(artifacts.length,1);const svg=await readFile(join(f.directory,artifacts[0].path),'utf8');
 assert.match(svg,/<image x="0" y="0" width="100" height="80"/);assert.ok(svg.includes(f.original.toString('base64')));assert.match(svg,/<rect x="10" y="16" width="30" height="32"/);for(const text of ['1. Misaligned button','Observed: 10px edge offset','Expected: Shared container edge','Basis: Adopted product layout'])assert.ok(svg.includes(text));
 assert.deepEqual(await buildReviewAnnotationArtifacts(f),artifacts);await assertReviewAnnotationArtifacts({...f,artifacts});assert.deepEqual(await readFile(join(f.directory,'before/desktop.png')),f.original);
});
test('escapes hostile labels and wraps long multilingual text without scripts',async t=>{
 const f=await fixture(t);f.review.annotations[0].label='<script>alert("x")</script> & 中文'.repeat(20);const [a]=await buildReviewAnnotationArtifacts(f),svg=await readFile(join(f.directory,a.path),'utf8');assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'));assert.ok(svg.includes('&amp;'));assert.ok(svg.includes('中文'));assert.ok((svg.match(/<text /g)||[]).length>10);
});
test('missing, tampered, duplicate and replaced output are rejected',async t=>{
 const f=await fixture(t),artifacts=await buildReviewAnnotationArtifacts(f);await assert.rejects(assertReviewAnnotationArtifacts({...f,artifacts:[]}),/Missing/);await assert.rejects(assertReviewAnnotationArtifacts({...f,artifacts:[...artifacts,...artifacts]}),/unexpected/);
 await writeFile(join(f.directory,artifacts[0].path),'not an image');await assert.rejects(assertReviewAnnotationArtifacts({...f,artifacts}),/changed/);await assert.rejects(buildReviewAnnotationArtifacts(f),/changed/);await rm(join(f.directory,artifacts[0].path));await assert.rejects(assertReviewAnnotationArtifacts({...f,artifacts}),/ENOENT/);
});
test('source and review changes invalidate artifacts; history may skip current original only',async t=>{
 const f=await fixture(t),artifacts=await buildReviewAnnotationArtifacts(f);f.review.annotations[0].box.x=.2;await assert.rejects(assertReviewAnnotationArtifacts({...f,artifacts}),/binding changed/);f.review.annotations[0].box.x=.1;
 await writeFile(join(f.directory,'before/desktop.png'),PNG.sync.write(new PNG({width:120,height:80,fill:true})));await assert.rejects(assertReviewAnnotationArtifacts({...f,artifacts}),/capture-time/);await assertReviewAnnotationArtifacts({...f,artifacts,checkOriginals:false});await writeFile(join(f.directory,artifacts[0].path),'tampered');await assert.rejects(assertReviewAnnotationArtifacts({...f,artifacts,checkOriginals:false}),/changed/);
});
test('no findings needs no image and no output is fabricated',async t=>{
 const f=await fixture(t);f.review.annotations=[];f.review.findings=[];assert.deepEqual(await buildReviewAnnotationArtifacts(f),[]);await assertReviewAnnotationArtifacts({...f,artifacts:[]});
});
test('rejects invalid boxes, unknown references and malformed PNG',async t=>{
 const f=await fixture(t);f.review.annotations[0].box.width=2;await assert.rejects(buildReviewAnnotationArtifacts(f),/bounds/);f.review.annotations[0].box.width=.3;f.review.annotations[0].screenshot='../outside.png';await assert.rejects(buildReviewAnnotationArtifacts(f),/inspected/);f.review.annotations[0].screenshot='before/desktop.png';delete f.manifest.captures.before.verificationOriginalHashes;await writeFile(join(f.directory,'before/desktop.png'),'not png');await assert.rejects(buildReviewAnnotationArtifacts(f),/PNG/);
});
test('source and output directory symlinks are refused',async t=>{
 const f=await fixture(t);await mkdir(join(f.directory,'elsewhere'));try{await symlink(join(f.directory,'elsewhere'),join(f.directory,'reviews'),'dir');}catch(error){if(error.code==='EPERM'){t.skip('OS does not grant symlink creation');return;}throw error;}await assert.rejects(buildReviewAnnotationArtifacts(f),/symlinks/);await rm(join(f.directory,'reviews'));await writeFile(join(f.directory,'source.png'),f.original);await rm(join(f.directory,'before/desktop.png'));await symlink(join(f.directory,'source.png'),join(f.directory,'before/desktop.png'),'file');await assert.rejects(buildReviewAnnotationArtifacts(f),/symlinks/);
});
test('absent historical capture hash is not rewritten as capture-time binding',async t=>{
 const f=await fixture(t);delete f.manifest.captures.before.verificationOriginalHashes;const [a]=await buildReviewAnnotationArtifacts(f);assert.equal(a.originalSha256,hash(f.original));assert.equal(f.manifest.captures.before.verificationOriginalHashes,undefined);
});
test('output-file symlinks cannot be followed or overwritten',async t=>{
 const f=await fixture(t),artifacts=await buildReviewAnnotationArtifacts(f),file=join(f.directory,artifacts[0].path);await rm(file);await writeFile(join(f.directory,'outside.svg'),'untouched');try{await symlink(join(f.directory,'outside.svg'),file,'file');}catch(error){if(error.code==='EPERM'){t.skip('OS does not grant symlink creation');return;}throw error;}await assert.rejects(buildReviewAnnotationArtifacts(f),/symlinks/);await assert.rejects(assertReviewAnnotationArtifacts({...f,artifacts}),/symlinks/);assert.equal(await readFile(join(f.directory,'outside.svg'),'utf8'),'untouched');
});
test('tiny original keeps its numbered marker within original bounds',async t=>{
 const f=await fixture(t);await writeFile(join(f.directory,'before/desktop.png'),PNG.sync.write(new PNG({width:1,height:1,fill:true})));delete f.manifest.captures.before.verificationOriginalHashes;const [a]=await buildReviewAnnotationArtifacts(f);const svg=await readFile(join(f.directory,a.path),'utf8');assert.match(svg,/<rect x="0" y="0" width="1" height="1" fill="#b91c1c"/);assert.match(svg,/font-size="0.5" fill="white"/);
});
