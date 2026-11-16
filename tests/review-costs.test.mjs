import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {createRun,loadRun} from '../packages/harness-core/store.js';
import {configureReviewCosts,reserveReviewCall,settleReviewCall,reviewCostReport,readReviewCosts,reviewUsageCollector,reconcileReviewCall} from '../packages/harness-core/review-costs.js';
const key='1'.repeat(64),measured={input_tokens:100,cached_input_tokens:80,output_tokens:10};
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'hh-review-cost-'));t.after(()=>rm(root,{recursive:true,force:true}));return createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:root});}
test('usage parsing handles split JSON, identical duplicates, cache counts and ambiguous/oversized output',()=>{
 const c=reviewUsageCollector(),line=JSON.stringify({type:'turn.completed',usage:measured});c.push(line.slice(0,10));c.push(line.slice(10)+'\n'+line+'\n');assert.deepEqual(c.finish(),measured);
 const ambiguous=reviewUsageCollector();ambiguous.push(line+'\n'+JSON.stringify({type:'turn.completed',usage:{...measured,input_tokens:101}}));assert.equal(ambiguous.finish(),null);
 const oversized=reviewUsageCollector();oversized.push('x'.repeat(300000));oversized.push('\n'+line);assert.equal(oversized.finish(),null);
 assert.equal(reviewUsageCollector().finish(),null);
});
test('concurrent reservations cannot overspend a one-call policy; policy changes preserve all costs',async t=>{
 const {directory}=await fixture(t);await configureReviewCosts(directory,{maxCalls:1},'One measured call');
 const results=await Promise.allSettled([reserveReviewCall(directory,{key,stage:'regional'}),reserveReviewCall(directory,{key,stage:'regional'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const id=results.find(r=>r.status==='fulfilled').value;await settleReviewCall(directory,id,{usage:measured});
 await assert.rejects(reserveReviewCall(directory,{key:'2'.repeat(64),stage:'cross'}),/budget exhausted/);
 await configureReviewCosts(directory,{maxCalls:2},'Explicitly allow a second call');const report=await reviewCostReport(directory);assert.equal(report.totals.calls,1);assert.equal(report.totals.uncachedInputTokens,20);assert.equal(report.policyChanges.length,2);
});
test('unknown usage and exhausted token thresholds block the next call instead of counting as zero',async t=>{
 const a=await fixture(t);await configureReviewCosts(a.directory,{maxInputTokens:100},'Measured limit');const id=await reserveReviewCall(a.directory,{key,stage:'regional'});await settleReviewCall(a.directory,id);await assert.rejects(reserveReviewCall(a.directory,{key:'2'.repeat(64),stage:'cross'}),/unknown/);
 const b=await fixture(t);await configureReviewCosts(b.directory,{maxInputTokens:100},'Measured limit');const other=await reserveReviewCall(b.directory,{key,stage:'regional'});await settleReviewCall(b.directory,other,{usage:measured});await assert.rejects(reserveReviewCall(b.directory,{key:'2'.repeat(64),stage:'cross'}),/token budget/);
});
test('uncertain execution requires a bound receipt, preserves the original record and rejects receipt tampering',async t=>{
 const {directory}=await fixture(t);const id=await reserveReviewCall(directory,{key,stage:'regional'});await settleReviewCall(directory,id,{outcome:'uncertain'});await assert.rejects(reserveReviewCall(directory,{key,stage:'regional',retryReason:'Retry'}),/uncertain/);
 const receipt={callId:id,execution:'not-started',usage:{input_tokens:0,cached_input_tokens:0,output_tokens:0},providerReceipt:'Synthetic test receipt; not actual provider execution evidence'};await writeFile(join(directory,'receipt.json'),JSON.stringify(receipt));
 await reconcileReviewCall(directory,id,{reason:'Synthetic reconciliation',evidencePath:'receipt.json'});const record=await readReviewCosts(directory);assert.equal(record.calls[0].outcome,'uncertain');assert.equal(record.calls[0].reconciliation.execution,'not-started');
 await assert.rejects(reserveReviewCall(directory,{key,stage:'regional'}),/retry reason/);await reserveReviewCall(directory,{key,stage:'regional',retryReason:'Provider receipt confirms this attempt never started'});
 await writeFile(join(directory,'receipt.json'),'{}');await assert.rejects(readReviewCosts(directory),/receipt changed/);
});
test('ledger tampering cannot release reservations or erase costs',async t=>{
 const {directory}=await fixture(t);await reserveReviewCall(directory,{key,stage:'regional'});const run=await loadRun(directory),path=join(directory,run.manifest.reviewCosts.path);await writeFile(path,'{}');await assert.rejects(readReviewCosts(directory),/ledger changed/);
});

test('removing an earlier cost snapshot cannot erase the reservation history',async t=>{
 const {directory}=await fixture(t);const id=await reserveReviewCall(directory,{key,stage:'regional'});await settleReviewCall(directory,id,{usage:measured});const record=await readReviewCosts(directory);assert.ok(record.previous);await rm(join(directory,record.previous.path));await assert.rejects(readReviewCosts(directory),/ENOENT/);
});

test('a still-live pending call cannot be reconciled as not-started to free spending',async t=>{
 const {directory}=await fixture(t);const id=await reserveReviewCall(directory,{key,stage:'regional'});
 await writeFile(join(directory,'live-receipt.json'),JSON.stringify({callId:id,execution:'not-started',usage:{input_tokens:0,cached_input_tokens:0,output_tokens:0},providerReceipt:'Synthetic receipt must not override a live local owner'}));
 await assert.rejects(reconcileReviewCall(directory,id,{reason:'Attempted premature reconciliation',evidencePath:'live-receipt.json'}),/still active/);
 await assert.rejects(reserveReviewCall(directory,{key:'2'.repeat(64),stage:'cross'}),/pending/);
});

test('identical completed requests cannot silently start another paid review without recovery or reason',async t=>{
 const {directory}=await fixture(t);const id=await reserveReviewCall(directory,{key,stage:'regional'});await settleReviewCall(directory,id,{usage:measured});
 await assert.rejects(reserveReviewCall(directory,{key,stage:'regional'}),/identical model request already completed/);
 await assert.rejects(reserveReviewCall(directory,{key,stage:'regional',deduplicate:true}),/reusable result is missing/);
});
