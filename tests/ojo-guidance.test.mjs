import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, cp, readFile, writeFile, readdir, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadOjoGuidance, stageOjoGuidance, ojoGuidancePrompt } from '../packages/skill-core/ojo-guidance.js';
const vendor = new URL('../skills/vendor/ojo/', import.meta.url);
test('OJO retries transient directory locks without losing the verified snapshot', async t => {
 const directory = await temporary(t); let calls = 0;
 const result = await stageOjoGuidance(directory, 'review', { renameDirectory: async (...args) => {
  if (++calls < 3) throw Object.assign(new Error('temporary Windows lock'), { code: 'EPERM' });
  return rename(...args);
 }});
 assert.equal(calls, 3);
 assert.equal(JSON.parse(await readFile(join(directory,result.metadata.reference,'bundle.json'),'utf8')).bundleHash,result.metadata.bundleHash);
});
async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(),'ojo-guidance-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  return directory;
}

test('OJO bundles the original skill, all nine references and MIT license with verified bytes',async()=>{
  const bundle=await loadOjoGuidance('review');
  assert.equal(bundle.documents.length,11);
  assert.equal(bundle.metadata.revision,'fbd2c2d158e5ebda8930f4bc63ed635a8500d31f');
  for(const file of bundle.documents) {
    const original=(await readFile(new URL(`upstream/${file.path.replace('upstream/','')}`,vendor),'utf8')).replaceAll('\r\n','\n');
    assert.equal(file.content,original);
    assert.equal(file.sha256,createHash('sha256').update(original).digest('hex'));
  }
  assert.match(bundle.documents.find(file=>file.path==='upstream/LICENSE').content,/Copyright \(c\) 2026 touchine-ojo/);
});

test('OJO preserves optional full references while routing review and implementation separately',async t=>{
  const directory=await temporary(t);
  const review=await stageOjoGuidance(directory,'review');
  const implementation=await stageOjoGuidance(directory,'implementation');
  assert.notEqual(review.metadata.bundleHash,implementation.metadata.bundleHash);
  assert.ok(review.metadata.readFirst.includes('upstream/references/design-audit.md'));
  assert.ok(!implementation.metadata.readFirst.includes('upstream/references/design-audit.md'));
  for(const bundle of [review,implementation]) {
    for(const file of bundle.metadata.readFirst) {
      assert.ok((await readFile(join(directory,bundle.metadata.reference,file),'utf8')).length>100);
      assert.ok(ojoGuidancePrompt(bundle,directory).includes(join(directory,bundle.metadata.reference,file)));
    }
    assert.ok((await readFile(join(directory,bundle.metadata.reference,'upstream/references/motion-system.md'),'utf8')).length>1000);
  }
  assert.deepEqual((await stageOjoGuidance(directory,'review')).metadata,review.metadata);
  await writeFile(join(directory,review.metadata.reference,'ADAPTER.md'),'changed');
  await assert.rejects(stageOjoGuidance(directory,'review'),/snapshot changed/);
});

test('OJO rejects changed upstream bytes and inventory escapes before use',async t=>{
  const root=await temporary(t);
  await cp(vendor,root,{recursive:true});
  await writeFile(join(root,'upstream/references/motion-system.md'),'unreviewed change');
  await assert.rejects(loadOjoGuidance('review',root),/hash mismatch/);
  const source=JSON.parse(await readFile(join(root,'source.json')));
  source.files[0].path='../outside.md';
  await writeFile(join(root,'source.json'),JSON.stringify(source));
  await assert.rejects(loadOjoGuidance('review',root),/source inventory/);
});

test('OJO adapter changes produce a different provenance fingerprint',async t=>{
  const root=await temporary(t);
  await cp(vendor,root,{recursive:true});
  const before=await loadOjoGuidance('review',root);
  await writeFile(join(root,'ADAPTER.md'),before.adapter+'\nLocal test amendment.\n');
  const after=await loadOjoGuidance('review',root);
  assert.notEqual(before.metadata.bundleHash,after.metadata.bundleHash);
  await assert.rejects(loadOjoGuidance('unknown',root),/Unknown OJO guidance mode/);
});


test('interrupted legacy and temporary snapshots do not block retry or get overwritten',async t=>{
  const directory=await temporary(t);
  const bundle=await loadOjoGuidance('review');
  const legacy=join(directory,'ojo-guidance',bundle.metadata.bundleHash);
  const pending=join(directory,'ojo-guidance','v2',`.pending-${bundle.metadata.bundleHash}-interrupted`);
  for(const path of [legacy,pending]) {
    await mkdir(path,{recursive:true});
    await writeFile(join(path,'ADAPTER.md'),'');
  }
  const recovered=await stageOjoGuidance(directory,'review');
  assert.equal(await readFile(join(directory,recovered.metadata.reference,'ADAPTER.md'),'utf8'),bundle.adapter);
  assert.deepEqual((await stageOjoGuidance(directory,'review')).metadata,recovered.metadata);
  for(const path of [legacy,pending]) assert.equal(await readFile(join(path,'ADAPTER.md'),'utf8'),'');
});

test('concurrent publication converges on a complete snapshot without leftover staging',async t=>{
  const directory=await temporary(t);
  const bundles=await Promise.all(Array.from({length:12},()=>stageOjoGuidance(directory,'review')));
  for(const bundle of bundles) assert.deepEqual(bundle.metadata,bundles[0].metadata);
  assert.deepEqual(await readdir(join(directory,'ojo-guidance','v2')),[bundles[0].metadata.bundleHash]);
  for(const document of bundles[0].documents) {
    assert.equal(await readFile(join(directory,bundles[0].metadata.reference,document.path),'utf8'),document.content);
  }
});

test('a published snapshot with a missing file is rejected rather than silently repaired',async t=>{
  const directory=await temporary(t);
  const bundle=await stageOjoGuidance(directory,'review');
  await rm(join(directory,bundle.metadata.reference,'upstream/SKILL.md'));
  await assert.rejects(stageOjoGuidance(directory,'review'),/snapshot changed.*missing/);
  await assert.rejects(readFile(join(directory,bundle.metadata.reference,'upstream/SKILL.md')), {code:'ENOENT'});
});


test('OJO concurrent recovery preserves old partial evidence and publishes a complete new bundle',async t=>{
  const directory=await temporary(t);
  const bundle=await loadOjoGuidance('review');
  const legacy=join(directory,'ojo-guidance',bundle.metadata.bundleHash);
  await mkdir(legacy,{recursive:true});
  await writeFile(join(legacy,'ADAPTER.md'),'');
  const [first,second]=await Promise.all([
    stageOjoGuidance(directory,'review'),
    stageOjoGuidance(directory,'review')
  ]);
  assert.deepEqual(first.metadata,second.metadata);
  assert.equal(await readFile(join(legacy,'ADAPTER.md'),'utf8'),'');
  const target=join(directory,first.metadata.reference);
  assert.equal(await readFile(join(target,'ADAPTER.md'),'utf8'),bundle.adapter);
  assert.deepEqual(JSON.parse(await readFile(join(target,'bundle.json'),'utf8')),bundle.metadata);
});
