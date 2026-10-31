import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRun,loadRun} from '../packages/harness-core/store.js';
import {createReviewedPullRequest,verifyPublication} from '../packages/workbench/pull-request.js';
const spec=JSON.parse(await readFile(new URL('../examples/happyclaw-site/experience.json',import.meta.url),'utf8'));
async function fixture(t,{accepted=true,existing=false,remote='https://github.com/example/app.git'}={}){
 const root=await mkdtemp(join(tmpdir(),'publication-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const run=await createRun({spec,url:'http://127.0.0.1:4357',outputRoot:root,id:'pr-test'}),worktree=join(run.directory,'worktree');await mkdir(worktree);
 run.manifest.judgment=accepted?{decision:'accept',reason:'Test fixture final decision'}:null;
 run.manifest.execution={exitCode:0,branch:'pd/pr-test',baseCommit:'a'.repeat(40),worktree,changedFiles:['src/page.js']};
 await writeFile(join(run.directory,'run.json'),JSON.stringify(run.manifest));
 const calls=[];const command=async(name,args,options)=>{calls.push({name,args,options});
  const key=[name,...args].join(' ');
  if(key==='git branch --show-current')return 'pd/pr-test';
  if(key==='git remote get-url origin')return remote;
  if(key==='git diff --name-only')return '';
  if(key.startsWith('git diff --name-only '))return 'src/page.js\n';
  if(key.startsWith('git diff --cached'))return 'src/page.js\n';
  if(key.startsWith('gh pr list'))return JSON.stringify(existing?[{url:'https://github.com/example/app/pull/12',isDraft:true,headRefOid:'d'.repeat(40)}]:[]);
  if(key.includes('/git/commits/'))return JSON.stringify({tree:{sha:'c'.repeat(40)},parents:[{sha:'a'.repeat(40)}]});
  if(key.startsWith('gh api'))return 'main';
  if(key==='git write-tree')return 'c'.repeat(40);
  if(key.startsWith('git commit-tree'))return 'd'.repeat(40);
  if(key.startsWith('gh pr create'))return 'https://github.com/example/app/pull/12';
  if(key==='git rev-parse HEAD')return 'b'.repeat(40);
  return '';
 };
 return {run,root,worktree,calls,command,verify:async()=>worktree};
}
test('publication requires final acceptance before issuing any command',async t=>{
 const f=await fixture(t,{accepted:false});await assert.rejects(createReviewedPullRequest(f.run.directory,{cwd:f.root,command:f.command,verify:f.verify}),/Accept the final/);assert.equal(f.calls.length,0);
 await assert.rejects(verifyPublication(await loadRun(f.run.directory)),/Accept the final/);
});
test('accepted scoped publication stages only reviewed files and creates one draft PR',async t=>{
 const f=await fixture(t);const result=await createReviewedPullRequest(f.run.directory,{cwd:f.root,command:f.command,verify:f.verify});
 assert.equal(result.url,'https://github.com/example/app/pull/12');assert.equal(result.repository,'example/app');
 assert.deepEqual(f.calls.find(c=>c.name==='git'&&c.args[0]==='add').args,['add','--','src/page.js']);
 assert.deepEqual(f.calls.find(c=>c.name==='git'&&c.args[0]==='push').args,['push','origin',`${'d'.repeat(40)}:refs/heads/pd/pr-test`]);
 assert.deepEqual(f.calls.find(c=>c.args[0]==='commit-tree').args.slice(0,4),['commit-tree','c'.repeat(40),'-p','a'.repeat(40)]);
 assert.ok(f.calls.find(c=>c.name==='gh'&&c.args[1]==='create').args.includes('--draft'));
 assert.ok(f.calls.every(c=>c.options.cwd===f.worktree));
 assert.equal((await loadRun(f.run.directory)).manifest.pullRequest.url,result.url);
 assert.doesNotMatch(await readFile(join(f.root,'pull-request-body.md'),'utf8'),/127\.0\.0\.1|before\/|after\//);
});
test('retry reuses an existing PR and does not create a duplicate',async t=>{
 const f=await fixture(t,{existing:true});await createReviewedPullRequest(f.run.directory,{cwd:f.root,command:f.command,verify:f.verify});assert.equal(f.calls.filter(c=>c.name==='gh'&&c.args[1]==='create').length,0);
});
test('changed reviewed content and non-GitHub remotes cannot be pushed',async t=>{
 const f=await fixture(t);let checks=0;await assert.rejects(createReviewedPullRequest(f.run.directory,{cwd:f.root,command:f.command,verify:async()=>{if(++checks>1)throw Error('Content changed');return f.worktree;}}),/Content changed/);assert.equal(f.calls.some(c=>c.args[0]==='push'),false);
 const g=await fixture(t,{remote:'https://unrelated.example/app.git'});await assert.rejects(createReviewedPullRequest(g.run.directory,{cwd:g.root,command:g.command,verify:g.verify}),/GitHub origin/);assert.equal(g.calls.some(c=>c.args[0]==='add'),false);
});


test('legacy CRLF diagnostics remain in the ledger but cannot be staged as files',async t=>{
 const f=await fixture(t),run=await loadRun(f.run.directory);run.manifest.execution.changedFiles.unshift("warning: in the working copy of 'src/page.js', LF will be replaced by CRLF the next time Git touches it");await writeFile(join(run.directory,'run.json'),JSON.stringify(run.manifest));
 await createReviewedPullRequest(f.run.directory,{cwd:f.root,command:f.command,verify:f.verify});
 assert.deepEqual(f.calls.find(c=>c.args[0]==='add').args,['add','--','src/page.js']);assert.equal((await loadRun(f.run.directory)).manifest.execution.changedFiles.length,2);
 assert.ok(f.calls.every(c=>c.options.stdoutOnly));
});
