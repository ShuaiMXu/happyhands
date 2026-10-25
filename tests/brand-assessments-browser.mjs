// Synthetic model/capture fixture: no actual brand compliance or acceptance.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,cp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';
import {fixture,png} from './helpers/pattern-fixture.mjs';
import {confirmFinding,savePlan,saveEvaluation,loadRun} from '../packages/harness-core/store.js';
import {captureWithDesignSystem} from '../packages/harness-core/design-system.js';
import {runAiVisualReview} from '../packages/workbench/ai-review.js';
import {exportRun} from '../packages/harness-core/export.js';
import {workbenchServicePlugin} from '../packages/workbench/service.js';
const cleanup=[],{root,repo,run}=await fixture({after:fn=>cleanup.push(fn)},{managed:true});let browser,server,page;const errors=[];
try{
  await writeFile(join(repo,'BRAND.md'),'## Voice\nCTA: Continue');
  await mkdir(join(root,'public'),{recursive:true});await cp(resolve('public/brand'),join(root,'public/brand'),{recursive:true});
  for(const phase of ['before','after']){
    if(phase==='after'){await confirmFinding(run.directory,'F1','supported','Synthetic scope');await savePlan(run.directory,'F1');}
    await captureWithDesignSystem({directory:run.directory,repo,phase,capture:async()=>{
      await mkdir(join(run.directory,phase));await writeFile(join(run.directory,phase,'desktop.png'),png);
      return {viewports:{desktop:{screenshot:`${phase}/desktop.png`,dom:{h1:['Synthetic fixture'],actions:[]}}}};
    }});
  }
  await saveEvaluation(run.directory,{status:'fixture',views:{}});const cwd=join(root,'model');await mkdir(cwd);
  const injection='<img src=x onerror="window.__brandInjected=true">';
  await runAiVisualReview(run.directory,{cwd,signal:new AbortController().signal,generate:async(_command,args,options)=>{
    const context=JSON.parse(await readFile(join(options.cwd,'review-context.json')));
    await writeFile(args[args.indexOf('-o')+1],JSON.stringify({verdict:'needs-evidence',screenshotRefs:['before/desktop.png','after/desktop.png'],findings:[],rationale:'Synthetic review.',limitations:['No real judgment.'],
      brandAssessments:context.brandReviewReferences.map(item=>({reference:item.reference,verdict:'not-visible',observation:injection,screenshotRefs:[]}))}));
  }});
  await exportRun({directory:run.directory,outputRoot:join(root,'public/runs')});
  server=await createServer({configFile:false,root:resolve('.'),publicDir:join(root,'public'),cacheDir:join(root,'vite-cache'),plugins:[workbenchServicePlugin(root)],optimizeDeps:{include:['react','react-dom/client','tldraw','@tiptap/pm/state'],exclude:['@tldraw/assets']},server:{host:'127.0.0.1',port:0,fs:{allow:[root,resolve('.')]}}});await server.listen();
  browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const lang of ['zh','en'])for(const width of [1280,390])for(const view of ['list','canvas']){
    await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/apps/designer/?case=run%3Acurrent-run&view=${view}&lang=${lang}`);
    const panel=page.locator(view==='list'?'#run-reviews':'#page-review-inspector');
    if(view==='canvas')await page.getByRole('button',{name:lang==='zh'?'问题与复核':'Findings and review',exact:true}).click();
    if(view==='list')await panel.locator('.report-verdict').waitFor();
    const details=panel.locator('[data-brand-assessments]');
    assert.equal(await details.count(),1,JSON.stringify({view,lang,text:await panel.textContent(),errors}));
    await details.locator('summary').click();
    assert.equal(await details.locator('section').count(),2);assert.ok((await details.textContent()).includes(injection));assert.equal(await page.evaluate(()=>Boolean(window.__brandInjected)),false);
    const link=details.getByRole('link',{name:lang==='zh'?'查看声明来源':'Open declaration evidence',exact:false});assert.equal(await link.count(),2);
    const response=await page.request.get(new URL(await link.first().getAttribute('href'),page.url()).href);assert.equal(response.status(),200);assert.ok((await response.json()).brandEvidence.declarations.length);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  assert.deepEqual(errors,[]);assert.equal((await loadRun(run.directory)).manifest.judgment,null);
  console.log('PASS: bound model assessments -> immutable export -> report/page-review in both languages and widths; original source links work and model HTML remains text.');
}catch(error){console.error(JSON.stringify({errors,notice:await page?.locator('#notice').textContent(),report:await page?.locator('#run-reviews').textContent()}));throw error;}
finally{await browser?.close();await server?.close();for(const clean of cleanup)await clean();}
