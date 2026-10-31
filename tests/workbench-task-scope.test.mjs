import test from 'node:test';
import assert from 'node:assert/strict';
import {jobBelongsToRun, loadOperationsData, reviewErrorIsHistorical, reviewLink} from '../apps/designer/cowart/operations.js';
import {setLanguage} from '../apps/designer/i18n.js';
test('review tasks exclude unrelated onboarding and retain refresh lineage', () => {
  assert.equal(jobBelongsToRun({kind:'onboard',runId:'other'},'current'),false);
  assert.equal(jobBelongsToRun({kind:'onboard',originRunId:'current'},'current'),true);
  assert.equal(jobBelongsToRun({runId:'new',originRunId:'current'},'new'),true);
  assert.equal(jobBelongsToRun({resultRunId:'current'},'current'),true);
  assert.equal(jobBelongsToRun({kind:'onboard'},undefined),true);
});
test('report links retain selected language and encode run identifiers', () => {
  for (const language of ['en','zh']) {
    setLanguage(language);
    const query = new URLSearchParams(reviewLink('a&b').slice(1));
    assert.equal(query.get('case'),'run:a&b');
    assert.equal(query.get('lang'),language);
  }
});

const passedState=(reviewedAt='2026-10-31T10:02:00.000Z')=>({workflow:{stage:'awaiting-judgment'},reviews:[{skillId:'visual-qa-evaluator',verdict:'pass',reviewedAt}]});
const failedJob={runId:'same',status:'succeeded',finishedAt:'2026-10-31T10:01:00.000Z',result:{reviewError:'older failure'}};

test('a later passing review makes the same-run error historical without deleting it',()=>{
  assert.equal(reviewErrorIsHistorical(failedJob,passedState(),'same'),true);
  assert.equal(failedJob.result.reviewError,'older failure');
});

test('newer and undated review errors remain current',()=>{
  assert.equal(reviewErrorIsHistorical({...failedJob,finishedAt:'2026-10-31T10:03:00.000Z'},passedState(),'same'),false);
  assert.equal(reviewErrorIsHistorical({...failedJob,updatedAt:'2026-10-31T10:03:00.000Z'},passedState(),'same'),false);
  assert.equal(reviewErrorIsHistorical({...failedJob,finishedAt:undefined},passedState(),'same'),false);
  assert.equal(reviewErrorIsHistorical({...failedJob,updatedAt:'not-a-date'},passedState(),'same'),false);
});

test('unresolved, nonterminal, and unrelated-run errors remain current',()=>{
  assert.equal(reviewErrorIsHistorical(failedJob,{...passedState(),workflow:{stage:'needs-visual-qa'}},'same'),false);
  assert.equal(reviewErrorIsHistorical({...failedJob,status:'running'},passedState(),'same'),false);
  assert.equal(reviewErrorIsHistorical({...failedJob,runId:'other'},passedState(),'same'),false);
});

test('job loading survives a failed state request',async()=>{
  const jobs=[failedJob],calls=[];
  const result=await loadOperationsData(async path=>{calls.push(path);if(path==='jobs')return jobs;throw new Error('state unavailable');},'same');
  assert.deepEqual(result,{jobs,state:null});
  assert.deepEqual(calls,['jobs','state?run=same']);
});
