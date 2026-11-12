import test from 'node:test';
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
async function fixture(t){
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
 await saveCapture(parent.directory,'before',{viewports:{}});
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
