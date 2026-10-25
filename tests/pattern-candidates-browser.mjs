// Synthetic UI fixture only: no real acceptance or model review is created.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,cp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {createRun,saveSkillResult,saveCapture} from '../packages/harness-core/store.js';
import {exportRun} from '../packages/harness-core/export.js';
import {workbenchServicePlugin} from '../packages/workbench/service.js';
const root=await mkdtemp(join(tmpdir(),'pattern-ui-')),repo=resolve('.');
const evidence=process.env.PATTERN_UI_EVIDENCE;let server,browser;
try{
  await mkdir(join(root,'.harness','runs'),{recursive:true});
  await mkdir(join(root,'public'),{recursive:true});await cp(join(repo,'public/brand'),join(root,'public/brand'),{recursive:true});
  const spec=structuredClone(sample);spec.project.name='Synthetic pattern UI fixture';
  const baseline=async run=>{
    await mkdir(join(run.directory,'before'));
    await writeFile(join(run.directory,'before/desktop.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64'));
    await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png',width:1280,height:800,status:200,dom:{h1:['Synthetic fixture'],actions:[]}}}});
  };
  const source=await createRun({spec,url:'http://localhost',outputRoot:join(root,'.harness','runs'),id:'synthetic-source'});
  await baseline(source);
  await exportRun({directory:source.directory,outputRoot:join(root,'public/runs')});
  const run=await createRun({spec,url:'http://localhost',outputRoot:join(root,'.harness','runs'),id:'synthetic-pattern'});
  await baseline(run);
  await saveSkillResult(run.directory,{schemaVersion:'0.1',skill:{id:'pattern-library-curator',version:'0.2.0',role:'foundation'},status:'needs-evidence',runAt:new Date().toISOString(),evidence:[],findings:[],limitations:['Synthetic UI fixture, not a professional design assessment.'],proposedUpdates:[{type:'pattern-candidates',status:'observed',candidates:[{name:'Synthetic Panel <img src=x onerror=alert(1)>',source:'components/Panel.jsx',status:'observed',examples:[{runId:source.manifest.id,stateId:'panel-0',configurationId:'desktop',route:'/example'},{runId:source.manifest.id,stateId:'panel-1',configurationId:'desktop',route:'/example'}]}]}]});
  await exportRun({directory:run.directory,outputRoot:join(root,'public/runs')});
  server=await createServer({configFile:false,root:repo,publicDir:join(root,'public'),cacheDir:join(root,'vite-cache'),plugins:[workbenchServicePlugin(root)],optimizeDeps:{include:['react','react-dom/client','tldraw','@tiptap/pm/state'],exclude:['@tldraw/assets']},server:{host:'127.0.0.1',port:0,fs:{allow:[root,repo]}}});await server.listen();
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const base=`http://127.0.0.1:${server.httpServer.address().port}`;
  for(const lang of ['zh','en'])for(const width of [1280,390]){
    await page.setViewportSize({width,height:900});
    await page.goto(`${base}/apps/designer/?case=run%3Asynthetic-pattern&view=list&lang=${lang}`);
    await page.locator('#foundation-section>summary').click();
    const details=page.locator('#foundation-evidence details').filter({has:page.locator('summary').filter({hasText:lang==='zh'?'已接受方案中的模式候选':'Accepted pattern candidates'})});
    await details.locator('summary').click();
    await details.locator('h4').waitFor();
    assert.equal(await details.locator('img').count(),0,'untrusted candidate names must remain text');
    assert.equal(await details.getByRole('link').count(),2);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'candidate panel must fit the viewport');
    if(evidence){await mkdir(evidence,{recursive:true});await details.scrollIntoViewIfNeeded();await page.screenshot({path:join(evidence,`${lang}-${width}.png`)});}
    await details.getByRole('link').first().click();await page.waitForURL(/case=run%3Asynthetic-source/);
  }
  assert.deepEqual(errors,[]);console.log('PASS: bilingual desktop/mobile candidate panel, safe text rendering and source-review navigation. Synthetic fixtures only.');
}finally{await browser?.close();await server?.close();await rm(root,{recursive:true,force:true});}
