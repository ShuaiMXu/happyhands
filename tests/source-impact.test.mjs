import test from 'node:test';
import assert from 'node:assert/strict';
import {componentGraph,moduleGraphEvidence} from '../packages/skill-core/component-graph.js';
import {sourceImpact} from '../packages/harness-core/source-impact.js';
import {buildDesignSystemExtraction} from '../packages/skill-core/design-system.js';

const files=[{path:'src/format.ts',content:'export const format = String;'},
  {path:'src/components/Price.ts',content:"import {format} from '../format'; export const price = format(3);"},
  {path:'src/pages/shop.ts',content:"import {price} from '../components/Price';"},
  {path:'src/pages/about.ts',content:'export const about = true;'}];
const graph=items=>moduleGraphEvidence(componentGraph(items));
const state=(id,file)=>({id,start:{url:`http://localhost/${id}`},actions:[],...(file?{region:{source:{file}}}:{})});

test('utility modules retain their whole dependency graph and source hashes in extraction',()=>{
  const extraction=buildDesignSystemExtraction({snapshot:{files,truncated:false},foundation:{status:'complete',proposedUpdates:[]},capture:{},phase:'after'});
  assert.equal(extraction.extractorVersion,'0.11.0');
  assert.equal(extraction.moduleGraph.edges.length,2);
  assert.match(extraction.moduleGraph.files.find(file=>file.path==='src/format.ts').hash,/^[a-f0-9]{64}$/);
  assert.ok(extraction.moduleGraph.edges.some(edge=>edge.target==='src/format.ts'));
});

test('both revisions preserve deleted consumers and map their planned state and navigation',()=>{
  const plan={states:[state('shop','src/pages/shop.ts'),state('about','src/pages/about.ts'),state('unbound')]};
  plan.states[0].actions=[{type:'navigate',url:'http://localhost/checkout?from=shop'}];
  const impact=sourceImpact([{path:'src/format.ts',kind:'modified'}],{baseline:graph(files),current:graph(files.filter(file=>file.path!=='src/pages/shop.ts')),plan});
  const change=impact.changes[0];
  assert.deepEqual(change.stateIds,['shop']);
  assert.ok(change.references.some(item=>item.revision==='baseline'&&item.file==='src/pages/shop.ts'&&item.via.length===2));
  assert.ok(!change.references.some(item=>item.revision==='current'&&item.file==='src/pages/shop.ts'));
  assert.deepEqual(impact.states[0].urls,['http://localhost/shop','http://localhost/checkout?from=shop']);
  assert.equal(impact.states[1].status,'impact-unknown');assert.equal(impact.states[2].status,'impact-unknown');
  assert.deepEqual(impact.excludedStateIds,[]);assert.deepEqual(impact.reviewedStateIds,[]);
  assert.equal(impact.capturePolicy,'all-configured-states');
});

test('missing, incomplete, unresolved and bounded graphs retain uncertainty without skipping states',()=>{
  const current=moduleGraphEvidence({edges:Array.from({length:10001},(_,i)=>({file:`file${i}.ts`,target:'base.ts'})),issues:Array.from({length:1001},()=>({reason:'unknown'}))});
  assert.equal(current.status,'partial');assert.deepEqual(current.omissions,{edges:1,issues:1});
  const impact=sourceImpact([{path:'base.ts',kind:'deleted'}],{current,plan:{states:[state('unknown')]}});
  for(const limitation of ['baseline-module-graph-missing','source-snapshot-incomplete','unresolved-module-references','impact-traversal-limit'])assert.ok(impact.limitations.includes(limitation));
  assert.ok(impact.changes[0].references.length<=256);assert.deepEqual(impact.excludedStateIds,[]);
});

test('cycles terminate and same state devices retain all source references and URLs',()=>{
  const cyclic=graph([{path:'a.ts',content:"import './b';"},{path:'b.ts',content:"import './a';"}]);
  const impact=sourceImpact([{path:'a.ts',kind:'modified'}],{baseline:cyclic,current:cyclic,capture:{states:[{stateId:'same',start:{url:'http://localhost/a'},region:{source:{file:'other.ts'}}},{stateId:'same',start:{url:'http://localhost/b'},plannedRegion:{source:{file:'b.ts'}}}]}});
  assert.equal(impact.changes[0].references.length,2);assert.deepEqual(impact.changes[0].stateIds,['same']);
  assert.deepEqual(impact.states[0].urls,['http://localhost/a','http://localhost/b']);
});
