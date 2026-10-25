import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {componentGraph} from '../packages/skill-core/component-graph.js';
import {inventoryComponents} from '../packages/skill-core/components.js';
import {sourceFiles} from '../packages/skill-core/scan.js';
import {buildDesignSystemExtraction,designSystemBrief} from '../packages/skill-core/design-system.js';
const file=(path,content)=>({path,content:typeof content==='string'?content:JSON.stringify(content)});
const button=file('src/components/Button.tsx','export const Button=()=> <button />;');
const page=file('src/page.tsx',"import {Button} from '@/components/Button'; export const Page=()=> <Button />;");

test('JSONC paths resolve with source configuration provenance and no runtime claims',()=>{
  const files=[file('tsconfig.json','{ // comments are valid\n "compilerOptions":{"paths":{"@/*":["./src/*"]}},\n}'),button,page];
  const graph=componentGraph(files),usage=graph.consumers(button.path);
  assert.equal(usage.direct.length,1);assert.equal(usage.direct[0].file,page.path);assert.equal(usage.direct[0].resolution.config,'tsconfig.json');
  assert.equal(usage.direct[0].resolution.pattern,'@/*');assert.match(usage.direct[0].resolution.configInputs[0].hash,/^[a-f0-9]{64}$/);
  assert.equal(usage.potential[0].status,'module-reachability-only');assert.deepEqual(inventoryComponents(files)[0].consumers,[page.path]);
});

test('alias evidence survives the design-system extraction and implementation brief',()=>{
  const files=[file('tsconfig.json',{compilerOptions:{paths:{'@/*':['./src/*']}}}),button,page];
  const options={foundation:{status:'complete',proposedUpdates:[]},capture:{},phase:'before'};
  const before=buildDesignSystemExtraction({...options,snapshot:{files,truncated:false}});
  assert.equal(before.extractorVersion,'0.11.0');assert.deepEqual(before.components[0].consumers,[page.path]);
  assert.match(designSystemBrief(before),/configInputs/);assert.match(designSystemBrief(before),/tsconfig-paths/);
  const after=buildDesignSystemExtraction({...options,snapshot:{files:[file('tsconfig.json',{compilerOptions:{paths:{'@/*':['./other/*']}}}),button,page],truncated:false}});
  assert.notEqual(before.source.snapshotHash,after.source.snapshotHash);assert.deepEqual(after.components[0].consumers,[]);
  assert.ok(after.moduleResolutionIssues.some(issue=>issue.reason==='alias-target-missing-from-snapshot'));
});

test('local extends retain origin and a child paths map replaces the inherited map',()=>{
  const base=file('config/base.json',{compilerOptions:{paths:{'@/*':['../src/*'],'old/*':['../src/*']}}});
  const inherited=componentGraph([base,file('tsconfig.json',{extends:'./config/base.json'}),button,page]);
  assert.equal(inherited.consumers(button.path).direct.length,1);
  assert.deepEqual(inherited.consumers(button.path).direct[0].resolution.configInputs.map(item=>item.file),['config/base.json','tsconfig.json']);
  const replaced=componentGraph([base,file('tsconfig.json',{extends:'./config/base.json',compilerOptions:{paths:{'new/*':['./src/*']}}}),button,page]);
  assert.equal(replaced.consumers(button.path).direct.length,0);
});

test('solution references and nested projects resolve only the applicable config',()=>{
  const files=[file('tsconfig.json',{files:[],references:[{path:'./tsconfig.app.json'},{path:'./tsconfig.node.json'}]}),
    file('tsconfig.app.json',{compilerOptions:{paths:{'@/*':['./src/*']}},include:['src']}),
    file('tsconfig.node.json',{include:['tools']}),file('tools/build.ts','export {};'),button,page,
    file('sub/tsconfig.json',{compilerOptions:{paths:{'@/*':['./ui/*']}}}),file('sub/ui/Button.tsx','export const Button=()=>null;'),file('sub/page.tsx',"import {Button} from '@/Button';")];
  const graph=componentGraph(files);
  assert.equal(graph.consumers(button.path).direct[0].resolution.config,'tsconfig.app.json');
  assert.deepEqual(graph.consumers('sub/ui/Button.tsx').direct.map(edge=>edge.file),['sub/page.tsx']);
});

test('patterns follow exact/longest-prefix and ordered target fallback',()=>{
  const files=[file('jsconfig.json',{compilerOptions:{paths:{'@/*':['./wrong/*'],'@/components/*':['./missing/*','./src/components/*'],'@/exact':['./src/components/Button.tsx']}}}),button,page,file('other.jsx',"import Button from '@/exact';")];
  const graph=componentGraph(files);assert.equal(graph.consumers(button.path).direct.length,2);
  assert.equal(graph.consumers(button.path).direct[0].resolution.pattern,'@/components/*');
});

test('cycles, external bases, overlapping configs, missing and ambiguous targets remain unresolved',()=>{
  for(const configs of [
    [file('tsconfig.json',{extends:'./base.json'}),file('base.json',{extends:'./tsconfig.json'})],
    [file('tsconfig.json',{extends:'unavailable-package/tsconfig.json',compilerOptions:{paths:{'@/*':['src/*']}}})],
    [file('tsconfig.json',{}),file('jsconfig.json',{})],
    [file('tsconfig.json',{compilerOptions:{paths:{'@/*':['missing/*']}}})],
    [file('tsconfig.json',{compilerOptions:{paths:{'@/*':['src/*']}}}),file('src/components/Button.jsx','export default null;')],
  ]){const graph=componentGraph([...configs,button,page]);assert.equal(graph.consumers(button.path).direct.length,0);assert.ok(graph.issues.length);}
  const outside=componentGraph([file('tsconfig.json',{compilerOptions:{paths:{'@/*':['../outside/*']}}}),button,page]);assert.ok(outside.issues.some(issue=>issue.reason==='outside-source-snapshot'));
});

