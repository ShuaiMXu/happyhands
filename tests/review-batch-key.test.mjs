import test from 'node:test';import assert from 'node:assert/strict';
import {reviewBatchKey} from '../packages/harness-core/review-batch-key.js';
for(const [label,a,b] of [['windows','C:\\review\\first','C:\\review\\retry'],['posix','/tmp/review/first','/tmp/review/retry']]){
 test(label+': changing only the prompt staging directory preserves the input key',()=>{
  const context={task:'Inspect the same actual source',originals:['before/desktop.png','after/desktop.png']};
  assert.equal(reviewBatchKey({prompt:'Read '+a+'/methods',context},a),reviewBatchKey({prompt:'Read '+b+'/methods',context},b));
 });
 test(label+': literal paths in user/source data must remain semantically distinct',()=>{
  const input=dir=>({prompt:'Read '+dir+'/methods',context:{task:'Inspect this literal path '+dir}});
  assert.notEqual(reviewBatchKey(input(a),a),reviewBatchKey(input(b),b));
 });
}
test('source, model identity and exact image changes invalidate the key',()=>{
 const input={prompt:'Read /session/methods',context:{source:'A'},identity:{model:'one'},images:{before:'sha-A'}};
 for(const change of [{context:{source:'B'}},{identity:{model:'two'}},{images:{before:'sha-B'}}])assert.notEqual(reviewBatchKey(input,'/session'),reviewBatchKey({...input,...change},'/session'));
});
