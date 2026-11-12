// Development-module regression only; this does not assess product visual quality.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';

const cacheDir=await mkdtemp(join(tmpdir(),'hh-review-modules-'));
let server,browser;
try{
 server=await createServer({configFile:false,appType:'custom',root:resolve('.'),cacheDir,optimizeDeps:{noDiscovery:true,include:['ajv/dist/2020.js','react','react-dom','react-dom/client','@radix-ui/react-dialog']},server:{host:'127.0.0.1',port:0,hmr:false}});
 server.middlewares.use('/__review-module-check',(_request,response)=>{response.setHeader('Content-Type','text/html');response.end('<!doctype html><title>Review module regression</title>');});
 await server.listen();
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__review-module-check`);
 const result=await page.evaluate(async()=>{
  const [model,review,admission,validation]=await Promise.all([
   import('/apps/designer/page-review/model.js'),
   import('/packages/harness-core/visual-review.js'),
   import('/packages/harness-core/finding-admission.js'),
   import('/packages/harness-core/remediation-validation.js')
  ]);
  return {
   model:typeof model.reviewTargets,
   review:typeof review.assertVisualReview,
   admission:admission.isReportableFinding({id:'AUTOMATIC_REPAIR'}),
   surface:validation.remediationProfile({profile:'happyhands',surface:'homepage-hero',adoptionReason:'Explicit synthetic browser regression adoption'}).surface,
   homepage:validation.isHomepageHero({start:{url:'http://localhost/apps/portal/'}})
  };
 });
 assert.deepEqual(result,{model:'function',review:'function',admission:false,surface:'homepage-hero',homepage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: development Chrome imports page-review, visual QA, finding admission and Hero validation without server-only module errors.');
}finally{
 await browser?.close();
 await server?.close();
 await rm(cacheDir,{recursive:true,force:true});
}
