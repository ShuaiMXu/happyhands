import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {createRun,loadRun} from '../packages/harness-core/store.js';
import {designSourceContext,stageBaselineProjectSources} from '../packages/harness-core/design-sources.js';
import {readSessionFile} from '../packages/harness-core/api-models.js';
import {baselineSourceHash} from '../packages/harness-core/baseline-diagnosis-record.js';
import {searchResources,selectResource} from '../packages/harness-core/reference-resources.js';
const content='# Reference\nKeep field input on a recoverable error.\n',hash=value=>createHash('sha256').update(value).digest('hex');
function server({corrupt=false,foreign=false}={}){const calls=[];return {calls,fetcher:async url=>{
 calls.push(url);const path=new URL(url).pathname;
 const data={
  '/design-archive/index.json':JSON.stringify([{slug:'example',name:'Example form',north_star:'Form recovery',sha256:hash(content)}]),
  '/design-how/catalog.json':JSON.stringify({systems:[{id:'lime',name:'Lime',summary:'Forms',documents:[{path:'index.md',title:'Overview',kind:'overview'}]}]}),
  '/r/index.json':JSON.stringify({items:[{name:'field',title:'Field',registryDependencies:[foreign?'https://evil.invalid/code':'https://happyhands.cc/r/field.json']}]}),
  '/design-how/manifest.json':JSON.stringify([{path:'design-how/lime/index.md',sha256:hash(content)}]),
  '/design-archive/example/design.md':corrupt?'changed':content,
  '/design-how/lime/index.md':content
 };
 return new Response(data[path]||'missing',{status:Object.hasOwn(data,path)?200:404});
 }};}
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'hh-resource-test-'));t.after(()=>rm(root,{recursive:true,force:true}));const {directory}=await createRun({spec:structuredClone(sample),url:'http://127.0.0.1:3000',outputRoot:root,id:'resource1'});return {root,directory};}
test('resource search gets only indexes, then selection snapshots exactly the chosen full document in the existing run',async t=>{
 const s=server(),f=await fixture(t),results=await searchResources('form',{fetcher:s.fetcher});
 assert.equal(results[0].id,'design-md:example');assert.equal(s.calls.length,4);assert.ok(!s.calls.some(url=>url.endsWith('.md')));
 const before=baselineSourceHash(await loadRun(f.directory));
 const record=await selectResource({directory:f.directory,id:'design-md:example',fetcher:s.fetcher});
 const run=await loadRun(f.directory);assert.equal(run.manifest.selectedReferences[0].path,record.path);assert.notEqual(baselineSourceHash(run),before);
 assert.equal((await designSourceContext(run))[0].content,content);assert.equal(record.authority,'reference-data-only');
 await writeFile(join(f.directory,record.path),'tampered');await assert.rejects(loadRun(f.directory),/snapshot changed/);
});
test('selection rejects source drift, unknown system documents and foreign registry fetches',async t=>{
 const f=await fixture(t),corrupt=server({corrupt:true}),foreign=server({foreign:true});
 await assert.rejects(selectResource({directory:f.directory,id:'design-md:example',fetcher:corrupt.fetcher}),/changed since/);
 await assert.rejects(selectResource({directory:f.directory,id:'system:lime',document:'../secret',fetcher:foreign.fetcher}),/actual document/);
 await assert.rejects(selectResource({directory:f.directory,id:'component:field',fetcher:foreign.fetcher}),/official website/);
 assert.equal((await loadRun(f.directory)).manifest.selectedReferences,undefined);
});
test('local selection is copied, selection freezes at diagnosis, and changed plan bindings fail closed',async t=>{
 const f=await fixture(t),file=join(f.root,'Design.md');await writeFile(file,content);
 const record=await selectResource({directory:f.directory,file});await writeFile(file,'later source');
 assert.equal((await designSourceContext(await loadRun(f.directory)))[0].content,content);
 const path=join(f.directory,'run.json'),manifest=JSON.parse(await readFile(path));manifest.diagnosis={path:'diagnosis.json'};await writeFile(path,JSON.stringify(manifest));
 await assert.rejects(selectResource({directory:f.directory,file}),/frozen after diagnosis/);
 manifest.plan={designSourcesDigest:'0'.repeat(64)};await writeFile(path,JSON.stringify(manifest));await assert.rejects(loadRun(f.directory),/changed after planning/);
 assert.ok(record.source.endsWith('Design.md'));
});
test('an explicit HTTPS document is fetched once and frozen with its actual bytes and original link',async t=>{
 const f=await fixture(t),calls=[];
 const url='https://github.com/example/design/blob/main/DESIGN.md#layout';
 const record=await selectResource({directory:f.directory,url,fetcher:async(address,options)=>{
  calls.push(address);assert.equal(options.redirect,'error');assert.equal(options.headers,undefined);
  return new Response(content,{headers:{'content-type':'text/plain; charset=utf-8'}});
 }});
 assert.deepEqual(calls,['https://raw.githubusercontent.com/example/design/main/DESIGN.md']);
 assert.equal(record.originalSource,url);assert.equal(record.source,calls[0]);assert.equal(record.type,'external');
 assert.equal(record.sha256,hash(content));assert.equal(record.authority,'reference-data-only');
 assert.equal((await designSourceContext(await loadRun(f.directory)))[0].content,content);
 await writeFile(join(f.directory,record.path),'changed');await assert.rejects(loadRun(f.directory),/snapshot changed/);
});
test('invalid, ambiguous, binary, oversized and HTML URL selections do not enter the run',async t=>{
 const f=await fixture(t);let calls=0;
 const fetcher=async()=>{calls++;return new Response(content);};
 for(const url of ['http://example.com/design.md','file:///tmp/design.md','https://user:secret@example.com/design.md'])await assert.rejects(selectResource({directory:f.directory,url,fetcher}),/HTTPS/);
 await assert.rejects(selectResource({directory:f.directory,url:'https://example.com/design.md',id:'system:lime',fetcher}),/exactly one/);
 assert.equal(calls,0);
 for(const response of [
  new Response('<html>viewer</html>',{headers:{'content-type':'text/html'}}),
  new Response('<!doctype html><html>viewer</html>'),
  new Response('too large',{headers:{'content-length':String(512*1024+1)}}),
  new Response(Buffer.from([0xff,0xfe,1])),
  new Response(Buffer.from('text\0binary')),
  new Response('failure',{status:503})
 ])await assert.rejects(selectResource({directory:f.directory,url:'https://example.com/design.md',fetcher:async()=>response}));
 assert.equal((await loadRun(f.directory)).manifest.selectedReferences,undefined);
});

