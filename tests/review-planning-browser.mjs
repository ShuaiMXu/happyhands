// Explicit browser fixture verifies discovery/replay, not product quality or human approval.
import assert from 'node:assert/strict';import {createServer} from 'node:http';import {mkdtemp,rm,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {discoverReviewTargets,confirmedReviewPlan} from '../packages/harness-core/review-discovery.js';import {captureBrowserPlan} from '../packages/harness-core/browser.js';
const root=process.env.REVIEW_PLANNING_EVIDENCE||await mkdtemp(join(tmpdir(),'review-planning-browser-'));let mutations=0,submissions=0;
const server=createServer((req,res)=>{
 if(req.method==='POST'){mutations++;if(req.url==='/submit')submissions++;res.end('Should never submit');return;}
 if(req.url==='/redirect'){res.writeHead(302,{location:'https://example.invalid/foreign'});res.end();return;}
 if(req.url==='/broken'){res.statusCode=404;res.end('Missing route');return;}
 const page=req.url==='/'?'Home':req.url==='/settings'?'Settings':'Error recovery';
 res.setHeader('content-type','text/html');res.end(`<!doctype html><html lang="en"><title>${page} fixture</title><style>body{margin:0;padding:20px}main{min-height:1100px}label{display:block;margin:10px}#nav[hidden]{display:none}</style><main><h1>${page}</h1><nav><a href="/">Home</a><a href="/settings">Settings</a><a href="/broken">Broken</a><a href="/redirect">Redirect</a><a href="/logout">Log out</a><a href="https://example.invalid/">External</a></nav>
 <button id="menu" aria-controls="nav" aria-expanded="false" onclick="const open=this.getAttribute('aria-expanded')!=='true';this.setAttribute('aria-expanded',String(open));document.querySelector('#nav').hidden=!open">Menu</button><div id="nav" hidden>Quick start</div>
 <button id="help" aria-haspopup="dialog" aria-controls="dialog" onclick="document.querySelector('#dialog').showModal()">Help</button><dialog id="dialog"><p>Dialog content</p><button onclick="this.closest('dialog').close()">Close</button></dialog>
 <form id="form" action="/submit" method="post"><label>Email <input id="email" type="email" name="email" required></label><label>Name <input id="name" name="name" required></label><button type="submit">Submit</button></form>
 <div id="error" role="alert">Network error</div><button id="retry" onclick="document.querySelector('#error').hidden=true;document.querySelector('#result').hidden=false">Retry</button><div id="result" hidden>Recovered</div>
 </main><script>fetch('/automatic-mutation',{method:'POST'}).catch(()=>{});</script></html>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/`;
try{
 const proposal=await discoverReviewTargets({url,configurations:[{id:'mobile',viewport:{width:390,height:844}}]});
 assert.equal(mutations,0);assert.ok(proposal.candidates.some(item=>item.state.start.url===url+'settings'));assert.ok(proposal.gaps.some(gap=>gap.url===url+'broken'));assert.ok(proposal.gaps.some(gap=>gap.url===url+'redirect'));assert.ok(proposal.gaps.some(gap=>gap.url===url+'logout'));
 const rootCandidates=proposal.candidates.filter(item=>item.state.start.url===url);assert.ok(rootCandidates.some(item=>item.kind==='dialog'));assert.ok(rootCandidates.some(item=>item.kind==='recovery'));
 const manual=[{id:'custom-retry',start:{url:url+'error'},actions:[{type:'click-selector',selector:'#retry'},{type:'assert-state',selector:'#error',state:'hidden'},{type:'assert-state',selector:'#result',state:'visible'}]}, {id:'false-success',start:{url},actions:[{type:'click-selector',selector:'#menu'},{type:'assert-state',selector:'#missing',state:'visible'}]}];
 const plan=confirmedReviewPlan(proposal,rootCandidates.map(item=>item.id),null,manual);
 // Mutation attempts by a fixture on ordinary capture are recorded separately;
 // discovery above must issue none. No generated state clicks submit.
 const capture=await captureBrowserPlan({plan,directory:root,phase:'before'});
 const failed=capture.states.find(state=>state.stateId==='false-success');assert.equal(failed.reached,false);assert.equal(failed.screenshot,undefined);assert.match(failed.error,/exactly one|Timeout/);
 assert.equal(submissions,0,'Generated form states never submit the form.');
 const reached=capture.states.filter(state=>state.stateId!=='false-success');assert.ok(reached.every(state=>state.reached),reached.filter(state=>!state.reached).map(state=>state.error).join('\n'));
 const form=proposal.candidates.find(item=>item.kind==='form'&&item.state.start.url===url);assert.equal(capture.states.find(state=>state.stateId===form.id).actionEvidence.at(-1).valid,false);
 const recovery=proposal.candidates.find(item=>item.kind==='recovery'&&item.state.start.url===url);assert.equal(capture.states.find(state=>state.stateId===recovery.id).actionEvidence.at(-1).valid,true);
 await writeFile(join(root,'proposal.json'),JSON.stringify(proposal,null,2));await writeFile(join(root,'plan.json'),JSON.stringify(plan,null,2));
 console.log('PASS: rendered multi-route discovery; failed/external/unsafe routes stay gaps; no discovery POST; menu and dialog open/close; native form error/recovery; custom retry; false state rejected; full-page originals. Evidence: '+root);
}finally{await new Promise(resolve=>server.close(resolve));if(!process.env.REVIEW_PLANNING_EVIDENCE)await rm(root,{recursive:true,force:true});}
