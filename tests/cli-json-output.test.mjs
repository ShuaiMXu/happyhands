import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createRun} from '../packages/harness-core/store.js';

const exec = promisify(execFile);
const entry = fileURLToPath(new URL('../scripts/harness.mjs', import.meta.url));
const spec = JSON.parse(await readFile(new URL('../examples/happyclaw-site/experience.json', import.meta.url), 'utf8'));

// The optional workbench deep link used to be written to stdout ahead of the
// JSON, so `next` and `status` could not be parsed by a caller reading stdout.
test('status and next print parseable JSON, and only send the workbench link when asked', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cli-json-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const outputRoot = join(root, 'runs');
  await mkdir(outputRoot, {recursive: true});
  const run = await createRun({spec, url: 'http://127.0.0.1:4321', outputRoot});

  for (const command of ['status', 'next']) {
    const plain = await exec(process.execPath, [entry, command, '--run', run.directory], {env: {...process.env, HAPPYHANDS_WORKBENCH_LINK: ''}});
    assert.doesNotThrow(() => JSON.parse(plain.stdout), `${command}: stdout must stay pure JSON`);
    assert.equal(plain.stdout.includes('画布 → '), false, `${command}: the link must not reach stdout`);

    const linked = await exec(process.execPath, [entry, command, '--run', run.directory], {env: {...process.env, HAPPYHANDS_WORKBENCH_LINK: '1'}});
    assert.doesNotThrow(() => JSON.parse(linked.stdout), `${command}: stdout must stay pure JSON with the link enabled`);
    assert.match(linked.stderr, /画布 → /, `${command}: the link belongs on stderr when requested`);
  }
});

test('experience CLI forwards the pre-audit step and selected topic', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cli-experience-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const run = await createRun({spec, url: 'http://127.0.0.1:4321', outputRoot: root});
  const base = [entry, 'experience', '--run', run.directory, '--phase', 'context', '--surface', 'public-page'];
  const context = async (...args) => JSON.parse((await exec(process.execPath, [...base, ...args])).stdout);

  const initial = await context();
  assert.deepEqual(await context('--step', 'inspect'), initial);
  assert.ok(initial.topics.includes('hierarchy-content'));
  assert.equal(initial.auditSchema, undefined);
  const method = await context('--step', 'method', '--topic', 'hierarchy-content');
  assert.equal(method.step, 'method');
  assert.equal(method.readingPlan.topic, 'hierarchy-content');
  assert.ok((await context('--step', 'record')).auditSchema);
  const topicError = error => error.code === 1 && /--topic/.test(error.stderr);
  await assert.rejects(context('--step', 'method', '--topic', 'unlisted-topic'), topicError);
  await assert.rejects(context('--step', 'inspect', '--topic', 'hierarchy-content'), topicError);
});

test('experience record submission rejects context-only flags before accessing the input file', async () => {
  for (const [phase, flag, value] of [['audit', 'step', 'inspect'], ['decision', 'topic', 'motion'], ['decision', 'surface', 'public-page']]) {
    await assert.rejects(
      exec(process.execPath, [entry, 'experience', '--run', 'unused', '--phase', phase, '--' + flag, value]),
      error => error.code === 1 && error.stderr.includes('--' + flag + ' is only available with --phase context')
    );
  }
});
