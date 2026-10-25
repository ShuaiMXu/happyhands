// Optional read-only replay of a real locally exported planning baseline.
import assert from 'node:assert/strict';import {chromium} from 'playwright-core';import {mkdir,writeFile} from 'node:fs/promises';import {join} from 'node:path';
const base=process.env.REVIEW_PLANNING_URL,runId=process.env.REVIEW_PLANNING_RUN,output=process.env.REVIEW_PLANNING_REAL_EVIDENCE;
if(!base||!runId||!output)throw Error('Set REVIEW_PLANNING_URL, REVIEW_PLANNING_RUN and REVIEW_PLANNING_REAL_EVIDENCE.');
const origin=new URL(base);assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname));assert.match(runId,/^[a-z0-9_-]+$/);await mkdir(output,{recursive:true});
const manifest=await fetch(base+'/runs/'+runId+'/run.json').then(response=>{assert.equal(response.ok,true);return response.json();});
assert.ok(manifest.onboarding.config.reviewPlanApproval);assert.equal(manifest.execution,null);assert.equal(manifest.judgment,null);assert.equal(manifest.confirmation,null);assert.ok(manifest.captures.before.states.every(state=>state.reached));assert.ok(manifest.captures.before.states.some(state=>state.actionEvidence?.some(action=>action.type==='assert-state'&&action.verified)));
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 for(const width of [1280,390])for(const view of ['canvas','list','codediff']){
  await page.setViewportSize({width,height:900});await page.goto(base+`/apps/designer/?case=run%3A${runId}&view=${view}&lang=zh`,{waitUntil:'networkidle'});await page.locator('[data-review-primary]:visible').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:join(output,`${view}-${width}.png`)});
 }
 assert.deepEqual(errors,[]);await writeFile(join(output,'result.json'),JSON.stringify({kind:'real-baseline-readonly-replay',runId,sourceCommit:manifest.onboarding.repository.commit,targets:manifest.captures.before.states.length,widths:[1280,390],views:['canvas','list','codediff'],noNewSourceEditOrJudgment:true,errors},null,2));console.log('PASS: real planned baseline in 3 views on desktop/mobile; recorded assertions, no overflow or script errors; no source edits or judgment. Evidence: '+output);
}finally{await browser.close();}
