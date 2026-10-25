import test from 'node:test';
import assert from 'node:assert/strict';
import {componentGraph,moduleReferences} from '../packages/skill-core/component-graph.js';
import {inventoryComponents} from '../packages/skill-core/components.js';

test('comments, strings and type-only declarations are not runtime module consumers',()=>{
  const file={path:'page.tsx',content:`// import Button from './components/Button';
const example="import Button from './components/Button'";
import type {Props} from './components/Button';
import {type Other} from './components/Button';
export {type Props} from './components/Button';
import Button from './components/Button';`};
  assert.deepEqual(moduleReferences(file).references.map(ref=>[ref.line,ref.kind]),[[6,'import']]);
});

test('module graph preserves direct and transitive paths without claiming symbol or runtime coverage',()=>{
  const files=[
    {path:'components/Button.tsx',content:'export const Button=()=> <button />;'},
    {path:'components/index.ts',content:"export {Button as Action} from './Button.js';"},
    {path:'page.tsx',content:"import {Action} from './components'; export const Page=()=> <Action />;"},
    {path:'unrelated.ts',content:"// import {Action} from './components';"},
    {path:'alias.ts',content:"import Button from '@/components/Button';"}
  ];
  const graph=componentGraph(files),usage=graph.consumers(files[0].path);
  assert.deepEqual(usage.direct.map(ref=>ref.file),['components/index.ts']);
  assert.deepEqual(usage.potential.map(ref=>ref.file),['components/index.ts','page.tsx']);
  assert.equal(usage.potential[1].via.length,2);
  assert.equal(usage.potential[1].status,'module-reachability-only');
  assert.equal(graph.issues[0].reason,'external-or-alias-needs-resolution');
  const component=inventoryComponents(files)[0];
  assert.deepEqual(component.consumers,['components/index.ts']);
  assert.equal(component.potentialConsumers[1].file,'page.tsx');
});

test('ambiguous, missing and dynamic references remain unresolved and cycles terminate',()=>{
  const files=[{path:'a.ts',content:"import './b'; import './unknown'; import(choice);"},{path:'b.ts',content:"import './a';"},{path:'b.js',content:''}];
  const graph=componentGraph(files);
  assert.ok(graph.issues.some(issue=>issue.reason==='ambiguous-source-module'));
  assert.ok(graph.issues.some(issue=>issue.reason==='module-missing-from-snapshot'));
  assert.ok(graph.issues.some(issue=>issue.reason==='dynamic-module-expression'));
  assert.equal(graph.consumers('a.ts').potential.length,1);
  const cycle=componentGraph(files.slice(0,2));
  assert.equal(cycle.consumers('a.ts').potential.length,1);
});

test('Astro and SFC script imports keep source lines and ignore template examples',()=>{
  const astro={path:'page.astro',content:"---\nimport Button from './Button.astro';\n---\n<pre>import Fake from './Fake'</pre>\n<script>import helper from './helper';</script>"};
  assert.deepEqual(moduleReferences(astro).references.map(ref=>[ref.specifier,ref.line]),[['./Button.astro',2],['./helper',5]]);
  assert.deepEqual(moduleReferences({path:'Page.vue',content:'<!-- <script>import Fake from "./Fake"</script> -->\n<script setup lang="ts">import Button from "./Button.vue";</script>'}).references.map(ref=>ref.specifier),['./Button.vue']);
});

test('deep dependency graphs stop with an explicit incomplete flag',()=>{
  const files=Array.from({length:40},(_,index)=>({path:`m${index}.ts`,content:index?`import './m${index-1}';`:''}));
  const usage=componentGraph(files).consumers('m0.ts');
  assert.equal(usage.truncated,true);assert.equal(usage.potential.length,32);
});
