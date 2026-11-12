import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const execute=promisify(execFile),root=fileURLToPath(new URL('../',import.meta.url));

test('source Harness and lightweight entry route to the actual video workflow',async()=>{
 for(const entry of ['scripts/harness.mjs','skills/happyhands/bin/happyhands.mjs']){
  const result=JSON.parse((await execute(process.execPath,[entry,'video','help'],{cwd:root})).stdout);
  assert.equal(result.status,'help');
  assert.ok(result.commands.some(command=>command.startsWith('collect ')));
  assert.equal(result.independentReview,'required');
  assert.match(result.humanJudgment,/explicit user decision/);
 }
});

test('video routing preserves strict subcommand options and failure exit status',async()=>{
 for(const entry of ['scripts/harness.mjs','skills/happyhands/bin/happyhands.mjs']){
  await assert.rejects(execute(process.execPath,[entry,'video','collect','--manifest','missing.json','--out','unused','--publish','true'],{cwd:root}),error=>error.code===1&&/Usage: video-review/.test(error.stderr));
 }
});
