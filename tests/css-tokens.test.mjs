import test from 'node:test';import assert from 'node:assert/strict';import {cssDeclarations} from '../packages/skill-core/css-tokens.js';import {captureAccessibility} from '../packages/harness-core/accessibility.js';
test('AST preserves multiline values and nested dark context without sibling leakage',()=>{
 const result=cssDeclarations({path:'theme.css',content:':root { --gap:\n 8px; } @media (prefers-color-scheme: dark) { @layer theme { :root { --ink: #fff; } } } .light { --ink: #111; }'});
 assert.equal(result.error,null);assert.equal(result.declarations[0].value,'8px');assert.equal(result.declarations[1].theme,'dark');assert.equal(result.declarations[2].theme,null);assert.ok(result.declarations[1].contexts.some(x=>x.includes('@media')));
});
test('malformed CSS is explicit missing evidence, not successful empty extraction',()=>{
 assert.ok(cssDeclarations({path:'broken.css',content:':root { --x: red;'}).error);
 assert.equal(cssDeclarations({path:'component.tsx',content:'not CSS'}),null);
});
test('axe injection failure is recorded, never a clean accessibility pass',async()=>{
 const result=await captureAccessibility({evaluate:async()=>{throw Error('page closed')}});assert.equal(result.status,'failed');assert.match(result.error,/page closed/);
});
