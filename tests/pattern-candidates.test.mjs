import {fixture,files,entry} from './helpers/pattern-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {loadRun,withdrawJudgment} from '../packages/harness-core/store.js';
import {acceptedPatternHistory} from '../packages/harness-core/pattern-history.js';
import {patternCandidates,patternLibraryCurator} from '../packages/skill-core/patterns.js';
import {executeSkill} from '../packages/skill-core/runner.js';
import {extractFoundationInventory} from '../packages/skill-core/foundation-inventory.js';

function history(states=[entry(0),entry(1)]){
  return {status:'checked',records:[{runId:'synthetic-parent',judgmentHash:'a'.repeat(64),qaHash:'b'.repeat(64),capture:{states},originals:states.map(item=>({path:item.screenshot,hash:'c'.repeat(64)}))}],limitations:[],excluded:[]};
}
test('repeated accepted composite roots produce candidates with dependencies, examples and explicit guidance gaps',()=>{
  const sourceSnapshot={files,truncated:false},projectHistory=history();
  const result=patternLibraryCurator({sourceSnapshot,projectHistory});
  assert.equal(result.status,'needs-evidence');
  const [candidate]=result.proposedUpdates[0].candidates;
  assert.equal(candidate.name,'Panel');assert.equal(candidate.examples.length,2);assert.equal(candidate.dependencies.length,2);assert.equal(candidate.consumers.length,2);
  assert.ok(candidate.guidanceGaps.includes('when-to-avoid'));assert.equal(candidate.status,'observed');
  assert.equal(result.proposedUpdates.some(item=>item.type==='design-foundation'),false);
});
test('device copies, selector aliases, repeated IDs, missing identity, missing originals and differing actions do not establish reuse',()=>{
  for(const states of [
    [entry(0),entry(1,{configurationId:'mobile'})],
    [entry(0),entry(1,{domPath:entry(0).componentInstance.domPath})],
    [entry(0),entry(1,{id:'panel-0'})],
    [entry(0),entry(1,{domPath:null})],
    [entry(0),{...entry(1),actions:[{type:'click',selector:'#open'}]}],
    [entry(0),{...entry(1),start:{url:'https://another.invalid/page'}}],
    [entry(0),{...entry(1),start:{url:'http://localhost/page#different-view'}}]
  ])assert.deepEqual(patternCandidates({files,truncated:false},history(states)),[]);
  const missing=history();missing.records[0].originals.pop();assert.deepEqual(patternCandidates({files,truncated:false},missing),[]);
});
test('one-off compositions, primitives, source changes and partial scans remain unpromoted',()=>{
  assert.deepEqual(patternCandidates({files:files.filter(file=>file.path!=='PageB.jsx'),truncated:false},history()),[]);
  assert.deepEqual(patternCandidates({files:files.map(file=>file.path==='components/Panel.jsx'?{...file,content:'export default function Panel(){return <article/>}'}:file),truncated:false},history()),[]);
  assert.deepEqual(patternCandidates({files,truncated:true},history()),[]);
});

test('pattern token references include the directly supplied child component sources',()=>{
  const childTokens=files.map(file=>file.path==='components/Title.jsx'?{...file,content:file.content.replace('<h2>',`<h2 style={{color:'var(--title-color)'}}>`)}:file);
  assert.deepEqual(patternCandidates({files:childTokens,truncated:false},history())[0].tokenReferences,['--title-color']);
});

test('runner loads only source-matched bound accepted ancestry and pins its digest without granting Foundation approval',async t=>{
  const {repo,snapshot,run}=await fixture(t);
  const history=await acceptedPatternHistory(run,repo,snapshot);assert.equal(history.records.length,1);
  const result=await executeSkill({id:'pattern-library-curator',directory:run.directory,repo});
  assert.equal(result.proposedUpdates[0].candidates.length,1);assert.match(result.provenance.patternHistoryHash,/^[a-f0-9]{64}$/);
  assert.deepEqual((await loadRun(run.directory)).spec.designFoundation.patterns,run.spec.designFoundation.patterns);
  assert.ok(!JSON.stringify(result).includes(repo));
});
test('withdrawn, tampered, foreign and outdated history cannot supply candidates',async t=>{
  for(const kind of ['withdrawn','image','foreign','source','legacy','current-project','linked','oversized','traversal'])await t.test(kind,async sub=>{
    const {repo,snapshot,parent,run,root}=await fixture(sub);
    if(kind==='withdrawn')await withdrawJudgment(parent.directory,'Synthetic withdrawal');
    if(kind==='image')await writeFile(join(parent.directory,'after/panel-0--desktop.png'),'changed');
    if(kind==='source')await writeFile(join(repo,'PageA.jsx'),'Changed current source');
    if(kind==='foreign'){await mkdir(join(root,'other'));parent.manifest.onboarding.repository.root=join(root,'other');await writeFile(join(parent.directory,'run.json'),JSON.stringify(parent.manifest));}
    if(kind==='current-project'){await mkdir(join(root,'other'));run.manifest.onboarding.repository.root=join(root,'other');}
    if(kind==='linked'){await rm(join(parent.directory,'after'),{recursive:true,force:true});await mkdir(join(root,'linked'));await symlink(join(root,'linked'),join(parent.directory,'after'),process.platform==='win32'?'junction':'dir');}
    if(kind==='oversized')await writeFile(join(parent.directory,'run.json'),' '.repeat(8*1024*1024+1));
    if(kind==='traversal')run.manifest.onboarding.parentRunId='../repo';
    if(kind==='legacy'){const ref=parent.manifest.visualReviews[0];await rm(join(parent.directory,ref.evidenceBinding.path));delete ref.evidenceBinding;await writeFile(join(parent.directory,'run.json'),JSON.stringify(parent.manifest));}
    assert.equal((await acceptedPatternHistory(run,repo,snapshot)).records.length,0);
  });
});
test('cached Foundation extraction refuses changed pattern decisions even when source files are unchanged',async t=>{
  const {repo,parent,run}=await fixture(t);
  await extractFoundationInventory({directory:run.directory,repo});
  await withdrawJudgment(parent.directory,'Synthetic withdrawal after candidate collection');
  await assert.rejects(extractFoundationInventory({directory:run.directory,repo}),/Pattern history changed/);
});
