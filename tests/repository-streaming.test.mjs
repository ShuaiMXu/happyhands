import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {repositoryFingerprint,repositoryInputHash} from '../packages/harness-core/repository-fingerprint.js';
const exec=promisify(execFile);
test('streaming fingerprints retain every binary byte and explicit budgets reject rather than truncate',async t=>{
 const root=await mkdtemp(join(tmpdir(),'hh-stream-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const git=(...args)=>exec('git',args,{cwd:root});await git('init','-q');await git('config','user.name','Test');await git('config','user.email','test@example.invalid');
 const binary=Buffer.alloc(200000,37);binary[binary.length-1]=254;await writeFile(join(root,'asset.bin'),binary);await git('add','.');await git('commit','-qm','Fixture');
 const result=await repositoryFingerprint(root,{includeFiles:true});assert.equal(result.files[0].hash,createHash('sha256').update(binary).digest('hex'));assert.equal(result.contentHash,repositoryInputHash(result.files));
 await assert.rejects(repositoryFingerprint(root,{maxBytes:binary.length-1}),/no partial binding/);
 binary[binary.length-1]=253;await writeFile(join(root,'asset.bin'),binary);assert.notEqual((await repositoryFingerprint(root)).contentHash,result.contentHash);
});
