import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {createRun,loadRun} from '../packages/harness-core/store.js';import {reserveReviewCall} from '../packages/harness-core/review-costs.js';import {saveReviewBatch,readReviewBatch} from '../packages/harness-core/review-batch-cache.js';
const key='a'.repeat(64);
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'hh-raw-batch-'));t.after(()=>rm(root,{recursive:true,force:true}));return createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:root});}
test('a raw batch requires its own reservation and never fabricates one',async t=>{
 const {directory}=await fixture(t);await assert.rejects(saveReviewBatch(directory,key,'{}','unrelated'),/exact model reservation/);assert.equal((await loadRun(directory)).manifest.reviewBatchResults,undefined);
 const id=await reserveReviewCall(directory,{key,stage:'synthetic-storage-test'});await saveReviewBatch(directory,key,'{"fixture":"raw only, not a model judgment"}',id);const record=await readReviewBatch(directory,key);assert.equal(record.callId,id);
});
test('JSON escaping cannot create an unreadable oversized raw-cache artifact',async t=>{
 const {directory}=await fixture(t);const id=await reserveReviewCall(directory,{key,stage:'synthetic-storage-limit'});await assert.rejects(saveReviewBatch(directory,key,'"'.repeat(1024*1024),id),/storage limit/);assert.equal((await loadRun(directory)).manifest.reviewBatchResults,undefined);
});
