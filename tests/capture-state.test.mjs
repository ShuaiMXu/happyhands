import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCapturePlan, captureEntries, captureKey, configurationsForState } from '../packages/harness-core/capture-state.js';
import { evaluateCaptures } from '../packages/harness-core/evaluate.js';
import { replayAction, verifyRegionSource } from '../packages/harness-core/browser.js';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assertVisualReview } from '../packages/harness-core/visual-review.js';

const plan = {
  schemaVersion: '0.1',
  adapter: 'web',
  configurations: [
    { id: 'desktop', viewport: { width: 1280, height: 800 } },
    { id: 'phone', viewport: { width: 390, height: 844 } }
  ],
  states: [
    { id: 'empty', start: { url: 'http://127.0.0.1:4173/jobs' }, actions: [] },
    { id: 'failed', start: { url: 'http://127.0.0.1:4173/jobs' }, actions: [
      { type: 'click', role: 'button', name: 'Start job' },
      { type: 'wait-for', text: 'Job failed', timeoutMs: 5000 }
    ] }
  ]
};

function view(stateId, configurationId, phase) {
  return {
    stateId, configurationId, width: configurationId === 'phone' ? 390 : 1280, height: configurationId === 'phone' ? 844 : 800,
    status: 200, screenshot: `${phase}/${stateId}--${configurationId}.png`,
    dom: { h1: ['Jobs'], actions: [], horizontalOverflow: false }
  };
}

test('capture plan validates named configurations and replayable task states', () => {
  assert.equal(assertCapturePlan(structuredClone(plan)).states.length, 2);
  const duplicate = structuredClone(plan);
  duplicate.states[1].id = 'empty';
  assert.throws(() => assertCapturePlan(duplicate), /state IDs must be unique/i);
  const unsafe = structuredClone(plan);
  unsafe.configurations[0].id = '../desktop';
  assert.throws(() => assertCapturePlan(unsafe));
  const targeted = structuredClone(plan);
  targeted.states[1].configurations = ['phone'];
  assert.deepEqual(configurationsForState(assertCapturePlan(targeted), targeted.states[1]).map(item => item.id), ['phone']);
  const unknown = structuredClone(plan);
  unknown.states[1].configurations = ['tablet'];
  assert.throws(() => assertCapturePlan(unknown), /unknown configurations: tablet/i);
});

test('HappyClaw full-page plan maps every reviewed region to source evidence', async () => {
  const example = assertCapturePlan(JSON.parse(await readFile(new URL('../examples/happyclaw-site/page-review-capture-plan.json', import.meta.url), 'utf8')));
  const project = JSON.parse(await readFile(new URL('../examples/happyclaw-site/project.json', import.meta.url), 'utf8'));
  assert.ok(example.states.length > 9);
  assert.equal(example.states.filter(state=>state.captureMode==='full-page').length,1);
  assert.deepEqual(example.states.find(state=>state.id==='whole-page').actions,[]);
  assert.ok(example.states.filter(state=>state.captureMode!=='full-page').every(state => state.region?.selector && state.region?.source?.file && state.region?.source?.line && state.region?.source?.anchor && state.region?.source?.component));
  assert.equal(new Set(example.states.filter(state=>state.region).map(state => state.region.source.component)).size,9);
  assert.ok(example.states.some(state=>state.actions.some(action=>action.type==='scroll-horizontal')));
  assert.equal(project.capturePlan, 'page-review-capture-plan.json');
  assert.deepEqual(project.routes, ['/']);
  const menu = example.states.find(state => state.id === 'mobile-menu-open');
  assert.deepEqual(menu.configurations, ['mobile']);
  assert.deepEqual(menu.actions, [{ type: 'click', role: 'button', name: '菜单' }]);
  assert.ok(example.states.every(state => new URL(state.start.url).origin === new URL(project.url).origin));
});

test('legacy viewport captures remain one implicit page state', () => {
  const entries = captureEntries({ url: 'http://localhost/', viewports: { desktop: { width: 1280 } } });
  assert.deepEqual({ stateId: entries[0].stateId, configurationId: entries[0].configurationId, legacy: entries[0].legacy }, { stateId: 'page', configurationId: 'desktop', legacy: true });
  assert.equal(captureKey('failed', 'phone'), 'failed--phone');
});

