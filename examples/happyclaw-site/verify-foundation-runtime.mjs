import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile,open,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright-core';
import {createRun,loadRun} from '../../packages/harness-core/store.js';
import {captureWithDesignSystem} from '../../packages/harness-core/design-system.js';
import {verificationHash} from '../../packages/harness-core/verification.js';

const {values}=parseArgs({options:{repo:{type:'string'},url:{type:'string'},out:{type:'string'}}});
if(!values.repo||!values.url||!values.out)throw Error('Provide --repo, --url and --out for the real checkout and its preview.');
const repo=resolve(values.repo),out=resolve(values.out),url=values.url,require=createRequire(import.meta.url),axe=require.resolve('axe-core/axe.min.js');
const spec=JSON.parse(await readFile(new URL('./experience.json',import.meta.url),'utf8'));
delete spec.designFoundation;spec.findings=[];spec.evidence=[];
spec.project.name='HappyClaw runtime Foundation observations';
spec.project.task='Measure current rendered typography, shapes and copy feedback with explicit methods. Observed facts are not approved Foundation or independent visual acceptance.';
await mkdir(out,{recursive:true});
const run=await createRun({spec,url,outputRoot:out});await mkdir(join(run.directory,'before'));
const methodBytes=await readFile(new URL(import.meta.url)),scriptHash=verificationHash(methodBytes);
await writeFile(join(run.directory,'runtime-method.mjs'),methodBytes,{flag:'wx'});
const widths=[320,390,768,1280],states=[],checks=[],errors=[];
const commands=[['clone','git clone https://github.com/riba2534/happyclaw.git'],['directory','cd happyclaw'],['start','make start']];
async function measurements(page){return page.evaluate(()=>{
 const selectors=['body','.section-heading p','.group-title','.channel-description','.command-step pre','.copy-status','.architecture-mobile h3','.architecture-mobile li li','.button','[role="tab"]','.command-step','#screenshots img','.brand-mark.compact img','#menu-toggle','#menu-toggle svg'];
 const result=[];
 for(const selector of selectors)for(const [index,element] of [...document.querySelectorAll(selector)].entries()){
  if(!element.getClientRects().length)continue;
  const style=getComputedStyle(element),rect=element.getBoundingClientRect();
  if(style.visibility==='hidden'||style.display==='none')continue;
  result.push({selector,index,tag:element.tagName,fontSize:style.fontSize,fontFamily:style.fontFamily,lineHeight:style.lineHeight,color:style.color,backgroundColor:style.backgroundColor,borderRadius:style.borderRadius,
   width:rect.width,height:rect.height,minHeight:style.minHeight,paddingTop:style.paddingTop,paddingBottom:style.paddingBottom,whiteSpace:style.whiteSpace,overflowX:style.overflowX,
   scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,inViewport:rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth});
 }
 return {method:'computed styles and laid-out DOM geometry; inViewport is recorded separately',rootFontSize:getComputedStyle(document.documentElement).fontSize,rows:result,pageOverflow:document.documentElement.scrollWidth>innerWidth};
});}
async function copyState(page){return page.locator('[data-command-step="clone"]').evaluate(element=>{
 const button=element.querySelector('button'),status=element.querySelector('[role="status"]');
 return {text:status.textContent,disabled:button.disabled,busy:button.getAttribute('aria-busy'),error:status.hasAttribute('data-error'),statusColor:getComputedStyle(status).color};
});}
async function snapshot(page,width,id,method,{copyExpected,actions=[],stimuli=[]}={}){
 await page.waitForFunction(()=>[...document.images].every(image=>{const rect=image.getBoundingClientRect();return !rect.width||!rect.height||rect.bottom<=0||rect.top>=innerHeight||rect.right<=0||rect.left>=innerWidth||image.complete&&image.naturalWidth>0;}),{},{timeout:15000});
 const measured=await measurements(page),before=copyExpected?await copyState(page):null;
 if(copyExpected)for(const [key,value] of Object.entries(copyExpected))assert.equal(before[key],value,`${width}/${id}/${key}`);
 const screenshot=`before/${id}--w${width}.png`;await page.screenshot({path:join(run.directory,screenshot),animations:'disabled'});
 assert.deepEqual(await measurements(page),measured,'Measured styles and geometry changed across screenshot boundaries.');
 if(copyExpected)assert.deepEqual(await copyState(page),before,'Copy state must remain unchanged at screenshot boundaries.');
 states.push({stateId:id,configurationId:`w${width}`,start:{url},finalUrl:page.url(),width,height:844,reached:true,screenshot,actions:structuredClone(actions),
  dom:{designSystem:{runtimeMeasurements:measured,copyState:before,method,runtimeStimuli:structuredClone(stimuli)}},runtimeBoundary:copyExpected?{method:'one DOM read immediately before and after screenshot',state:before}:null});
 console.log(JSON.stringify({event:'runtime-state',width,state:id,method}));
}
async function contrast(page,width,state){
 const result=await page.evaluate(async()=>{
  const value=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});
  return {engine:{name:'axe-core',version:window.axe.version},violations:value.violations.map(item=>({id:item.id,impact:item.impact,targets:item.nodes.map(node=>node.target),details:item.nodes.map(node=>node.failureSummary)})),incomplete:value.incomplete.map(item=>({id:item.id,targets:item.nodes.map(node=>node.target),details:item.nodes.map(node=>node.failureSummary||'')}))};
 });checks.push({width,state,method:'axe WCAG-tagged DOM checks, including color contrast; not full compliance or visual approval',...result});
}
const success={text:'命令已复制',disabled:false,busy:null,error:false};
const failure={text:'暂未确认复制结果，请选中上方命令手动复制。',disabled:false,busy:null,error:true};
const clipboardLockPath=join(tmpdir(),'happyclaw-foundation-runtime-clipboard.lock');
let browser,clipboardLock;
try{
 try{clipboardLock=await open(clipboardLockPath,'wx');}
 catch(error){if(error.code==='EEXIST')throw Error('Another runtime clipboard check owns '+clipboardLockPath+'. Run versions sequentially; inspect the owning PID before removing a stale lock.');throw error;}
 await clipboardLock.writeFile(JSON.stringify({pid:process.pid,run:run.manifest.id,createdAt:new Date().toISOString()}));
 const capture=await captureWithDesignSystem({directory:run.directory,repo,phase:'before',bindVerificationSource:true,verificationUrl:url,capture:async()=>{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  for(const width of widths){
   const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1,reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']}),page=await context.newPage();
   page.on('pageerror',error=>errors.push(error.message));await page.goto(url,{waitUntil:'networkidle'});await page.addScriptTag({path:axe});
   const actions=[],stimuli=[];
   await snapshot(page,width,'runtime-default','normal layout and computed styles');
   for(const channel of ['web','mobile','feishu']){
    const selector=`#tab-${channel}`;await page.locator(selector).click();await page.locator('#screenshots').scrollIntoViewIfNeeded();
    actions.push({type:'click-selector',selector});
    assert.equal(await page.locator(selector).getAttribute('aria-selected'),'true');
    await snapshot(page,width,`channel-${channel}`,'real selected channel, laid-out measurements',{actions});await contrast(page,width,`channel-${channel}`);
   }
   for(const [id,command] of commands){
    const button=page.locator(`[data-command-step="${id}"] button`);assert.equal(await button.getAttribute('data-copy-command'),command);
    await button.click();await page.locator(`#copy-status-${id}`).filter({hasText:'命令已复制'}).waitFor();
    actions.push({type:'click-selector',selector:`[data-command-step="${id}"] button`});
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),command);assert.equal(await page.locator(`[data-command-step="${id}"] code`).textContent(),command);
    checks.push({width,state:`copy-${id}`,method:'real button click and native Clipboard API read-back',command,valueVerified:true});
   }
   const button=page.locator('[data-command-step="clone"] button');await button.scrollIntoViewIfNeeded();
   await snapshot(page,width,'copy-success','native Clipboard API read-back for all three commands',{copyExpected:success,actions,stimuli});await contrast(page,width,'copy-success');
   await page.evaluate(()=>{
    const descriptor=Object.getOwnPropertyDescriptor(navigator.clipboard,'writeText');
    window.__hhRestoreClipboard=()=>{if(descriptor)Object.defineProperty(navigator.clipboard,'writeText',descriptor);else delete navigator.clipboard.writeText;delete window.__hhRestoreClipboard;};
    Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:()=>Promise.reject(new DOMException('Simulated denial','NotAllowedError'))});
   });
   stimuli.push({beforeActionIndex:actions.length,kind:'simulated-clipboard-rejection',method:'override writeText to reject; not a real user permission denial'});
   await button.click();await page.locator('#copy-status-clone').filter({hasText:'手动复制'}).waitFor();
   actions.push({type:'click-selector',selector:'[data-command-step="clone"] button'});
   await snapshot(page,width,'copy-denied','simulated writeText rejection; not real user permission denial',{copyExpected:failure,actions,stimuli});await contrast(page,width,'copy-denied');
   await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:()=>new Promise(()=>{})}));
   stimuli.push({beforeActionIndex:actions.length,kind:'simulated-unresolved-clipboard',method:'override writeText with an unresolved promise; the component timeout remains real'});
   await button.click();actions.push({type:'click-selector',selector:'[data-command-step="clone"] button'});
   await snapshot(page,width,'copy-pending','simulated unresolved clipboard promise; real component busy state',{copyExpected:{text:'正在复制命令…',disabled:true,busy:'true',error:false},actions,stimuli});
   await page.waitForFunction(()=>!document.querySelector('[data-command-step="clone"] button').disabled,{},{timeout:7000});
   actions.push({type:'wait-for',text:'暂未确认复制结果，请选中上方命令手动复制。',timeoutMs:7000});
   await snapshot(page,width,'copy-timeout','simulated unresolved promise; real five-second component timeout',{copyExpected:failure,actions,stimuli});
   await page.evaluate(()=>window.__hhRestoreClipboard());stimuli.push({beforeActionIndex:actions.length,kind:'restored-native-clipboard',method:'restore original writeText descriptor before real click and native read-back'});
   await button.click();actions.push({type:'click-selector',selector:'[data-command-step="clone"] button'});await page.locator('#copy-status-clone').filter({hasText:'命令已复制'}).waitFor();
   assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),commands[0][1]);
   await snapshot(page,width,'copy-recovered','restored native clipboard, click and read-back after simulated failures',{copyExpected:success,actions,stimuli});
   const pre=page.locator('[data-command-step="clone"] pre');await pre.focus();
   assert.equal(await pre.evaluate(element=>document.activeElement===element),true);
   if(await pre.evaluate(element=>element.scrollWidth>element.clientWidth)){
    for(let index=0;index<40;index++)await page.keyboard.press('ArrowRight');
    await page.waitForFunction(()=>{const element=document.querySelector('[data-command-step="clone"] pre');return element.scrollLeft+element.clientWidth>=element.scrollWidth-2;});
   }
   const selected=await pre.evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);return selection.toString();});assert.equal(selected,commands[0][1]);
   const geometry=await pre.evaluate(element=>({scrollLeft:element.scrollLeft,scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,focused:element===document.activeElement,whiteSpace:getComputedStyle(element).whiteSpace,overflowX:getComputedStyle(element).overflowX}));
   checks.push({width,state:'command-selection',method:'programmatic focus and DOM Range selection, real ArrowRight scrolling when overflow exists; not manual text-selection usability',textVerified:true,geometry});
   await context.close();
  }
  assert.deepEqual(errors,[]);assert.equal(verificationHash(await readFile(new URL(import.meta.url))),scriptHash,'Runtime verifier changed during capture.');
  return {schemaVersion:'0.1',adapter:'web',channel:'chrome',at:new Date().toISOString(),states,runtimeFoundation:{methodSchemaVersion:'0.3',scriptPath:'runtime-method.mjs',scriptHash,
   browser:{channel:process.env.BROWSER_CHANNEL||'chrome',version:browser.version(),platform:process.platform,deviceScaleFactor:1,reducedMotion:'reduce'},checks:structuredClone(checks),errors:[...errors]}};
 }});
 const current=await loadRun(run.directory);
 const report={runId:run.manifest.id,source:capture.designSystemSource,previewFingerprint:capture.verificationPreviewFingerprint,states:states.length,...capture.runtimeFoundation,
  judgment:current.manifest.judgment,foundationApproval:current.manifest.foundationApproval,
  limitations:['Current-revision baseline only; no historical review or capture is overwritten.','Computed styles and laid-out geometry are observations; inViewport is explicit and not every measured element is shown in each viewport image. CSS fontFamily is a declared stack, not proof of the font used for each glyph.','No root-font stress test, physical-device or screen-reader certification, independent visual assessment or human approval.','Clipboard denial and timeout are simulated API stimuli; successful read-back uses native Chrome clipboard. Read saved method and runtimeStimuli with the UI action history; actions alone do not replay injected stimuli.','Preview response and source stability are bound; this is not cryptographic deployment identity.']};
 await writeFile(join(run.directory,'runtime-foundation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({event:'runtime-complete',run:run.directory,states:states.length,checks:checks.length,violations:checks.filter(item=>item.violations?.length).length}));
}finally{
 try{await browser?.close();}finally{if(clipboardLock){try{await clipboardLock.close();}finally{await unlink(clipboardLockPath);}}}
}
