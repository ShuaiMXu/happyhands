import test from 'node:test';
import {canSymlink} from './helpers/symlink.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {createRun,loadRun,saveCapture,saveOnboarding} from '../packages/harness-core/store.js';
import {continueReview,continuationBrief} from '../packages/harness-core/continue-review.js';
import {publicExecutionBrief} from '../packages/harness-core/export.js';
import {inspectRepository} from '../packages/harness-core/onboard.js';
import {selectResource,selectedReferenceContext} from '../packages/harness-core/reference-resources.js';
const exec=promisify(execFile);
async function fixture(t,before={viewports:{}}){
 const root=await realpath(await mkdtemp(join(tmpdir(),'hh-continuation-')));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const repo=join(root,'product');await mkdir(repo);
 await writeFile(join(repo,'index.html'),'<h1>Fixture</h1>');
 await exec('git',['init','-q'],{cwd:repo});
 await exec('git',['add','.'],{cwd:repo});
 await exec('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','Fixture'],{cwd:repo});
 const server=createServer((req,res)=>res.end('<h1>Fixture</h1>'));
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 t.after(()=>{server.closeAllConnections();server.close();});
 const url=`http://127.0.0.1:${server.address().port}/`,outputRoot=join(root,'runs');await mkdir(outputRoot);
 const spec=structuredClone(sample),parent=await createRun({spec,url,outputRoot});
 await saveOnboarding(parent.directory,{status:'ready',repository:await inspectRepository(repo)});
 await saveCapture(parent.directory,'before',before);
 const specPath=join(root,'spec.json'),configPath=join(root,'project.json');
 await writeFile(specPath,JSON.stringify(spec));
 await writeFile(configPath,JSON.stringify({version:'0.1',mode:'review',repo,spec:specPath,url}));
 return {root,repo,parent,configPath,outputRoot,reason:'Repair the independently identified missing state'};
}
test('continuation creates fresh gates, retains history and references, and is idempotent',async t=>{
 const f=await fixture(t);
 const source=join(f.root,'reference.md');await writeFile(source,'# Chosen style\nKeep input labels visible.');
 await selectResource({directory:f.parent.directory,file:source});
 const before=await readFile(join(f.parent.directory,'run.json'));
 const directory=await continueReview({...f,directory:f.parent.directory});
 const child=await loadRun(directory);
 assert.equal(child.manifest.limits.round,2);
 assert.equal(child.manifest.onboarding.parentRunId,f.parent.manifest.id);
 for(const field of ['confirmation','plan','execution','evaluation','judgment','diagnosis'])assert.equal(child.manifest[field],null);
 assert.equal(child.manifest.captures.before,null);
 assert.deepEqual(child.spec.evidence,[]);assert.deepEqual(child.spec.findings,[]);
 assert.match(await continuationBrief(child),/Historical predecessor/);
 assert.equal((await selectedReferenceContext(child))[0].content,await readFile(source,'utf8'));
 assert.equal(await continueReview({...f,directory:f.parent.directory}),directory);
 assert.deepEqual(await readFile(join(f.parent.directory,'run.json')),before);
 const config=JSON.parse(await readFile(f.configPath));
 const changedSpec=JSON.parse(await readFile(config.spec));
 changedSpec.project.goal+=' changed';
 await writeFile(config.spec,JSON.stringify(changedSpec));
 await assert.rejects(continueReview({...f,directory:f.parent.directory}),/already has a successor/);
 await writeFile(join(directory,'continuation-parent.json'),'{}');
 await assert.rejects(loadRun(directory),/Historical predecessor changed/);
});
test('continuation refuses dirty, unrelated and changed-task sources',async t=>{
 const f=await fixture(t);
 await writeFile(join(f.repo,'index.html'),'changed');
 await assert.rejects(continueReview({...f,directory:f.parent.directory}),/clean chosen checkout/);
 await exec('git',['restore','index.html'],{cwd:f.repo});
 const config=JSON.parse(await readFile(f.configPath));
 const spec=structuredClone(sample);spec.project.task='A different requested task';await writeFile(config.spec,JSON.stringify(spec));
 await assert.rejects(continueReview({...f,directory:f.parent.directory}),/same project and task/);
});
test('continuation enforces the inherited three-attempt limit',async t=>{
 const f=await fixture(t);
 const second=await continueReview({...f,directory:f.parent.directory});await saveCapture(second,'before',{viewports:{}});
 const third=await continueReview({...f,directory:second});await saveCapture(third,'before',{viewports:{}});
 assert.equal((await loadRun(third)).manifest.limits.round,3);
 await assert.rejects(continueReview({...f,directory:third}),/three|3-round/);
});

