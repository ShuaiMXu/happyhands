import {fakeModel} from './helpers/pattern-model.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rename,symlink,rm,link} from 'node:fs/promises';
import {join} from 'node:path';
import {fixture,png} from './helpers/pattern-fixture.mjs';
import {runPatternReview} from '../packages/workbench/pattern-review.js';
import {readPatternReview} from '../packages/harness-core/pattern-review-record.js';
import {loadRun,withdrawJudgment} from '../packages/harness-core/store.js';
import {exportRun,reindex} from '../packages/harness-core/export.js';
import {repositoryFingerprint,sameRepositoryFingerprint} from '../packages/harness-core/repository-fingerprint.js';
const source='components/Panel.jsx';
test('guidance receives verified original images and source, persists immutable proposals and exports no private source context',async t=>{
  const {repo,root,run}=await fixture(t),cwd=join(root,'model-job');await mkdir(cwd);
  const fingerprint=await repositoryFingerprint(repo);
  const before=JSON.stringify(run.spec.designFoundation);let calls=0;
  const options={repo,source,cwd,generate:async(...args)=>{calls++;await fakeModel(...args);}};
  const record=await runPatternReview(run.directory,options);
  assert.equal(record.status,'proposal-only');assert.equal(record.guidance.verdict,'propose');
  const latest=await loadRun(run.directory),reference=latest.manifest.patternReviews[0];
  assert.equal(JSON.stringify(latest.spec.designFoundation),before);assert.equal(latest.manifest.judgment,null);
  const saved=await readPatternReview(latest,reference);assert.equal(saved.input.images.length,1,'identical originals deduplicate by bytes, not by declared instances');
  assert.ok(!JSON.stringify(saved).includes(repo));
  assert.deepEqual(await runPatternReview(run.directory,options),record);assert.equal(calls,1,'live-valid cached advice should not call the model again');
  assert.ok(sameRepositoryFingerprint(fingerprint,await repositoryFingerprint(repo)),'review must not modify the target repository');
  // The synthetic current run has no baseline; supply its independently marked test capture for export.
  const {saveCapture}=await import('../packages/harness-core/store.js');await mkdir(join(run.directory,'before'));
  await writeFile(join(run.directory,'before/desktop.png'),await readFile(join(cwd,'inputs',saved.input.images[0].file)));
  await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png'}}});
  const exported=await exportRun({directory:run.directory,outputRoot:join(root,'public')});
  assert.ok(saved.files.every(file=>exported.files.includes(file)));assert.ok(!exported.files.some(file=>file.includes('context.json')||file.endsWith('SKILL.md')));
  const copy=await loadRun(exported.directory);assert.equal((await readPatternReview(copy,copy.manifest.patternReviews[0])).record.status,'proposal-only');
  const exportedImage=join(exported.directory,saved.files.find(path=>path.endsWith('.png'))),outside=join(root,'external-sentinel');
  await rm(exportedImage);await writeFile(outside,'must remain untouched');await link(outside,exportedImage);
  await assert.rejects(exportRun({directory:run.directory,outputRoot:join(root,'public')}),/Published pattern artifact changed/);
  assert.equal(await readFile(outside,'utf8'),'must remain untouched');
  await rm(exportedImage);await writeFile(exportedImage,png);
  await writeFile(join(exported.directory,saved.files.find(path=>path.endsWith('.png'))),'changed');
  assert.deepEqual(await reindex(join(root,'public')),[],'tampered pattern evidence must not enter the public index');
});
test('changes to parent acceptance, originals, current source or model inputs publish no guidance',async t=>{
  for(const kind of ['withdrawal','original','source','context','image-input','foundation','cancel','linked-input'])await t.test(kind,async sub=>{
    const {root,repo,run,parent}=await fixture(sub),controller=new AbortController();
    await assert.rejects(runPatternReview(run.directory,{repo,source,cwd:join(root,'job'),signal:controller.signal,generate:async(...args)=>{
      await fakeModel(...args);const cwd=args[2].cwd;
      if(kind==='withdrawal')await withdrawJudgment(parent.directory,'Synthetic withdrawal during model review');
      if(kind==='original')await writeFile(join(parent.directory,'after/panel-0--desktop.png'),'changed');
      if(kind==='source')await writeFile(join(repo,'PageA.jsx'),'changed');
      if(kind==='context')await writeFile(join(cwd,'inputs/context.json'),'{}');
      if(kind==='image-input'){const context=JSON.parse(await readFile(join(cwd,'inputs/context.json')));await writeFile(join(cwd,'inputs',context.input.images[0].file),'changed');}
      if(kind==='foundation'){const spec=JSON.parse(await readFile(join(run.directory,'experience.json')));spec.designFoundation.brand.voice.push('Changed while reviewing');await writeFile(join(run.directory,'experience.json'),JSON.stringify(spec));}
      if(kind==='cancel')controller.abort();
      if(kind==='linked-input'){await rename(join(cwd,'inputs'),join(root,'moved-inputs'));await symlink(join(root,'moved-inputs'),join(cwd,'inputs'),process.platform==='win32'?'junction':'dir');}
    }}),/changed|No current|abort|symlink/i);
    assert.equal((await loadRun(run.directory)).manifest.patternReviews,undefined);
  });
});
test('invalid model references, empty guidance and contradictory verdicts cannot be published',async t=>{
  for(const kind of ['image-ref','source-ref','token-ref','missing-use','not-reusable','score','whitespace'])await t.test(kind,async sub=>{
    const {root,repo,run}=await fixture(sub);
    await assert.rejects(runPatternReview(run.directory,{repo,source,cwd:join(root,'job'),generate:async(...args)=>{
      await fakeModel(...args);const path=join(args[2].cwd,'pattern-result.json'),guide=JSON.parse(await readFile(path));
      if(kind==='image-ref')guide.imageRefs=['images/not-supplied.png'];if(kind==='source-ref')guide.sourceRefs=['other.jsx'];
      if(kind==='token-ref')guide.tokenRefs=['--invented'];if(kind==='missing-use')guide.whenToUse=[];
      if(kind==='not-reusable')guide.verdict='not-reusable';if(kind==='score')guide.score=100;
      if(kind==='whitespace')guide.whenToAvoid=['   '];
      await writeFile(path,JSON.stringify(guide));
    }}),/guidance|require|cannot|evidence/i);
    assert.equal((await loadRun(run.directory)).manifest.patternReviews,undefined);
  });
});
test('withdrawal blocks new or cached model curation without erasing historical proposal evidence',async t=>{
  const {root,repo,run,parent}=await fixture(t),options={repo,source,cwd:join(root,'job'),generate:fakeModel};
  await runPatternReview(run.directory,options);await withdrawJudgment(parent.directory,'Synthetic later withdrawal');
  await assert.rejects(runPatternReview(run.directory,options),/No current/);
  const latest=await loadRun(run.directory);assert.equal((await readPatternReview(latest,latest.manifest.patternReviews[0])).record.status,'proposal-only');
});

