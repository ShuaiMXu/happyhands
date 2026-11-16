import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewOutcomes} from '../packages/harness-core/review-outcomes.js';
test('a visual pass never implies design improvement or human acceptance',()=>{
 const output=reviewOutcomes({verdict:'pass',experienceAssessments:[{dimension:'hierarchy',verdict:'pass'},{dimension:'regression',verdict:'pass'}]});
 assert.equal(output.designImprovement,'not-assessed');assert.equal(output.regression,'pass');assert.equal(output.humanAcceptance,'pending');
});
test('preservation remains preservation and a human record remains separate',()=>{
 const output=reviewOutcomes({verdict:'pass',designComparison:{verdict:'preserved',reason:'Only contrast and focus repaired.'}},{verdict:'reject'});
 assert.equal(output.designImprovement,'preserved');assert.equal(output.humanAcceptance,'recorded-separately');
});