test('evaluation matches state and configuration and reports an unreachable changed state', () => {
  const before = { states: [view('empty', 'desktop', 'before'), view('failed', 'desktop', 'before')] };
  const after = { states: [view('empty', 'desktop', 'after')] };
  const result = evaluateCaptures(before, after);
  assert.equal(result.views['empty--desktop'].checks.stateReached, true);
  assert.equal(result.views['failed--desktop'].checks.stateReached, false);
  assert.equal(result.views['failed--desktop'].reachable, false);
});

test('evaluation records a state that becomes reachable without reading absent baseline DOM', () => {
  const unreachable = { stateId: 'recovery', configurationId: 'desktop', width: 1280, height: 800, reached: false, error: 'Button was missing.' };
  const recovered = view('recovery', 'desktop', 'after');
  recovered.dom.controls = [{ tag: 'button', label: '菜单', ariaControls: 'mobile-menu', ariaControlsResolved: true, ariaExpanded: 'true', width: 40, height: 40 }];
  const result = evaluateCaptures({ states: [unreachable] }, { states: [recovered] });
  assert.equal(result.views['recovery--desktop'].recovery, true);
  assert.equal(result.views['recovery--desktop'].checks.baselineStateReached, false);
  assert.equal(result.views['recovery--desktop'].checks.stateReached, true);
  assert.equal(result.views['recovery--desktop'].afterScreenshot, 'after/recovery--desktop.png');
  assert.equal(result.views['recovery--desktop'].beforeControls.length, 0);
  assert.equal(result.views['recovery--desktop'].afterControls[0].ariaControlsResolved, true);
});

test('evaluation preserves control relationships and expanded state as before/after evidence', () => {
  const beforeView = view('mobile-menu-open', 'phone', 'before');
  const afterView = view('mobile-menu-open', 'phone', 'after');
  beforeView.dom.controls = [{ tag: 'button', label: '菜单', ariaControls: null, ariaControlsResolved: null, ariaExpanded: null, width: 40, height: 40 }];
  afterView.dom.controls = [{ tag: 'button', label: '菜单', ariaControls: 'mobile-menu missing-menu', ariaControlsResolved: false, ariaExpanded: 'true', width: 40, height: 40 }];
  const result = evaluateCaptures({ states: [beforeView] }, { states: [afterView] });
  assert.equal(result.views['mobile-menu-open--phone'].beforeControls[0].ariaExpanded, null);
  assert.equal(result.views['mobile-menu-open--phone'].afterControls[0].ariaControls, 'mobile-menu missing-menu');
  assert.equal(result.views['mobile-menu-open--phone'].afterControls[0].ariaControlsResolved, false);
  assert.equal(result.views['mobile-menu-open--phone'].afterControls[0].ariaExpanded, 'true');
});

test('visual QA must inspect a state that becomes reachable after the change', () => {
  const manifest = {
    mode: 'review', baseline: null,
    captures: {
      before: { states: [{ stateId: 'recovery', configurationId: 'desktop', reached: false, error: 'Button was missing.' }, view('stable', 'desktop', 'before')] },
      after: { states: [view('recovery', 'desktop', 'after'), view('stable', 'desktop', 'after')] }
    }
  };
  const review = {
    schemaVersion: '0.1', skillId: 'visual-qa-evaluator',
    reviewer: { type: 'human', name: 'reviewer', version: '1.0' }, reviewedAt: new Date().toISOString(),
    verdict: 'needs-evidence', screenshotRefs: ['before/stable--desktop.png', 'after/stable--desktop.png', 'after/recovery--desktop.png'],
    findings: [], rationale: 'The recovered state was inspected.', limitations: ['No behavioral analytics were available.']
  };
  assert.doesNotThrow(() => assertVisualReview(review, manifest));
  assert.throws(() => assertVisualReview({ ...review, screenshotRefs: review.screenshotRefs.filter(ref => !ref.includes('recovery')) }, manifest), /newly reachable/i);
});

