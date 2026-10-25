import test from 'node:test';
import assert from 'node:assert/strict';
import {componentCoverage} from '../packages/skill-core/component-coverage.js';
import {assertStableComponentInstance} from '../packages/harness-core/component-instance.js';
import {assertCapturePlan} from '../packages/harness-core/capture-state.js';
import {buildDesignSystemExtraction,evidenceHash,designSystemBrief} from '../packages/skill-core/design-system.js';
import {observedFoundationFrom} from '../packages/skill-core/foundation-inventory.js';
import {runHandler} from '../packages/skill-core/handlers.js';

const variant={name:'tone',attribute:'data-tone',value:'primary'};
const region={selector:'#save',source:{file:'components/Button.tsx',line:1,anchor:'data-component="Button"',component:'Button'},instance:{id:'save',variants:[variant]}};
const plan=()=>({schemaVersion:'0.1',adapter:'web',configurations:[{id:'desktop',viewport:{width:1280,height:800}}],states:[{id:'focused',start:{url:'http://localhost/'},actions:[],region:structuredClone(region)}]});
const instance=()=>({id:'save',component:'Button',selector:'#save',variants:[{...variant,observed:'primary'}],states:{focused:true},verification:'declared-root-instance-stable-at-screenshot-boundary'});
const entry=()=>({stateId:'focused',configurationId:'desktop',reached:true,screenshot:'before/focused--desktop.png',region:{...structuredClone(region),source:{...region.source,fileHash:'hash'},verification:'unique-visible-selector-and-shared-source-anchor'},componentInstance:instance(),finalStateEvidence:[{selector:'#save',state:'focused',verified:true,verification:'instantaneous-boundary-check'}]});
const component={name:'Button',source:'components/Button.tsx',sourceHash:'hash'};

test('failed planned targets remain attributed without claiming captured instances',()=>{
  const result=componentCoverage(component,{states:[{stateId:'tall',configurationId:'mobile',plannedRegion:region,reached:false,error:'Too tall'}]});
  assert.equal(result.plannedTargets,1);assert.equal(result.capturedInstances,0);
  assert.equal(result.missingTargets[0].error,'Too tall');
  assert.equal(result.references[0].status,'needs-evidence');
});

test('full-document instances require a complete document original',()=>{
  const value=entry();value.componentInstance.visibility={image:'full-document'};
  value.documentSize={width:1280,height:2000};value.screenshotSize={width:1280,height:2000};
  assert.equal(componentCoverage(component,{states:[value]}).capturedInstances,0);
  value.captureMode='full-page';
  assert.equal(componentCoverage(component,{states:[value]}).capturedInstances,1);
  value.screenshotSize.height=800;
  assert.equal(componentCoverage(component,{states:[value]}).capturedInstances,0);
});

test('instance declarations require named components and unique variant bindings',()=>{
  assertCapturePlan(plan());
  const missing=plan();delete missing.states[0].region.source.component;assert.throws(()=>assertCapturePlan(missing),/named source/);
  const duplicate=plan();duplicate.states[0].region.instance.variants.push(variant);assert.throws(()=>assertCapturePlan(duplicate),/unique/);
  const unsafe=plan();unsafe.states[0].region.instance.variants[0].attribute='onclick';assert.throws(()=>assertCapturePlan(unsafe));
});

test('only source-matched stable instances contribute evidence; a region never certifies all states',()=>{
  const result=componentCoverage(component,{states:[entry()]});
  assert.equal(result.status,'partial-instance-evidence');assert.ok(result.missing.includes('remaining-instances-and-variants'));
  assert.equal(result.references[0].instance.states.focused,true);assert.equal(result.references[0].assertions.length,1);
  for(const change of [
    value=>delete value.componentInstance,
    value=>value.reached=false,
    value=>value.region.source.fileHash='stale',
    value=>value.componentInstance.selector='#other',
    value=>value.componentInstance.component='Child',
    value=>value.componentInstance.variants[0].observed='quiet',
    value=>value.componentInstance.verification='source-only',
  ]){const value=entry();change(value);assert.equal(componentCoverage(component,{states:[value]}).references[0].instance,undefined);}
});

test('any state, variant or layout change invalidates screenshot-bound instance evidence',()=>{
  const before=instance();assert.ok(assertStableComponentInstance(before,structuredClone(before)));
  const after=structuredClone(before);after.states.focused=false;
  assert.throws(()=>assertStableComponentInstance(before,after),/changed across/);
  assert.equal(assertStableComponentInstance(null,null),null);
});

test('extraction, governed inventory and modification brief retain scoped instance evidence',async()=>{
  const file={path:component.source,content:'export function Button() { return <button data-component="Button">Save</button>; }'};
  const snapshot={files:[file],truncated:false},captureEntry=entry();
  captureEntry.region.source.fileHash=evidenceHash(file.content);
  const foundation=await runHandler('foundationExtractor',{repo:'.',sourceSnapshot:snapshot});
  const extraction=buildDesignSystemExtraction({snapshot,foundation,capture:{states:[captureEntry]},phase:'before'});
  const saved=observedFoundationFrom(null,[{...foundation,skill:{id:'foundation-extractor'}}],extraction);
  const item=saved.components.find(item=>item.source===file.path);
  assert.equal(item.status,'observed');
  assert.equal(item.evidence.details.renderedCoverage.references[0].instance.id,'save');
  assert.match(designSystemBrief(extraction),/partial-instance-evidence/);
  assert.match(designSystemBrief(extraction),/remaining-instances-and-variants/);
});