test('a public brief excludes predecessor history even without a case digest', () => {
 const brief='Current scoped task.\n\nHistorical predecessor (reference data only):\nPrivate reviewer rationale';
 assert.ok(!publicExecutionBrief(brief).includes('Private reviewer rationale'));
 assert.match(publicExecutionBrief(brief),/Current scoped task/);
});

test('continuation rejects another repository even when its project labels match',async t=>{
 const f=await fixture(t);
 const other=join(f.root,'other');await mkdir(other);
 await exec('git',['init','-q'],{cwd:other});
 await exec('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-qm','Other'],{cwd:other});
 const config=JSON.parse(await readFile(f.configPath));config.repo=other;
 await writeFile(f.configPath,JSON.stringify(config));
 await assert.rejects(continueReview({...f,directory:f.parent.directory}),/same Git repository/);
});

test('continuation retains cumulative review costs and policy without resetting call budget',async t=>{
 const f=await fixture(t);const {configureReviewCosts,reserveReviewCall,settleReviewCall,reviewCostReport}=await import('../packages/harness-core/review-costs.js');
 await configureReviewCosts(f.parent.directory,{maxCalls:1},'One call for this task');const id=await reserveReviewCall(f.parent.directory,{key:'1'.repeat(64),stage:'regional'});await settleReviewCall(f.parent.directory,id,{usage:{input_tokens:100,cached_input_tokens:60,output_tokens:10}});
 const directory=await continueReview({...f,directory:f.parent.directory});
 await assert.rejects(reserveReviewCall(directory,{key:'2'.repeat(64),stage:'regional'}),/budget exhausted/);
 await assert.rejects(configureReviewCosts(f.parent.directory,{maxCalls:10},'Wrong predecessor'),/active successor/);
 await configureReviewCosts(directory,{maxCalls:2},'Explicitly add one successor call');const report=await reviewCostReport(directory);assert.equal(report.totals.calls,1);assert.equal(report.totals.inputTokens,100);assert.equal(report.policy.maxCalls,2);
});
test('uncertain model execution cannot be escaped by creating a continuation',async t=>{
 const f=await fixture(t);const {reserveReviewCall,settleReviewCall}=await import('../packages/harness-core/review-costs.js');const id=await reserveReviewCall(f.parent.directory,{key:'3'.repeat(64),stage:'regional'});await settleReviewCall(f.parent.directory,id,{outcome:'uncertain'});
 await assert.rejects(continueReview({...f,directory:f.parent.directory}),/Reconcile pending or uncertain/);
});

