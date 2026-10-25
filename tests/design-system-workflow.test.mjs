import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {createRun,loadRun,confirmFinding,savePlan,saveEvaluation,saveDesignSystemExtraction} from '../packages/harness-core/store.js';
import {captureWithDesignSystem,extractDesignSystem} from '../packages/harness-core/design-system.js';
import {designSystemContext,snapshotHash} from '../packages/skill-core/design-system.js';
import {sourceFiles} from '../packages/skill-core/scan.js';
import {exportRun} from '../packages/harness-core/export.js';
import {runAiVisualReview} from '../packages/workbench/ai-review.js';
import {inventoryComponents} from '../packages/skill-core/components.js';
import {buildDesignSystemExtraction} from '../packages/skill-core/design-system.js';
import {readVisualReviewBinding} from '../packages/harness-core/visual-review-binding.js';
import {runHandler} from '../packages/skill-core/handlers.js';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');

test('offline extraction binds state observations to template coordinates without borrowing loader states', async () => {
  const template='<html><style>:root { --radius-control: 12px; }</style><body><button disabled>default loading</button></body></html>';
  const file={path:'bundle.html',content:'<script>/* pending needs review retry reason */</script>\n<script type="__bundler/template">'+JSON.stringify(template)+'</script>'};
  const snapshot={files:[file],truncated:false,omissions:[]};
  const foundation=await runHandler('foundationExtractor',{repo:'synthetic-offline',sourceSnapshot:snapshot});
  const extraction=buildDesignSystemExtraction({snapshot,foundation,capture:{viewports:{}},phase:'before'});
  assert.equal(extraction.extractorVersion,'0.11.0');
  assert.equal(extraction.components.length,1);
  const component=extraction.components[0];
  assert.deepEqual(component.observedStates,['in-progress','disabled','default']);
  assert.equal(component.sourceCoordinates.containerLine,2);
  assert.deepEqual(component.stateEvidence,{kind:'static-text-candidate',sourceFound:true,sourceCoordinates:component.sourceCoordinates,sourceError:null});
  assert.deepEqual(extraction.rendered,[], 'synthetic source observations cannot invent rendered evidence');
});
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'design-system-workflow-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const repo=join(root,'app');await mkdir(join(repo,'src/components/ui'),{recursive:true});await mkdir(join(repo,'src/pages'));
  await writeFile(join(repo,'src/tokens.css'),':root { --color-action: #0f766e; --space-md: 16px; --radius-control: 12px; --motion-duration: 160ms; }');
  await writeFile(join(repo,'DESIGN.md'),'# Design System\n## Colors\nUse src/tokens.css as the source.\n```css\n:root { --example-only: pink; }\n```');
  await writeFile(join(repo,'src/components/ui/CommandStep.astro'),'---\ninterface Props { title: string; items: { label: string; value: "}" }[]; /* } */ command: string; }\nconst {title, command} = Astro.props;\n---\n<button disabled style="color:var(--color-action)">{title}</button><p role="status">success error</p>');
  await writeFile(join(repo,'src/pages/index.astro'),"---\nimport CommandStep from '../components/ui/CommandStep.astro';\n---\n<CommandStep title=\"Start\" command=\"original\" />");
  execFileSync('git',['init','-q'],{cwd:repo});execFileSync('git',['add','.'],{cwd:repo});execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','fixture'],{cwd:repo});
  const spec=structuredClone(sample);spec.designFoundation.status='approved';
  const run=await createRun({spec,url:'http://127.0.0.1:4321',outputRoot:root,id:'design-system-test'});
  async function capture(phase,mutate){return captureWithDesignSystem({directory:run.directory,repo,phase,capture:async()=>{
    await mkdir(join(run.directory,phase),{recursive:true});await writeFile(join(run.directory,phase,'desktop.png'),png);
    if(mutate)await mutate();
    return {viewports:{desktop:{screenshot:`${phase}/desktop.png`,dom:{designSystem:{status:'observed-visible-samples',rootVariables:{'--color-action':'#0f766e'},elements:[{tag:'button',styles:{color:'rgb(15,118,110)'}}]}}}}};
  }});}
  return {root,repo,run,spec,capture};
}

