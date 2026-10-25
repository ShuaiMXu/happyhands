import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNodes, safeScreenshot } from '../apps/designer/canvas/nodes.js';
import { autoLayout, loadLayout, saveLayout } from '../apps/designer/canvas/layout.js';
import { stageCommand } from '../apps/designer/canvas/index.js';
import { parsePatch } from '../apps/designer/canvas/codediff.js';
import { formatRegionComments } from '../apps/designer/cowart/region-comment-format.js';
const entry=(state='checkout',config='desktop')=>({stateId:state,configurationId:config,width:1280,height:800,screenshot:`before/${state}--${config}.png`});
test('canvas pairs legacy captures and reads legacy evaluation keys without guessing missing evaluations',()=>{
 const manifest={captures:{before:{viewports:{desktop:{width:1280,height:800,screenshot:'before/desktop.png'}}},after:{viewports:{desktop:{width:1280,height:800,screenshot:'after/desktop.png'}}}}};
 const nodes=buildNodes({manifest,evaluation:{views:{desktop:{checks:{heading:true},beforeH1:['a'],afterH1:['b']}}}});
 assert.equal(nodes.length,2);assert.ok(nodes.every(n=>n.paired && n.changed));assert.equal(nodes[1].phase,'after');
 assert.equal(buildNodes({manifest})[0].changed,null);
});
test('canvas retains bootstrap and newly reached states, rejects unsafe screenshot references',()=>{
 const e=entry();e.screenshot='after/checkout--desktop.png';
 const nodes=buildNodes({manifest:{captures:{after:{states:[e]}}}});
 assert.equal(nodes.length,1);assert.equal(nodes[0].phase,'after');assert.equal(nodes[0].paired,false);
 assert.equal(safeScreenshot('after',e),e.screenshot);
 assert.equal(safeScreenshot('after',{...e,screenshot:'../../secret.png'}),null);
});
test('multi-state layout reserves actual card height and positions bootstrap entries',()=>{
 const entries=[entry('one'),entry('two'),{...entry('one','mobile'),width:390,height:844}];
 const result=autoLayout(entries,{hasAfter:true});
 const one=result.positions.get('one--mobile'),two=result.positions.get('two--desktop');
 assert.ok(two.y>one.y+one.h+40);assert.ok(result.totalHeight>two.y+two.h);assert.ok(one.afterX>one.x+one.w);
});
test('layout storage round-trips a map and tolerates stale or invalid browser values',()=>{
 let value=null;globalThis.localStorage={getItem:()=>value,setItem:(_,v)=>{value=v;}};
 saveLayout('fixture',new Map([['before:a--desktop',{x:25,y:35}]]));assert.deepEqual(loadLayout('fixture').get('before:a--desktop'),{x:25,y:35});
 value='{}';assert.equal(loadLayout('fixture').size,0);value='[["bad",{"x":null,"y":0}]]';assert.equal(loadLayout('fixture').size,0);delete globalThis.localStorage;
});
test('bootstrap commands require foundation approval and never ask to confirm an absent finding',()=>{
 const manifest={id:'fixture',mode:'bootstrap',baseline:{status:'absent'},captures:{}};
 assert.match(stageCommand({manifest}).command,/foundation-approve/);
 manifest.foundationApproval={version:'1.0.0'};assert.match(stageCommand({manifest}).command,/plan --run/);assert.doesNotMatch(stageCommand({manifest}).command,/--finding/);
});
test('patch parser preserves additions and removals as evidence',()=>{
 const files=parsePatch('diff --git a/a.js b/a.js\n--- a/a.js\n+++ b/a.js\n@@ -1 +1 @@\n-old\n+new\n');
 assert.equal(files[0].name,'a.js');assert.deepEqual(files[0].hunks[0].lines.slice(0,2),['-old','+new']);
});
test('region comments preserve local coordinates and authored text for AI instructions',()=>{
 const comments=[{x:10.4,y:20.6,w:300.2,h:99.7,text:'Make this action clearer'}];
 assert.equal(formatRegionComments(comments,'en'),'Region 1 (x 10, y 21, w 300, h 100): Make this action clearer');
 assert.equal(formatRegionComments(comments,'zh'),'局部 1（x 10, y 21, w 300, h 100）：Make this action clearer');
});

test('hand panning moves the stage without treating the release as a deselection click', async t => {
  const { Stage } = await import('../apps/designer/canvas/stage.js');
  const previousDocument = globalThis.document, previousWindow = globalThis.window;
  globalThis.document = new EventTarget(); globalThis.window = new EventTarget();
  const element = new EventTarget();
  element.style = { setProperty() {}, cursor: '' };
  element.setPointerCapture = () => {};
  const stage = new Stage(element); stage.mode = 'hand';
  t.after(() => { stage.destroy(); globalThis.document = previousDocument; globalThis.window = previousWindow; });
  const emit = (type, x, y) => { const event = new Event(type); Object.assign(event, {button:0, pointerId:1, clientX:x, clientY:y}); element.dispatchEvent(event); };
  emit('pointerdown', 10, 10); emit('pointermove', 80, 60); emit('pointerup', 80, 60);
  assert.equal(stage.x,70); assert.equal(stage.y,50); assert.equal(stage.panMoved,true);
  assert.equal(element.style.cursor,'grab');
});
