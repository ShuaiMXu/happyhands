import test from 'node:test';
import assert from 'node:assert/strict';
import {heroStoreFixture} from './helpers/hero-store-fixture.mjs';

test('source-bound Hero contexts retain actual PNG dimensions through the full store chain',async()=>{
 const {manifest,bundle}=await heroStoreFixture();
 assert.equal(manifest.visualReviews[0].verdict,'pass');
 assert.deepEqual(bundle.records[0].images.map(image=>[image.width,image.height]),[[80,50],[80,50],[39,84],[39,84]]);
});

test('static pairs, absent contexts and explicit lack of motion cannot persist a Hero pass',async()=>{
 for(const kind of ['missing-runtime','false-motion','desktop-only'])await assert.rejects(heroStoreFixture({kind}),/motion-observed context/);
});

test('a changed after route cannot remove an expected mobile Hero from the acceptance scope',async()=>{
 await assert.rejects(heroStoreFixture({kind:'redirect'}),/homepage route/);
 await assert.rejects(heroStoreFixture({kind:'newly-reachable'}),/motion-observed context/);
});

test('reused indexes, repeated originals and wrong viewport frames cannot persist a Hero pass',async()=>{
 await assert.rejects(heroStoreFixture({kind:'duplicate-frame-index'}),/distinct frame indexes/);
 await assert.rejects(heroStoreFixture({kind:'duplicate-images'}),/distinct original frames/);
 await assert.rejects(heroStoreFixture({kind:'wrong-dimensions'}),/configuration viewport/);
 const configs=[{id:'dark',width:80,height:50},{id:'light',width:80,height:50}];
 await assert.rejects(heroStoreFixture({kind:'reuse-frame-pair',configs}),/own original frame sequences/);
 await assert.rejects(heroStoreFixture({kind:'reuse-frame-hashes',configs}),/own original frame sequences/);
 assert.equal((await heroStoreFixture({configs})).manifest.visualReviews[0].verdict,'pass');
});
