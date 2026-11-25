import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';

const exec=promisify(execFile);
const entry=fileURLToPath(new URL('../scripts/harness.mjs',import.meta.url));
// Node itself can write to stderr (an experimental-feature warning, for example
// when NODE_USE_ENV_PROXY is set). Only the CLI's own output is under test here.
const ownStderr=stderr=>stderr.split('\n').filter(line=>line&&!/^\(node:\d+\)/.test(line)&&!/--trace-warnings/.test(line)).join('\n');
for(const flag of ['--help','-h'])test(`source CLI ${flag} works outside a project`,async()=>{
 const result=await exec(process.execPath,[entry,flag],{cwd:tmpdir()});
 assert.match(result.stdout,/HappyHands Harness/);
 assert.match(result.stdout,/pnpm harness capture/);
 assert.match(result.stdout,/experience .*--phase context .*--step inspect\|method\|record.*--topic TOPIC/);
 assert.equal(ownStderr(result.stderr),'');
});
test('an unknown top-level option remains an error',async()=>{
 await assert.rejects(exec(process.execPath,[entry,'--unknown'],{cwd:tmpdir()}),error=>error.code===1&&/Unknown command: --unknown/.test(error.stderr));
});
