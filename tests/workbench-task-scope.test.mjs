import test from 'node:test';
import assert from 'node:assert/strict';
import {jobBelongsToRun, reviewLink} from '../apps/designer/cowart/operations.js';
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
