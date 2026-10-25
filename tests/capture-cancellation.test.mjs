import test from 'node:test';
import assert from 'node:assert/strict';
import {captureAccessibility} from '../packages/harness-core/accessibility.js';
import {captureBrowserPlan} from '../packages/harness-core/browser.js';
import {assertBaselineModelCapacity} from '../packages/workbench/baseline-diagnosis.js';
test('accessibility deadline remains bounded when the page cannot execute its timer',async()=>{
 const result=await captureAccessibility({evaluate:()=>new Promise(()=>{})},20);
 assert.equal(result.status,'failed');assert.match(result.error,/host timeout/);
});
test('model capacity counts configured targets before capture without truncating the plan',()=>{
 const plan={configurations:[{id:'desktop'},{id:'mobile'}],states:Array.from({length:13},(_,i)=>({id:`state-${i}`}))};
 assert.doesNotThrow(()=>assertBaselineModelCapacity(plan));
 assert.throws(()=>assertBaselineModelCapacity({...plan,states:Array.from({length:49},(_,i)=>({id:'state-'+i}))}),/98.*96/);
 assert.equal(plan.states.length,13);
 assert.doesNotThrow(()=>assertBaselineModelCapacity({...plan,states:plan.states.slice(0,12)}));
});
test('cancelled capture refuses to start even before validating a plan',async()=>{
 const controller=new AbortController();controller.abort(new Error('User cancelled capture'));
 await assert.rejects(captureBrowserPlan({signal:controller.signal}),/User cancelled capture/);
});
