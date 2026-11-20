import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {appendFile, mkdir, mkdtemp, readdir, rename, rm, writeFile} from 'node:fs/promises';
import {release, tmpdir} from 'node:os';
import {join, relative, resolve} from 'node:path';

const output = resolve(process.argv[2] || 'run-lock-probe.ndjson');
const rounds = 16;
const contenders = 32;
const root = await mkdtemp(join(tmpdir(), 'happyhands-lock-probe-'));
const summary = {rename: {multipleClaims: 0, retireErrors: 0}, exclusive: {multipleClaims: 0, retireErrors: 0}};
const writeRows = rows => appendFile(output, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
const claimName = owner => 'claim-' + createHash('sha256').update(owner).digest('hex');
const ownerA = '999999999-11111111-1111-1111-1111-111111111111';
const ownerB = process.pid + '-22222222-2222-2222-2222-222222222222';
const expectedConflicts = new Set(['ENOENT', 'ENOTDIR', 'EEXIST', 'EPERM', 'EACCES', 'EBUSY']);

function trace(rows) {
  let sequence = 0;
  return async (step, contender, paths, run) => {
    const operation = {step, contender, paths: paths.map(path => relative(root, path))};
    rows.push({...operation, event:'submitted', sequence:++sequence, milliseconds:performance.now()});
    try {
      const value = await run();
      rows.push({...operation, event:'completed', sequence:++sequence, milliseconds:performance.now(), status:'ok',
        ...(Array.isArray(value) ? {entries:value} : {})});
      return {ok:true, value};
    } catch (error) {
      rows.push({...operation, event:'completed', sequence:++sequence, milliseconds:performance.now(), status:'error',
        code:error.code || error.name});
      return {ok:false, code:error.code || error.name};
    }
  };
}

async function publish(lock, owner, record) {
  assert.equal((await record('create-lock', owner, [lock], () => mkdir(lock))).ok, true);
  const path = join(lock, owner);
  assert.equal((await record('publish-owner', owner, [path], () => writeFile(path, '', {flag:'wx'}))).ok, true);
}

async function race(protocol, round) {
  const rows = [{event:'race', protocol, round, contenders}];
  const record = trace(rows);
  const directory = join(root, `${protocol}-${round}`);
  const lock = join(directory, 'run.lock');
  await mkdir(directory);
  try {
    await publish(lock, ownerA, record);
    const results = await Promise.all(Array.from({length:contenders}, async (_, index) => {
      const marker = join(lock, ownerA);
      const claimPath = join(lock, protocol === 'rename' ? `reaping-${process.pid}-${randomUUID()}` : claimName(ownerA));
      const claim = await record('claim', index, [marker, claimPath], () => protocol === 'rename'
        ? rename(marker, claimPath)
        : writeFile(claimPath, String(index), {flag:'wx'}));
      if (!claim.ok) return {claim};
      if (protocol === 'exclusive') {
        const observed = await record('revalidate-owner', index, [lock], () => readdir(lock));
        assert.deepEqual(observed.value.filter(name => !name.startsWith('claim-')), [ownerA]);
      }
      const retired = join(directory, 'retired-' + index);
      const retire = await record('retire', index, [lock, retired], () => rename(lock, retired));
      if (retire.ok) await record('retired-owners', index, [retired], () => readdir(retired));
      return {claim, retire};
    }));
    const claimed = results.filter(result => result.claim.ok);
    const retired = claimed.filter(result => result.retire.ok);
    if (claimed.length > 1) summary[protocol].multipleClaims++;
    summary[protocol].retireErrors += claimed.length - retired.length;
    for (const {claim, retire} of results) {
      if (!claim.ok) assert.ok(expectedConflicts.has(claim.code), `Unexpected claim failure ${claim.code}`);
      if (retire && !retire.ok) assert.ok(expectedConflicts.has(retire.code), `Unexpected retire failure ${retire.code}`);
    }
    if (protocol === 'exclusive') {
      assert.equal(claimed.length, 1, 'one claimant per generation');
      assert.equal(retired.length, 1, 'the successful claim owns retirement');
    }
    if (retired.length) {
      await publish(lock, ownerB, record);
      assert.deepEqual((await record('new-owner', ownerB, [lock], () => readdir(lock))).value, [ownerB]);
    } else {
      await record('unretired-owners', 'observer', [lock], () => readdir(lock));
    }
    rows.push({event:'race-result', protocol, round, successfulClaims:claimed.length, retiredDirectories:retired.length});
  } finally {
    await writeRows(rows);
  }
}

async function staleGeneration() {
  const rows = [{event:'scheduled-handoff'}];
  const record = trace(rows);
  const lock = join(root, 'run.lock');
  const retired = join(root, 'old-generation');
  try {
    await publish(lock, ownerA, record);
    assert.deepEqual((await record('read-old-owner', 'paused', [lock], () => readdir(lock))).value, [ownerA]);
    assert.equal((await record('retire', 'current', [lock, retired], () => rename(lock, retired))).ok, true);
    await publish(lock, ownerB, record);
    const obsolete = join(lock, claimName(ownerA));
    assert.equal((await record('claim', 'paused', [obsolete], () => writeFile(obsolete, 'paused', {flag:'wx'}))).ok, true);
    const owners = (await record('revalidate-owner', 'paused', [lock], () => readdir(lock))).value.filter(name => !name.startsWith('claim-'));
    assert.deepEqual(owners, [ownerB]);
    rows.push({event:'handoff-result', observed:ownerA, current:ownerB, retireAttempted:false});
  } finally {
    await writeRows(rows);
  }
}

try {
  await writeFile(output, '', {flag:'wx'});
  await writeRows([{event:'environment', platform:process.platform, release:release(), arch:process.arch,
    node:process.version, libuv:process.versions.uv, threadPoolSize:process.env.UV_THREADPOOL_SIZE || 'default', rounds, contenders}]);
  for (const protocol of ['rename', 'exclusive']) {
    for (let round = 1; round <= rounds; round++) await race(protocol, round);
  }
  await staleGeneration();
  await writeRows([{event:'summary', ...summary}]);
  console.log(JSON.stringify({platform:process.platform, ...summary}));
} finally {
  await rm(root, {recursive:true, force:true, maxRetries:10, retryDelay:20});
}
