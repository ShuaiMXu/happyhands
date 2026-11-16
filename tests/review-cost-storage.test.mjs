import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {createRun,loadRun} from '../packages/harness-core/store.js';
import {reserveReviewCall,settleReviewCall,configureReviewCosts,readReviewCosts} from '../packages/harness-core/review-costs.js';
const limit=32*1024*1024;
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'hh-cost-storage-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const {directory}=await createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:root});
 const id=await reserveReviewCall(directory,{key:'1'.repeat(64),stage:'synthetic-storage-only',modelIdentity:{fixture:'x'.repeat(1536*1024)}});
 await settleReviewCall(directory,id,{usage:{input_tokens:0,cached_input_tokens:0,output_tokens:0}});return directory;
}
async function historySize(directory){let ref=(await loadRun(directory)).manifest.reviewCosts,total=0,size=0;while(ref){const raw=await readFile(join(directory,ref.path));if(!size)size=raw.length;total+=raw.length;ref=JSON.parse(raw).previous;}return {total,size};}
test('history exhaustion refuses the append while leaving the previous head readable',async t=>{
 const directory=await fixture(t);let blocked=false;
 for(let i=0;i<40;i++){
  const before=await readFile(join(directory,'run.json'));
  try{await configureReviewCosts(directory,{},'Explicit synthetic policy observation '+i);}
  catch(error){assert.match(error.message,/history/);assert.deepEqual(await readFile(join(directory,'run.json')),before);assert.equal((await readReviewCosts(directory)).calls.length,1);blocked=true;break;}
 }
 assert.ok(blocked,'The bounded history must eventually stop without truncation');
});
test('a new model reservation must leave room for its terminal settlement snapshot',async t=>{
 const directory=await fixture(t);
 for(let i=0;i<40;i++){const {total,size}=await historySize(directory);if(total+size+16*1024>limit)break;await configureReviewCosts(directory,{},'Synthetic headroom observation '+i);}
 const before=await readFile(join(directory,'run.json'));
 await assert.rejects(reserveReviewCall(directory,{key:'2'.repeat(64),stage:'must-not-start-model'}),/history|settlement/);
 assert.deepEqual(await readFile(join(directory,'run.json')),before);assert.equal((await readReviewCosts(directory)).calls.length,1);
});

test('a nearly full current snapshot cannot reserve a call with no room to settle it',async t=>{
 const root=await mkdtemp(join(tmpdir(),'hh-cost-terminal-room-'));t.after(()=>rm(root,{recursive:true,force:true}));const {directory}=await createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:root});
 await assert.rejects(reserveReviewCall(directory,{key:'3'.repeat(64),stage:'must-not-start-model',modelIdentity:{fixture:'x'.repeat(2*1024*1024-4096)}}),/settlement headroom/);
 assert.equal((await loadRun(directory)).manifest.reviewCosts,undefined);
});
