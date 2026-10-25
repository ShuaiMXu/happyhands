// Real browser verification of the control flow. All edits, captures and QA below are
// deterministic test fixtures; this test never declares a real product visually approved.
import {chromium} from 'playwright-core';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,cp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createRun,saveExecution,loadRun} from '../packages/harness-core/store.js';
import {exportRun} from '../packages/harness-core/export.js';
import {workbenchServicePlugin} from '../packages/workbench/service.js';
import {workflowState} from '../packages/harness-core/workflow.js';
import {primaryActionForStage} from '../packages/harness-core/primary-action.js';
const root=await mkdtemp(join(tmpdir(),'review-actions-browser-')),repo=resolve('.');
const output=process.env.REVIEW_ACTION_EVIDENCE||join(root,'evidence');await mkdir(output,{recursive:true});
const spec=JSON.parse(await readFile(join(repo,'examples/happyclaw-site/experience.json'),'utf8'));spec.project.name='Stage action test fixture';
const capture=phase=>({viewports:{desktop:{screenshot:`${phase}/desktop.png`,width:1280,height:800,status:200,dom:{h1:['Fixture'],actions:[],controls:[],horizontalOverflow:false}}}});
const diagnosis={schemaVersion:'0.1',evaluatorVersion:'fixture@1',experienceScore:{status:'insufficient-evidence'},findings:[{id:'TEST_FINDING',title:'Fixture action name',evidenceRefs:['E'],impact:3,confidence:4,effort:1,priority:12,verificationStatus:'review-target',proposal:'Make the action name explicit'}],evidence:[{id:'E',source:'before/desktop.png',type:'browser-capture'}]};
const qa=verdict=>({schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'human',name:'Test fixture',version:'fixture@1'},reviewedAt:'2026-10-13T00:00:00Z',verdict,screenshotRefs:['before/desktop.png','after/desktop.png'],findings:verdict==='fail'?[{id:'UNRESOLVED',title:'Fixture issue',observation:'Test-only regression',impact:4,confidence:'high',screenshotRefs:['after/desktop.png']}]:[],rationale:'Test-only QA record',limitations:['Fixture, not a product assessment.']});
let executeCount=0;let png;
const dependencies={inspectRepository:async()=>({root,commit:'a'.repeat(40),dirty:false}),previewReachable:async()=>false,fetch:async()=>{throw Error('Fixture port is free');},spawnPreview:()=>({exitCode:null,signalCode:null,killed:false}),stopPreview:()=>{},waitForPreview:async()=>{},captureBrowser:async({directory,phase})=>{await mkdir(join(directory,phase),{recursive:true});await writeFile(join(directory,phase,'desktop.png'),png);return capture(phase);},execute:async({directory})=>{executeCount++;await saveExecution(directory,{exitCode:0,worktree:root});},generate:async(_command,_args,{cwd})=>{const context=JSON.parse(await readFile(join(cwd,'review-context.json'),'utf8'));await writeFile(join(cwd,'review-result.json'),JSON.stringify({...qa('pass'),screenshotRefs:context.evidence.map(item=>item.reference)}));}};
let server,browser;
try{
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 const shot=await browser.newPage({viewport:{width:1280,height:800}});await shot.setContent('<h1>Deterministic UI fixture</h1><button>Explicit action</button>');png=await shot.screenshot();await shot.close();
 await mkdir(join(root,'public'),{recursive:true});await cp(join(repo,'public/brand'),join(root,'public/brand'),{recursive:true});
 await mkdir(join(root,'.harness','runs'),{recursive:true});await mkdir(join(root,'.harness','workbench-projects'),{recursive:true});
 await writeFile(join(root,'experience.json'),JSON.stringify(spec));const configPath=join(root,'project.json');await writeFile(configPath,JSON.stringify({version:'0.1',spec:'experience.json',repo:root,url:'http://127.0.0.1:43998',mode:'review',start:{command:'node',args:[]}}));
 const stages=['needs-baseline','needs-diagnosis','awaiting-confirmation','needs-plan','needs-execution','needs-after-capture','needs-structural-evaluation','needs-visual-qa','awaiting-judgment','complete','onboarding-failed','finding-stale','execution-failed','boundary-breached','visual-qa-needs-evidence','visual-qa-failed','needs-absent-baseline','needs-foundation-approval','needs-first-render-plan'];
 const records=[];
 for(const [index,stage] of stages.entries()){
  const id='fixture-'+index,bootstrap=stage.startsWith('needs-absent')||stage.startsWith('needs-foundation')||stage.startsWith('needs-first');
  const run=await createRun({spec,mode:bootstrap?'bootstrap':'review',url:'http://127.0.0.1:43998',outputRoot:join(root,'.harness','runs'),id});const m=run.manifest;
  if(stage!=='needs-baseline'&&!bootstrap)m.captures.before=capture('before');
  if(!['needs-baseline','needs-diagnosis'].includes(stage)&&!bootstrap)m.diagnosis={path:'diagnosis.json'};
  if(!['needs-baseline','needs-diagnosis','awaiting-confirmation','onboarding-failed'].includes(stage)&&!bootstrap){m.confirmation={findingId:'TEST_FINDING',verdict:stage==='finding-stale'?'stale':'supported',note:'Fixture scope'};m.findingId='TEST_FINDING';}
  if(bootstrap&&stage!=='needs-absent-baseline')m.baseline={status:'absent',reason:'Fixture absent baseline'};
  if(stage==='needs-first-render-plan')m.foundationApproval={version:'1.0.0'};
  if(!bootstrap&&!['needs-baseline','needs-diagnosis','awaiting-confirmation','needs-plan','onboarding-failed','finding-stale'].includes(stage))m.plan={kind:'fix'};
  if(!bootstrap&&!['needs-baseline','needs-diagnosis','awaiting-confirmation','needs-plan','needs-execution','onboarding-failed','finding-stale'].includes(stage))m.execution={exitCode:stage==='execution-failed'?1:0,worktree:root,...(stage==='boundary-breached'?{boundaryBreaches:['Fixture boundary']}:{})};
  if(['needs-structural-evaluation','needs-visual-qa','awaiting-judgment','complete','visual-qa-needs-evidence','visual-qa-failed'].includes(stage))m.captures.after=capture('after');
  if(['needs-visual-qa','awaiting-judgment','complete','visual-qa-needs-evidence','visual-qa-failed'].includes(stage))m.evaluation={version:'0.1',views:{}};
  if(['awaiting-judgment','complete','visual-qa-needs-evidence','visual-qa-failed'].includes(stage)){const verdict=stage==='visual-qa-failed'?'fail':stage==='visual-qa-needs-evidence'?'needs-evidence':'pass',review=qa(verdict);m.visualReviews=[{skillId:review.skillId,verdict,reviewer:review.reviewer,reviewedAt:review.reviewedAt,path:'reviews/visual-qa-evaluator.json'}];await mkdir(join(run.directory,'reviews'));await writeFile(join(run.directory,'reviews/visual-qa-evaluator.json'),JSON.stringify(review));}
  if(stage==='complete')m.judgment={decision:'accept',reason:'Fixture only'};
  if(stage==='onboarding-failed')m.onboarding={status:'failed',error:'Fixture preview unavailable'};
  assert.equal(workflowState(m).stage,stage);
  for(const phase of ['before','after']){await mkdir(join(run.directory,phase));await writeFile(join(run.directory,phase,'desktop.png'),png);}
  await writeFile(join(run.directory,'run.json'),JSON.stringify(m));await writeFile(join(run.directory,'diagnosis.json'),JSON.stringify(diagnosis));await writeFile(join(run.directory,'codex-brief.md'),'# Complete fixture plan\nOnly update the confirmed action name.\n');
  await writeFile(join(root,'.harness','workbench-projects',id+'.json'),JSON.stringify({configPath}));
  if(stage==='needs-baseline'){const target=join(root,'public/runs',id);await mkdir(target,{recursive:true});await writeFile(join(target,'run.json'),JSON.stringify(m));await writeFile(join(target,'experience.json'),JSON.stringify(spec));}
  else await exportRun({directory:run.directory,outputRoot:join(root,'public/runs'),allowPendingBootstrap:true});
  records.push({id,stage});
 }
 if(process.env.REVIEW_ACTION_REAL_RUN)await exportRun({directory:process.env.REVIEW_ACTION_REAL_RUN,outputRoot:join(root,'public/runs')});
 const indexPath=join(root,'public/runs/index.json'),index=JSON.parse(await readFile(indexPath,'utf8'));index.runs.push({id:'fixture-0',project:spec.project.name,createdAt:'2026-10-13T00:00:00Z'});await writeFile(indexPath,JSON.stringify(index));
 server=await createServer({configFile:false,cacheDir:join(root,'vite-cache'),root:repo,publicDir:join(root,'public'),plugins:[workbenchServicePlugin(root,dependencies)],server:{host:'127.0.0.1',port:0,strictPort:true,fs:{allow:[repo,root]}},optimizeDeps:{include:['react','react-dom/client','tldraw','@tiptap/pm/state'],exclude:['@tldraw/assets']}});await server.listen();
 const base='http://127.0.0.1:'+server.httpServer.address().port,page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const visiblePrimary=()=>page.locator('[data-review-primary]:visible');
 async function visit(id,view='canvas',language='zh'){await page.goto(`${base}/apps/designer/?case=run:${id}&view=${view}&lang=${language}`,{waitUntil:'networkidle'});try{await visiblePrimary().waitFor();}catch(error){await page.screenshot({path:join(output,'failure.png'),fullPage:true});console.error({id,view,errors,notice:await page.locator('#notice').innerText()});throw error;}await page.waitForFunction(()=>document.querySelector('[data-review-primary]:not([disabled])'));}
 async function expectLabel(text){await page.waitForFunction(expected=>[...document.querySelectorAll('[data-review-primary]')].some(el=>el.offsetWidth&&el.textContent===expected),text);assert.equal(await visiblePrimary().count(),1);}
 const coverage=[];
 for(const width of [1280,390]){await page.setViewportSize({width,height:900});for(const {id,stage} of records){await visit(id);await expectLabel(primaryActionForStage(stage).label);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,`${stage} at ${width}`);coverage.push({width,stage,action:await visiblePrimary().innerText()});}await page.screenshot({path:join(output,`stage-${width}.png`)});}
 for(const view of ['list','codediff']){await visit('fixture-2',view);await expectLabel('选择问题并确认范围');if(view==='codediff')assert.equal(await page.evaluate(()=>document.querySelector('#code-primary-action').getBoundingClientRect().top<document.querySelector('.pd-codediff-empty-state').getBoundingClientRect().top),true);await page.screenshot({path:join(output,`${view}-390.png`)});}
 await visit('fixture-2','canvas','en');await expectLabel('Choose an issue and confirm scope');await visiblePrimary().click();await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('dialog').count(),1);await page.getByRole('dialog').getByLabel('Issue for this round').selectOption('TEST_FINDING');await page.getByRole('dialog').getByLabel('Proposed change and confirmation reason').fill('Test-only scope');await page.getByRole('dialog').getByRole('button',{name:'Choose an issue and confirm scope',exact:true}).click();assert.equal((await loadRun(join(root,'.harness/runs/fixture-2'))).manifest.confirmation,null);await page.getByRole('dialog').getByLabel('I have checked the evidence and confirmed this change scope').check();await page.getByRole('dialog').getByRole('button',{name:'Choose an issue and confirm scope',exact:true}).click();await expectLabel('Review the plan and start changes');assert.equal(executeCount,0);
 await expectLabel('Review the plan and start changes');assert.equal(executeCount,0);await visiblePrimary().click();assert.equal(await page.getByRole('dialog').locator('details').first().evaluate(el=>el.open),true);assert.match(await page.getByRole('dialog').locator('pre').innerText(),/Fixture action name/);await page.getByRole('dialog').getByLabel('I have read the change plan and agree to execution in an isolated worktree').check();await page.getByRole('dialog').getByRole('button',{name:'Review the plan and start changes',exact:true}).click();await expectLabel('Read the review and record a decision');assert.equal(executeCount,1);assert.equal((await loadRun(join(root,'.harness/runs/fixture-2'))).manifest.judgment,null);
 await visiblePrimary().click();const judgment=page.getByRole('dialog');assert.equal(await judgment.getByLabel('Decision',{exact:true}).inputValue(),'');await judgment.getByLabel('Decision',{exact:true}).selectOption('reject');await judgment.getByLabel('Human decision reason').fill('Test-only explicit rejection');await judgment.getByRole('button',{name:'Record decision',exact:true}).click();await expectLabel('Start the next review');
 await visit('fixture-15');await visiblePrimary().click();assert.equal(await page.getByRole('dialog').getByLabel('决定',{exact:true}).locator('option[value=accept]').count(),0);await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
 await visit('fixture-2');await page.getByRole('button',{name:'项目与任务',exact:true}).first().click();const operations=page.getByRole('dialog');for(const name of ['执行源码修改','接受这版','记录人工判断'])assert.equal(await operations.getByRole('button',{name,exact:true}).count(),0);assert.equal(await operations.getByLabel('预览地址').isVisible(),false);await operations.getByRole('button',{name:'关闭',exact:true}).click();
 await visit('fixture-17');await visiblePrimary().click();await page.waitForURL(/view=list/);await page.waitForFunction(()=>document.querySelector('#foundation-section').open===true);
 await visit('fixture-10');await visiblePrimary().click();const reconnect=page.getByRole('dialog');assert.equal(await reconnect.getByText('高级：修改范围与执行',{exact:true}).count(),0);await page.waitForFunction(()=>document.querySelector('#workbench-operations input')?.value);await reconnect.getByRole('button',{name:'连接并开始审阅',exact:true}).click();await page.waitForURL(url=>url.searchParams.get('view')==='directions'&&!url.searchParams.get('case').includes('fixture-10'));
 const moreDirections=page.locator('.workspace-directions>details');
 await moreDirections.locator(':scope > summary').click();
 await page.getByRole('button',{name:'选择此方向',exact:true}).last().click();
 assert.equal(await page.locator('.direction-card[data-selected=true] button[aria-pressed=true]').evaluate(el=>el===document.activeElement),true,'Selecting an extended direction preserves keyboard focus after rendering');
 assert.equal(await moreDirections.evaluate(el=>el.open),true,'Selecting an extended direction keeps its disclosure open');
 // The last candidate is also the document's final tab stop; move backwards
 // to verify the adjacent keyboard target instead of tabbing into browser UI.
 await page.keyboard.press('Shift+Tab');
 assert.equal(await page.evaluate(()=>document.activeElement!==document.body),true);
 assert.equal(await page.locator('.workbench-navigation').isVisible(),true);
 await page.getByRole('button',{name:'查看页面与原始证据',exact:true}).click();await page.locator('.page-review').waitFor();
 await page.locator('#direction-link').click();await page.locator('.workspace-directions').waitFor();
 assert.equal(await page.locator('.direction-card button[aria-pressed=true]').count(),1);
 assert.equal(await page.locator('.workspace-directions>details').evaluate(el=>el.open),true,'Returning from the canvas reveals the restored extended selection');
 assert.equal(await page.locator('.direction-card[data-selected=true]').isVisible(),true);
 await visiblePrimary().click();
 assert.notEqual(await page.getByRole('dialog').getByLabel('本轮问题').inputValue(),'');
 assert.equal(await page.getByRole('dialog').getByLabel('我已核对证据并确认本轮修改范围').isChecked(),false);
 await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'查看页面与原始证据',exact:true}).click();await page.locator('.page-review').waitFor();await visiblePrimary().waitFor();assert.match(new URL(page.url()).searchParams.get('case'),/^run:/);assert.equal(new URL(page.url()).searchParams.get('view'),'canvas');
 // Report verdicts stay distinct from human decisions; failed QA remains visible.
 await visit('fixture-8','list');assert.equal(await page.locator('.report-verdict').getAttribute('data-verdict'),'pass');
 assert.match(await page.locator('.report-human-decision').innerText(),/尚未记录人工决定/);
 await visit('fixture-15','list');assert.equal(await page.locator('.report-verdict').getAttribute('data-verdict'),'fail');
 assert.equal(await page.locator('.report-review-finding').filter({hasText:'Fixture issue'}).isVisible(),true);
 assert.equal(await page.locator('#run-shots .run-pair').count(),1);
 await page.locator('.report-context > summary').click();assert.equal(await page.locator('#project-name').isVisible(),true);
 await visit('fixture-8','list');
 await page.evaluate(async()=>{const {renderReportReviews}=await import('/apps/designer/report/reviews.js');const base='/runs/fixture-8';const manifest=await (await fetch(base+'/run.json')).json();const document=await (await fetch(base+'/reviews/visual-qa-evaluator.json')).json();manifest.verificationEvidence={digest:'changed'};renderReportReviews(window.document.querySelector('#run-reviews'),{manifest,base,reviews:[{...manifest.visualReviews[0],document}]});});
 assert.equal(await page.locator('.report-verdict').getAttribute('data-verdict'),'needs-evidence');
 await page.getByText('查看未生效的原始复核',{exact:true}).click();assert.equal(await page.getByRole('link',{name:'打开原始复核记录',exact:true}).isVisible(),true);
 // Pane toggles keep navigation and focus, including after selecting a device.
 await visit('fixture-8','canvas');const directoryToggle=page.getByRole('button',{name:'页面与状态',exact:true});
 await directoryToggle.click();assert.equal(await directoryToggle.getAttribute('aria-expanded'),'true');
 await page.getByLabel('查看设备',{exact:true}).focus();await page.getByLabel('查看设备',{exact:true}).selectOption('desktop');
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'查看设备');
 await directoryToggle.click();assert.equal(await page.locator('.page-review-directory').isVisible(),false);
 await page.getByRole('button',{name:'问题与复核',exact:true}).click();assert.equal(await page.locator('.page-review-inspector').isVisible(),true);
 // Tablet navigation must have separate hit targets, not merely avoid page overflow.
 await page.setViewportSize({width:768,height:900});
 for(const view of ['canvas','list']){await visit('fixture-8',view,'en');const boxes=await page.locator('.workbench-logo:visible,.workbench-view-nav button:visible,.workbench-view-nav a:visible').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.equal(a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom,false,'Navigation hit targets overlap');}}
 await page.setViewportSize({width:390,height:900});
 // Disconnect one exported record: all three surfaces must offer only reconnection.
 await rm(join(root,'.harness/workbench-projects/fixture-2.json'));for(const view of ['canvas','list','codediff']){await visit('fixture-2',view);await expectLabel('连接原项目');}
 if(process.env.REVIEW_ACTION_REAL_RUN){
  const real=await loadRun(process.env.REVIEW_ACTION_REAL_RUN);
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});
   for(const view of ['canvas','list','codediff']){
    await visit(real.manifest.id,view);await expectLabel('连接原项目');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(view==='list'&&real.manifest.designSystemExtractions?.before){
     if(await page.locator('#foundation-section').getAttribute('open')===null)await page.locator('#foundation-section > summary').click();
     const link=page.getByRole('link',{name:'整改前：设计系统与组件证据'});
     assert.equal(await link.count(),1);assert.ok((await link.getAttribute('href')).endsWith('/before/design-system.json'));
    }
    if(view==='list'){
     const selector=page.getByLabel('对照页面与设备',{exact:true});const options=await selector.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
     assert.ok(options.length>=1);assert.equal(await page.locator('#run-shots .run-pair').count(),1);
     for(const key of options){await selector.selectOption(key);assert.equal(await page.locator('#run-shots figure').count(),2);await page.locator('#run-shots').scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('#run-shots img')].every(img=>img.complete&&img.naturalWidth>0));}
     await selector.selectOption(options[0]);
     const exported=await (await page.request.get(base+'/runs/'+real.manifest.id+'/run.json')).json();
     if(exported.verificationRecords?.length){await page.getByText('专项验证记录',{exact:true}).click();assert.equal(await page.locator('.report-verification-row').count(),exported.verificationRecords.length);
     const evidenceLinks=await page.locator('.report-verification-row a').evaluateAll(nodes=>nodes.map(n=>n.href));
     for(const href of evidenceLinks){const response=await page.request.get(href);assert.equal(response.status(),200);}
     await page.getByText('专项验证记录',{exact:true}).click();}
    }
    await page.screenshot({path:join(output,`real-${view}-${width}.png`)});
   }
  }
 }
 if(process.env.REVIEW_ACTION_REAL_RUN){const real=await loadRun(process.env.REVIEW_ACTION_REAL_RUN);await visiblePrimary().click();const setup=page.getByRole('dialog');await setup.getByRole('button',{name:'连接并开始审阅',exact:true}).waitFor();assert.equal(await setup.getByLabel('项目名称').inputValue(),real.spec.project.name);await setup.getByText('高级：预览与项目信息',{exact:true}).click();await setup.getByLabel('项目仓库目录').fill(root);await setup.getByLabel('预览地址').fill('http://127.0.0.1:43998');await setup.getByLabel('预览启动程序').fill('node');await setup.getByLabel('启动参数 JSON').fill('[]');await setup.getByRole('button',{name:'连接并开始审阅',exact:true}).click();await page.waitForURL(url=>url.searchParams.get('case')!=='run:'+real.manifest.id);await visiblePrimary().waitFor();assert.notEqual(await page.locator('#studio-run-select').inputValue(),'');}
 assert.deepEqual(errors,[]);await writeFile(join(output,'browser-result.json'),JSON.stringify({kind:'deterministic-browser-fixture',coverage,views:['canvas','list','codediff'],explicitScope:true,explicitPlan:true,explicitJudgment:true,readonly:true,foundationNavigation:true,realReplay:process.env.REVIEW_ACTION_REAL_RUN?{runId:(await loadRun(process.env.REVIEW_ACTION_REAL_RUN)).manifest.id,widths:[1280,390],views:['canvas','list','codediff']}:null,errors},null,2));console.log(`PASS: ${coverage.length} stage/device checks; report/code actions; scope→plan→isolated fixture→QA→explicit judgment; readonly/recovery/foundation. Evidence: ${output}`);
}catch(error){const last=browser?.contexts().at(-1)?.pages().at(-1);if(last){await last.screenshot({path:join(output,'failure.png'),fullPage:true});console.error((await last.locator('body').innerText()).slice(-8000));}throw error;}finally{await browser?.close();await server?.close();await rm(root,{recursive:true,force:true});}
