import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRun,saveCapture,confirmFinding,saveEvaluation,loadRun,saveOnboarding} from '../packages/harness-core/store.js';
import {verificationBinding,saveVerificationEvidence,readVerificationEvidence,validateVerificationChecks,verificationHash} from '../packages/harness-core/verification.js';
import {runVerificationChecks} from '../packages/workbench/verification.js';
import {runAiVisualReview} from '../packages/workbench/ai-review.js';
import {exportRun} from '../packages/harness-core/export.js';
import {visualReviewFor} from '../packages/harness-core/workflow.js';
import {snapshotHash} from '../packages/skill-core/design-system.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
const check={id:'menu',command:'node',args:['check.mjs','{url}','{out}'],stage:'normal-interaction',method:'Real browser keyboard input; simulated API denial',limitations:['Chrome only; no OS denial certification'],stateIds:['menu'],screenshots:['menu.png']};
const snapshot={files:[]};
async function fixture(t,{dirty=false}={}){
  const root=await mkdtemp(join(tmpdir(),'verification-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const spec=JSON.parse(await readFile(new URL('../examples/happyclaw-site/experience.json',import.meta.url)));
  const outputRoot=join(root,'.harness/runs');await mkdir(outputRoot,{recursive:true});
  const run=await createRun({spec,url:'http://localhost',outputRoot});
  for(const phase of ['before','after']){
    if(phase==='after')await confirmFinding(run.directory,spec.findings[0].id,'supported','Fixture verification');
    await mkdir(join(run.directory,phase));await writeFile(join(run.directory,phase,'menu--mobile.png'),png);
    await saveCapture(run.directory,phase,{states:[{stateId:'menu',configurationId:'mobile',reached:true,screenshot:`${phase}/menu--mobile.png`}],designSystemSource:{repositoryCommit:'a'.repeat(40),dirty,status:'capture-scan-match',snapshotHash:snapshotHash(snapshot)},verificationPreviewFingerprint:'preview',verificationOriginalHashes:{[`${phase}/menu--mobile.png`]:verificationHash(png)},verificationSource:{version:1,commit:'a'.repeat(40),dirty,contentHash:'b'.repeat(64),fileCount:1}});
  }
  await saveEvaluation(run.directory,{status:'fixture'});
  return {run,root,binding:await verificationBinding(run.directory,(await loadRun(run.directory)).manifest)};
}
const record=()=>({...check,status:'pass',result:{status:'pass',checks:[{focus:'wrapped',clipboard:'actual readback'}]},images:[png],checkHash:verificationHash(check)});
async function review(run,root,generate){const cwd=join(root,'review-'+Math.random().toString(36).slice(2));await mkdir(cwd);return runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate});}
function model(verdict='pass',inspect=()=>{}){return async(command,args,options)=>{
  const context=JSON.parse(await readFile(join(options.cwd,'review-context.json')));await inspect(context,args,options);
  await writeFile(args[args.indexOf('-o')+1],JSON.stringify({verdict,verificationRefs:context.verification.records.map(r=>r.id),screenshotRefs:context.evidence.map(e=>e.reference),findings:[],rationale:'Fixture result',limitations:['Fixture only']}));
};}
test('specialist records and originals automatically enter QA; follow-up preserves previous needs-evidence and exports both',async t=>{
  const {run,root,binding}=await fixture(t);
  await review(run,root,model('needs-evidence'));
  const original=await readFile(join(run.directory,'reviews/visual-qa-evaluator.json'),'utf8');
  await saveVerificationEvidence(run.directory,{binding,records:[record()]});
  assert.equal(visualReviewFor((await loadRun(run.directory)).manifest,'visual-qa-evaluator'),null);
  await review(run,root,model('pass',context=>{
    assert.equal(context.previousReview.verdict,'needs-evidence');assert.equal(context.verification.records[0].result.checks[0].focus,'wrapped');
    assert.equal(context.evidence.length,3);assert.match(context.verification.records[0].method,/simulated/);
  }));
  const manifest=(await loadRun(run.directory)).manifest;
  assert.equal(manifest.visualReviewHistory[0].verdict,'needs-evidence');assert.equal(visualReviewFor(manifest,'visual-qa-evaluator').verdict,'pass');
  assert.equal(await readFile(join(run.directory,'reviews/visual-qa-evaluator.json'),'utf8'),original);
  const out=await exportRun({directory:run.directory,outputRoot:join(root,'public')});
  assert.ok(out.files.includes(manifest.visualReviews[0].path));assert.ok(out.files.includes(manifest.visualReviewHistory[0].path));assert.ok(out.files.includes(manifest.verificationEvidence.path));
});
test('normal failures cannot pass and auxiliary observations stay supplemental',async t=>{
  const {run,root,binding}=await fixture(t);await saveVerificationEvidence(run.directory,{binding,records:[{...record(),status:'needs-evidence',result:{status:'needs-evidence'}}]});
  await assert.rejects(review(run,root,model()),/successful normal/);
  await saveVerificationEvidence(run.directory,{binding,records:[{...record(),status:'fail',result:{status:'fail'},stage:'auxiliary'}]});
  assert.equal((await review(run,root,model())).verdict,'pass');
});
test('rejects missing acknowledgement, tampered records, symlinks, wrong capture, oversized evidence and excess images',async t=>{
  const {run,root,binding}=await fixture(t);await saveVerificationEvidence(run.directory,{binding,records:[record()]});
  await assert.rejects(saveVerificationEvidence(run.directory,{binding:{...binding,runId:'wrong'},records:[record()]}),/source changed/);
  await assert.rejects(saveVerificationEvidence(run.directory,{binding,records:[{...record(),result:{large:'x'.repeat(256*1024)}}]}),/total limit/);
  await assert.rejects(saveVerificationEvidence(run.directory,{binding,records:[{...record(),images:Array(13).fill(png)}]}),/12 bounded/);
  const manifest=(await loadRun(run.directory)).manifest,data=await readVerificationEvidence(run.directory,manifest),path=join(run.directory,data.records[0].path);
  await writeFile(path,'{}');await assert.rejects(readVerificationEvidence(run.directory,manifest),/changed/);
  await rm(path);
  // Windows junctions exercise the same lstat guard without requiring the
  // machine-wide privilege needed to create a file symlink. POSIX retains the
  // file-link case; neither platform skips the rejection assertion.
  const external=join(root,'external');
  if(process.platform==='win32'){await mkdir(external);await symlink(external,path,'junction');}
  else {await writeFile(external,'{}');await symlink(external,path);}
  await assert.rejects(readVerificationEvidence(run.directory,manifest),/symlinks/);
});
test('review cannot omit verification acknowledgement or race a new evidence revision',async t=>{
  const {run,root,binding}=await fixture(t);await saveVerificationEvidence(run.directory,{binding,records:[record()]});
  await assert.rejects(review(run,root,async(cmd,args,options)=>{await model()(cmd,args,options);const file=args[args.indexOf('-o')+1],result=JSON.parse(await readFile(file));delete result.verificationRefs;await writeFile(file,JSON.stringify(result));}),/acknowledge/);
  await assert.rejects(review(run,root,model('pass',()=>saveVerificationEvidence(run.directory,{binding,records:[record()]}))),/changed/);
});
test('configured runner binds source, preview, checks and bounded images and refuses changed source or build',async t=>{
  const {run,binding}=await fixture(t);await saveOnboarding(run.directory,{config:{verificationChecks:[check]}});
  await assert.rejects(readVerificationEvidence(run.directory,(await loadRun(run.directory)).manifest),/not completed/);
  const options={directory:run.directory,repo:'/fixture',url:'http://localhost',checks:[check],inspect:async()=>({commit:binding.source.repositoryCommit,dirty:false}),scan:async()=>snapshot,fingerprint:async()=> 'preview',fingerprintSource:async()=>binding.repository,execute:async(cmd,args)=>{const out=args[2];await writeFile(join(out,'result.json'),JSON.stringify({status:'pass',checks:['focus']}));await writeFile(join(out,'menu.png'),png);}};
  await runVerificationChecks(options);
  const bundle=await readVerificationEvidence(run.directory,(await loadRun(run.directory)).manifest);assert.equal(bundle.records[0].preview.binding,'capture-response-match');
  await assert.rejects(runVerificationChecks({...options,fingerprint:async()=> 'different'}),/preview no longer/);
  await assert.rejects(runVerificationChecks({...options,inspect:async()=>({commit:'b'.repeat(40),dirty:false})}),/source does not match/);
  await runVerificationChecks({...options,execute:async()=>{throw Error('test failure');}});
  assert.equal((await readVerificationEvidence(run.directory,(await loadRun(run.directory)).manifest)).records[0].status,'needs-evidence');
  assert.throws(()=>validateVerificationChecks([{...check,screenshots:['../private.png']}]));
});
test('exported follow-up remains readable and a later evidence revision removes stale pass from UI',async t=>{
  const {exportedReviewState}=await import('../apps/designer/cowart/review-state.js');
  const {run,root,binding}=await fixture(t);await saveVerificationEvidence(run.directory,{binding,records:[record()]});await review(run,root,model());
  const output=await exportRun({directory:run.directory,outputRoot:join(root,'public')});
  const manifest=JSON.parse(await readFile(join(output.directory,'run.json'))),item=manifest.visualReviews[0],document=JSON.parse(await readFile(join(output.directory,item.path)));
  assert.equal(exportedReviewState({manifest,reviews:[{...item,document}]}).reviews.length,1);
  await saveVerificationEvidence(run.directory,{binding,records:[record()]});const changed=(await loadRun(run.directory)).manifest;
  assert.equal(exportedReviewState({manifest:changed,reviews:[{...item,document}]}).reviews.length,0);
});
test('CLI help exposes verification without breaking its executable entry point',async()=>{
  const {execFile}=await import('node:child_process'),{promisify}=await import('node:util');
  const {stdout}=await promisify(execFile)(process.execPath,['scripts/harness.mjs','help']);assert.match(stdout,/harness verify/);
});
test('captured uncommitted worktrees are bound by content; later edits or a commit require a new capture',async t=>{
  const {run,binding}=await fixture(t,{dirty:true});
  const options={directory:run.directory,repo:'/fixture',url:'http://localhost',checks:[check],inspect:async()=>({commit:binding.source.repositoryCommit,dirty:true}),scan:async()=>snapshot,fingerprint:async()=> 'preview',fingerprintSource:async()=>binding.repository,execute:async(cmd,args)=>{await writeFile(join(args[2],'result.json'),JSON.stringify({status:'pass'}));await writeFile(join(args[2],'menu.png'),png);}};
  await runVerificationChecks(options);
  assert.equal((await readVerificationEvidence(run.directory,(await loadRun(run.directory)).manifest)).binding.source.dirty,true);
  await assert.rejects(runVerificationChecks({...options,fingerprintSource:async()=>({...binding.repository,contentHash:'changed'})}),/repository inputs changed/);
  await assert.rejects(runVerificationChecks({...options,scan:async()=>({files:[{path:'changed.js',content:'changed'}]})}),/source does not match/);
  await assert.rejects(runVerificationChecks({...options,inspect:async()=>({commit:binding.source.repositoryCommit,dirty:false})}),/source does not match/);
});
async function attestationFixture(t){
  const {run,root,binding}=await fixture(t);await saveVerificationEvidence(run.directory,{binding,records:[record()]});
  const manifest=(await loadRun(run.directory)).manifest,bundle=await readVerificationEvidence(run.directory,manifest);
  const review={schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'model',name:'Fixture independent reviewer',version:'1'},reviewedAt:new Date().toISOString(),verdict:'needs-evidence',screenshotRefs:['before/menu--mobile.png','after/menu--mobile.png',...bundle.records[0].images.map(i=>i.path)],verificationRefs:['menu'],verificationDigest:bundle.digest,findings:[],rationale:'Fixture evidence only',limitations:['Not real visual approval']};
  return {run,root,review};
}
test('CLI attest accepts verified specialist records and originals through authoritative store validation',async t=>{
  const {run,root,review}=await attestationFixture(t),file=join(root,'attestation.json');await writeFile(file,JSON.stringify(review));
  const {execFile}=await import('node:child_process'),{promisify}=await import('node:util');
  await promisify(execFile)(process.execPath,['scripts/harness.mjs','attest','--run',run.directory,'--input',file]);
  assert.equal((await loadRun(run.directory)).manifest.visualReviews[0].verificationDigest,review.verificationDigest);
});
test('workbench attest uses the same hydrated evidence validation',async t=>{
  const {run,root,review}=await attestationFixture(t),{createWorkbench}=await import('../packages/workbench/service.js'),service=createWorkbench(root);t.after(()=>service.close());
  const job=await service.action({runId:run.manifest.id,action:'attest',review});let result;
  for(let i=0;i<100;i++){result=await service.jobs.get(job.id);if(!['queued','running'].includes(result.status))break;await new Promise(r=>setTimeout(r,25));}
  assert.equal(result.status,'succeeded',result.error);assert.equal((await loadRun(run.directory)).manifest.visualReviews[0].verificationDigest,review.verificationDigest);
});
test('complete repository fingerprint catches JSON, MJS and binary changes while dirty remains true',async t=>{
  const {repositoryFingerprint}=await import('../packages/harness-core/repository-fingerprint.js');
  const {execFile}=await import('node:child_process'),{promisify}=await import('node:util'),execute=promisify(execFile);
  const repo=await mkdtemp(join(tmpdir(),'verification-inputs-'));t.after(()=>rm(repo,{recursive:true,force:true}));
  const files={'index.html':'<main>base</main>','data.json':'{"value":1}','verify.mjs':'export const value=1','asset.png':png};
  for(const[name,content]of Object.entries(files))await writeFile(join(repo,name),content);
  for(const args of [['init','-q'],['add','.'],['-c','user.name=Test','-c','user.email=test@example.local','commit','-qm','Fixture']])await execute('git',args,{cwd:repo});
  await writeFile(join(repo,'index.html'),'<main>uncommitted</main>');let previous=await repositoryFingerprint(repo);assert.equal(previous.dirty,true);
  for(const [name,content] of [['data.json','{"value":2}'],['verify.mjs','export const value=2'],['asset.png',Buffer.concat([png,Buffer.from('changed')])]]){
    await writeFile(join(repo,name),content);const current=await repositoryFingerprint(repo);assert.equal(current.dirty,true);assert.equal(current.commit,previous.commit);assert.notEqual(current.contentHash,previous.contentHash);previous=current;
  }
});
test('missing normal specialist results expose managed retry without losing the old verdict',async t=>{
  const {workflowState}=await import('../packages/harness-core/workflow.js'),{reviewPrimaryAction}=await import('../packages/harness-core/primary-action.js');
  const {run,root,binding}=await fixture(t);await saveOnboarding(run.directory,{config:{verificationChecks:[check]}});
  await saveVerificationEvidence(run.directory,{binding,records:[{...record(),status:'needs-evidence',result:{status:'needs-evidence'}}]});await review(run,root,model('needs-evidence'));
  const manifest=(await loadRun(run.directory)).manifest;
  // Earlier workflow stages are satisfied by a real diagnosis in production.
  manifest.diagnosis={findingCount:1};manifest.plan={};
  assert.equal(workflowState(manifest).stage,'needs-specialist-verification');assert.equal(reviewPrimaryAction(manifest).kind,'ai-review');
  assert.equal(manifest.visualReviews[0].verdict,'needs-evidence');
});
test('changing a captured original invalidates specialist binding before another review',async t=>{
  const {run,binding}=await fixture(t);await saveVerificationEvidence(run.directory,{binding,records:[record()]});
  await writeFile(join(run.directory,'after/menu--mobile.png'),Buffer.concat([png,Buffer.from('different')]));
  await assert.rejects(readVerificationEvidence(run.directory,(await loadRun(run.directory)).manifest),/Captured original PNG changed/);
});
test('missing JSON, malformed JSON, absent or invalid PNG retires a previous pass and exposes retry',async t=>{
  const {run,root,binding}=await fixture(t);
  const options={directory:run.directory,repo:'/fixture',url:'http://localhost',checks:[check],inspect:async()=>({commit:binding.source.repositoryCommit,dirty:false}),scan:async()=>snapshot,fingerprint:async()=> 'preview',fingerprintSource:async()=>binding.repository};
  for(const kind of ['missing-json','malformed-json','missing-image','invalid-image']){
    await saveVerificationEvidence(run.directory,{binding,records:[record()]});await review(run,root,model());
    await runVerificationChecks({...options,execute:async(cmd,args)=>{
      const out=args[2];if(kind!=='missing-json')await writeFile(join(out,'result.json'),kind==='malformed-json'?'{bad':JSON.stringify({status:'pass'}));
      if(kind==='invalid-image')await writeFile(join(out,'menu.png'),'not a png');
    }});
    const manifest=(await loadRun(run.directory)).manifest;
    assert.equal(visualReviewFor(manifest,'visual-qa-evaluator'),null,kind);assert.equal(manifest.verificationEvidence.retryable,true,kind);
    assert.equal((await readVerificationEvidence(run.directory,manifest)).records[0].status,'needs-evidence');
  }
});
test('capture-time prerequisites cannot be synthesized retrospectively for legacy captures',async t=>{
  const {run}=await fixture(t),manifest=(await loadRun(run.directory)).manifest;
  for(const [phase,field] of [['before','verificationOriginalHashes'],['after','verificationOriginalHashes'],['after','verificationSource'],['after','verificationPreviewFingerprint']]){
    const legacy=structuredClone(manifest);delete legacy.captures[phase][field];await assert.rejects(verificationBinding(run.directory,legacy),/fingerprint|capture-time/);
  }
});
test('corrupted evidence hides the current pass and prevents human acceptance',async t=>{
  const {run,root,binding}=await fixture(t);await saveVerificationEvidence(run.directory,{binding,records:[record()]});await review(run,root,model());
  const manifest=(await loadRun(run.directory)).manifest,bundle=await readVerificationEvidence(run.directory,manifest);await writeFile(join(run.directory,bundle.records[0].path),'{}');
  const {saveJudgment}=await import('../packages/harness-core/store.js');await assert.rejects(saveJudgment(run.directory,'accept','Fixture attempted acceptance'),/changed/);
  const {createWorkbench}=await import('../packages/workbench/service.js'),service=createWorkbench(root);t.after(()=>service.close());const state=await service.state(run.manifest.id);
  assert.equal(state.workflow.stage,'verification-invalid');assert.equal(state.reviews.length,0);assert.match(state.verificationError,/changed/);assert.equal((await loadRun(run.directory)).manifest.judgment,null);
});
test('shared CLI/workbench capture boundary records both original hashes and preview binding only when requested',async t=>{
  const {captureWithDesignSystem}=await import('../packages/harness-core/design-system.js');
  const {execFile}=await import('node:child_process'),{promisify}=await import('node:util'),execute=promisify(execFile);
  const root=await mkdtemp(join(tmpdir(),'bound-capture-'));t.after(()=>rm(root,{recursive:true,force:true}));const repo=join(root,'source');await mkdir(repo);await writeFile(join(repo,'index.html'),'<main>fixture</main>');
  for(const args of [['init','-q'],['add','.'],['-c','user.name=Test','-c','user.email=test@example.local','commit','-qm','Fixture']])await execute('git',args,{cwd:repo});
  const spec=JSON.parse(await readFile(new URL('../examples/happyclaw-site/experience.json',import.meta.url))),run=await createRun({spec,url:'http://fixture',outputRoot:root});
  for(const phase of ['before','after']){
    if(phase==='after')await confirmFinding(run.directory,spec.findings[0].id,'supported','Fixture');
    const captured=await captureWithDesignSystem({directory:run.directory,repo,phase,bindVerificationSource:true,verificationUrl:'http://fixture',fingerprintPreview:async url=>{assert.equal(url,'http://fixture');return 'c'.repeat(64);},capture:async()=>{await mkdir(join(run.directory,phase));const screenshot=`${phase}/menu--mobile.png`;await writeFile(join(run.directory,screenshot),png);return{states:[{stateId:'menu',configurationId:'mobile',reached:true,screenshot}]};}});
    assert.equal(captured.verificationOriginalHashes[`${phase}/menu--mobile.png`],verificationHash(png));assert.equal(captured.verificationPreviewFingerprint,'c'.repeat(64));
  }
  const binding=await verificationBinding(run.directory,(await loadRun(run.directory)).manifest);assert.equal(Object.keys(binding.originalHashes).length,2);
  // A normal source scan can remain usable on a repository outside the stricter
  // specialist boundary. Binding must not become mandatory for ordinary captures.
  const ordinary=await createRun({spec,url:'http://fixture',outputRoot:root});
  if(process.platform==='win32'){
    const external=join(root,'external');await mkdir(external);await symlink(external,join(repo,'linked'),'junction');
  } else await symlink('index.html',join(repo,'linked.html'));
  const result=await captureWithDesignSystem({directory:ordinary.directory,repo,phase:'before',scan:async()=>snapshot,capture:async()=>({states:[]})});assert.equal(result.verificationSource,undefined);
});
