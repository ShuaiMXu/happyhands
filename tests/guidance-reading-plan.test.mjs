import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildGuidanceReadingPlan} from '../packages/skill-core/guidance-reading-plan.js';
import {designGuidancePrompt, stageDesignGuidance} from '../packages/skill-core/design-guidance.js';
import {ojoGuidancePrompt, stageOjoGuidance} from '../packages/skill-core/ojo-guidance.js';

test('public-page reading is complete for design improvements and bounded for a frozen narrow repair', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'hh-reading-plan-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const design = await stageDesignGuidance(directory, 'review', {taste: 'public-page', intent: 'polish'});
  const ojo = await stageOjoGuidance(directory, 'review');
  const plan = (kind, repairImpact, depth = 'focused') => buildGuidanceReadingPlan({design, ojo, goal: {kind}, repairImpact, depth});
  const focused = plan('repair', 'local');
  const complete = plan('repair', 'local', 'full');
  const web = value => value.groups.find(group => group.id === 'web-taste');
  const required = value => web(value).mustRead.map(file => file.path);
  assert.deepEqual(required(plan('improvement', 'local')), required(complete));
  assert.deepEqual(required(plan('mixed', 'local')), required(complete));
  assert.deepEqual(required(plan(undefined)), required(complete));
  assert.deepEqual(required(plan('repair')), required(complete));
  assert.deepEqual(required(plan('repair', 'broad')), required(complete));
  assert.deepEqual(required(focused), [web(focused).reference + '/upstream/SKILL.md']);
  assert.equal(web(focused).onDemand.length, 5);
  assert.ok(web(focused).onDemand.some(file => file.path.endsWith('/layout-v4.md')));
  assert.ok(focused.groups.find(group => group.id === 'impeccable').mustRead.some(file => file.path.endsWith('/critique.md')));
  assert.ok(focused.groups.find(group => group.id === ojo.metadata.id).mustRead.some(file => file.path.endsWith('/anti-patterns.md')));
  assert.deepEqual(focused.excluded.map(group => group.id), ['taste', 'taste-v2']);

  async function requiredBytes(value) {
    let bytes = 0;
    for (const item of web(value).mustRead) {
      const source = await readFile(join(directory, item.path));
      assert.equal(createHash('sha256').update(source).digest('hex'), item.sha256);
      bytes += source.length;
    }
    return bytes;
  }
  assert.ok(await requiredBytes(focused) < (await requiredBytes(complete)) / 2,
    'the scoped web-taste required file bytes should be less than half the full route');
  const prompt = ojoGuidancePrompt(ojo, directory, focused) + designGuidancePrompt(design, directory, focused);
  assert.match(prompt, /read the complete public-page route before proceeding/);
  for (const source of [...web(focused).mustRead, ...web(focused).onDemand]) {
    assert.ok(prompt.includes(join(directory, source.path)));
  }
  const adapter = design.packs.find(pack => pack.metadata.id === 'web-taste').adapter;
  assert.equal(prompt.split(adapter).length, 2, 'adapter appears once as complete embedded text');
});
