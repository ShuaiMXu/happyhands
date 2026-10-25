// Browser-engine checks with an explicit fixture, not a product quality review.
import assert from 'node:assert/strict';import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {captureBrowserPlan} from '../packages/harness-core/browser.js';import {pngDimensions} from '../packages/harness-core/whole-page.js';
const root=await mkdtemp(join(tmpdir(),'whole-page-browser-'));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
const server=createServer((req,res)=>{if(req.url==='/tiny.png'){res.setHeader('content-type','image/png');res.end(png);return;}if(req.url==='/missing.png'){res.statusCode=404;res.end();return;}
 res.setHeader('content-type','text/html');res.end(`<!doctype html><html lang="en"><title>Capture test fixture</title><style>body{margin:0}main{padding:20px}.space{height:2000px}.scroller{width:300px;overflow-x:${req.url==='/blocked'?'hidden':'auto'};white-space:nowrap}img{width:80px;height:80px}</style><main><h1>Capture test fixture</h1><button>Go</button><nav id="scoped"><button onclick="this.textContent='Clicked'">Go</button></nav><div class="space"></div><img loading="lazy" src="${req.url==='/broken'?'/missing.png':'/tiny.png'}" alt="Lazy fixture"><div class="scroller">${'Long command '.repeat(100)}</div></main></html>`);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
try{
 const plan={schemaVersion:'0.1',adapter:'web',configurations:[{id:'mobile',viewport:{width:390,height:844}}],states:[
  {id:'whole',start:{url:base+'/'},captureMode:'full-page',actions:[]},
  {id:'viewport',start:{url:base+'/'},actions:[]},
  {id:'command-end',start:{url:base+'/'},actions:[{type:'scroll-horizontal',selector:'.scroller',position:'end'}]},
  {id:'blocked-command',start:{url:base+'/blocked'},actions:[{type:'scroll-horizontal',selector:'.scroller',position:'end'}]},
  {id:'scoped-click',start:{url:base+'/'},actions:[{type:'click',scope:'#scoped',role:'button',name:'Go'}]},
  {id:'ambiguous-click',start:{url:base+'/'},actions:[{type:'click',role:'button',name:'Go'}]},
  {id:'broken-overview',start:{url:base+'/broken'},captureMode:'full-page',actions:[]}
 ]};
 const capture=await captureBrowserPlan({plan,directory:root,phase:'before',channel:process.env.BROWSER_CHANNEL||'chrome'});
 const [whole,viewport,command,blocked,scoped,ambiguous,broken]=capture.states;
 assert.equal(whole.reached,true,whole.error);assert.equal(whole.captureMode,'full-page');assert.ok(whole.screenshotSize.height>844);assert.equal(whole.dom.scroll.y,0);
 assert.deepEqual(pngDimensions(await readFile(join(root,whole.screenshot))),whole.screenshotSize);assert.ok(whole.screenshotSize.height>=whole.documentSize.height);
 assert.equal(viewport.reached,true);assert.equal(viewport.captureMode,'viewport');assert.equal(viewport.screenshotSize.height,844);
 assert.equal(command.reached,true,command.error);assert.ok(command.actionEvidence[0].scrollLeft>0);assert.equal(command.actionEvidence[0].overflowX,'auto');
 assert.equal(blocked.reached,false);assert.match(blocked.error,/user-scrollable/);assert.equal(blocked.screenshot,undefined);
 assert.equal(scoped.reached,true,scoped.error);assert.ok(scoped.dom.controls.some(control=>control.label==='Clicked'));assert.equal(ambiguous.reached,false);assert.match(ambiguous.error,/strict mode/);
 assert.equal(broken.reached,false);assert.match(broken.error,/images did not load/);assert.equal(broken.screenshot,undefined);
 console.log('PASS: complete original capture, lazy image loading, restored scroll, viewport default, real horizontal wheel, and missing-image/blocked-scroll failures.');
}finally{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