test('capture-bound extraction records documents, exact nested APIs, consumers and rendered samples without altering approval',async t=>{
  const {repo,run,spec,capture}=await fixture(t);await capture('before');
  const saved=await loadRun(run.directory),ctx=await designSystemContext(saved),before=ctx.before;
  assert.equal(before.source.binding,'capture-scan-match');assert.match(before.source.repositoryCommit,/^[a-f0-9]{40}$/);assert.equal(before.source.dirty,false);
  assert.equal(before.source.snapshotHash,snapshotHash(await sourceFiles(repo,{includeDesignDocs:true})));
  assert.deepEqual(before.documents.map(x=>x.source),['DESIGN.md']);
  assert.equal(before.documents[0].content,await readFile(join(repo,'DESIGN.md'),'utf8'));
  assert.equal(before.tokens.some(x=>x.name==='--example-only'),false,'documentation code examples are not product tokens');
  assert.deepEqual(before.brandEvidence.declarations.map(item=>({category:item.category,text:item.text})),[{category:'visual',text:'Use src/tokens.css as the source.'}]);
  const component=before.components.find(x=>x.name==='CommandStep');assert.match(component.api.declaration,/command: string/,'nested types, quoted and commented braces are preserved');
  assert.deepEqual(component.consumers,['src/pages/index.astro']);assert.deepEqual(component.tokenReferences,['--color-action']);assert.ok(component.observedStates.includes('disabled'));
  assert.ok(before.rendered[0].samples.elements.length);assert.equal(ctx.after,null);
  assert.deepEqual(saved.spec.designFoundation,spec.designFoundation);assert.equal(saved.manifest.foundationApproval,null);assert.equal(saved.manifest.judgment,null);
  await assert.rejects(saveDesignSystemExtraction(run.directory,before),/immutable/);
});

test('source-bound brand declarations reach original-image review, require assessment and survive immutable export',async t=>{
  const {repo,root,run,spec,capture}=await fixture(t);
  await writeFile(join(repo,'BRAND.md'),'## Voice\nCTA: Continue');await capture('before');
  await confirmFinding(run.directory,spec.findings[0].id,'supported','Synthetic scoped task');await savePlan(run.directory,spec.findings[0].id);
  await writeFile(join(repo,'BRAND.md'),'## Voice\nCTA: Next');await capture('after');await saveEvaluation(run.directory,{status:'fixture'});
  const ctx=await designSystemContext(await loadRun(run.directory));
  assert.equal(ctx.before.brandEvidence.declarations[0].text,'Continue');assert.equal(ctx.after.brandEvidence.declarations[0].text,'Next');
  assert.ok(ctx.comparison.brandDeclarations.changed.length);assert.equal(ctx.before.brandEvidence.renderedCopy[0].screenshot,'before/desktop.png');
  async function generate(_command,args,options){
    const context=JSON.parse(await readFile(join(options.cwd,'review-context.json')));assert.match(options.input,/Declared brand intent and rendered evidence/);
    assert.equal(context.brandReviewReferences.length,4);assert.equal(args.filter(value=>value==='-i').length,2);
    assert.deepEqual(context.brandReviewReferences.map(item=>item.category).sort(),['cta','cta','visual','visual']);
    assert.deepEqual(context.brandReviewOriginals,{before:['before/desktop.png'],after:['after/desktop.png']});
    assert.match(options.input,/Verification\/specialist images and annotations are NOT phase-bound brand originals/);
    const output={verdict:'needs-evidence',screenshotRefs:['before/desktop.png','after/desktop.png'],findings:[],rationale:'Synthetic originals do not certify wording.',limitations:['No real professional judgment.']};
    if(!options.cwd.endsWith('missing'))output.brandAssessments=context.brandReviewReferences.map(item=>({reference:item.reference,verdict:'not-visible',observation:'Synthetic image has no readable text; cannot compare this declaration.',screenshotRefs:[]}));
    await writeFile(args[args.indexOf('-o')+1],JSON.stringify(output));
  }
  for(const name of ['missing','valid'])await mkdir(join(root,name));
  await assert.rejects(runAiVisualReview(run.directory,{cwd:join(root,'missing'),signal:new AbortController().signal,generate}),/every capture-bound/);
  assert.deepEqual((await loadRun(run.directory)).manifest.visualReviews,[]);
  const review=await runAiVisualReview(run.directory,{cwd:join(root,'valid'),signal:new AbortController().signal,generate});assert.equal(review.brandAssessments.length,4);
  const current=await loadRun(run.directory);assert.equal((await readVisualReviewBinding(current,current.manifest.visualReviews[0])).status,'bound');
  await exportRun({directory:run.directory,outputRoot:join(root,'public')});assert.deepEqual(current.spec.designFoundation,spec.designFoundation);assert.equal(current.manifest.judgment,null);
  await writeFile(join(run.directory,'after/design-system.json'),'changed');await assert.rejects(readVisualReviewBinding(current,current.manifest.visualReviews[0]),/extraction changed/);
});