test('changed sealed originals block cached advice and export while preserving the recorded proposal',async t=>{
  const {root,repo,run}=await fixture(t),{saveCapture}=await import('../packages/harness-core/store.js');
  await mkdir(join(run.directory,'before'));await writeFile(join(run.directory,'before/desktop.png'),png);
  await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png'}}});
  const options={repo,source,cwd:join(root,'job'),generate:fakeModel};await runPatternReview(run.directory,options);
  const current=await loadRun(run.directory),reference=current.manifest.patternReviews[0],sealed=await readPatternReview(current,reference);
  await writeFile(join(run.directory,sealed.files.find(path=>path.endsWith('.png'))),'changed');
  await assert.rejects(runPatternReview(run.directory,options),/original changed/);
  await assert.rejects(exportRun({directory:run.directory,outputRoot:join(root,'public')}),/original changed/);
  assert.equal((await loadRun(run.directory)).manifest.patternReviews[0].hash,reference.hash);
});

test('honest missing-evidence verdicts persist without usage rules or automatic approval',async t=>{
  const {root,repo,run}=await fixture(t);
  const review=await runPatternReview(run.directory,{repo,source,cwd:join(root,'job'),generate:async(...args)=>{
    await fakeModel(...args);const path=join(args[2].cwd,'pattern-result.json'),guide=JSON.parse(await readFile(path));
    guide.verdict='needs-evidence';guide.whenToUse=[];guide.whenToAvoid=[];guide.exceptions=[];guide.summary='Synthetic evidence is insufficient for reusable guidance.';await writeFile(path,JSON.stringify(guide));
  }});
  assert.equal(review.guidance.verdict,'needs-evidence');assert.deepEqual(review.guidance.whenToUse,[]);
  assert.deepEqual((await loadRun(run.directory)).spec.designFoundation,run.spec.designFoundation);
});

test('unregistered prior output does not become a cache entry or block a fresh verified attempt',async t=>{
  const {root,repo,run}=await fixture(t);let calls=0;
  const options={repo,source,generate:async(...args)=>{calls++;await fakeModel(...args);}};
  await runPatternReview(run.directory,{...options,cwd:join(root,'first-job')});
  const first=await loadRun(run.directory),old=first.manifest.patternReviews[0],original=await readFile(join(run.directory,old.path));
  delete first.manifest.patternReviews;await writeFile(join(run.directory,'run.json'),JSON.stringify(first.manifest));
  await runPatternReview(run.directory,{...options,cwd:join(root,'retry-job')});
  const latest=await loadRun(run.directory),reference=latest.manifest.patternReviews[0];
  assert.equal(calls,2);assert.notEqual(reference.id,old.id);assert.equal(reference.inputDigest,old.inputDigest);
  assert.ok((await readFile(join(run.directory,old.path))).equals(original));
});

test('concurrent equivalent model requests publish one registered proposal without overwriting either attempt',async t=>{
  const {root,repo,run}=await fixture(t);
  const records=await Promise.all(['one','two'].map(name=>runPatternReview(run.directory,{repo,source,cwd:join(root,name),generate:fakeModel})));
  const latest=await loadRun(run.directory);assert.equal(latest.manifest.patternReviews.length,1);
  assert.equal(records[0].inputHash,records[1].inputHash);
});
