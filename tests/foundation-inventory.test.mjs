import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import sample from '../examples/happyclaw-site/experience.json' with { type: 'json' };
import { createRun, loadRun, saveCapture } from '../packages/harness-core/store.js';
import { extractFoundationInventory } from '../packages/skill-core/foundation-inventory.js';

const registryRoot = resolve('skills/product-design');

async function fixture(t, id, spec) {
  const root = await mkdtemp(join(tmpdir(), 'foundation-inventory-'));
  t.after(async () => {
    if (!root.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(root, { recursive: true, force: true });
  });
  const repo = join(root, 'repo'), runs = join(root, 'runs');
  await mkdir(join(repo, 'src', 'components'), { recursive: true });
  await mkdir(runs);
  await writeFile(join(repo, 'src', 'theme.css'), ':root { --brand-accent: #0f766e; --space-panel: 24px; }');
  await writeFile(join(repo, 'src', 'components', 'Panel.jsx'), 'export const Panel = () => <img src="/product-logo.svg" />;');
  await mkdir(join(repo, 'src', 'admin', 'components'), { recursive: true });
  await writeFile(join(repo, 'src', 'admin', 'components', 'Panel.jsx'), 'export const Panel = () => null;');
  const run = await createRun({ spec, url: 'http://127.0.0.1:4321/', outputRoot: runs, id });
  await saveCapture(run.directory, 'before', { viewports: { desktop: { screenshot: 'before/desktop.png', dom: { title: 'Workspace', h1: ['Review clearly'], visibleCopy: ['Keep the evidence visible'] } } } });
  return { repo, directory: run.directory };
}

test('proactive inventory materializes observed design candidates for the workbench', async t => {
  const spec = structuredClone(sample);
  delete spec.designFoundation;
  const { repo, directory } = await fixture(t, 'auto-foundation', spec);
  const result = await extractFoundationInventory({ directory, repo, registryRoot });
  const run = await loadRun(directory);

  assert.equal(result.inventory.status, 'partial');
  assert.equal(result.results.find(item=>item.skill.id==='pattern-library-curator').status,'needs-evidence');
  assert.equal(result.inventory.materialized, true);
  assert.equal(run.manifest.foundationInventory.materializationReason, 'observed-candidate-saved');
  assert.equal(run.spec.designFoundation.status, 'observed');
  assert.ok(run.spec.designFoundation.tokens.some(item => item.name === '--brand-accent' && item.status === 'observed'));
  assert.equal(run.spec.designFoundation.components.filter(item => item.name === 'Panel' && item.states.length === 0).length, 2, 'same-named components keep their distinct source identity');
  assert.ok(run.spec.designFoundation.brand.assets.some(item => item.name === 'product-logo.svg' && item.role === 'logo'));
  assert.deepEqual(run.spec.designFoundation.brand.principles, [], 'brand intent is not inferred from source filenames');
  assert.deepEqual(run.spec.designFoundation.brand.voice, [], 'rendered copy stays evidence instead of becoming an approved voice rule');
  assert.ok(run.spec.designFoundation.brand.voiceEvidence.some(item => item.sample === 'Review clearly'));
  assert.deepEqual(run.manifest.skills.map(item => item.id), ['foundation-extractor', 'brand-foundation-extractor', 'component-inventory', 'pattern-library-curator']);
  assert.deepEqual(run.spec.designFoundation.patterns,[], 'history collection must not invent or approve shared patterns');
});

test('proactive inventory never overwrites an approved design foundation', async t => {
  const spec = structuredClone(sample);
  spec.designFoundation.status = 'approved';
  for (const entry of [...spec.designFoundation.brand.assets, ...spec.designFoundation.tokens, ...spec.designFoundation.components, ...spec.designFoundation.patterns]) entry.status = 'approved';
  const before = JSON.stringify(spec.designFoundation);
  const { repo, directory } = await fixture(t, 'frozen-foundation', spec);
  const result = await extractFoundationInventory({ directory, repo, registryRoot });
  const run = await loadRun(directory);

  assert.equal(result.inventory.materialized, false);
  assert.equal(result.inventory.materializationReason, 'approved-foundation-frozen');
  assert.equal(JSON.stringify(run.spec.designFoundation), before);
  assert.equal(JSON.parse(await readFile(join(directory, 'run.json'), 'utf8')).foundationInventory.status, 'partial');
});

test('cancelled extraction stops before writing inventory or skill artifacts', async t => {
  const spec = structuredClone(sample);
  delete spec.designFoundation;
  const { repo, directory } = await fixture(t, 'cancelled-foundation', spec);
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(extractFoundationInventory({ directory, repo, registryRoot, signal: controller.signal }), { name: 'AbortError' });
  const run = await loadRun(directory);
  assert.equal(run.manifest.foundationInventory, null);
  assert.deepEqual(run.manifest.skills, []);
  assert.equal(run.spec.designFoundation, undefined);
});
