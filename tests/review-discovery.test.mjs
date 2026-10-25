import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewCandidates,confirmedReviewPlan,localReviewUrl} from '../packages/harness-core/review-discovery.js';
import {assertCapturePlan} from '../packages/harness-core/capture-state.js';
const url='http://127.0.0.1:4321/';
const configurations=[{id:'desktop',viewport:{width:1280,height:800}},{id:'mobile',viewport:{width:390,height:844}}];
const controls=[{selector:'#menu',name:'Menu',expanded:'false',targetSelector:'#nav'}, {selector:'#open',name:'Help',popup:'dialog',targetSelector:'#help'}];
const form={selector:'#form',fields:[{selector:'#email',label:'Email',type:'email',required:true,pattern:null,minLength:0},{selector:'#name',label:'Name',type:'text',required:true,minLength:0}]};
function proposal(){return {...reviewCandidates([{url,configurationId:'mobile',title:'Home',controls,forms:[form]}],url),url,configurations};}
test('DOM evidence proposes menu/dialog open and close plus local native form error/recovery without submission',()=>{
 const p=proposal();assert.deepEqual(p.candidates.map(item=>item.kind),['page','menu','menu','dialog','dialog','form','recovery']);
 for(const candidate of p.candidates)assertCapturePlan({schemaVersion:'0.1',adapter:'web',configurations,states:[candidate.state]});
 assert.ok(p.candidates.find(item=>item.kind==='recovery').state.actions.some(action=>action.type==='validate-form'&&action.valid));
 assert.ok(p.candidates.every(item=>!item.state.actions.some(action=>action.name==='Submit'||action.selector==='[type=submit]')));
});
test('explicit selection adds full-page originals on both devices and preserves existing custom states',()=>{
 const p=proposal(),existing={schemaVersion:'0.1',adapter:'web',configurations,states:[{id:'custom',start:{url:url+'settings'},actions:[]}]};
 const plan=confirmedReviewPlan(p,[p.candidates[1].id],existing);
 assert.deepEqual(plan.states.find(state=>state.id==='custom'),existing.states[0]);
 assert.equal(plan.states.filter(state=>state.captureMode==='full-page').length,4);
 assert.equal(plan.states.find(state=>state.id===p.candidates[1].id).actions.length,3);
});
test('manual error recovery and unlinked routes use the same bounded plan contract',()=>{
 const p=proposal(),manual=[{id:'retry',start:{url:url+'error'},actions:[{type:'click-selector',selector:'#retry'},{type:'assert-state',selector:'#error',state:'hidden'},{type:'assert-state',selector:'#result',state:'visible'}]}];
 const plan=confirmedReviewPlan(p,[],null,manual);assert.equal(plan.states.length,3);
 assert.throws(()=>confirmedReviewPlan(p,[],null,[{...manual[0],start:{url:'https://evil.example/'}}]),/preview origin/);
 assert.throws(()=>confirmedReviewPlan(p,[],null,[{...manual[0],actions:[{type:'navigate',url:'https://evil.example/'}]}]),/preview origin/);
});
test('no implicit selection, forged IDs, duplicate/conflicting IDs or truncated huge plans',()=>{
 const p=proposal();assert.throws(()=>confirmedReviewPlan(p,[]),/Select at least/);
 assert.throws(()=>confirmedReviewPlan(p,['forged']),/Unknown/);
 assert.throws(()=>confirmedReviewPlan(p,[p.candidates[0].id,p.candidates[0].id]),/duplicate/);
 const selected=p.candidates[0],existing={schemaVersion:'0.1',adapter:'web',configurations,states:[{...selected.state,actions:[{type:'wait-for',text:'other'}]}]};
 assert.throws(()=>confirmedReviewPlan(p,[selected.id],existing),/conflicts/);
 const manual=Array.from({length:51},(_,index)=>({id:'manual-'+index,start:{url},actions:[]}));assert.throws(()=>confirmedReviewPlan(p,[],null,manual),/exceeds/);
});
test('ambiguous controls and custom/pattern forms stay gaps rather than guessed passing states',()=>{
 const p=reviewCandidates([{url,configurationId:'mobile',controls:[{name:'Menu',controls:'nav'}],forms:[{...form,fields:[{...form.fields[0],pattern:'.+'}]}],alerts:[{selector:'#error'}]}],url);
 assert.equal(p.candidates.length,1);assert.equal(p.gaps.length,3);
 assert.throws(()=>localReviewUrl('http://user:secret@127.0.0.1:4321/',url),/credentials/);
 assert.equal(localReviewUrl('/settings#account',url),url+'settings');
});
test('assertions require an expected state and reject arbitrary attribute/keys/code',()=>{
 const p=proposal(),state=p.candidates[0].state;
 for(const action of [{type:'assert-state',selector:'#menu'}, {type:'assert-state',selector:'#menu',state:'visible',attribute:'aria-expanded',value:'true'}, {type:'assert-state',selector:'#menu',attribute:'onclick',value:'evil'}, {type:'press-key',selector:'#menu',key:'Meta+A'}, {type:'evaluate',script:'alert(1)'}])assert.throws(()=>assertCapturePlan({schemaVersion:'0.1',adapter:'web',configurations,states:[{...state,actions:[action]}]}));
});
