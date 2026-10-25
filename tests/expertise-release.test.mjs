import test from 'node:test';
import {runRegression} from '../packages/skill-core/regression.js';
import {regressionEvidenceHash} from '../packages/skill-core/release-inputs.js';
import corpus from '../regression/cases.json' with {type:'json'};
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { activateSkillRelease, createSkillRelease } from '../packages/skill-core/releases.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'expertise-release-')); t.after(()=>rm(root,{recursive:true,force:true}));
  const registry = join(root, 'skills'), skill = join(registry, 'example-reviewer'); await cp(new URL('../skills/product-design/',import.meta.url),registry,{recursive:true}); await mkdir(skill,{recursive:true});
  await writeFile(join(skill,'skill.json'),JSON.stringify({id:'example-reviewer',version:'1.2.0',role:'review',description:'Fixture',requiredInputs:['baselineCapture'],handler:'evidenceGate',maturity:'bounded'}));
  await writeFile(join(skill,'SKILL.md'),'# Fixture\n');
  const report=await runRegression(corpus,{registryRoot:registry});report.modelReview={status:'reviewed',reviewer:'Synthetic test reviewer',reason:'Fixture assertion only; not a real model approval.',evidenceHash:report.evidenceHash};
  return { root, registry,report };
}

test('an expertise release is immutable, review-gated and records exact skill contracts', async t => {
  const {root,registry,report}=await fixture(t);
  const release=await createSkillRelease({root,registryRoot:registry,version:'2.0.0',reviewer:'Release owner',reason:'Reviewed candidate',regressionReport:report});
  assert.equal(release.skills.find(skill=>skill.id==='example-reviewer').version,'1.2.0'); assert.match(release.skills[0].contractHash,/^[a-f0-9]{64}$/);
  await assert.rejects(createSkillRelease({root,registryRoot:registry,version:'2.0.0',reviewer:'Release owner',reason:'Overwrite',regressionReport:report}),/exist/i);
});

test('activation and rollback keep an audit trail instead of rewriting release files', async t => {
  const {root,registry,report}=await fixture(t);
  await createSkillRelease({root,registryRoot:registry,version:'1.0.0',reviewer:'Owner',reason:'First',regressionReport:report});
  await createSkillRelease({root,registryRoot:registry,version:'1.1.0',reviewer:'Owner',reason:'Second',regressionReport:report});
  await activateSkillRelease({root,version:'1.1.0',reviewer:'Owner',reason:'Promote'});
  const rollback=await activateSkillRelease({root,version:'1.0.0',reviewer:'Owner',reason:'Regression found'});
  assert.equal(rollback.previousVersion,'1.1.0');
  assert.equal(JSON.parse(await readFile(join(root,'expertise','active.json'),'utf8')).releaseVersion,'1.0.0');
});

test('synthetic regression alone cannot publish an expertise release', async t => {
  const {root,registry,report}=await fixture(t);
  await assert.rejects(createSkillRelease({root,registryRoot:registry,version:'1.0.0',reviewer:'Owner',reason:'Too early',regressionReport:{...report,modelReview:{status:'not-run'}}}),/Independent model review/);
});

test('stale implementation, altered results and unbound reviews cannot publish',async t=>{
  const {root,registry,report}=await fixture(t);
  for(const mutate of [
    value=>value.implementationHash='0'.repeat(64),
    value=>value.corpusHash='0'.repeat(64),
    value=>value.cases[0].actual.status='complete',
    value=>value.cases.pop(),
  ]){
    const candidate=structuredClone(report);mutate(candidate);
    candidate.evidenceHash=regressionEvidenceHash(candidate);candidate.modelReview.evidenceHash=candidate.evidenceHash;
    await assert.rejects(createSkillRelease({root,registryRoot:registry,version:'3.0.0',reviewer:'Fixture',reason:'Test',regressionReport:candidate}),/does not match current/);
  }
  const unbound=structuredClone(report);delete unbound.modelReview.evidenceHash;
  await assert.rejects(createSkillRelease({root,registryRoot:registry,version:'3.0.0',reviewer:'Fixture',reason:'Test',regressionReport:unbound}),/must bind/);
  await writeFile(join(registry,'example-reviewer','SKILL.md'),'# Changed after report\n');
  await assert.rejects(createSkillRelease({root,registryRoot:registry,version:'3.0.0',reviewer:'Fixture',reason:'Test',regressionReport:report}),/does not match current/);
  await assert.rejects(readFile(join(root,'expertise','releases','3.0.0.json')),{code:'ENOENT'});
});

