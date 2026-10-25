// Real Creative OS UI + an unmodified exported project record. No mocked jobs,
// diagnoses, captures, approvals or API responses. This is bounded navigation
// evidence, not acceptance of the embedded project or arbitrary business routes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,readdir,cp,rm,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';
import {exportRun} from '../packages/harness-core/export.js';
import {loadRun} from '../packages/harness-core/store.js';
import {workbenchServicePlugin} from '../packages/workbench/service.js';

const repo=resolve('.'),source=process.env.REVIEW_NAVIGATION_RUN;
const output=process.env.REVIEW_NAVIGATION_EVIDENCE;
const refs={before:process.env.REVIEW_NAVIGATION_BEFORE,after:process.env.REVIEW_NAVIGATION_AFTER};
if(!source||!output||!refs.before||!refs.after)throw Error('Set REVIEW_NAVIGATION_RUN, EVIDENCE, BEFORE and AFTER (all prefixed REVIEW_NAVIGATION_). Use a real original run and explicit Git revisions.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:repo});
const real=await loadRun(source);
real.diagnosis=JSON.parse(await readFile(join(source,'diagnosis.json'),'utf8'));
assert.ok(real.diagnosis?.findings?.length>3,'Need a real diagnosis with extended directions');
const sourceManifest=hash(await readFile(join(source,'run.json')));
await mkdir(output); // Refuse to overwrite any previous evidence attempt.
const root=await realpath(await mkdtemp(join(tmpdir(),'real-review-navigation-')));
const results={version:1,kind:'real-workbench-navigation',record:{id:real.manifest.id,project:real.spec.project,manifestSha256:sourceManifest},viewports:[{width:1280,height:900},{width:390,height:844}],phases:{},limitations:['Query-routed Creative OS views, not separate target-project business pages.','Read-only historical project evidence; no new HappyClaw source change or human judgment.','Viewport screenshots do not cover every internal scroll area.','Selection continuity is in-session; reload/deep links assert run/view only.','No browser history traversal, live project execution, business forms, authenticated routes or whole-site acceptance.']};
let browser;
try{
 await mkdir(join(root,'public'),{recursive:true});
 await exportRun({directory:source,outputRoot:join(root,'public/runs')});
 await cp(join(repo,'public/brand'),join(root,'public/brand'),{recursive:true});
 const exported=join(root,'public/runs',real.manifest.id);
 async function hashes(folder,prefix=''){
  const files=[];for(const entry of (await readdir(folder,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const name=prefix+entry.name,path=join(folder,entry.name);if(entry.isDirectory())files.push(...await hashes(path,name+'/'));else if(entry.isFile())files.push({path:name,sha256:hash(await readFile(path))});}return files;
 }
 results.record.exportedFiles=await hashes(exported);
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 for(const phase of ['before','after']){
  const commit=git('rev-parse','--verify',refs[phase]+'^{commit}').toString().trim();
  const checkout=join(root,phase);await mkdir(checkout);
  const archive=join(root,phase+'.tar');git('archive','--output='+archive,commit);
  execFileSync('tar',['-xf',archive,'-C',checkout]);await rm(archive);
  const sourceFiles=await hashes(join(checkout,'apps/designer'));
  // Dependencies are installed once; source/public state stays phase-isolated.
  const {symlink}=await import('node:fs/promises');await symlink(resolve(repo,'node_modules'),join(checkout,'node_modules'));
  const server=await createServer({configFile:false,root:checkout,publicDir:join(root,'public'),cacheDir:join(root,'cache-'+phase),plugins:[workbenchServicePlugin(root)],server:{host:'127.0.0.1',port:0,strictPort:true,fs:{allow:[checkout,root,repo]}},optimizeDeps:{include:['react','react-dom/client','tldraw','@tiptap/pm/state'],exclude:['@tldraw/assets']}});
  const record=results.phases[phase]={commit,designerFiles:sourceFiles,checks:[],images:[]};
  try{
   await server.listen();const base='http://127.0.0.1:'+server.httpServer.address().port;
   for(const viewport of results.viewports){
    const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[],writes=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(!['GET','HEAD'].includes(request.method()))writes.push({method:request.method(),url:request.url()});});
    const actions=[];
    const ready=async()=>{await page.waitForFunction(()=>document.querySelector('#fullscreen-shell')?.getAttribute('aria-busy')==='false');};
    const checkContext=view=>{const url=new URL(page.url());assert.equal(url.searchParams.get('case'),'run:'+real.manifest.id);assert.equal(url.searchParams.get('view'),view);assert.equal(url.searchParams.get('lang'),'zh');};
    async function click(locator,label){await locator.click();actions.push({type:'click',label,url:page.url()});await ready();}
    async function capture(state,view,details={}){
     checkContext(view);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${phase}/${state}/${viewport.width} page overflow`);
     await page.evaluate(()=>document.fonts.ready);
     const name=`${phase}-${viewport.width}-${state}.png`,bytes=await page.screenshot({path:join(output,name)});
     const item={state,view,viewport,url:page.url(),at:new Date().toISOString(),screenshot:name,sha256:hash(bytes),actions:structuredClone(actions),...details};record.images.push(item);await writeFile(join(output,'evidence-progress.json'),JSON.stringify(results,null,2));
    }
    try{
     await page.goto(`${base}/apps/designer/?case=run:${real.manifest.id}&view=directions&lang=zh`,{waitUntil:'networkidle'});await ready();
     await page.locator('.direction-card').first().waitFor();
     const more=page.locator('.workspace-directions>details');assert.equal(await more.evaluate(el=>el.open),false);
     await capture('directions','directions');
     await click(more.locator(':scope > summary'),'Expand other directions');
     const cards=page.locator('.direction-card'),count=await cards.count();assert.equal(count,real.diagnosis.findings.length);
     await click(cards.last().getByRole('button',{name:'选择此方向',exact:true}),'Select last real diagnosis');
     const selected=page.locator('.direction-card[data-selected=true]');
     const title=(await selected.locator('h3').textContent()).trim();
     assert.equal(await selected.getByRole('button',{name:'选择此方向',exact:true}).evaluate(el=>el===document.activeElement),true);
     await capture('selected','directions',{selectedTitle:title,selectionVisible:await selected.isVisible()});
     await click(page.getByRole('button',{name:'查看页面与原始证据',exact:true}),'Open page review');
     await page.locator('.page-review').waitFor();
     const toggle=page.getByRole('button',{name:'页面与状态',exact:true});
     if(viewport.width<900)await click(toggle,'Open page and state directory');
     await page.getByLabel('查看设备',{exact:true}).selectOption('mobile');actions.push({type:'select',label:'Device',value:'mobile'});
     await page.getByLabel('查看版本',{exact:true}).selectOption('after');actions.push({type:'select',label:'Phase',value:'after'});
     const statePicker=page.getByLabel('查看页面状态',{exact:true});
     const options=await statePicker.locator('option').evaluateAll(nodes=>nodes.map(n=>({value:n.value,text:n.textContent})));
     const menu=options.find(option=>/menu-open/.test(option.value));assert.ok(menu,'Real run must include captured mobile menu-open');
     await statePicker.selectOption(menu.value);actions.push({type:'select',label:'State',value:menu.value});
     if(viewport.width<900)await click(toggle,'Close page and state directory');
     await page.waitForFunction(()=>{const image=document.querySelector('.page-review-evidence');return image?.complete&&image.naturalWidth>0;});
     const evidenceSrc=await page.locator('.page-review-evidence').getAttribute('src');
     await capture('canvas-menu','canvas',{evidenceSrc});
     await click(page.locator('#direction-link'),'Return to directions from canvas');
     const restored={selectedTitle:(await selected.locator('h3').textContent()).trim(),selectionVisible:await selected.isVisible(),expanded:await more.evaluate(el=>el.open)};
     assert.equal(restored.selectedTitle,title);
     assert.equal(restored.selectionVisible,phase==='after','Baseline must reproduce the hidden selection; after must fix it');
     assert.equal(restored.expanded,phase==='after');
     await (restored.selectionVisible?selected:more.locator(':scope > summary')).scrollIntoViewIfNeeded();
     await capture('restored','directions',restored);
     await click(page.locator('.workbench-view-nav [data-studio-view=list]'),'Open review report');
     await page.locator('.report-verdict').waitFor();
     const reportVerdict=await page.locator('.report-verdict').getAttribute('data-verdict');
     await capture('report','list',{reportVerdict,humanDecision:await page.locator('.report-human-decision').innerText()});
     const reportPicker=page.getByLabel('对照页面与设备',{exact:true});
     const reportOption=await reportPicker.locator('option').evaluateAll(nodes=>nodes.find(n=>/menu-open.*mobile/.test(n.value))?.value);assert.ok(reportOption);
     await reportPicker.selectOption(reportOption);actions.push({type:'select',label:'Report comparison',value:reportOption});
     await page.locator('#run-shots').scrollIntoViewIfNeeded();
     await page.waitForFunction(()=>[...document.querySelectorAll('#run-shots img')].every(img=>img.complete&&img.naturalWidth>0));
     await capture('report-pair','list',{pair:reportOption});
     await click(page.locator('.workbench-view-nav [data-studio-view=codediff]'),'Open source diff');
     await page.locator('#code-primary-action').waitFor();await capture('code','codediff');
     await click(page.locator('.workbench-view-nav [data-studio-view=canvas]'),'Return to page review');
     await page.waitForFunction(()=>{const image=document.querySelector('.page-review-evidence');return image?.complete&&image.naturalWidth>0;});
     assert.equal(await page.locator('.page-review-evidence').getAttribute('src'),evidenceSrc);
     await capture('canvas-restored','canvas',{evidenceSrc});
     await click(page.locator('#direction-link'),'Return to selected direction after report and code');
     assert.equal((await selected.locator('h3').textContent()).trim(),title);assert.equal(await selected.isVisible(),phase==='after');
     await (phase==='after'?selected:more.locator(':scope > summary')).scrollIntoViewIfNeeded();
     await capture('final-selection','directions',{selectedTitle:title,selectionVisible:await selected.isVisible()});
     // Fresh deep links must preserve the real run and route, not in-memory selection.
     for(const view of ['directions','canvas','list','codediff']){await page.goto(`${base}/apps/designer/?case=run:${real.manifest.id}&view=${view}&lang=zh`,{waitUntil:'networkidle'});await ready();checkContext(view);await page.reload({waitUntil:'networkidle'});await ready();checkContext(view);}
     assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
     record.checks.push({viewport,extendedSelectionVisible:phase==='after',canvasSelectionRestored:true,reportPairAvailable:true,deepLinks:['directions','canvas','list','codediff'],reload:true,errors,writes});
    }catch(error){await page.screenshot({path:join(output,`${phase}-${viewport.width}-failure.png`)});throw error;}finally{await context.close();}
   }
  }finally{await server.close();}
 }
 assert.equal(hash(await readFile(join(source,'run.json'))),sourceManifest);
 assert.deepEqual(await hashes(exported),results.record.exportedFiles,'Exported project evidence must remain immutable');
 for(const before of results.phases.before.images){const after=results.phases.after.images.find(item=>item.state===before.state&&item.viewport.width===before.viewport.width);assert.ok(after,'Every baseline state must have a matching after image');assert.equal(after.view,before.view);}
 results.status='pass';await writeFile(join(output,'evidence.json'),JSON.stringify(results,null,2));
 const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 const rows=results.phases.before.images.map(before=>{const after=results.phases.after.images.find(item=>item.state===before.state&&item.viewport.width===before.viewport.width);return `<section><h2>${escape(before.state)} · ${before.viewport.width}px</h2><div><figure><figcaption>修改前</figcaption><a href="${before.screenshot}"><img loading="lazy" src="${before.screenshot}"></a></figure><figure><figcaption>修改后</figcaption><a href="${after.screenshot}"><img loading="lazy" src="${after.screenshot}"></a></figure></div></section>`;}).join('');
 await writeFile(join(output,'comparison.html'),`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>工作台跨视图真实对照</title><style>body{font:16px system-ui;margin:32px;color:#222;background:#f5f5f3}section{margin:36px 0}section>div{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;min-width:0}img{width:100%;border:1px solid #bbb}figcaption{margin:8px 0}@media(max-width:700px){section>div{grid-template-columns:1fr}}</style><h1>工作台跨视图真实对照</h1><p>真实 Creative OS 版本 + 未修改的 ${escape(real.spec.project.name)} 历史证据。正常桌面 / 手机，18 组匹配前后截图；这是工作台导航验收，不代表目标项目整站验收或人工 Accept。</p><p><a href="evidence.json">版本、操作、原图哈希与边界</a></p>${rows}</html>`);
 console.log(JSON.stringify({status:'pass',output,images:results.phases.before.images.length+results.phases.after.images.length,runId:real.manifest.id}));
}finally{await browser?.close();await rm(root,{recursive:true,force:true});}
