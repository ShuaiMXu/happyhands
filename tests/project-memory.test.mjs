import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile,writeFile,readdir } from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {projectMemory} from '../packages/workbench/memory.js';
import {skillResult} from '../packages/skill-core/result.js';
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'memory-test-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
const run={manifest:{id:'test-run',captures:{before:{},after:{}},evaluation:{},execution:{baseCommit:'abc',changedFiles:['ui.js']},judgment:{decision:'reject',reason:'Ambiguous action',at:'2026-09-28'}}};
const proposal={principle:'Name primary actions by outcome',context:'Review screens',reason:'The prior label was ambiguous'};
test('project memory requires a recorded judgment and stays candidate until explicit review',async t=>{const store=projectMemory(await fixture(t),'repo');await assert.rejects(store.propose({manifest:{id:'empty'}},proposal),/human judgment/);const entry=await store.propose(run,proposal);assert.equal(entry.status,'candidate');assert.equal((await store.list())[0].source.judgment.decision,'reject');assert.match(entry.source.evidenceHash,/^[a-f0-9]{64}$/);});
test('memory decisions are immutable and require a reason',async t=>{const store=projectMemory(await fixture(t),'repo'),entry=await store.propose(run,proposal);await assert.rejects(store.decide({id:entry.id,decision:'approve',reason:''}),/reason/i);await store.decide({id:entry.id,decision:'approve',reason:'Applies to our review workflow'});assert.equal((await store.list())[0].status,'approved');await assert.rejects(store.decide({id:entry.id,decision:'reject',reason:'overwrite'}),{code:'EEXIST'});});
test('project memory never leaks into a different repository or global skill state',async t=>{const root=await fixture(t),first=projectMemory(root,'repo-a'),second=projectMemory(root,'repo-b');await first.propose(run,proposal);assert.deepEqual(await second.list(),[]);await assert.rejects(first.decide({id:'../../secret',decision:'approve',reason:'x'}),/Invalid/);});
test('skill handlers cannot replace authoritative identity and provenance',()=>{const result=skillResult({id:'real',version:'1.2.3',role:'review'},{status:'complete',evidence:[],findings:[],proposedUpdates:[],limitations:[],skill:{id:'forged'},schemaVersion:'forged',provenance:{fake:true}},{implementationHash:'verified'});assert.equal(result.skill.id,'real');assert.equal(result.schemaVersion,'0.1');assert.deepEqual(result.provenance,{implementationHash:'verified'});});

test('retiring approved memory preserves its approval and removes it from active rules',async t=>{
  const store=projectMemory(await fixture(t),'repo');
  const entry=await store.propose(run,{...proposal,exceptions:['Destructive actions require explicit object names']});
  assert.deepEqual(await store.active(),[]);
  await store.decide({id:entry.id,decision:'approve',reason:'Reviewed'});
  assert.deepEqual((await store.active())[0].exceptions,['Destructive actions require explicit object names']);
  await assert.rejects(store.retire({id:entry.id,reason:''}),/reason/i);
  const retired=await store.retire({id:entry.id,reason:'Superseded by our revised terminology'});
  assert.equal(retired.status,'deprecated');assert.equal(retired.version,entry.id+'@2');
  assert.deepEqual(await store.active(),[]);
  const history=(await store.list())[0];assert.equal(history.review.decision,'approve');assert.equal(history.retirement.reason,'Superseded by our revised terminology');
  await assert.rejects(store.decide({id:entry.id,decision:'approve',reason:'Revive'}),/Retired/);
  await assert.rejects(store.retire({id:entry.id,reason:'Overwrite'}),/already retired/);
});

test('withdrawn candidates cannot later become active and rejected rules stay excluded',async t=>{
  const store=projectMemory(await fixture(t),'repo');
  const candidate=await store.propose(run,proposal),rejected=await store.propose(run,proposal);
  await store.retire({id:candidate.id,reason:'Incorrect scope'});
  await store.decide({id:rejected.id,decision:'reject',reason:'Not applicable'});
  assert.equal((await store.list()).find(item=>item.id===candidate.id).status,'withdrawn');
  await assert.rejects(store.decide({id:candidate.id,decision:'approve',reason:'Too late'}),/Retired/);
  assert.deepEqual(await store.active(),[]);
});

test('changed proposal text cannot reuse an earlier approval',async t=>{
  const root=await fixture(t),store=projectMemory(root,'repo');
  const entry=await store.propose(run,proposal);await store.decide({id:entry.id,decision:'approve',reason:'Reviewed'});
  const base=join(root,'.harness','project-memory'),directory=join(base,(await readdir(base))[0]);
  await writeFile(join(directory,entry.id+'.json'),JSON.stringify({...entry,principle:'A different rule'}));
  await assert.rejects(store.active(),/content changed/);
  await assert.rejects(store.retire({id:entry.id,reason:'Changed'}),/content changed/);
});

test('racing approval cannot reactivate a withdrawn principle',async t=>{
  const store=projectMemory(await fixture(t),'repo'),entry=await store.propose(run,proposal);
  const results=await Promise.allSettled([store.decide({id:entry.id,decision:'approve',reason:'Concurrent review'}),store.retire({id:entry.id,reason:'Withdraw scope'})]);
  assert.equal(results[1].status,'fulfilled');
  assert.deepEqual(await store.active(),[]);
  assert.ok((await store.list())[0].retirement);
});