test('the shared plan and independent review receive decomposition evidence, then export both immutable phases',async t=>{
  const {repo,root,run,spec,capture}=await fixture(t);await capture('before');
  const finding=spec.findings[0].id;await confirmFinding(run.directory,finding,'supported','Fixture scope');await savePlan(run.directory,finding);
  const brief=await readFile(join(run.directory,'codex-brief.md'),'utf8');assert.match(brief,/Design system extraction and component boundaries/);assert.match(brief,/choose reuse, extract, or keep local/);assert.match(brief,/items: \{ label: string/);
  const reuse=JSON.parse(await readFile(join(run.directory,'component-reuse-plan.json')));assert.equal(reuse.sourceCandidates[0].source,'src/components/ui/CommandStep.astro');
  await writeFile(join(repo,'src/tokens.css'),':root { --color-action: #115e59; --space-md: 16px; }');
  await writeFile(join(repo,'src/components/ui/SectionHeading.astro'),'---\ninterface Props {title: string}\n---\n<h2>{Astro.props.title}</h2>');
  await capture('after');await saveEvaluation(run.directory,{status:'fixture'});
  const cwd=join(root,'qa');await mkdir(cwd);
  await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(_command,args,options)=>{
    const context=JSON.parse(await readFile(join(cwd,'review-context.json')));
    assert.ok(context.designSystem.comparison.tokens.changed.includes('--color-action'));
    assert.ok(context.designSystem.comparison.components.added.includes('src/components/ui/SectionHeading.astro'));
    assert.notEqual(context.designSystem.before.source.snapshotHash,context.designSystem.after.source.snapshotHash);
    assert.match(options.input,/declared component APIs/);assert.equal(context.foundationApproval,null);
    assert.equal(context.brandReviewReferences.length,2);
    await writeFile(args[args.indexOf('-o')+1],JSON.stringify({verdict:'needs-evidence',screenshotRefs:['before/desktop.png','after/desktop.png'],findings:[],rationale:'Fixture originals do not prove quality.',limitations:['Test images only.'],brandAssessments:context.brandReviewReferences.map(item=>({reference:item.reference,verdict:'not-visible',observation:'Synthetic image cannot establish compliance with this design declaration.',screenshotRefs:[]}))}));
  }});
  const exported=await exportRun({directory:run.directory,outputRoot:join(root,'public')});
  for(const phase of ['before','after'])assert.equal(await readFile(join(root,'public',run.manifest.id,phase,'design-system.json'),'utf8'),await readFile(join(run.directory,phase,'design-system.json'),'utf8'));
  assert.ok(exported);assert.equal((await loadRun(run.directory)).manifest.judgment,null);
});

test('source changes during the browser capture are rejected before a capture or extraction is attached',async t=>{
  const {repo,run,capture}=await fixture(t);
  await assert.rejects(capture('before',()=>writeFile(join(repo,'src/tokens.css'),':root {--new: red;}')),/source changed during capture/);
  const saved=await loadRun(run.directory);assert.equal(saved.manifest.captures.before,null);assert.equal(saved.manifest.designSystemExtractions,undefined);
});

