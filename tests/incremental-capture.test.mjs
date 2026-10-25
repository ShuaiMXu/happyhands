import test from 'node:test';
import assert from 'node:assert/strict';
import {selectIncrementalStates,selectedCapturePlan} from '../packages/harness-core/incremental-capture.js';
import {componentGraph,moduleGraphEvidence} from '../packages/skill-core/component-graph.js';
import {assertCapturePlan} from '../packages/harness-core/capture-state.js';
const files=[{path:'button.js',content:'export const button = 1;'}, {path:'home.js',content:"import './button.js';"},{path:'about.js',content:'export const about = 1;'}];
const graph=items=>({...moduleGraphEvidence(componentGraph(items)),files:items.map(item=>({path:item.path}))});
const plan={schemaVersion:'0.1',adapter:'web',configurations:[{id:'desktop',viewport:{width:1280,height:800}},{id:'mobile',viewport:{width:390,height:844}}],states:['home','about'].map(id=>({id,start:{url:`http://localhost/${id}`},actions:[],sourceEntries:[`${id}.js`]}))};
const captured=p=>({states:p.states.flatMap(state=>p.configurations.map(config=>({stateId:state.id,configurationId:config.id,...config.viewport,reached:true,screenshot:`after/${state.id}--${config.id}.png`,plannedState:structuredClone(state)})))});
const input=()=>({changes:[{path:'button.js',kind:'modified'}],baseline:graph(files),current:graph(files),plan:structuredClone(plan),baselineCapture:captured(plan)});

test('a declared route closure selects its states and retains both device configurations',()=>{
  const selection=selectIncrementalStates(input());assert.equal(selection.status,'selected');
  assert.deepEqual(selection.selectedStateIds,['home']);assert.deepEqual(selection.excludedStateIds,['about']);assert.deepEqual(selection.reviewedStateIds,[]);
  const effective=selectedCapturePlan(plan,selection);assert.deepEqual(effective.states.map(state=>state.id),['home']);assert.deepEqual(effective.configurations,plan.configurations);
  assert.deepEqual(plan.states.map(state=>state.id),['home','about']);
  assert.throws(()=>selectedCapturePlan({...plan,states:[...plan.states].reverse()},selection),/changed/);
  assert.throws(()=>selectedCapturePlan(plan,{...selection,selectedStateIds:['missing']}),/partition/);
});

test('entry closures independently traverse old and new dependencies and shared changes retain all states',()=>{
  const value=input();value.current=graph([...files.filter(file=>file.path!=='about.js'),{path:'about.js',content:"import './home.js';"}]);
  assert.deepEqual(selectIncrementalStates(value).selectedStateIds,['home','about']);
  const removed=input();removed.current=graph(files.map(file=>file.path==='home.js'?{...file,content:'export const home = 1;'}:file));
  assert.deepEqual(selectIncrementalStates(removed).selectedStateIds,['home']);
});

test('unknown references, global files, missing contracts and changed device/state plans retain full capture',()=>{
  for(const mutate of [v=>v.current.issues.push({reason:'dynamic-module-expression'}),v=>v.baseline.status='partial',v=>delete v.plan.states[1].sourceEntries,v=>v.plan.states[0].actions.push({type:'wait-for',text:'Changed'}),v=>v.plan.configurations[0].viewport.width++,v=>v.changes.push({path:'global.css',kind:'modified'}),v=>v.changes.push({path:'server.js',kind:'modified'}),v=>v.baselineCapture.states.pop(),v=>delete v.baselineCapture.states[0].plannedState]){
    const value=input();mutate(value);const selection=selectIncrementalStates(value);assert.equal(selection.status,'full');assert.deepEqual(selection.excludedStateIds,[]);
  }
});

test('source entry contracts reject traversal, absolute paths, duplicates and empty segments',()=>{
  for(const file of ['../home.js','a/../home.js','/home.js','C:/home.js','a\\home.js','a//home.js']){
    const value=structuredClone(plan);value.states[0].sourceEntries=[file];assert.throws(()=>assertCapturePlan(value));
  }
  const value=structuredClone(plan);value.states[0].sourceEntries=['home.js','home.js'];assert.throws(()=>assertCapturePlan(value));
});

test('installed config changes cannot narrow scope even when ignored by the repository diff',()=>{
  const value=input(),path='node_modules/preset/base.json';
  value.baseline.files.push({path,hash:'a'.repeat(64)});value.current.files.push({path,hash:'b'.repeat(64)});
  const selected=selectIncrementalStates(value);assert.equal(selected.status,'full');assert.equal(selected.reason,'installed-config-inputs-changed');
  value.current.files.at(-1).hash='a'.repeat(64);assert.equal(selectIncrementalStates(value).status,'selected');
  delete value.current.files.at(-1).hash;assert.equal(selectIncrementalStates(value).reason,'dependency-input-hash-missing');
});
