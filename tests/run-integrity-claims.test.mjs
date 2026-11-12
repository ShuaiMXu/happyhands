import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {withRunLock} from '../packages/harness-core/store.js';

const claimName = token => `claim-${createHash('sha256').update(token).digest('hex')}`;
const deadToken = () => `999999999-${randomUUID()}`;
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'pd-lock-claim-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  return {directory, lock: join(directory, 'run.lock')};
}

for (const contents of ['', `${process.pid}-${randomUUID()}`]) {
  test(`${contents ? 'A live' : 'An unpublished'} removal claim is never replaced`, async t => {
    const {directory, lock} = await fixture(t), marker = deadToken();
    await mkdir(lock);
    await writeFile(join(lock, marker), '');
    const claim = join(lock, claimName(marker));
    await writeFile(claim, contents);
    await assert.rejects(withRunLock(directory, () => assert.fail('entered a claimed lock'), {maxAttempts: 3, intervalMs: 1}), /Another harness writer/);
    assert.equal(await readFile(claim, 'utf8'), contents);
    assert.equal(await readFile(join(lock, marker), 'utf8'), '');
  });
}

test('dead removal claims are succeeded without replacing their files', async t => {
  const {directory, lock} = await fixture(t), marker = deadToken();
  await mkdir(lock);
  await writeFile(join(lock, marker), '');
  let previous = marker;
  for (let depth = 0; depth < 3; depth++) {
    const next = deadToken();
    await writeFile(join(lock, claimName(previous)), next);
    previous = next;
  }
  assert.equal(await withRunLock(directory, () => 'recovered'), 'recovered');
  assert.deepEqual(await readdir(directory), []);
});

test('an overlong dead-claim chain fails closed within the caller budget', async t => {
  const {directory, lock} = await fixture(t), marker = deadToken();
  await mkdir(lock);
  await writeFile(join(lock, marker), '');
  let previous = marker;
  for (let depth = 0; depth < 32; depth++) {
    const next = deadToken();
    await writeFile(join(lock, claimName(previous)), next);
    previous = next;
  }
  await assert.rejects(withRunLock(directory, () => assert.fail('entered an exhausted claim chain'), {maxAttempts: 2, intervalMs: 1}), /Another harness writer/);
  assert.equal((await readdir(lock)).length, 33);
});

test('an obsolete claim cannot prevent a new owner from releasing normally', async t => {
  const {directory, lock} = await fixture(t);
  await withRunLock(directory, async () => {
    await writeFile(join(lock, claimName(deadToken())), `${process.pid}-${randomUUID()}`, {flag: 'wx'});
  });
  assert.deepEqual(await readdir(directory), []);
  assert.equal(await withRunLock(directory, () => 'next owner'), 'next owner');
});

test('a delayed old-generation claimant cannot move or overlap a new live owner', async t => {
  const {directory} = await fixture(t), worker = join(directory, 'late-claim.mjs');
  // An isolated child schedules real filesystem operations at the publication
  // boundary. It does not fake a successful rename or modify the implementation.
  await writeFile(worker, `
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const directory=process.argv[2],lock=join(directory,'run.lock');
const old='999999999-11111111-1111-1111-1111-111111111111';
const obsolete='claim-'+createHash('sha256').update(old).digest('hex');
await fs.mkdir(lock);await fs.writeFile(join(lock,old),'');
const originalWrite=fs.writeFile,originalRename=fs.rename;
let pause,resume,published,release,entered;
const paused=new Promise(r=>pause=r),resumeOld=new Promise(r=>resume=r);
const obsoletePublished=new Promise(r=>published=r),held=new Promise(r=>entered=r),finish=new Promise(r=>release=r);
let intercepted=false,keeperHeld=false,active=0,peak=0;
const events=[];
fs.writeFile=async(path,...args)=>{
 if(!intercepted&&String(path)===join(lock,obsolete)){
  intercepted=true;pause();await resumeOld;
  const value=await originalWrite(path,...args);published();return value;
 }
 return originalWrite(path,...args);
};
fs.rename=async(from,to)=>{
 if(keeperHeld&&String(from)===lock&&String(to).startsWith(lock+'.retired-'))throw Error('Attempted to move a new live owner.');
 return originalRename(from,to);
};
syncBuiltinESMExports();
const {withRunLock}=await import(${JSON.stringify(new URL('../packages/harness-core/store.js', import.meta.url).href)});
const delayed=withRunLock(directory,async()=>{
 peak=Math.max(peak,++active);events.push('delayed-enter');active--;events.push('delayed-exit');
},{maxAttempts:1000,intervalMs:1});
delayed.catch(()=>{});
await paused;
const keeper=withRunLock(directory,async()=>{
 keeperHeld=true;peak=Math.max(peak,++active);events.push('keeper-enter');entered();
 await finish;events.push('keeper-exit');active--;keeperHeld=false;
},{maxAttempts:1000,intervalMs:1});
keeper.catch(()=>{});
await held;resume();await obsoletePublished;await delay(30);
assert.equal(active,1);assert.equal(peak,1);
assert.equal((await fs.readdir(lock)).filter(name=>/^\\d+-[0-9a-f-]{36}$/.test(name)).length,1);
assert.ok((await fs.readdir(lock)).includes(obsolete));
release();await Promise.all([keeper,delayed]);
assert.equal(peak,1);assert.deepEqual(events,['keeper-enter','keeper-exit','delayed-enter','delayed-exit']);
assert.ok(!(await fs.readdir(directory)).includes('run.lock'));
fs.writeFile=originalWrite;fs.rename=originalRename;syncBuiltinESMExports();
console.log(JSON.stringify({peak,events,obsoleteClaimObserved:true}));
`);
  const result = await promisify(execFile)(process.execPath, [worker, directory], {timeout: 15000, windowsHide: true});
  const observed = JSON.parse(result.stdout);
  assert.equal(observed.peak, 1);
  assert.equal(observed.obsoleteClaimObserved, true);
  assert.deepEqual(observed.events, ['keeper-enter', 'keeper-exit', 'delayed-enter', 'delayed-exit']);
});