test('a truncated snapshot does not guess a nearest alias config or fallback target',()=>{
  const graph=componentGraph([file('tsconfig.json',{compilerOptions:{paths:{'@/*':['src/*']}}}),button,page],{truncated:true});
  assert.equal(graph.consumers(button.path).direct.length,0);assert.ok(graph.issues.some(issue=>issue.reason==='alias-snapshot-incomplete'));
});

test('baseUrl and inherited overrides follow the pinned TypeScript config parser',()=>{
  const files=[file('config/base.json',{compilerOptions:{baseUrl:'../wrong',paths:{'@/*':['*']}}}),file('tsconfig.json',{extends:'./config/base.json',compilerOptions:{baseUrl:'./src'}}),button,page,file('src/another.tsx',"import {Button} from 'components/Button';")];
  const graph=componentGraph(files);assert.equal(graph.consumers(button.path).direct.length,2);
  assert.equal(graph.consumers(button.path).direct.find(edge=>edge.file==='src/another.tsx').resolution.kind,'tsconfig-base-url');
  const rooted=componentGraph([file('tsconfig.json',{compilerOptions:{paths:{'@root':['.']}}}),file('index.ts','export const value=1;'),file('page.ts',"import {value} from '@root';")]);
  assert.equal(rooted.consumers('index.ts').direct.length,1);
});

test('absolute config paths cannot impersonate the virtual snapshot root',()=>{
  for(const compilerOptions of [{baseUrl:'/snapshot/src',paths:{'@/*':['*']}},{paths:{'@/*':['/snapshot/src/*']}},{paths:{'@/*':['\\\\snapshot\\src\\*']}}]){
    const graph=componentGraph([file('tsconfig.json',{compilerOptions}),button,page]);assert.equal(graph.consumers(button.path).direct.length,0);
    assert.ok(graph.issues.some(issue=>issue.reason==='absolute-module-config-needs-inspection'));
  }
});

test('Astro and Vue script consumers participate in explicit path aliases',()=>{
  for(const extension of ['astro','vue']){
    const source=extension==='astro'?"---\nimport Button from '@/ui/Button.astro';\n---\n<Button />":'<script setup>import Button from "@/ui/Button.vue";</script><template><Button /></template>';
    const target=`src/ui/Button.${extension}`;
    const graph=componentGraph([file('tsconfig.json',{compilerOptions:{paths:{'@/*':['./src/*']}}}),file(target,extension==='astro'?'<button />':'<template><button /></template>'),file(`src/page.${extension}`,source)]);
    assert.deepEqual(graph.consumers(target).direct.map(edge=>edge.file),[`src/page.${extension}`]);
  }
});

test('source scanning includes local config dependencies but not unrelated JSON or executable configs',async t=>{
  const root=await mkdtemp(join(tmpdir(),'module-config-scan-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'config'));await mkdir(join(root,'src','components'),{recursive:true});
  const configs=[file('tsconfig.json',{extends:'./config/base.json'}),file('config/base.json',{compilerOptions:{paths:{'@/*':['../src/*']}}})];
  for(const item of [...configs,button,page,file('unrelated.json',{secret:'not part of source discovery'})])await writeFile(join(root,item.path),item.content);
  const snapshot=await sourceFiles(root);assert.ok(snapshot.files.some(item=>item.path==='config/base.json'));assert.ok(!snapshot.files.some(item=>item.path==='unrelated.json'));
  assert.equal(componentGraph(snapshot.files).consumers(button.path).direct.length,1);
  const limited=await sourceFiles(root,{maxBytes:1});assert.equal(limited.truncated,true);
  await writeFile(join(root,'tsconfig.json'),JSON.stringify({extends:'.\\config\\base.json'}));
  const windows=await sourceFiles(root);assert.ok(windows.files.some(item=>item.path==='config/base.json'));assert.equal(componentGraph(windows.files).consumers(button.path).direct.length,1);
});

test('config discovery never follows a junction or relative extends outside the repository',async t=>{
  const host=await mkdtemp(join(tmpdir(),'module-config-boundary-'));t.after(()=>rm(host,{recursive:true,force:true}));
  const root=join(host,'project'),outside=join(host,'outside');await mkdir(root);await mkdir(outside);
  await writeFile(join(outside,'base.json'),JSON.stringify({compilerOptions:{paths:{'@/*':['src/*']}}}));
  await symlink(outside,join(root,'linked'),process.platform==='win32'?'junction':'dir');
  await writeFile(join(root,'tsconfig.json'),JSON.stringify({extends:'./linked/base.json'}));
  let snapshot=await sourceFiles(root);assert.deepEqual(snapshot.files.map(item=>item.path),['tsconfig.json']);
  await writeFile(join(root,'tsconfig.json'),JSON.stringify({extends:'../outside/base.json'}));
  snapshot=await sourceFiles(root);assert.deepEqual(snapshot.files.map(item=>item.path),['tsconfig.json']);
});
