import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {captureBrowserPlan} from '../packages/harness-core/browser.js';
import {componentCoverage} from '../packages/skill-core/component-coverage.js';
import {createHash} from 'node:crypto';

const root=await mkdtemp(join(tmpdir(),'component-instance-'));
const markup='<button id="save" data-component="Button" data-tone="primary">Save</button>';
const html=`<!doctype html><html><head><style>body{margin:24px;font-family:Arial}button{padding:12px 24px}button:hover{background:orange}button:focus{outline:2px solid blue}</style></head><body><main>${markup}<button id="quiet" data-component="Button" data-tone="quiet" disabled>Quiet</button><div style="opacity:0"><button id="invisible" data-component="Button" data-tone="primary">Invisible</button></div><div style="width:30px;overflow:hidden"><button id="clipped" data-component="Button" data-tone="primary">Clipped</button></div><button id="offscreen" style="position:absolute;left:-100px" data-component="Button" data-tone="primary">Offscreen</button><div id="tall" data-component="Button" data-tone="primary" style="height:1200px;background:#eee">Tall component</div></main></body></html>`;
await mkdir(join(root,'components'));
await writeFile(join(root,'components/Button.html'),markup);
const server=createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}`;
const region=(selector,id,tone='primary')=>({selector,source:{file:'components/Button.html',line:1,anchor:'data-component="Button"',component:'Button'},instance:{id,variants:[{name:'tone',attribute:'data-tone',value:tone}]}});
const state=(id,actions,selected=region('#save','save'))=>({id,start:{url},actions,region:selected});
try{
  const capture=await captureBrowserPlan({directory:root,sourceRoot:root,phase:'before',plan:{schemaVersion:'0.1',adapter:'web',configurations:[{id:'desktop',viewport:{width:1280,height:800}},{id:'mobile',viewport:{width:390,height:844}}],states:[
    state('focus',[{type:'focus-selector',selector:'#save'},{type:'assert-state',selector:'#save',state:'focused'}]),
    state('hover',[{type:'hover-selector',selector:'#save'},{type:'assert-state',selector:'#save',state:'hovered'}]),
    state('disabled',[{type:'assert-state',selector:'#quiet',state:'disabled'}],region('#quiet','quiet','quiet')),
    state('wrong-variant',[],region('#save','save','quiet')),
    state('parent-only',[],region('main','parent')),
    state('ambiguous',[],region('button','ambiguous')),
    state('invisible',[],region('#invisible','invisible')),
    state('clipped',[],region('#clipped','clipped')),
    state('offscreen',[],region('#offscreen','offscreen')),
    state('tall-viewport',[{type:'scroll-to',selector:'#tall',offset:0}],region('#tall','tall')),
    {...state('tall-document',[{type:'scroll-to',selector:'#tall',offset:0}],region('#tall','tall')),captureMode:'full-page'},
    {...state('clipped-document',[],region('#clipped','clipped')),captureMode:'full-page'}
  ]}});
  for(const entry of capture.states){
    if(entry.stateId==='tall-document'){
      assert.equal(entry.reached,true,entry.error);assert.equal(entry.componentInstance.visibility.image,'full-document');
      assert.ok(entry.screenshotSize.height>=entry.documentSize.height);
    }else if(['focus','hover','disabled'].includes(entry.stateId)){
      assert.equal(entry.reached,true,entry.error);
      assert.equal(entry.componentInstance.states[{focus:'focused',hover:'hovered',disabled:'disabled'}[entry.stateId]],true);
    }else{assert.equal(entry.reached,false,entry.stateId);assert.equal(entry.componentInstance,undefined);assert.equal(entry.screenshot,undefined);}
  }
  const coverage=componentCoverage({name:'Button',source:'components/Button.html',sourceHash:createHash('sha256').update(markup).digest('hex')},capture);
  assert.equal(coverage.references.filter(reference=>reference.instance).length,8);
  assert.equal(coverage.status,'partial-instance-evidence');
  const rootOf=id=>capture.states.find(entry=>entry.stateId===id&&entry.configurationId==='desktop').componentInstance.domPath;
  assert.ok(rootOf('focus').startsWith('html:nth-of-type(1)>'));
  assert.equal(rootOf('focus'),rootOf('hover'),'different states on one root must preserve its structural identity');
  assert.notEqual(rootOf('focus'),rootOf('disabled'),'different roots must not collapse into one instance');
  console.log('PASS: 8 desktop/mobile instance captures including full-document tall roots; viewport overflow, clipped full-document roots, wrong variants and invalid anchors rejected. Remaining variants stay unreviewed.');
}finally{
  await new Promise(resolve=>server.close(resolve));
  const resolved=resolve(root);if(!resolved.startsWith(resolve(tmpdir())+sep))throw Error('Unexpected test cleanup path');
  await rm(resolved,{recursive:true,force:true});
}
