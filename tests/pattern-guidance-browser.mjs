// Actual browser/API/job/export flow with synthetic acceptance and model output.
// This does not certify real visual quality or count as human product acceptance.
import assert from 'node:assert/strict';
import {mkdir,writeFile,cp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';
import {fixture,png,files} from './helpers/pattern-fixture.mjs';
import {fakeModel} from './helpers/pattern-model.mjs';
import {saveOnboarding,saveCapture,loadRun} from '../packages/harness-core/store.js';
import {executeSkill} from '../packages/skill-core/runner.js';
import {exportRun} from '../packages/harness-core/export.js';
import {workbenchServicePlugin} from '../packages/workbench/service.js';
const cleanup=[];const data=await fixture({after:fn=>cleanup.push(fn)},{managed:true});
const {root,repo,run,parent}=data,project=resolve('.');let browser,server,calls=0;
try{
  run.spec.designFoundation.components=files.filter(file=>file.path.startsWith('components/')).map(file=>({name:file.path.split('/').pop().split('.')[0],source:file.path,variants:[],states:[],status:'observed'}));
  run.spec.designFoundation.patterns=[];
  await writeFile(join(run.directory,'experience.json'),JSON.stringify(run.spec));
  await mkdir(join(root,'public'),{recursive:true});await cp(join(project,'public/brand'),join(root,'public/brand'),{recursive:true});
  await writeFile(join(root,'experience.json'),JSON.stringify(run.spec));const configPath=join(root,'project.json');
  await writeFile(configPath,JSON.stringify({version:'0.1',repo,spec:join(root,'experience.json'),url:'http://localhost'}));
  await saveOnboarding(run.directory,{...run.manifest.onboarding,config:{repo,configPath}});
  await mkdir(join(run.directory,'before'));await writeFile(join(run.directory,'before/desktop.png'),png);
  await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png',width:1280,height:800,dom:{h1:['Synthetic pattern fixture'],actions:[]}}}});
  await executeSkill({id:'pattern-library-curator',directory:run.directory,repo});
  await exportRun({directory:parent.directory,outputRoot:join(root,'public/runs')});
  await exportRun({directory:run.directory,outputRoot:join(root,'public/runs')});
  server=await createServer({configFile:false,root:project,publicDir:join(root,'public'),cacheDir:join(root,'vite-cache'),plugins:[workbenchServicePlugin(root,{generate:async(...args)=>{calls++;await fakeModel(...args);}})],
    optimizeDeps:{include:['react','react-dom/client','tldraw','@tiptap/pm/state'],exclude:['@tldraw/assets']},server:{host:'127.0.0.1',port:0,fs:{allow:[root,project]}}});await server.listen();
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const base=`http://127.0.0.1:${server.httpServer.address().port}`;
  for(const lang of ['zh','en'])for(const width of [1280,390]){
    await page.setViewportSize({width,height:900});await page.goto(`${base}/apps/designer/?case=run%3Acurrent-run&view=list&lang=${lang}`);
    await page.locator('#foundation-section>summary').click();
    const candidates=page.locator('#foundation-evidence details').filter({has:page.locator('summary').filter({hasText:lang==='zh'?'已接受方案中的模式候选':'Accepted pattern candidates'})});
    await candidates.locator('summary').click();await candidates.getByRole('button',{name:lang==='zh'?'整理使用建议':'Draft usage guidance',exact:true}).click();
    const summary=lang==='zh'?'合成测试建议，不代表专业审阅。':'Synthetic recommendation only.';
    await page.getByText(summary,{exact:true}).waitFor();
    // Refresh after publication must preserve the input snapshot and model advice.
    await page.reload();await page.locator('#foundation-section>summary').click();await candidates.locator('summary').click();
    await page.getByText(summary,{exact:true}).waitFor();
    assert.equal(await candidates.getByText(lang==='zh'?'不适用的情况':'When to avoid',{exact:true}).count(),1);
    const original=candidates.getByRole('link',{name:lang==='zh'?'本次审阅原图 1':'Reviewed original 1',exact:true});
    const response=await page.request.get(base+await original.getAttribute('href'));assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/image\/png/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.evaluate(()=>{
      const value=document.createElement('p');value.textContent='x'.repeat(2400);document.querySelector('[data-pattern-candidates]').append(value);
      const fits=document.documentElement.scrollWidth<=innerWidth;value.remove();return fits;
    }),true,'long unbroken guidance must fit the review panel');
    if(process.env.PATTERN_GUIDANCE_EVIDENCE){await mkdir(process.env.PATTERN_GUIDANCE_EVIDENCE,{recursive:true});await candidates.scrollIntoViewIfNeeded();await page.screenshot({path:join(process.env.PATTERN_GUIDANCE_EVIDENCE,`${lang}-${width}.png`)});}
  }
  await page.goto(`${base}/apps/designer/?case=run%3Acurrent-run&view=list&lang=zh`);await page.locator('#foundation-section>summary').click();
  await page.locator('[data-pattern-candidates]>summary').click();
  assert.equal(await page.getByText('合成测试建议，不代表专业审阅。',{exact:true}).count(),1);
  assert.equal(await page.getByText('Synthetic recommendation only.',{exact:true}).count(),0,'Chinese UI must select the Chinese proposal rather than the latest English one');
  assert.equal(calls,2,'one model call per language; repeated device views reuse live-validated evidence');
  const latest=await loadRun(run.directory);assert.equal(latest.manifest.patternReviews.length,2);assert.equal(latest.manifest.judgment,null);
  assert.deepEqual(latest.spec.designFoundation,run.spec.designFoundation);assert.deepEqual(errors,[]);
  await page.getByRole('button',{name:'列入规范待审',exact:true}).click();
  const pattern=page.locator('[data-foundation-collection="patterns"]');
  await pattern.waitFor();
  const staged=await loadRun(run.directory);
  assert.equal(staged.manifest.patternAdmissions.length,1);
  assert.ok(!staged.manifest.foundationApproval);
  assert.deepEqual(staged.spec.designFoundation,run.spec.designFoundation);
  await page.reload();await page.locator('#foundation-section>summary').click();
  await pattern.waitFor();
  const rows=page.locator('.foundation-item');
  for(let index=0;index<await rows.count();index++){
    await rows.nth(index).getByRole('button',{name:'批准',exact:true}).click();
    await rows.nth(index).locator('.foundation-decision-reason textarea').fill('Synthetic explicit decision; not real product acceptance.');
  }
  await page.locator('.foundation-approval-details > summary').click();
  await page.locator('#foundation-reviewer').fill('Synthetic browser reviewer');
  await page.locator('#foundation-reason').fill('Synthetic version approval for browser verification only.');
  await page.locator('#foundation-save').click();
  await page.waitForFunction(()=>document.querySelector('#foundation-save-status')?.textContent.includes('1.0.0'));
  const approved=await loadRun(run.directory);
  assert.equal(approved.spec.designFoundation.patterns[0].status,'approved');
  assert.ok(approved.spec.designFoundation.patterns[0].usage.whenToAvoid.length);
  assert.equal(approved.manifest.judgment,null);
  console.log('PASS: bilingual desktop/mobile browser -> API -> queued model fixture -> sealed originals -> export -> reload; no automatic Foundation approval.');
}catch(error){console.error(error);throw error;}
finally{await browser?.close();await server?.close();assert.ok(resolve(root).startsWith(resolve(tmpdir())+'\\')||resolve(root).startsWith(resolve(tmpdir())+'/'));for(const clean of cleanup)await clean();}
