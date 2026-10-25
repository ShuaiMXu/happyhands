import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {captureBrowserPlan} from '../packages/harness-core/browser.js';
const root=await mkdtemp(join(tmpdir(),'scroll-capture-'));
const markup='<html><head><title>Lazy image fixture</title></head><body style="margin:0"><section style="height:1600px">Intro</section><img loading="lazy" src="/late.svg" style="display:block;width:100%"><section id="target" style="height:1000px;background:#def"><h2>Target after image</h2></section><footer id="footer" style="height:100px">Footer</footer></body></html>';
await writeFile(join(root,'page.html'),markup);
const server=createServer((req,res)=>{
 if(req.url==='/unstable'){res.setHeader('content-type','text/html');res.end(markup.replace('margin:0','margin:0;overflow-anchor:none').replace('</body>','<script>setInterval(()=>{const intro=document.querySelector("section");intro.style.height=(intro.offsetHeight+30)+"px"},80)</script></body>'));return;}
 if(req.url==='/late.svg'){setTimeout(()=>{res.setHeader('content-type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="390" height="900"><rect width="390" height="900" fill="gray"/></svg>');},350);return;}
 res.setHeader('content-type','text/html');res.end(markup);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;
try{
 const plan={schemaVersion:'0.1',adapter:'web',configurations:[{id:'mobile',viewport:{width:390,height:844}}],states:[{id:'target',start:{url},actions:[{type:'scroll-to',selector:'#target',offset:80}],region:{selector:'#target',source:{file:'page.html',line:1,anchor:'id="target"',component:'Target'}}},{id:'footer',start:{url},actions:[{type:'scroll-to',selector:'#footer',offset:80}],region:{selector:'#footer',source:{file:'page.html',line:1,anchor:'id="footer"',component:'Footer'}}}]};
 const capture=await captureBrowserPlan({plan,directory:root,phase:'before',sourceRoot:root});
 const target=capture.states[0],footer=capture.states[1];
 assert.equal(target.reached,true,target.error);assert.ok(Math.abs(target.region.bounds.y-80)<=2,`Lazy image shifted target to y=${target.region.bounds.y}`);
 assert.ok(target.dom.visibleCopy.includes('Target after image'),'The target heading must appear in the actual screenshot viewport');
 assert.equal(footer.reached,true,footer.error);assert.ok(footer.region.bounds.y>=80&&footer.region.bounds.y<844,'Bottom-clamped targets remain valid');
 const unstable=await captureBrowserPlan({plan:{...plan,states:[{...plan.states[0],start:{url:url+'unstable'}}]},directory:root,phase:'after',sourceRoot:root});
 assert.equal(unstable.states[0].reached,false,'A continuously moving target must not certify the previous section');
 assert.match(unstable.states[0].error,/Scroll target moved after layout settled/);
 console.log('PASS: late lazy image layout is settled before capturing the declared scroll target; bottom-clamped footer remains reachable.');
}finally{await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
