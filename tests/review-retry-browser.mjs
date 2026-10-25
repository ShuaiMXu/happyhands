// Synthetic review fixture; this verifies audit presentation, not visual quality.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,cp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';
import {fixture,png} from './helpers/pattern-fixture.mjs';
import {saveCapture,confirmFinding,savePlan,saveEvaluation,saveVisualReview,loadRun} from '../packages/harness-core/store.js';
import {runAiVisualReview} from '../packages/workbench/ai-review.js';
import {exportRun} from '../packages/harness-core/export.js';
import {workbenchServicePlugin} from '../packages/workbench/service.js';
const cleanup=[],{root,run}=await fixture({after:fn=>cleanup.push(fn)},{managed:true});let browser,server,page;const errors=[];
try{
 await mkdir(join(root,'public'),{recursive:true});await cp(resolve('public/brand'),join(root,'public/brand'),{recursive:true});
 for(const phase of ['before','after']){
  if(phase==='after'){await confirmFinding(run.directory,'F1','supported','Synthetic fixture scope');await savePlan(run.directory,'F1');}
  await mkdir(join(run.directory,phase));await writeFile(join(run.directory,phase,'desktop.png'),png);
  await saveCapture(run.directory,phase,{viewports:{desktop:{screenshot:`${phase}/desktop.png`}}});
 }
 await saveEvaluation(run.directory,{status:'fixture',views:{}});
 await saveVisualReview(run.directory,{schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'model',name:'Synthetic old reviewer',version:'ai-visual-review@13; fixture'},reviewedAt:new Date().toISOString(),verdict:'needs-evidence',screenshotRefs:['before/desktop.png','after/desktop.png'],findings:[],rationale:'Synthetic prior result.',limitations:['Fixture only.']});
 const prior=(await loadRun(run.directory)).manifest.visualReviews[0],old=await readFile(join(run.directory,prior.path));
 const reason='<img src=x onerror="window.__retryInjected=true">';
 const cwd=join(root,'retry');await mkdir(cwd);
 await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,retry:{reason},generate:async(_command,args)=>{
  await writeFile(args[args.indexOf('-o')+1],JSON.stringify({verdict:'needs-evidence',screenshotRefs:['before/desktop.png','after/desktop.png'],findings:[],rationale:'Synthetic retry remains uncertain.',limitations:['Not real model quality.']}));
 }});
 await exportRun({directory:run.directory,outputRoot:join(root,'public/runs')});
 server=await createServer({configFile:false,root:resolve('.'),publicDir:join(root,'public'),cacheDir:join(root,'vite-cache'),plugins:[workbenchServicePlugin(root)],optimizeDeps:{include:['react','react-dom/client','tldraw','@tiptap/pm/state'],exclude:['@tldraw/assets']},server:{host:'127.0.0.1',port:0,fs:{allow:[root,resolve('.')]}}});await server.listen();
 browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
 for(const lang of ['zh','en'])for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/apps/designer/?case=run%3Acurrent-run&view=list&lang=${lang}`);
  const panel=page.locator('#run-reviews');await panel.locator('.report-verdict').waitFor();
  await panel.locator('details[data-detail="qa"] > summary').click();
  const complete=panel.locator('details[data-detail="qa"]');assert.ok((await complete.textContent()).includes(reason));
  assert.equal(await complete.getByText(lang==='zh'?'评审规范已更新。此前结论已保留。':'The review criteria were updated. The previous result has been preserved.',{exact:true}).count(),1);
  const link=complete.getByRole('link',{name:lang==='zh'?'打开此前的复核记录':'Open the previous review',exact:true});assert.equal(await link.count(),1);
  const response=await page.request.get(new URL(await link.getAttribute('href'),page.url()).href);assert.equal(response.status(),200);assert.deepEqual(await response.body(),old);
  await panel.locator('details[data-detail="history"] > summary').click();assert.equal(await panel.getByText(lang==='zh'?'查看此前的复核记录':'Previous review records',{exact:true}).count(),1);
  assert.equal(await page.evaluate(()=>Boolean(window.__retryInjected)),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 assert.deepEqual(errors,[]);assert.equal((await loadRun(run.directory)).manifest.judgment,null);
 console.log('PASS: protocol retry report preserves prior bytes, audit links, uncertainty and safe reason text in both languages and widths.');
}catch(error){console.error(JSON.stringify({errors,notice:await page?.locator('#notice').textContent(),report:await page?.locator('#run-reviews').textContent()}));throw error;}
finally{await browser?.close();await server?.close();for(const clean of cleanup)await clean();}
