import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {diagnoseProduct} from '../packages/harness-core/diagnose-product.js';
import {headlessModel} from '../packages/harness-core/headless-models.js';
import {confirmFinding, createRun, loadRun, saveCapture} from '../packages/harness-core/store.js';
import sample from '../examples/happyclaw-site/experience.json' with {type: 'json'};

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=', 'base64');

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'diagnose-product-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const {directory} = await createRun({spec: structuredClone(sample), url: 'http://localhost', outputRoot: root});
  const repo = join(root, 'product');
  await mkdir(repo);
  await writeFile(join(repo, 'index.html'), '<main><h1>Fixture product</h1><button>Continue</button></main>');
  await mkdir(join(directory, 'before'));
  await writeFile(join(directory, 'before/desktop.png'), png);
  await saveCapture(directory, 'before', {viewports: {desktop: {
    screenshot: 'before/desktop.png', width: 1, height: 1, status: 200,
    dom: {h1: ['Fixture product'], actions: [], controls: [], horizontalOverflow: false}
  }}});
  return {directory, repo, cwd: join(root, 'model')};
}

async function completeModel(_command, _args, {cwd}) {
  await writeFile(join(cwd, 'result.json'), JSON.stringify({
    status: 'complete', summary: 'Deterministic protocol fixture',
    screenshotRefs: ['before/desktop.png'], findings: [],
    limitations: ['Synthetic model response; no product quality claim.']
  }));
}

async function savedDiagnosis(directory) {
  return JSON.parse(await readFile(join(directory, 'diagnosis.json'), 'utf8'));
}

test('lightweight diagnosis shares the stage while retaining narrow coverage and selected model', async t => {
  const {directory} = await fixture(t);
  const result = await headlessModel({directory, phase: 'diagnosis', model: 'test-model', generate: async (command, args, context) => {
    assert.equal(args[args.indexOf('-m') + 1], 'test-model');
    await completeModel(command, args, context);
  }});
  assert.equal(result.modelDiagnosis.status, 'complete');
  assert.deepEqual((await loadRun(directory)).manifest.skills, []);
  assert.equal((await savedDiagnosis(directory)).modelDiagnosis.path, result.modelDiagnosis.path);
  assert.equal((await loadRun(directory)).manifest.judgment, null);
});

test('project diagnosis executes current default Skills and retains failure for the workbench', async t => {
  const input = await fixture(t), progress = [];
  const result = await diagnoseProduct(input.directory, {
    ...input, strategy: 'project', modelFailure: 'record',
    onProgress: value => progress.push(value),
    generate: async () => { throw new Error('Synthetic model connection failure'); }
  });
  assert.equal(result.modelDiagnosis.status, 'failed');
  assert.deepEqual(result.modelDiagnosis.limitations, ['Synthetic model connection failure']);
  assert.deepEqual(new Set((await loadRun(input.directory)).manifest.skills.map(item => item.id)), new Set([
    'accessibility-reviewer', 'responsive-reviewer', 'information-architecture-reviewer',
    'visual-hierarchy-reviewer', 'design-system-drift-detector', 'component-state-auditor'
  ]));
  assert.equal(progress[0].stage, 'model-diagnosis');
  assert.equal((await savedDiagnosis(input.directory)).modelDiagnosis.status, 'failed');
});

test('headless failure stays nonzero through rejection and preserves its diagnosis', async t => {
  const {directory} = await fixture(t);
  await assert.rejects(headlessModel({directory, phase: 'diagnosis', generate: async () => {
    throw new Error('Synthetic model failure');
  }}), /Synthetic model failure/);
  assert.equal((await savedDiagnosis(directory)).modelDiagnosis.status, 'failed');
});

test('source drift and cancellation cannot replace the saved diagnosis', async t => {
  const input = await fixture(t);
  await assert.rejects(diagnoseProduct(input.directory, {
    ...input, generate: completeModel,
    verifySource: async () => { throw new Error('Synthetic source changed'); }
  }), /Synthetic source changed/);
  await assert.rejects(savedDiagnosis(input.directory), {code: 'ENOENT'});
  const controller = new AbortController();
  await assert.rejects(diagnoseProduct(input.directory, {
    ...input, signal: controller.signal, modelFailure: 'record',
    generate: async () => { controller.abort(new Error('Synthetic cancellation')); throw new Error('Stopped'); }
  }), /Synthetic cancellation/);
  await assert.rejects(savedDiagnosis(input.directory), {code: 'ENOENT'});
});

test('confirmed diagnosis cannot trigger project Skill execution or another model attempt', async t => {
  const input = await fixture(t);
  await confirmFinding(input.directory, 'F1', 'supported', 'Synthetic confirmed fixture scope.');
  await assert.rejects(diagnoseProduct(input.directory, {
    ...input, strategy: 'project', generate: async () => assert.fail('Model must not run after confirmation')
  }), /fresh review/);
  assert.deepEqual((await loadRun(input.directory)).manifest.skills, []);
});
