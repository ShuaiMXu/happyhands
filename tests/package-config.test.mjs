import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {sourceFiles} from '../packages/skill-core/scan.js';
import {componentGraph} from '../packages/skill-core/component-graph.js';
import {packageConfigReferences,packageConfigEntry} from '../packages/skill-core/module-config.js';
import {snapshotHash} from '../packages/skill-core/design-system.js';
import {runHandler} from '../packages/skill-core/handlers.js';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
const file=(path,value)=>({path,content:typeof value==='string'?value:JSON.stringify(value)});
async function fixture(t,files){const root=await mkdtemp(join(tmpdir(),'package-config-'));t.after(()=>rm(root,{recursive:true,force:true}));for(const item of files){await mkdir(dirname(join(root,item.path)),{recursive:true});await writeFile(join(root,item.path),item.content);}return root;}
const button=file('src/components/Button.tsx','export const Button=()=> <button/>;'),page=file('src/page.tsx',"import {Button} from '@/components/Button';");

test('declared installed package configs and their local chain are snapshotted with alias provenance',async t=>{
  const root=await fixture(t,[file('tsconfig.json',{extends:'preset'}),file('node_modules/preset/package.json',{name:'preset',version:'1.0.0',tsconfig:'configs/base.json',scripts:{postinstall:'DO NOT EXECUTE'}}),file('node_modules/preset/configs/base.json',{extends:'./strict.json'}),file('node_modules/preset/configs/strict.json',{compilerOptions:{paths:{'@/*':['../../../src/*']}}}),file('node_modules/preset/runtime.js','throw Error("Not config");'),file('node_modules/preset/unrelated.json',{secret:'not read'}),button,page]);
  const snapshot=await sourceFiles(root);assert.equal(snapshot.truncated,false);
  assert.deepEqual(snapshot.files.filter(item=>item.dependencyInput).map(item=>item.path).sort(),['node_modules/preset/configs/base.json','node_modules/preset/configs/strict.json','node_modules/preset/package.json']);
  assert.ok(!snapshot.files.some(item=>/runtime|unrelated/.test(item.path)));
  const edge=componentGraph(snapshot.files,{truncated:snapshot.truncated}).consumers(button.path).direct[0];assert.ok(edge);
  assert.ok(edge.resolution.configInputs.some(item=>item.file==='node_modules/preset/package.json'));
  assert.ok(edge.resolution.configInputs.some(item=>item.file==='node_modules/preset/configs/strict.json'));
  assert.ok(edge.resolution.configInputs.every(item=>/^[a-f0-9]{64}$/.test(item.hash)));
  const previous=snapshotHash(snapshot);await writeFile(join(root,'node_modules/preset/configs/strict.json'),JSON.stringify({compilerOptions:{strict:true}}));assert.notEqual(snapshotHash(await sourceFiles(root)),previous);
});

test('scoped subpath configs resolve from the nearest project dependency without crawling package runtime',async t=>{
  const root=await fixture(t,[file('apps/client/tsconfig.json',{extends:'@org/preset/strict'}),file('apps/client/node_modules/@org/preset/package.json',{name:'@org/preset',version:'1'}),file('apps/client/node_modules/@org/preset/strict.json',{extends:'./base.json'}),file('apps/client/node_modules/@org/preset/base.json',{compilerOptions:{strict:true}})]);
  const snapshot=await sourceFiles(root);assert.equal(snapshot.truncated,false);assert.ok(snapshot.files.some(item=>item.path==='apps/client/node_modules/@org/preset/base.json'));
  const graph=componentGraph([...snapshot.files,file('apps/client/page.ts',"import value from 'unknown';")]);assert.ok(!graph.issues.some(issue=>issue.reason==='module-config-needs-inspection'));
});

test('unsafe package references and entry metadata do not select executable or escaping configs',()=>{
  for(const content of ['{"tsconfig":','null','[]','0','"value"'])assert.equal(packageConfigEntry(file('node_modules/preset/package.json',content)),null);
  for(const value of ['https://example.test/config.json','../outside.json','/absolute.json','C:/config.json','preset/../secret.json','preset/config.js','preset\\strict'])assert.deepEqual(packageConfigReferences(file('tsconfig.json',{extends:value})),[]);
  for(const tsconfig of ['../secret.json','/absolute.json','C:/config.json','config.js','a\\base.json'])assert.equal(packageConfigEntry(file('node_modules/preset/package.json',{tsconfig})),null);
});

test('missing packages, unsafe entries and package links stay incomplete and cannot use a partial alias guess',async t=>{
  const root=await fixture(t,[file('tsconfig.json',{extends:'preset',compilerOptions:{paths:{'@/*':['src/*']}}}),button,page]);
  let snapshot=await sourceFiles(root);assert.equal(snapshot.truncated,true);assert.ok(snapshot.omissions.some(item=>item.reason==='package-config-unavailable'));
  assert.equal(componentGraph(snapshot.files,{truncated:snapshot.truncated}).consumers(button.path).direct.length,0);
  const outside=await fixture(t,[file('package.json',{name:'preset',tsconfig:'base.json'}),file('base.json',{})]);await mkdir(join(root,'node_modules'));
  await symlink(outside,join(root,'node_modules/preset'),process.platform==='win32'?'junction':'dir');snapshot=await sourceFiles(root);assert.ok(!snapshot.files.some(item=>item.path.includes('node_modules')));assert.equal(snapshot.truncated,true);
});

test('package config discovery retains existing size bounds and a finite lookup budget',async t=>{
  const root=await fixture(t,[file('tsconfig.json',{extends:Array.from({length:300},(_,i)=>'missing-'+i)})]);
  const snapshot=await sourceFiles(root);assert.equal(snapshot.truncated,true);assert.ok(snapshot.omissions.some(item=>item.reason==='package-config-lookup-limit'));
  const limited=await sourceFiles(root,{maxBytes:1});assert.equal(limited.truncated,true);assert.ok(limited.files.length===0);
});

test('dependency metadata stays configuration evidence and cannot become product tokens or brand assets',async t=>{
  const root=await fixture(t,[file('tsconfig.json',{extends:'preset'}),file('node_modules/preset/package.json',{name:'preset',description:'--package-only: red;',brandLogo:'/bad-package-logo.svg'}),file('node_modules/preset/tsconfig.json',{}),button,page]);
  const snapshot=await sourceFiles(root);assert.ok(snapshot.files.some(file=>file.dependencyInput));
  const foundation=await runHandler('foundationExtractor',{repo:root,sourceSnapshot:snapshot});
  assert.ok(!foundation.proposedUpdates[0].tokens.some(token=>token.name==='--package-only'));
  const run={manifest:{captures:{before:{viewports:{desktop:{screenshot:'before/test.png',dom:{title:'Fixture',h1:[],visibleCopy:[]}}}}}}};
  const brand=await runHandler('brandFoundationExtractor',{repo:root,sourceSnapshot:snapshot,run,spec:structuredClone(sample)});
  assert.ok(!JSON.stringify(brand).includes('/bad-package-logo.svg'));
});