test('web replay uses accessible roles and labels instead of CSS selectors', async () => {
  const calls = [];
  const locator = { click: async options => calls.push(['click', options]), fill: async (value, options) => calls.push(['fill', value, options]), first() { return this; }, waitFor: async options => calls.push(['wait', options]) };
  const page = {
    getByRole: (role, options) => { calls.push(['role', role, options]); return locator; },
    getByLabel: (label, options) => { calls.push(['label', label, options]); return locator; },
    getByText: (value, options) => { calls.push(['text', value, options]); return locator; },
    goto: async (url, options) => { calls.push(['goto', url, options]); return { status: () => 200 }; }
  };
  await replayAction(page, { type: 'click', role: 'button', name: 'Start job' });
  await replayAction(page, { type: 'fill', label: 'Project name', value: 'Demo product' });
  await replayAction(page, { type: 'wait-for', text: 'Job failed', timeoutMs: 5000 });
  await replayAction(page, { type: 'navigate', url: 'http://localhost/jobs' });
  assert.deepEqual(calls[0], ['role', 'button', { name: 'Start job', exact: true }]);
  assert.ok(calls.some(call => call[0] === 'label' && call[1] === 'Project name'));
  assert.ok(calls.some(call => call[0] === 'wait' && call[1].timeout === 5000));
  assert.ok(calls.some(call => call[0] === 'goto' && call[1] === 'http://localhost/jobs'));
});

test('region capture scrolls to a unique target with a bounded header offset',async()=>{
 const regional=structuredClone(plan);regional.states[0].actions=[{type:'scroll-to',selector:'#features',offset:80}];assert.equal(assertCapturePlan(regional).states[0].actions[0].type,'scroll-to');
 const bad=structuredClone(regional);bad.states[0].actions[0].offset=9999;assert.throws(()=>assertCapturePlan(bad));
 let selector,offset;await replayAction({locator(value){selector=value;return {count:async()=>1,evaluate(fn,value){assert.equal(typeof fn,'function');offset=value;}};}},regional.states[0].actions[0]);assert.equal(selector,'#features');assert.equal(offset,80);
 await assert.rejects(replayAction({locator(){return {count:async()=>0};}},regional.states[0].actions[0]),/unique/);
});

test('region source declarations stay inside the repository',()=>{
 const regional=structuredClone(plan);regional.states[0].region={selector:'#hero',source:{file:'src/Hero.astro',line:2,anchor:'id="hero"',component:'Hero'}};assert.equal(assertCapturePlan(regional).states[0].region.source.line,2);
 for(const file of ['../Hero.astro','..\\Hero.astro','/tmp/Hero.astro','C:\\Hero.astro']){const bad=structuredClone(regional);bad.states[0].region.source.file=file;assert.throws(()=>assertCapturePlan(bad),/inside the reviewed repository/);}
});

test('region source evidence requires one visible DOM match and an exact source-line anchor',async t=>{
 const root=await mkdtemp(join(tmpdir(),'region-source-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'src'));await writeFile(join(root,'src','Hero.astro'),'---\n---\n<section id="hero">Hero</section>\n');
 const page={locator:selector=>({count:async()=>selector==='#hero'?1:0,boundingBox:async()=>({x:0,y:12,width:640,height:320}),evaluate:async()=>'<section id="hero">Hero</section>'})};
 const region={selector:'#hero',source:{file:'src/Hero.astro',line:3,anchor:'id="hero"',component:'Hero'}},result=await verifyRegionSource(page,region,root);
 assert.equal(result.source.file,'src/Hero.astro');assert.equal(result.source.line,3);assert.match(result.source.fileHash,/^[a-f0-9]{64}$/);assert.equal(result.verification,'unique-visible-selector-and-shared-source-anchor');
 await assert.rejects(verifyRegionSource(page,{...region,selector:'#missing'},root),/exactly one/);
 await assert.rejects(verifyRegionSource(page,{...region,source:{...region.source,anchor:'not-there'}},root),/not present in the rendered element/);
 await assert.rejects(verifyRegionSource({...page,locator:()=>({count:async()=>1,boundingBox:async()=>({x:0,y:0,width:1,height:1}),evaluate:async()=>'<section data-review-region="missing">Hero</section>'})},{...region,source:{...region.source,anchor:'data-review-region="missing"'}},root),/anchor was not found/);
 await assert.rejects(verifyRegionSource({...page,locator:()=>({count:async()=>1,boundingBox:async()=>({x:0,y:0,width:1,height:1}),evaluate:async()=>'<section>Hero</section>'})},region,root),/not present in the rendered element/);
});

test('safe IDs that collide after joining cannot overwrite another state screenshot',()=>{
 const collision={schemaVersion:'0.1',adapter:'web',configurations:[{id:'c',viewport:{width:390,height:844}},{id:'b--c',viewport:{width:390,height:844}}],states:[{id:'a--b',configurations:['c'],start:{url:'http://localhost/'},actions:[]},{id:'a',configurations:['b--c'],start:{url:'http://localhost/'},actions:[]}]};
 assert.throws(()=>assertCapturePlan(collision),/filenames must uniquely identify/);
});
