import test from 'node:test';
import assert from 'node:assert/strict';
import { groupReviewHistory, reviewProject } from '../apps/designer/review-history.js';

test('the same repository groups historical source descriptions and different review names together', () => {
  const records = [
    { value: 'run:one', summary: { project: 'System review', source: 'https://github.com/owner/site' } },
    { value: 'run:two', summary: { project: 'Site review', source: 'https://github.com/owner/site (baseline abc, reviewed yesterday)' } },
    { value: 'sample' }
  ];
  const groups = groupReviewHistory(records);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].name, 'site');
  assert.deepEqual(groups[0].records.map(item => item.value), ['run:one', 'run:two']);
  assert.equal(groups[1].examples, true);
});

test('different owners and directories never collapse into one folder just because their names match', () => {
  assert.notEqual(reviewProject('https://github.com/one/site').key, reviewProject('https://github.com/two/site').key);
  assert.notEqual(reviewProject('C:/one/site').key, reviewProject('C:/two/site').key);
  assert.equal(reviewProject('C:\\Projects\\Site').key, reviewProject('c:/projects/site/').key);
  assert.equal(reviewProject('https://github.com/one/site.git').key, reviewProject('https://github.com/one/site').key);
});