test('baseline diagnosis indexes selected, observed and historical sources and verifies their session copies', async t => {
  const {root, directory} = await fixture(t);
  const chosen = {path:'docs/controls.md', sha256:hash(content), bytes:Buffer.byteLength(content), content};
  const external = await selectResource({directory, id:'design-md:example', fetcher:server().fetcher});
  const references = await designSourceContext(await loadRun(directory));
  const extraction = {status:'partial', phase:'before', documents:[
    {source:'DESIGN.md', sourceHash:chosen.sha256, content}
  ], tokens:[{name:'--spacing', value:'1rem'}], components:[]};
  const memory = {role:'historical-project-context-not-current-evidence',context:{entries:[{principle:'Historical exception'}]}};
  const foundation = {status:'observed', tokens:[{name:'--spacing'}]};
  const {projectSources,verify} = await stageBaselineProjectSources(root,{
    selectedDesignSources:[chosen,...references], designSystem:{before:extraction, after:{status:'do not inspect'}},
    foundation, projectMemory:memory
  });
  const index = JSON.stringify(projectSources);
  assert.ok(!index.includes('recoverable error') && !index.includes('Historical exception') && !index.includes('do not inspect'));
  const [local, selected] = projectSources.selectedDesignSources;
  assert.equal(local.path, chosen.path);
  assert.equal(local.sha256, chosen.sha256);
  assert.equal(selected.id, external.id);
  assert.equal(selected.authority, 'reference-data-only');
  assert.equal(selected.role, 'selected-reference');
  assert.equal((await readSessionFile(root,{path:selected.readPath})).content, content);
  assert.equal((await readSessionFile(root,{path:local.readPath})).content, content);
  assert.equal(projectSources.designSystem.role, 'observed-extraction');
  assert.equal(projectSources.designSystem.status, 'partial');
  const section = await readSessionFile(root,{path:projectSources.designSystem.readPath,offset:projectSources.designSystem.sectionStartLines.tokens,limit:6});
  assert.match(section.content, /--spacing/);
  assert.deepEqual(JSON.parse((await readSessionFile(root,{path:projectSources.designSystem.readPath})).content), extraction);
  assert.equal(projectSources.foundation.approval, null);
  assert.deepEqual(JSON.parse((await readSessionFile(root,{path:projectSources.projectMemory.readPath})).content), memory);
  await verify();
  await writeFile(join(root,local.readPath),'X'.repeat(local.bytes));
  await assert.rejects(verify(), /Baseline project source changed/);
});

test('a long one-line project source is readable through its original session path', async t => {
  const {root} = await fixture(t);
  const text = 'a'.repeat(47999) + '🌐' + '模型'.repeat(12000) + 'end';
  const source = {path:'tokens.json',sha256:hash(text),bytes:Buffer.byteLength(text),content:text};
  const {projectSources,verify} = await stageBaselineProjectSources(root,{selectedDesignSources:[source]});
  const [file] = projectSources.selectedDesignSources;
  assert.equal(projectSources.designSystem.status,'not-extracted');
  const first = await readSessionFile(root,{path:file.readPath});
  assert.equal(first.next.path,file.readPath);
  const last = await readSessionFile(root,first.next);
  assert.equal(last.next,null);
  assert.equal(first.content + last.content,text);
  await verify();
});

test('legacy project text keeps its recorded bytes even when UTF-8 decoding is lossy', async t => {
  const {root, directory} = await fixture(t);
  const path = '设计 规范.md';
  const bytes = Buffer.from([0x23,0x20,0xe9,0x0a]);
  await writeFile(join(root,path),bytes);
  const selected = {path,sha256:hash(bytes),bytes:bytes.length,content:bytes.toString('utf8')};
  const {projectSources,verify} = await stageBaselineProjectSources(directory,{
    run:{manifest:{onboarding:{config:{repo:root}}}},selectedDesignSources:[selected]
  });
  assert.deepEqual(await readFile(join(directory,projectSources.selectedDesignSources[0].readPath)),bytes);
  await verify();
});