test('activation rejects path-shaped versions before reading release files',async t=>{
  const {root}=await fixture(t);
  for(const version of ['../outside','..\\outside','/absolute','',null])await assert.rejects(activateSkillRelease({root,version,reviewer:'Fixture',reason:'Test'}),/version must be semantic/);
});

test('activation lock excludes another writer without replacing the current pointer', async t => {
  const {root, registry, report} = await fixture(t);
  await createSkillRelease({root, registryRoot:registry, version:'1.0.0', reviewer:'Fixture', reason:'Test', regressionReport:report});
  const active = await activateSkillRelease({root, version:'1.0.0', reviewer:'Fixture', reason:'Test'});
  const lock = join(root, 'expertise', 'activation.lock');
  await writeFile(lock, 'unreadable owner');
  await assert.rejects(activateSkillRelease({root, version:'1.0.0', reviewer:'Fixture', reason:'Test'}), /activation lock exists/);
  assert.equal(await readFile(lock, 'utf8'), 'unreadable owner');
  assert.deepEqual(JSON.parse(await readFile(join(root,'expertise','active.json'),'utf8')), active);
});

test('unbound or corrupted releases cannot replace an active release', async t => {
  const {root, registry, report} = await fixture(t);
  await createSkillRelease({root, registryRoot:registry, version:'1.0.0', reviewer:'Fixture', reason:'Test', regressionReport:report});
  const active = await activateSkillRelease({root, version:'1.0.0', reviewer:'Fixture', reason:'Test'});
  const releasePath = join(root,'expertise','releases','1.0.0.json');
  const release = JSON.parse(await readFile(releasePath,'utf8'));
  release.skills[0].version = '999.0.0';
  await writeFile(releasePath, JSON.stringify(release));
  await assert.rejects(activateSkillRelease({root, version:'1.0.0', reviewer:'Fixture', reason:'Test'}), /Invalid or unbound/);
  assert.deepEqual(JSON.parse(await readFile(join(root,'expertise','active.json'),'utf8')), active);
});

test('process exit before pointer replacement preserves prior version and requires explicit recovery', async t => {
  const {root, registry, report} = await fixture(t);
  for (const version of ['1.0.0','1.1.0']) await createSkillRelease({root, registryRoot:registry, version, reviewer:'Fixture', reason:'Test', regressionReport:report});
  const previous = await activateSkillRelease({root, version:'1.0.0', reviewer:'Fixture', reason:'Test'});
  const script = `import fs from 'node:fs/promises'; import {syncBuiltinESMExports} from 'node:module';
    fs.rename = async () => process.exit(77); syncBuiltinESMExports();
    const {activateSkillRelease} = await import(${JSON.stringify(new URL('../packages/skill-core/releases.js',import.meta.url).href)});
    await activateSkillRelease({root:process.argv[1],version:'1.1.0',reviewer:'Synthetic crash test',reason:'Test only'});`;
  const child = spawnSync(process.execPath, ['--input-type=module','-e',script,root], {encoding:'utf8',timeout:15000});
  assert.equal(child.status,77,child.stderr);
  assert.deepEqual(JSON.parse(await readFile(join(root,'expertise','active.json'),'utf8')),previous);
  await assert.rejects(activateSkillRelease({root,version:'1.1.0',reviewer:'Fixture',reason:'Test'}),/activation lock exists/);
  // The owning child is conclusively terminated; remove only its test lock.
  await rm(join(root,'expertise','activation.lock'));
  const next = await activateSkillRelease({root,version:'1.1.0',reviewer:'Fixture',reason:'Recovered test'});
  assert.equal(next.previousActivationId,previous.activationId);
  assert.equal(next.previousVersion,'1.0.0');
  const recorded = JSON.parse(await readFile(join(root,'expertise','activations',next.activationId+'.json'),'utf8'));
  assert.deepEqual(recorded,next);
});
