import assert from 'node:assert/strict';
import {mkdir,writeFile,cp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';
import {fixture,png} from './helpers/pattern-fixture.mjs';
import {saveCapture,loadRun} from '../packages/harness-core/store.js';
import {executeSkill} from '../packages/skill-core/runner.js';
import {exportRun} from '../packages/harness-core/export.js';
import {workbenchServicePlugin} from '../packages/workbench/service.js';
const cleanup=[],{root,repo,run}=await fixture({after:fn=>cleanup.push(fn)},{managed:true});
let server,browser;
try{
  const injection='<img src=x onerror="window.__brandInjected=true">';
  await writeFile(join(repo,'BRAND.md'),'## Voice\nCTA: Continue\n## Prohibited claims\n'+injection+'\n');
  await mkdir(join(repo,'docs'));await writeFile(join(repo,'docs/VOICE.md'),'## Voice\nCTA: Next');
  await mkdir(join(root,'public'),{recursive:true});await cp(resolve('public/brand'),join(root,'public/brand'),{recursive:true});
  await mkdir(join(run.directory,'before'));await writeFile(join(run.directory,'before/desktop.png'),png);
  await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png',dom:{h1:['Synthetic brand fixture'],actions:[]}}}});
  const result=await executeSkill({id:'brand-foundation-extractor',directory:run.directory,repo});
  assert.equal(result.status,'needs-evidence');assert.equal(result.proposedUpdates[0].declarations.alternatives.length,1);
  await exportRun({directory:run.directory,outputRoot:join(root,'public/runs')});
  server=await createServer({configFile:false,root:resolve('.'),publicDir:join(root,'public'),cacheDir:join(root,'vite-cache'),plugins:[workbenchServicePlugin(root)],
    optimizeDeps:{include:['react','react-dom/client','tldraw','@tiptap/pm/state'],exclude:['@tldraw/assets']},server:{host:'127.0.0.1',port:0,fs:{allow:[root,resolve('.')]}}});await server.listen();
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const lang of ['zh','en'])for(const width of [1280,390]){
    await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/apps/designer/?case=run%3Acurrent-run&view=list&lang=${lang}`);
    await page.locator('#foundation-section>summary').click();
    await page.getByText(lang==='zh'?'文档中的品牌声明':'Declared brand intent',{exact:true}).click();
    const evidence=page.locator('#foundation-evidence');
    assert.match(await evidence.textContent(),/BRAND\.md:2/);assert.match(await evidence.textContent(),/docs\/VOICE\.md:2/);
    assert.match(await evidence.textContent(),lang==='zh'?/不同声明需核对适用范围/:/Conflicting declarations need review/);
    assert.ok((await evidence.textContent()).includes(injection));assert.equal(await page.evaluate(()=>Boolean(window.__brandInjected)),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  const current=await loadRun(run.directory);assert.deepEqual(current.spec.designFoundation,run.spec.designFoundation);assert.equal(current.manifest.foundationApproval,null);assert.deepEqual(errors,[]);
  console.log('PASS: source-backed declared intent, alternatives and missing categories in both languages/devices; source HTML is text and no approval is created.');
}finally{await browser?.close();await server?.close();for(const clean of cleanup)await clean();}
