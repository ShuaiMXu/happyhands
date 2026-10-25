import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createRun,saveCapture,saveReviewAttachment,saveVisualReview,loadRun} from '../packages/harness-core/store.js';
import {exportRun} from '../packages/harness-core/export.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
const hash=createHash('sha256').update(png).digest('hex');
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'review-attachment-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const spec=JSON.parse(await readFile(new URL('../examples/happyclaw-site/experience.json',import.meta.url),'utf8'));
 const run=await createRun({spec,url:'http://localhost:4321',outputRoot:root,id:'test-run'});
 await mkdir(join(run.directory,'before'));await writeFile(join(run.directory,'before','desktop.png'),png);
 await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png'}}});return {root,run};
}
const input={screenshot:'before/desktop.png',fingerprint:hash,image:png,notes:'The primary action needs review.'};
const review=id=>({schemaVersion:'0.1',skillId:'visual-hierarchy-reviewer',reviewer:{type:'human',name:'QA fixture',version:'1'},reviewedAt:'2026-09-28',verdict:'needs-evidence',screenshotRefs:['before/desktop.png'],attachmentRefs:[id],findings:[],rationale:'Fixture review',limitations:['Not product acceptance']});
test('annotations export with provenance and are cited in durable visual reviews',async t=>{
 const {root,run}=await fixture(t);const attachment=await saveReviewAttachment(run.directory,input);
 assert.equal(attachment.fingerprint,hash);assert.equal(attachment.imageHash,hash);
 await saveVisualReview(run.directory,review(attachment.id));
 await exportRun({directory:run.directory,outputRoot:join(root,'public')});
 assert.deepEqual(await readFile(join(root,'public','test-run',attachment.path)),png);
 const saved=JSON.parse(await readFile(join(run.directory,'reviews','visual-hierarchy-reviewer.json')));
 assert.deepEqual(saved.attachmentRefs,[attachment.id]);
 assert.equal((await loadRun(run.directory)).manifest.judgment,null);
});
test('attachments reject stale sources, unknown references and changed annotation bytes',async t=>{
 const {run}=await fixture(t);
 await assert.rejects(saveReviewAttachment(run.directory,{...input,fingerprint:'stale'}),/source changed/);
 await assert.rejects(saveReviewAttachment(run.directory,{...input,screenshot:'../secret.png'}),/Invalid/);
 await assert.rejects(saveVisualReview(run.directory,review('11111111-1111-1111-1111-111111111111')),/Unknown/);
 const attachment=await saveReviewAttachment(run.directory,input);
 await writeFile(join(run.directory,attachment.path),'tampered');
 await assert.rejects(saveVisualReview(run.directory,review(attachment.id)),/attachment or source changed/);
 assert.equal((await loadRun(run.directory)).manifest.visualReviews.length,0);
});
test('annotations cannot substitute for matched before and after QA evidence',async t=>{
 const {run}=await fixture(t);const attachment=await saveReviewAttachment(run.directory,input);
 await assert.rejects(saveVisualReview(run.directory,{...review(attachment.id),skillId:'visual-qa-evaluator'}),/rendered capture/);
});
