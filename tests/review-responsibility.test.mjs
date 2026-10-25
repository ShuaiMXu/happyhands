import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewResponsibility,responsibilityInstructions,readResponsibilityVerdict} from '../packages/workbench/review-responsibility.js';

test('regional and complete sessions require distinct explicit decisions without upgrading any result',()=>{
 const local=reviewResponsibility('regional-batch',['before/local.png','after/local.png']);
 assert.equal(local.kind,'regional-batch');assert.equal(local.decisionField,'regionalVerdict');
 assert.match(responsibilityInstructions(local),/completion is reserved/);
 for(const value of ['pass','fail','needs-evidence'])assert.equal(readResponsibilityVerdict({regionalVerdict:value},local),value);
 for(const result of [{verdict:'pass'},{regionalVerdict:'pass',verdict:'needs-evidence'},{regionalVerdict:'unknown'},{}])assert.throws(()=>readResponsibilityVerdict(result,local),/responsibility/);
 for(const purpose of ['cross-region','regional']){
  const whole=reviewResponsibility(purpose,['after/task.png']);assert.equal(whole.decisionField,'verdict');
  assert.match(responsibilityInstructions(whole),/verify the confirmed task/);
  for(const value of ['pass','fail','needs-evidence'])assert.equal(readResponsibilityVerdict({verdict:value},whole),value);
  assert.throws(()=>readResponsibilityVerdict({regionalVerdict:'pass'},whole),/responsibility/);
 }
});
