import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AUDIT_READING_TOPICS, buildAuditStepReadingPlan, buildGuidanceReadingPlan, formatGuidanceReadingGroup} from '../packages/skill-core/guidance-reading-plan.js';
import {designGuidancePrompt, stageDesignGuidance} from '../packages/skill-core/design-guidance.js';

test('public-page reading is complete for design improvements and bounded for a frozen narrow repair', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'hh-reading-plan-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const design = await stageDesignGuidance(directory, 'review', {taste: 'public-page', intent: 'polish'});
  const plan = (kind, repairImpact, depth = 'focused') => buildGuidanceReadingPlan({design, goal: {kind}, repairImpact, depth});
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
  const prompt = designGuidancePrompt(design, directory, focused);
  assert.doesNotMatch(prompt, /\bOJO\b/i);
  assert.match(prompt, /read the complete public-page route before proceeding/);
  for (const source of [...web(focused).mustRead, ...web(focused).onDemand]) {
    assert.ok(prompt.includes(join(directory, source.path)));
  }
  const adapter = design.packs.find(pack => pack.metadata.id === 'web-taste').adapter;
  assert.equal(prompt.split(adapter).length, 2, 'adapter appears once as complete embedded text');
});

test('inspect and record require no method pack, including at full depth', () => {
  const plan = {stage: 'audit', surface: 'public-page', depth: 'full',
    groups: [{id: 'unused'}], excluded: [{id: 'irrelevant'}]};
  const inspect = buildAuditStepReadingPlan(plan);
  assert.equal(inspect.step, 'inspect');
  for (const step of [inspect, buildAuditStepReadingPlan(plan, 'record')]) {
    assert.deepEqual(step.groups, []);
    assert.deepEqual(step.excluded, []);
    assert.equal(step.depth, 'focused');
  }
  assert.throws(() => buildAuditStepReadingPlan(plan, 'inspect', 'motion'), /method step/);
  assert.throws(() => buildAuditStepReadingPlan(plan, 'record', 'motion'), /method step/);
  assert.throws(() => buildAuditStepReadingPlan(plan, 'method', 'every-topic'), /recognized audit topic/);
  assert.throws(() => buildAuditStepReadingPlan(plan, 'method', ['motion', 'responsive']), /one recognized/);
  assert.throws(() => buildAuditStepReadingPlan(plan, 'full'), /Unknown audit step/);
  assert.throws(() => buildAuditStepReadingPlan({...plan, stage: 'decision'}), /requires an audit plan/);
  assert.throws(() => buildAuditStepReadingPlan(plan, 'method'), /missing from the staged reading plan/);
});

test('method assigns the primary method and at most one verified topic reference per request', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'hh-audit-method-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const paths = ['review-product/SKILL.md', ...[
    'interaction-reviewer', 'content-design-reviewer', 'visual-hierarchy-reviewer', 'component-state-auditor',
    'error-recovery-reviewer', 'accessibility-reviewer', 'responsive-reviewer'
  ].map(id => 'product-design/' + id + '/SKILL.md')];
  const files = await Promise.all(paths.map(async path => {
    const bytes = await readFile(new URL('../skills/' + path, import.meta.url));
    return {path, sha256: createHash('sha256').update(bytes).digest('hex')};
  }));
  const local = {files, reference: 'local', readFirst: ['local/review-product/SKILL.md']};
  for (const surface of ['app-screen', 'public-page']) {
    const design = await stageDesignGuidance(directory, 'review', {taste: surface});
    const plans = ['focused', 'full'].map(depth => buildGuidanceReadingPlan({design, local, stage: 'audit', depth}));
    const publicPage = surface === 'public-page';
    const primaryGroup = plans[0].groups.find(group => group.id === (publicPage ? 'web-taste' : 'local-experience'));
    const primaryPath = primaryGroup.reference + (publicPage ? '/upstream/SKILL.md' : '/review-product/SKILL.md');
    const primary = buildAuditStepReadingPlan(plans[0], 'method');
    assert.deepEqual(primary.groups.flatMap(group => group.mustRead.map(item => item.path)), [primaryPath]);
    assert.deepEqual(primary.groups[0].readOnce, primaryGroup.embedded);
    if (publicPage) {
      const prompt = formatGuidanceReadingGroup(primary.groups[0], directory);
      assert.ok(prompt.includes(join(directory, primaryGroup.embedded[0].path)));
      assert.doesNotMatch(prompt, /complete text included|undefined/);
    }
    for (const topic of AUDIT_READING_TOPICS) {
      const plan = buildAuditStepReadingPlan(plans[0], 'method', topic);
      assert.deepEqual(buildAuditStepReadingPlan(plans[1], 'method', topic), plan);
      const assigned = plan.groups.flatMap(group => group.mustRead);
      assert.equal(assigned.length, 2);
      assert.equal(assigned[0].path, primaryPath);
      assert.notEqual(assigned[1].path, primaryPath);
      if (topic === 'responsive') assert.match(assigned[1].path, /responsive-reviewer\/SKILL.md$/);
      if (publicPage && topic === 'motion') assert.match(assigned[1].path, /upstream\/references\/motion.md$/);
      for (const group of plan.groups) {
        const original = plans[0].groups.find(entry => entry.id === group.id);
        assert.ok(original);
        assert.deepEqual(group.readOnce, original.embedded);
        assert.deepEqual(group.embedded, []);
        assert.deepEqual(group.onDemand, []);
        for (const file of group.mustRead) {
          assert.match(file.sha256, /^[a-f0-9]{64}$/);
          assert.ok([...original.mustRead, ...original.onDemand].some(entry => entry.path === file.path && entry.sha256 === file.sha256));
        }
      }
    }
  }
});
