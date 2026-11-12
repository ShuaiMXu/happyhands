import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const exec = promisify(execFile);
const assets = ['star-history.json', 'star-history-light.svg', 'star-history-dark.svg'];
const timestamps = ['2026-10-25T14:10:24Z', '2026-11-10T12:00:00Z', '2026-11-12T00:00:00Z'];

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'hh-star-history-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  await mkdir(join(root, 'scripts'));
  await mkdir(join(root, 'assets', 'readme'), {recursive: true});
  const script = join(root, 'scripts', 'update-star-history.mjs');
  const mock = join(root, 'mock-github.mjs');
  await copyFile(new URL('../scripts/update-star-history.mjs', import.meta.url), script);
  // Mock the gh process inside Node so this check also runs on Windows.
  await writeFile(mock, `
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
const fixture = JSON.parse(process.env.HH_STAR_FIXTURE);
childProcess.execFileSync = (command, args) => {
  if (command !== 'gh' || args[0] !== 'api') throw new Error('Unexpected command');
  if (fixture.failure) throw new Error('GitHub authentication failed');
  return args.includes('--paginate') ? fixture.timestamps.join('\\n') : JSON.stringify({stargazers_count: fixture.count});
};
syncBuiltinESMExports();
const NativeDate = Date;
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [fixture.now])); }
  static now() { return NativeDate.parse(fixture.now); }
};
`);
  return {
    run: (overrides = {}) => exec(process.execPath, ['--import', mock, script], {
      cwd: root,
      env: {...process.env, HH_STAR_FIXTURE: JSON.stringify({timestamps, count: timestamps.length, now: '2026-11-12T01:23:00Z', ...overrides})},
    }),
    read: () => Promise.all(assets.map(name => readFile(join(root, 'assets', 'readme', name), 'utf8'))),
  };
}

test('same-day unchanged star snapshots are byte-identical; new dates and stars refresh all assets', async t => {
  const f = await fixture(t);
  await f.run();
  const initial = await f.read();
  const snapshot = JSON.parse(initial[0]);
  assert.equal(snapshot.totalStars, 3);
  assert.equal(snapshot.starredInLast7Days, 2);
  assert.deepEqual(snapshot.series.at(-1), {date: '2026-11-12', stars: 3});
  assert.ok(initial[1].includes('3 current stars as of 2026-11-12'));
  assert.ok(initial[2].includes('3 current stars as of 2026-11-12'));
  await f.run({now: '2026-11-12T15:00:00Z'});
  assert.deepEqual(await f.read(), initial);
  await f.run({now: '2026-11-12T15:00:00Z', timestamps: [...timestamps, '2026-11-12T14:00:00Z'], count: 4});
  const changed = await f.read();
  assert.ok(changed.every((content, index) => content !== initial[index]));
  assert.equal(JSON.parse(changed[0]).generatedAt, '2026-11-12T15:00:00.000Z');
  await f.run({now: '2026-11-13T01:23:00Z'});
  const nextDay = await f.read();
  assert.ok(nextDay.every((content, index) => content !== initial[index]));
  assert.deepEqual(JSON.parse(nextDay[0]).series.at(-1), {date: '2026-11-13', stars: 3});
});

test('API errors, missing or invalid dates, and inconsistent counts retain every chart asset', async t => {
  const f = await fixture(t);
  await f.run();
  const initial = await f.read();
  for (const overrides of [
    {failure: true},
    {timestamps: []},
    {timestamps: ['invalid'], count: 1},
    {count: 4},
  ]) {
    await assert.rejects(f.run(overrides));
    assert.deepEqual(await f.read(), initial);
  }
});
