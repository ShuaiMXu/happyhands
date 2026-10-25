import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkbench } from '../packages/workbench/service.js';
import { workflowState } from '../packages/harness-core/workflow.js';
import { onboardingRecovery } from '../apps/designer/cowart/operations.js';

const spec = JSON.parse(await readFile(new URL('../examples/happyclaw-site/experience.json', import.meta.url)));
const commit = 'a'.repeat(40);

async function fixture(t, overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'onboard-provenance-'));
  const repo = join(root, 'app');
  await mkdir(repo);
  await writeFile(join(repo, 'styles.css'), ':root { --brand: #009689; }');
  await writeFile(join(root, 'experience.json'), JSON.stringify(spec));
  const configPath = join(root, 'project.json');
  await writeFile(configPath, JSON.stringify({ version: '0.1', spec: 'experience.json', repo: 'app', url: 'http://127.0.0.1:4321/', start: { command: 'npm', args: ['run', 'dev'] } }));
  const calls = { spawned: 0, stopped: 0, captured: 0 };
  const child = { exitCode: null, signalCode: null, killed: false };
  const service = createWorkbench(root, {
    generate:async()=>{throw Error("Model unavailable in deterministic onboarding fixture");},
    inspectRepository: async () => ({ root: repo, commit, dirty: false }),
    fetch: async () => { throw new Error('No server'); },
    spawnPreview: () => { calls.spawned++; return child; },
    stopPreview: value => { if (value) calls.stopped++; },
    waitForPreview: async () => ({ status: 200 }),
    captureBrowser: async ({ directory }) => {
      calls.captured++;
      await mkdir(join(directory, 'before'));
      await writeFile(join(directory, 'before', 'mobile.png'), 'local test screenshot');
      return { viewports: { mobile: { width: 390, height: 844, status: 200, screenshot: 'before/mobile.png', dom: { h1: ['HappyClaw'], actions: [], controls: [], headings: [], horizontalOverflow: false } } } };
    },
    ...overrides
  });
  t.after(async () => { service.close(); await rm(root, { recursive: true, force: true }); });
  return { root, repo, configPath, service, calls, child };
}