test('modified artifacts cannot enter plans, exports, or AI review; missing legacy extractions remain explicit',async t=>{
  const {root,run,spec,capture}=await fixture(t);await capture('before');
  await confirmFinding(run.directory,spec.findings[0].id,'supported','Fixture scope');
  await writeFile(join(run.directory,'before/design-system.json'),'{}');
  await assert.rejects(savePlan(run.directory,spec.findings[0].id),/extraction changed/);
  await assert.rejects(exportRun({directory:run.directory,outputRoot:join(root,'public')}),/extraction changed/);
  const legacy=await createRun({spec,url:'http://localhost',outputRoot:root,id:'legacy-design'});
  assert.deepEqual(await designSystemContext(await loadRun(legacy.directory)),{before:null,after:null,comparison:null});
});

test('AI evidence is rechecked after the model returns',async t=>{
  const {root,run,spec,capture}=await fixture(t);await capture('before');await confirmFinding(run.directory,spec.findings[0].id,'supported','Fixture scope');await savePlan(run.directory,spec.findings[0].id);await capture('after');await saveEvaluation(run.directory,{status:'fixture'});
  const cwd=join(root,'qa');await mkdir(cwd);
  await assert.rejects(runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(_command,args)=>{
    await writeFile(join(run.directory,'after/design-system.json'),'{}');
    await writeFile(args[args.indexOf('-o')+1],JSON.stringify({verdict:'pass',screenshotRefs:['before/desktop.png','after/desktop.png'],findings:[],rationale:'Fixture',limitations:['Fixture']}));
  }}),/extraction changed/);
  assert.deepEqual((await loadRun(run.directory)).manifest.visualReviews,[]);
});

test('component consumers resolve distinct paths and do not invent runtime instances or APIs',()=>{
  const result=inventoryComponents([{path:'components/Button.tsx',content:'export const Button=()=>null;'},
    {path:'admin/components/Button.tsx',content:'export const Button=()=>null;'},
    {path:'page.tsx',content:"import Button from './components/Button';"},
    {path:'DESIGN.md',content:"import Button from './components/Button';"},
    {path:'components/tokens.css',content:':root {--x:red}'}]);
  assert.equal(result.length,2);assert.deepEqual(result[0].consumers,['page.tsx']);assert.deepEqual(result[1].consumers,[]);
});

test('cancelled extraction does not record partial approval or silently attach evidence',async t=>{
  const {repo,run}=await fixture(t);const controller=new AbortController();controller.abort();
  await assert.rejects(extractDesignSystem({directory:run.directory,repo,phase:'before',signal:controller.signal}),{name:'AbortError'});
  assert.equal((await loadRun(run.directory)).manifest.designSystemExtractions,undefined);
});

test('bounded and malformed scans remain partial and unsupported APIs stay explicit',async t=>{
  const {repo}=await fixture(t);
  const limited=await sourceFiles(repo,{maxFiles:1,includeDesignDocs:true});
  assert.equal(limited.truncated,true);
  const foundation=await runHandler('foundationExtractor',{repo,sourceSnapshot:limited});
  assert.equal(buildDesignSystemExtraction({snapshot:limited,foundation,capture:{},phase:'before'}).status,'partial');
  const oversized=await sourceFiles(repo,{maxBytes:1,includeDesignDocs:true});assert.equal(oversized.truncated,true);
  const snapshot={files:[{path:'ui/Dialog.js',content:'export const Dialog=()=>null;'}, {path:'bad.css',content:':root { --color: red;'}],truncated:false};
  const malformed=await runHandler('foundationExtractor',{repo,sourceSnapshot:snapshot});
  const result=buildDesignSystemExtraction({snapshot,foundation:malformed,capture:{},phase:'before'});
  assert.equal(result.status,'partial');assert.equal(result.components[0].api.status,'needs-inspection');
});
