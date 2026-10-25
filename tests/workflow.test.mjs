import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowState} from '../packages/harness-core/workflow.js';

test('confirmed historical replay reaches the same evidence, QA and judgment gates without a new edit', () => {
  const replay={captures:{before:{states:[{stateId:'page',configurationId:'mobile',screenshot:'before/page--mobile.png'}]},after:{states:[{stateId:'page',configurationId:'mobile',screenshot:'after/page--mobile.png',reached:true}]}},confirmation:{verdict:'supported'},evaluation:{},visualReviews:[]};
  assert.equal(workflowState(replay).stage,'needs-visual-qa');
  replay.visualReviews=[{skillId:'visual-qa-evaluator',verdict:'needs-evidence'}];
  assert.equal(workflowState(replay).stage,'visual-qa-needs-evidence');
  replay.visualReviews[0].verdict='fail';
  assert.equal(workflowState(replay).stage,'visual-qa-failed');
  replay.visualReviews[0].verdict='pass';
  assert.equal(workflowState(replay).stage,'awaiting-judgment');
  assert.equal(replay.execution,undefined);
  assert.equal(replay.judgment,undefined);
  replay.captures.after.states[0].reached=false;
  assert.equal(workflowState(replay).stage,'visual-qa-needs-evidence');
  delete replay.confirmation;
  assert.equal(workflowState(replay).stage,'needs-diagnosis');
});