async function finish(service, id) {
  for (let n = 0; n < 300; n++) {
    const job = await service.jobs.get(id);
    if (!['queued', 'running'].includes(job.status)) return job;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('Onboarding did not finish');
}

test('a busy baseline port, even returning 404, cannot supply source-bound evidence', async t => {
  const { service, configPath, calls } = await fixture(t, { fetch: async () => new Response('old preview', { status: 404 }) });
  const job = await finish(service, (await service.onboard({ configPath })).id);
  assert.equal(job.status, 'failed');
  assert.match(job.error, /port is already in use/);
  assert.equal(calls.spawned, 0);
  assert.equal(calls.captured, 0);
  const run = await service.localRun(job.runId);
  assert.equal(run.manifest.captures.before, null);
  assert.equal(workflowState(run.manifest).stage, 'onboarding-failed');
  assert.match(run.manifest.onboarding.error, /Stop that preview/);
  assert.deepEqual(onboardingRecovery(job), { reconnect: true, configPath, openReview: false });
});

test('dirty source is refused before queueing a baseline review', async t => {
  const { service, configPath, calls } = await fixture(t, { inspectRepository: async () => ({ commit, dirty: true }) });
  await assert.rejects(service.onboard({ configPath }), /uncommitted changes/);
  assert.equal((await service.jobs.list()).length, 0);
  assert.equal(calls.captured, 0);
});

for (const [name, changed] of [['new commit', { commit: 'b'.repeat(40), dirty: false }], ['uncommitted edit', { commit, dirty: true }]]) {
  test(`a ${name} during baseline capture prevents evidence publication`, async t => {
    let checks = 0;
    const { service, configPath, root, calls } = await fixture(t, {
      inspectRepository: async () => ++checks < 3 ? { commit, dirty: false } : changed
    });
    const job = await finish(service, (await service.onboard({ configPath })).id);
    assert.equal(job.status, 'failed');
    assert.equal(calls.captured, 1);
    assert.equal(calls.stopped, 1);
    const run = await service.localRun(job.runId);
    assert.equal(run.manifest.captures.before, null);
    assert.equal(run.manifest.onboarding.status, 'failed');
    await assert.rejects(readFile(join(root, 'public', 'runs', job.runId, 'run.json')), { code: 'ENOENT' });
  });
}

test('a configuration edited while queued cannot replace the submitted review configuration', async t => {
  const { service, configPath, calls } = await fixture(t);
  let release;
  const holding = await service.jobs.start({}, () => new Promise(resolve => { release = resolve; }));
  while (!release) await new Promise(resolve => setTimeout(resolve, 5));
  const pending = await service.onboard({ configPath });
  const config = JSON.parse(await readFile(configPath));
  config.url = 'http://127.0.0.1:4444/';
  await writeFile(configPath, JSON.stringify(config));
  release();
  await finish(service, holding.id);
  const job = await finish(service, pending.id);
  assert.equal(job.status, 'failed');
  assert.match(job.error, /configuration changed while.*queued/);
  assert.equal(calls.spawned, 0);
  assert.equal((await service.localRun(job.runId)).manifest.onboarding.config.url, 'http://127.0.0.1:4321/');
});

test('a failed preview start remains a recoverable failed run and stops the child', async t => {
  const { service, configPath, calls } = await fixture(t, { waitForPreview: async () => { throw new Error('Preview failed to start'); } });
  const job = await finish(service, (await service.onboard({ configPath })).id);
  assert.equal(job.status, 'failed');
  assert.equal(calls.stopped, 1);
  assert.equal(calls.captured, 0);
  const run = await service.localRun(job.runId);
  assert.equal(workflowState(run.manifest).stage, 'onboarding-failed');
  assert.match(workflowState(run.manifest).next, /start a new run/);
});

test('a stopped preview cannot be replaced by a reachable unrelated server', async t => {
  const { service, configPath, child, calls } = await fixture(t);
  child.exitCode = 1;
  const job = await finish(service, (await service.onboard({ configPath })).id);
  assert.equal(job.status, 'failed');
  assert.match(job.error, /preview stopped/);
  assert.equal(calls.captured, 0);
});

test('a fresh clean source reaches baseline, foundation inventory and diagnosis', async t => {
  const { service, configPath, calls } = await fixture(t);
  const job = await finish(service, (await service.onboard({ configPath })).id);
  assert.equal(job.status, 'succeeded', job.error);
  const run = await service.localRun(job.runId);
  assert.equal(run.manifest.onboarding.status, 'ready');
  assert.equal(run.manifest.onboarding.repository.commit, commit);
  assert.equal(run.manifest.captures.before.viewports.mobile.status, 200);
  assert.ok(run.manifest.foundationInventory);
  assert.ok(run.manifest.diagnosis);
  assert.equal(calls.stopped, 1);
});

test('an entirely unreachable plan stays failed with replay evidence and no diagnosis', async t => {
  const { service, configPath, root } = await fixture(t, {
    captureBrowserPlan: async () => ({ states: [{ stateId: 'menu', configurationId: 'mobile', reached: false, error: 'Menu button missing' }] })
  });
  await writeFile(join(root, 'plan.json'), JSON.stringify({schemaVersion:'0.1',adapter:'web',configurations:[{id:'mobile',viewport:{width:390,height:844}}],states:[{id:'menu',start:{url:'http://127.0.0.1:4321/'},actions:[{type:'click',role:'button',name:'Menu'}]}]}));
  const config = JSON.parse(await readFile(configPath));
  config.capturePlan = 'plan.json';
  await writeFile(configPath, JSON.stringify(config));
  const job = await finish(service, (await service.onboard({ configPath })).id);
  assert.equal(job.status, 'failed');
  assert.match(job.error, /No planned page state was reached/);
  const run = await service.localRun(job.runId);
  assert.equal(run.manifest.captures.before.states[0].error, 'Menu button missing');
  assert.equal(run.manifest.diagnosis, null);
  assert.equal(workflowState(run.manifest).stage, 'onboarding-failed');
  assert.equal(onboardingRecovery(job).openReview, true);
});

test('starting a new review recovers after the occupied port is released', async t => {
  let occupied = true;
  const { service, configPath } = await fixture(t, {fetch:async()=>{if(occupied)return new Response('old preview');throw new Error('No server');}});
  const failed = await finish(service, (await service.onboard({ configPath })).id);
  assert.equal(failed.status, 'failed');
  occupied = false;
  const recovered = await finish(service, (await service.onboard({ configPath })).id);
  assert.equal(recovered.status, 'succeeded', recovered.error);
  assert.notEqual(recovered.runId, failed.runId);
  assert.equal((await service.localRun(failed.runId)).manifest.onboarding.status, 'failed');
  assert.ok((await service.localRun(recovered.runId)).manifest.diagnosis);
});

test('interrupted legacy onboarding offers reconnection without a broken report link', () => {
  assert.deepEqual(onboardingRecovery({kind:'onboard',status:'interrupted',runId:'old-run'}),{reconnect:true,configPath:'',openReview:false});
  assert.equal(onboardingRecovery({kind:'execute',status:'failed'}).openReview,true);
});

test('design-system refresh captures committed source into a new run and preserves the previous record',async t=>{
 let revision=commit;
 const {service,configPath,repo,root}=await fixture(t,{inspectRepository:async()=>({root:repo,commit:revision,dirty:false})});
 const first=await finish(service,(await service.onboard({configPath})).id);
 assert.equal(first.status,'succeeded');
 const old=await service.localRun(first.runId),bytes=await readFile(join(old.directory,'run.json'));
 await writeFile(join(repo,'DESIGN.md'),'# Project design\nUse --brand for primary actions.');
 await writeFile(join(repo,'styles.css'),':root { --brand: #123456; }');revision='b'.repeat(40);
 const changedSpec=JSON.parse(await readFile(join(root,'experience.json')));changedSpec.project.source='Same project, new source revision '+revision;await writeFile(join(root,'experience.json'),JSON.stringify(changedSpec));
 await assert.rejects(service.action({runId:first.runId,action:'diagnose'}),/does not belong/);
 await assert.rejects(service.action({runId:first.runId,action:'foundation-approve',approval:{}}),/does not belong/);
 assert.deepEqual(await service.foundationWorkspace(first.runId),{available:false,refreshAvailable:true,entries:[]});
 const next=await finish(service,(await service.refreshReview(first.runId,{fullReview:true})).id);
 assert.equal(next.status,'succeeded');assert.notEqual(next.runId,first.runId);
 const current=await service.localRun(next.runId);
 assert.equal(current.manifest.onboarding.repository.commit,revision);
 assert.equal(current.spec.project.source,changedSpec.project.source);
 assert.equal(current.manifest.foundationApproval,null);
 assert.deepEqual(await readFile(join(old.directory,'run.json')),bytes);
});

test('source drift during model diagnosis fails the onboarding rather than publishing rule-only success',async t=>{
 let revision=commit;
 const {service,configPath,repo}=await fixture(t,{
  inspectRepository:async()=>({root:repo,commit:revision,dirty:false}),
  captureBrowser:async({directory})=>{await mkdir(join(directory,'before'));await writeFile(join(directory,'before/mobile.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64'));return {viewports:{mobile:{width:1,height:1,screenshot:'before/mobile.png'}}};},
  generate:async()=>{revision='b'.repeat(40);throw Error('Model unavailable after source edit');}
 });
 const job=await finish(service,(await service.onboard({configPath})).id);
 assert.equal(job.status,'failed');assert.match(job.error,/Repository changed during baseline diagnosis/);
 const run=await service.localRun(job.runId);assert.equal(run.manifest.onboarding.status,'failed');
 await assert.rejects(readFile(join(run.directory,'diagnosis.json')),{code:'ENOENT'});
});
test('unconfirmed diagnostics can be retried through the existing action API',async t=>{const {service,configPath}=await fixture(t);const first=await finish(service,(await service.onboard({configPath})).id);assert.equal(first.status,'succeeded');const retry=await finish(service,(await service.action({runId:first.runId,action:'diagnose'})).id);assert.equal(retry.status,'succeeded',retry.error);const run=await service.localRun(first.runId);assert.equal(run.manifest.confirmation,null);assert.equal(run.manifest.plan,null);});
