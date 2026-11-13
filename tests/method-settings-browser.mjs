// Actual operations UI with fixture APIs: no repository configuration is written.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';

const output=process.env.METHOD_EVIDENCE;
if(output)await mkdir(output,{recursive:true});
const baseline=process.env.METHOD_BASELINE==='1';
const server=await createServer({configFile:false,cacheDir:'.tmp/method-settings-vite',server:{host:'127.0.0.1',port:0},plugins:[{
  name:'method-settings-fixture',configureServer(s){s.middlewares.use('/method-settings-fixture',(_req,res)=>{
    res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      ${['style','studio','workbench-base','workbench-system','site-theme'].map(name=>`<link rel="stylesheet" href="/apps/designer/${name}.css">`).join('')}
      <body class="workspace-page"><button id="open">Open settings</button><script type="module">
      import '/packages/ui/workbench.js';
      import {openOperations} from '/apps/designer/cowart/operations.js';
      document.querySelector('#open').onclick=()=>openOperations({manifest:{id:'method-fixture',onboarding:{config:{designGuidance:{taste:'app-screen',intent:'typeset'}}}},spec:{project:{name:'HappyHands method selection',goal:'Keep a saved specialist method usable',audience:'Developers',task:'Edit project settings'}}},{connectionOnly:true});
      </script></body></html>`);
  });}
}],optimizeDeps:{noDiscovery:true,include:['react','react/jsx-runtime','react/jsx-dev-runtime','react-dom','react-dom/client','@radix-ui/react-dialog','@radix-ui/react-checkbox','@radix-ui/react-select']}});
let browser;
const records=[];
try{
  await server.listen();
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const [device,width,height]of [['desktop',1280,1000],['phone',390,844]])for(const theme of ['light','dark']){
    const page=await browser.newPage({viewport:{width,height}}),errors=[],saved=[];
    page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
    await page.route('**/api/workbench/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path.endsWith('/configure'))saved.push(route.request().postDataJSON());
      const body=path.endsWith('/jobs')?[]:path.endsWith('/state')?{project:{repository:{root:'fixture-repository'},preview:{url:'http://localhost:3000'}},reviews:[],workflow:{}}:path.endsWith('/configure')?{configPath:'fixture-config.json'}:{id:'fixture-job',status:'running'};
      await route.fulfill({json:body});
    });
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/method-settings-fixture`);
    await page.waitForFunction(()=>document.documentElement.dataset.hhComponents==='ready' && typeof document.querySelector('#open').onclick==='function');
    await page.evaluate(theme=>document.documentElement.dataset.hhTheme=theme,theme);
    const openSettings=async()=>{
      await page.locator('#open').click();
      await page.getByText('高级：预览与项目信息',{exact:true}).click();
      await page.getByText('设计方法与审美设置',{exact:true}).click();
      await page.getByRole('combobox',{name:'本轮设计重点',exact:true}).scrollIntoViewIfNeeded();
    };
    await openSettings();
    const taste=page.getByRole('combobox',{name:'Taste 使用方式',exact:true});
    const intent=page.getByRole('combobox',{name:'本轮设计重点',exact:true});
    const styles=await page.locator('#workbench-operations .hh-select-trigger').evaluateAll(nodes=>nodes.map(node=>{
      const s=getComputedStyle(node),label=getComputedStyle(node.closest('label'));
      return {justify:s.justifyContent,border:s.borderTopWidth,weight:s.fontWeight,background:s.backgroundColor,height:node.getBoundingClientRect().height,labelDisplay:label.display,gap:label.rowGap};
    }));
    assert.equal(styles.length,2);
    for(const style of styles){
      assert.equal(style.justify,baseline?'center':'space-between');
      assert.equal(parseFloat(style.border)>0,!baseline);
      if(!baseline){assert.equal(style.weight,'400');assert.equal(style.labelDisplay,'grid');assert.equal(style.gap,'6px');assert.ok(style.height>=44);}
    }
    await intent.hover(); await page.waitForTimeout(300);
    if(!baseline){assert.equal(await intent.evaluate(e=>getComputedStyle(e).justifyContent),'space-between');assert.ok(await intent.evaluate(e=>parseFloat(getComputedStyle(e).borderTopWidth)>0));}
    await intent.focus();
    assert.ok(await intent.evaluate(e=>parseFloat(getComputedStyle(e).outlineWidth)>0));
    if(output)await page.screenshot({path:join(output,`method-settings--${device}-${theme}.png`)});
    assert.match(await intent.textContent(),/文字排版/);
    await taste.click();await page.getByRole('listbox').waitFor();
    await page.keyboard.press('Escape');await page.getByRole('listbox').waitFor({state:'detached'});
    await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Taste 使用方式');
    await intent.press('Space');await page.getByRole('listbox').waitFor();
    assert.equal(await page.getByRole('option').count(),11);
    assert.equal(await page.getByRole('option',{name:'文字排版',exact:true}).getAttribute('data-state'),'checked');
    if(output)await page.screenshot({path:join(output,`method-options--${device}-${theme}.png`)});
    await page.keyboard.press('Escape');await page.getByRole('listbox').waitFor({state:'detached'});
    await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='本轮设计重点');
    await page.getByRole('textbox',{name:'项目名称',exact:true}).fill('Edited project');
    await page.getByRole('button',{name:'连接并开始审阅',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#workbench-operations select')?.disabled);
    await page.waitForFunction(()=>[...document.querySelectorAll('#workbench-operations .hh-select-trigger')].every(e=>e.disabled));
    assert.equal(saved[0].name,'Edited project');assert.equal(saved[0].designGuidance.intent,'typeset');
    await page.getByRole('button',{name:'关闭',exact:true}).click();
    await openSettings();
    await intent.press('Space');await page.getByRole('listbox').waitFor();
    await page.waitForFunction(()=>document.activeElement?.getAttribute('role')==='option'); await page.keyboard.press('End'); await page.waitForFunction(()=>document.activeElement?.textContent.includes('组件')); await page.keyboard.press('Enter');
    await page.waitForFunction(()=>[...document.querySelectorAll('select')].some(s=>s.value==='extract'));
    await page.getByRole('button',{name:'连接并开始审阅',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#workbench-operations select')?.disabled);
    assert.equal(saved[1].designGuidance.intent,'extract');
    await page.getByRole('button',{name:'关闭',exact:true}).click();
    // The other branch of the shared selector, plus an ordinary action and checkbox.
    await page.evaluate(async()=>{
      const {createControl}=await import('/packages/ui/controls.js');
      const section=document.createElement('section');section.className='page-review';
      const select=createControl('select');select.setAttribute('aria-label','Review fixture');select.innerHTML='<option>Desktop</option><option>Phone</option>';
      const action=createControl('button');action.textContent='Review action';
      const check=createControl('input');check.type='checkbox';check.setAttribute('aria-label','Review checkbox');
      section.append(select,action,check);document.body.append(section);
    });
    const review=page.getByRole('combobox',{name:'Review fixture'});await review.waitFor();
    assert.equal(await review.evaluate(e=>getComputedStyle(e).justifyContent),baseline?'center':'space-between');
    assert.equal(await page.getByRole('button',{name:'Review action'}).evaluate(e=>getComputedStyle(e).justifyContent),'center');
    assert.equal(await page.getByRole('checkbox',{name:'Review checkbox'}).evaluate(e=>e.getBoundingClientRect().width),18);
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await review.evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
    assert.deepEqual(errors,[]);
    records.push({device,width,height,theme,styles,options:11,escapeFocus:true,metadataSave:'typeset',keyboardSave:'extract',api:'mocked',pageReviewFixture:true,reducedMotion:true});
    await page.close();
  }
  if(output)await writeFile(join(output,'verification.json'),JSON.stringify({baseline,records},null,2));
  console.log(`PASS: ${baseline?'reproduced baseline override':'method field regression'}; ${records.length} device/theme cases; actual operations UI, mocked configure payloads, keyboard, shared selector consumers.`);
}finally{await browser?.close();await server.close();}