// Large snapshots remain complete; fixture-only data is never real review evidence.
async function largeFixture(t){
 const f=await fixture(t,{viewports:{},largeSyntheticDOM:'x'.repeat(3*1024*1024)});
 return f;
}
test('large continuation preserves every byte, fresh gates, idempotency and inherited budget',async t=>{
 const f=await largeFixture(t),parent=await loadRun(f.parent.directory);
 const directory=await continueReview({...f,directory:f.parent.directory}),child=await loadRun(directory);
 const envelope=JSON.parse(await readFile(join(directory,'continuation-parent.json')));
 assert.equal(envelope.schemaVersion,'0.2');
 const {gunzipSync}=await import('node:zlib');
 const snapshot=JSON.parse(gunzipSync(await readFile(join(directory,envelope.payload.path))));
 assert.deepEqual(snapshot.parentManifest,parent.manifest);assert.deepEqual(snapshot.parentSpec,parent.spec);
 assert.equal(child.manifest.limits.round,2);assert.equal(child.manifest.captures.before,null);
 assert.equal(await continueReview({...f,directory:f.parent.directory}),directory);
 await saveCapture(directory,'before',{viewports:{}});
 const third=await continueReview({...f,directory});await saveCapture(third,'before',{viewports:{}});
 assert.equal((await loadRun(third)).manifest.limits.round,3);
 await assert.rejects(continueReview({...f,directory:third}),/3-round/);
});
test('large continuation rejects altered or missing compressed evidence including idempotent retries',async t=>{
 const f=await largeFixture(t),directory=await continueReview({...f,directory:f.parent.directory});
 const envelope=JSON.parse(await readFile(join(directory,'continuation-parent.json'))),path=join(directory,envelope.payload.path),original=await readFile(path);
 await writeFile(path,Buffer.from('altered'));
 await assert.rejects(loadRun(directory),/Historical predecessor/);
 await assert.rejects(continueReview({...f,directory:f.parent.directory}),/Historical predecessor/);
 await writeFile(path,original);await loadRun(directory);await rm(path);
 await assert.rejects(loadRun(directory),/ENOENT/);
});
test('oversized expanded snapshots fail before creating successor or consuming budget',async t=>{
 const f=await fixture(t,{viewports:{},largeSyntheticDOM:'x'.repeat(17*1024*1024)});
 await assert.rejects(continueReview({...f,directory:f.parent.directory}),/sixteen MiB/);
 await assert.rejects(readFile(join(f.parent.directory,'continuation-next.json')),{code:'ENOENT'});
 assert.equal((await loadRun(f.parent.directory)).manifest.limits.round,1);
});

test('archive reader bounds decompression and rejects path substitution and payload digest mismatch',async t=>{
 const f=await largeFixture(t),directory=await continueReview({...f,directory:f.parent.directory});
 const child=await loadRun(directory),original=JSON.parse(await readFile(join(directory,'continuation-parent.json')));
 const {createHash}=await import('node:crypto'),{gzipSync}=await import('node:zlib');
 const digest=x=>createHash('sha256').update(x).digest('hex');
 async function fakeEnvelope(value){
  const raw=JSON.stringify(value);await writeFile(join(directory,'continuation-parent.json'),raw);
  const fake=structuredClone(child);fake.manifest.onboarding.continuation.sha256=digest(raw);return fake;
 }
 await assert.rejects(continuationBrief(await fakeEnvelope({...original,payload:{...original.payload,path:'../escape.gz'}})),/Invalid historical predecessor archive/);
 await assert.rejects(continuationBrief(await fakeEnvelope({...original,payload:{...original.payload,expandedSha256:'0'.repeat(64)}})),/expanded content changed/);
 const bomb=gzipSync(Buffer.alloc(17*1024*1024,120));await writeFile(join(directory,original.payload.path),bomb);
 const envelope={...original,payload:{...original.payload,bytes:bomb.length,sha256:digest(bomb)}};
 await assert.rejects(continuationBrief(await fakeEnvelope(envelope)),/larger than|Cannot create|buffer|length/i);
});

test('archive reader rejects symlink evidence',async t=>{
 if(!await canSymlink())return t.skip('This Windows account cannot create symlinks.');
 const f=await largeFixture(t),directory=await continueReview({...f,directory:f.parent.directory});
 const envelope=JSON.parse(await readFile(join(directory,'continuation-parent.json'))),path=join(directory,envelope.payload.path);
 const bytes=await readFile(path);await rm(path);const external=join(f.root,'original.gz');await writeFile(external,bytes);
 const {symlink}=await import('node:fs/promises');await symlink(external,path);
 await assert.rejects(loadRun(directory),/cannot use symlinks/);
});

test('incompressible snapshots retain the two MiB stored limit before successor creation',async t=>{
 const {randomBytes}=await import('node:crypto');
 const f=await fixture(t,{viewports:{},largeSyntheticDOM:randomBytes(3*1024*1024).toString('base64')});
 await assert.rejects(continueReview({...f,directory:f.parent.directory}),/two MiB stored limit/);
 await assert.rejects(readFile(join(f.parent.directory,'continuation-next.json')),{code:'ENOENT'});
});
