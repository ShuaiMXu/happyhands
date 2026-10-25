import assert from 'node:assert/strict';import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {captureBrowserPlan,verifyTerminalState} from '../packages/harness-core/browser.js';
import {chromium} from 'playwright-core';
const root=await mkdtemp(join(tmpdir(),'surface-browser-'));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
const server=createServer((req,res)=>{if(req.url==='/tiny.png'){res.setHeader('content-type','image/png');res.end(png);return;}if(req.url==='/missing.png'){res.statusCode=404;res.end();return;}
res.setHeader('content-type','text/html');res.end(`<!doctype html><html><style>body{margin:0}#scroll{height:400px;overflow-y:auto;width:390px}.content{height:2000px}#bottom{position:relative;top:1700px}img{width:40px;height:40px}button:hover{background:red}</style><div id="scroll"><div class="content"><div id="bottom"><img loading="lazy" src="${req.url==='/broken'?'/missing.png':'/tiny.png'}"><button id="button">Button</button><input id="check" type="checkbox"><button disabled id="disabled">Disabled</button></div></div></div><button id="menu" aria-expanded="false" onclick="this.setAttribute('aria-expanded','true');setTimeout(()=>this.setAttribute('aria-expanded','false'),100)">Menu</button></html>`);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
const surface={selector:'#scroll',top:1600,scrollHeight:2000,clientHeight:400,clientWidth:390};
const state=(id,actions=[],extra={})=>({id,start:{url:url+'/'},actions,...extra});
try{
 const plan={schemaVersion:'0.1',adapter:'web',configurations:[{id:'mobile',viewport:{width:390,height:844}}],states:[
 state('bottom',[],{scrollSurface:surface}),state('whole',[],{captureMode:'full-page'}),state('broken',[],{start:{url:url+'/broken'},scrollSurface:surface}),
 state('drift',[],{scrollSurface:{...surface,scrollHeight:2100}}),
 state('hover',[{type:'hover-selector',selector:'#button'},{type:'assert-state',selector:'#button',state:'hovered'}]),
 state('focus',[{type:'focus-selector',selector:'#button'},{type:'assert-state',selector:'#button',state:'focused'}]),
 state('checked',[{type:'click-selector',selector:'#check'},{type:'assert-state',selector:'#check',state:'checked'}]),
 state('disabled',[{type:'assert-state',selector:'#disabled',state:'disabled'}]),
 state('scroll-target',[{type:'scroll-to',selector:'#bottom',container:'#scroll'}]),
 state('transient',[{type:'click-selector',selector:'#menu'},{type:'assert-state',selector:'#menu',attribute:'aria-expanded',value:'true'}])
 ]};const capture=await captureBrowserPlan({plan,directory:root,phase:'before'});
 const [bottom,whole,broken,drift,hover,focus,checked,disabled,scrolled,transient]=capture.states;
 for(const entry of [bottom,hover,focus,checked,disabled,scrolled])assert.equal(entry.reached,true,entry.stateId+': '+entry.error);
 assert.deepEqual(bottom.scrollSurface.interval,{start:1600,end:2000});assert.equal(bottom.scrollSurface.visibleImages,1);assert.equal(bottom.screenshotSize.height,844);
 for(const entry of [whole,broken,drift,transient]){assert.equal(entry.reached,false,entry.stateId);assert.equal(entry.screenshot,undefined);}
 assert.match(whole.error,/Internal scroll/);assert.match(broken.error,/images did not load/);assert.match(drift.error,/dimensions changed/);
 for(const entry of [hover,focus,checked,disabled])assert.equal(entry.finalStateEvidence[0].verified,true);
 assert.equal(scrolled.actionEvidence[0].scrollTop,1600);
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();await page.setContent('<button id="recover" aria-expanded="false">Menu</button>');
  const expected=[{type:'assert-state',selector:'#recover',attribute:'aria-expanded',value:'true'}];
  await page.evaluate(()=>{globalThis.recovered=false;setTimeout(()=>{document.querySelector('#recover').setAttribute('aria-expanded','true');globalThis.recovered=true;},1000);});
  await assert.rejects(verifyTerminalState(page,expected),/screenshot boundary/);
  assert.equal(await page.evaluate(()=>globalThis.recovered),false,'Boundary check must fail before the later recovery.');
  await page.waitForFunction(()=>globalThis.recovered);assert.equal((await verifyTerminalState(page,expected))[0].verification,'instantaneous-boundary-check');
  await page.evaluate(()=>{const clone=document.querySelector('#recover').cloneNode(true);document.body.append(clone);});
  await assert.rejects(verifyTerminalState(page,expected),/exactly one/);
  await page.setContent('<button id="a" aria-expanded="true">A</button><button id="b" aria-expanded="false">B</button>');
  await assert.rejects(verifyTerminalState(page,[{...expected[0],selector:'#a'},{...expected[0],selector:'#b'}]),/screenshot boundary/);
 }finally{await browser.close();}
 console.log('PASS: actual inner scrolling/lazy images; original segments; broken image/dimension drift/full-page rejection; hover/focus/checked/disabled and transient-state failure.');
 console.log('PASS: instantaneous whole-group boundary checks reject a false state before later recovery, duplicate targets, and mixed false/true conditions.');
}finally{await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
