import {capturePageSurfaces,verifyPageSurfaces} from './page-surfaces.js';
import {captureComponentInstance,assertStableComponentInstance} from './component-instance.js';
import { pngDimensions } from './whole-page.js';
import { captureAccessibility } from './accessibility.js';
import { mkdir, writeFile, readFile, realpath } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { assertCapturePlan, captureKey, configurationsForState } from './capture-state.js';
import { inspectScrollSurfaces, prepareSurface, measureSurface, assertSurfaceMeasurement, scrollSurfaceCoverage } from './scroll-surface.js';

export const DEFAULT_VIEWPORTS = Object.freeze({
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 }
});

export async function captureBrowser({ url, directory, phase, viewports = DEFAULT_VIEWPORTS, channel = 'chrome' }) {
  if (!['before', 'after'].includes(phase)) throw new Error('Phase must be before or after.');
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Capture URL must use http or https.');
  const target = join(directory, phase);
  await mkdir(target, { recursive: true });
  const browser = await chromium.launch({ channel, headless: true });
  try {
    const results = {};
    for (const [name, viewport] of Object.entries(viewports)) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const page = await context.newPage();
      // Large background video and long-lived app requests can delay `load`
      // indefinitely even though the reviewable UI is already rendered.
      const response = await page.goto(parsed.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await settle(page);
      if (!response || response.status() >= 400) throw new Error(`${name} preview returned HTTP ${response?.status() ?? 'no response'}.`);
      // Astro may return 200 while a later development-build error covers the page.
      if (await page.locator('astro-error-overlay').count()) throw new Error(`${name} preview has an Astro error overlay; fix the app before capturing evidence.`);
      const screenshot = `${name}.png`;
      await page.screenshot({ path: join(target, screenshot), animations: 'disabled' });
      results[name] = { ...viewport, status: response?.status() ?? null, finalUrl: page.url(), screenshot: `${phase}/${screenshot}`, dom: await captureDom(page) };
      await context.close();
    }
    const capture = { at: new Date().toISOString(), url: parsed.href, channel, viewports: results };
    await writeFile(join(target, 'capture.json'), JSON.stringify(capture, null, 2) + '\n', 'utf8');
    return capture;
  } finally {
    await browser.close();
  }
}

// Shared settle for both capture paths, so a legacy capture and a task-state
// capture of the same page wait on the same things before the screenshot.
async function settle(page) {
  await Promise.race([page.evaluate(() => document.fonts?.ready), page.waitForTimeout(3000)]);
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
}

// Scrolling can trigger lazy images above the target. Their intrinsic height
// arrives during settle, so a successful scroll action can otherwise capture
// the previous section. Re-anchor only the declared final scroll; never replay
// clicks or change an interaction state to manufacture a screenshot.
async function settleScrollTarget(page, action) {
  if (action?.type !== 'scroll-to') return;
  if (action.container) {
    for(let attempt=0;attempt<3;attempt++){
      const aligned=await page.locator(action.container).evaluate((container,action)=>{
        const target=document.querySelector(action.selector);
        if(!target||!container.contains(target))return false;
        const top=target.getBoundingClientRect().top-container.getBoundingClientRect().top-container.clientTop,offset=action.offset||0;
        return Math.abs(top-offset)<=2 || container.scrollTop<=2&&top<=offset+2 || container.scrollHeight-container.clientHeight-container.scrollTop<=2&&top>=offset-2;
      },action);
      if(aligned)return;
      await replayAction(page,action);await settle(page);
    }
    throw Error('Internal scroll target moved after layout settled: '+action.selector);
  }
  const target = page.locator(action.selector), offset = action.offset || 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const aligned = await target.evaluate((element, offset) => {
      const top = element.getBoundingClientRect().top;
      const scrolling = document.scrollingElement || document.documentElement;
      return Math.abs(top - offset) <= 2
        || scrolling.scrollTop <= 2 && top <= offset + 2
        || scrolling.scrollHeight - scrolling.clientHeight - scrolling.scrollTop <= 2 && top >= offset - 2;
    }, offset);
    if (aligned) return;
    if (attempt === 2) break;
    await replayAction(page, action);
    await settle(page);
  }
  throw new Error('Scroll target moved after layout settled: ' + action.selector);
}


// Reach lazy-loaded content using normal scrolling, then restore the declared state.
// Stop rather than certify an unbounded or continuously growing document.
async function prepareWholePage(page) {
  if ((await page.evaluate(inspectScrollSurfaces)).length) throw Error('Internal scroll surfaces require explicit viewport segments; a document screenshot cannot cover their content.');
  const initial = await page.evaluate(() => ({x:scrollX,y:scrollY}));
  try {
    let stable = false;
    for (let pass=0;pass<3;pass++) {
      const size = await page.evaluate(() => ({height:document.documentElement.scrollHeight,step:Math.max(200,innerHeight-100)}));
      if(size.height>100000 || Math.ceil(size.height/size.step)>200)throw Error('Document exceeds the bounded whole-page capture limit.');
      for(let y=0;y<size.height;y+=size.step){await page.evaluate(top=>window.scrollTo({top,behavior:'instant'}),y);await page.waitForTimeout(50);}
      await settle(page);
      if(await page.evaluate(()=>document.documentElement.scrollHeight)===size.height){stable=true;break;}
    }
    if(!stable)throw Error('Document keeps growing; a complete whole-page capture is unavailable.');
    if((await page.evaluate(inspectScrollSurfaces)).length)throw Error('Internal scroll surfaces appeared during capture; declare explicit viewport segments.');
    const missing = await page.evaluate(() => [...document.images].filter(img=>img.getBoundingClientRect().width>0&&img.getBoundingClientRect().height>0&&(!img.complete||!img.naturalWidth)).map(img=>img.getAttribute('src')||'unknown-image'));
    if(missing.length)throw Error('Whole-page images did not load: '+missing.slice(0,10).join(', '));
  } finally {await page.evaluate(position=>window.scrollTo({left:position.x,top:position.y,behavior:'instant'}),initial);await settle(page);}
}

export async function replayAction(page, action) {
  if (['assert-state','press-key','fill-selector','validate-form','click-selector','hover-selector','focus-selector'].includes(action.type)) {
    const target=page.locator(action.selector);
    if(action.state==='visible'||['click-selector','fill-selector','press-key','validate-form','hover-selector','focus-selector'].includes(action.type))await target.waitFor({state:'visible',timeout:10000});
    else if(action.state!=='hidden')await target.waitFor({state:'attached',timeout:10000});
    const count=await target.count();
    if(action.type==='assert-state'&&action.state==='hidden'&&count===0)return {captureAction:{...action,verified:true,matched:0}};
    if(count!==1)throw Error('Interaction target must match exactly one element: '+action.selector);
    if(action.type==='hover-selector'){await target.hover({timeout:10000});return {captureAction:{...action}};}
    if(action.type==='focus-selector'){await target.scrollIntoViewIfNeeded();await target.focus({timeout:10000});return {captureAction:{...action}};}
    if(action.type==='click-selector'){await target.click({timeout:10000});return {captureAction:{...action}};}
    if(action.type==='press-key'){await target.press(action.key,{timeout:10000});return {captureAction:{...action}};}
    if(action.type==='fill-selector'){await target.fill(action.value,{timeout:10000});return {captureAction:{...action}};}
    if(action.type==='validate-form'){
      const result=await target.evaluate(element=>{
        if(!(element instanceof HTMLFormElement))throw Error('Validation target must be a form.');
        return {valid:element.reportValidity(),invalidFields:[...element.elements].filter(field=>field.willValidate&&!field.validity.valid).map(field=>({name:field.name,type:field.type,message:field.validationMessage}))};
      });
      if(result.valid!==action.valid)throw Error('Form validity does not match the declared error/recovery state.');
      return {captureAction:{...action,...result}};
    }
    if(action.state && !['visible','hidden'].includes(action.state)) {
      await page.waitForFunction(({selector,state})=>{
        const element=document.querySelector(selector);if(!element)return false;
        return state==='focused'?element===document.activeElement:state==='hovered'?element.matches(':hover'):
          state==='checked'?element.matches(':checked'):state==='unchecked'?element.matches('input[type=checkbox],input[type=radio]')&&!element.checked:
          state==='disabled'?element.matches(':disabled'):element.matches(':enabled');
      },action,{timeout:10000});
    }
    else if(action.state)await target.waitFor({state:action.state,timeout:10000});
    else await page.waitForFunction(({selector,attribute,value})=>document.querySelector(selector)?.getAttribute(attribute)===value,action,{timeout:10000});
    return {captureAction:{...action,verified:true}};
  }
  if (action.type === 'navigate') return page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (action.type === 'click') {
    const target=action.scope?page.locator(action.scope):page;
    if(action.scope&&await target.count()!==1)throw Error('Click scope must match exactly one element.');
    return target.getByRole(action.role,{name:action.name,exact:true}).click({timeout:10000});
  }
  if (action.type === 'fill') return page.getByLabel(action.label, { exact: true }).fill(action.value, { timeout: 10000 });
  if (action.type === 'wait-for') return page.getByText(action.text, { exact: false }).first().waitFor({ state: 'visible', timeout: action.timeoutMs || 10000 });
  if (action.type === 'scroll-horizontal') {
    const locator=page.locator(action.selector);
    if(await locator.count()!==1)throw Error('Horizontal scroll target must be unique.');
    await locator.scrollIntoViewIfNeeded();
    const metrics=await locator.evaluate(element=>({overflowX:getComputedStyle(element).overflowX,scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,scrollLeft:element.scrollLeft}));
    if(!['auto','scroll'].includes(metrics.overflowX)||metrics.scrollWidth<=metrics.clientWidth)throw Error('Target has no user-scrollable horizontal overflow.');
    const bounds=await locator.boundingBox();if(!bounds||bounds.width<=0||bounds.height<=0)throw Error('Horizontal scroll target is not visible.');
    await page.mouse.move(bounds.x+bounds.width/2,bounds.y+Math.min(bounds.height/2,40));
    await page.mouse.wheel((action.position==='end'?1:-1)*(metrics.scrollWidth+100),0);
    await page.waitForFunction(({selector,position})=>{const element=document.querySelector(selector);return element&&(position==='end'?element.scrollLeft>=element.scrollWidth-element.clientWidth-2:element.scrollLeft<=2);},action,{timeout:5000});
    return {captureAction:{type:action.type,selector:action.selector,position:action.position,...await locator.evaluate(element=>({scrollLeft:element.scrollLeft,scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,overflowX:getComputedStyle(element).overflowX}))}};
  }
  if (action.type === 'scroll-to') {
    if(await page.locator(action.selector).count()!==1)throw Error('Scroll target must be unique.');
    if(action.container){
      const surface=page.locator(action.container);
      if(await surface.count()!==1)throw Error('Scroll container must be unique.');
      return surface.evaluate((container,action)=>{
        const element=document.querySelector(action.selector);
        if(!container.contains(element)||!['auto','scroll'].includes(getComputedStyle(container).overflowY))throw Error('Target must belong to the declared user-scrollable container.');
        container.scrollTo({top:element.getBoundingClientRect().top-container.getBoundingClientRect().top-container.clientTop+container.scrollTop-(action.offset||0),behavior:'instant'});
        return {captureAction:{...action,scrollTop:container.scrollTop,scrollHeight:container.scrollHeight,clientHeight:container.clientHeight}};
      },action);
    }
    return page.locator(action.selector).evaluate((element, offset) => { window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - offset, behavior: 'instant' }); }, action.offset || 0);
  }
  throw new Error(`Unsupported replay action: ${action.type}.`);
}

// Actions may wait for an expected state. Screenshot boundaries must NOT wait
// for a later recovery: inspect the complete group in one synchronous DOM read.
export async function verifyTerminalState(page, assertions) {
  if(!assertions.length)return [];
  return page.evaluate(assertions=>{
    const visible=element=>{
      const rect=element.getBoundingClientRect(),style=getComputedStyle(element);
      return rect.width>0&&rect.height>0&&style.visibility!=='hidden'&&style.visibility!=='collapse'&&style.display!=='none';
    };
    return assertions.map(action=>{
      const elements=document.querySelectorAll(action.selector),element=elements[0];
      if(action.state==='hidden'&&elements.length===0)return {...action,verified:true,matched:0,verification:'instantaneous-boundary-check'};
      if(elements.length!==1)throw Error('Final state target must match exactly one element: '+action.selector);
      const matches=action.attribute?element.getAttribute(action.attribute)===action.value:
        action.state==='visible'?visible(element):action.state==='hidden'?!visible(element):
        action.state==='focused'?element===document.activeElement:action.state==='hovered'?element.matches(':hover'):
        action.state==='checked'?element.matches(':checked'):action.state==='unchecked'?element.matches('input[type=checkbox],input[type=radio]')&&!element.checked:
        action.state==='disabled'?element.matches(':disabled'):element.matches(':enabled');
      if(!matches)throw Error('Final state does not match at screenshot boundary: '+action.selector);
      return {...action,verified:true,verification:'instantaneous-boundary-check'};
    });
  },assertions);
}

export async function captureDom(page) {
  const dom = await page.evaluate(() => ({
    scroll: { x: window.scrollX, y: window.scrollY },
    designSystem: {
      status:'observed-visible-samples',
      rootVariables:Object.fromEntries([...getComputedStyle(document.documentElement)].filter(name=>name.startsWith('--')).sort().slice(0,128).map(name=>[name,getComputedStyle(document.documentElement).getPropertyValue(name).trim()])),
      elements:[...document.querySelectorAll('body,h1,h2,h3,p,button,a,input,select,textarea,pre,[role="tab"]')].filter(item=>{
        const rect=item.getBoundingClientRect(),style=getComputedStyle(item);
        return rect.width>0&&rect.height>0&&rect.top<innerHeight&&rect.bottom>0&&style.visibility!=='hidden'&&style.display!=='none';
      }).slice(0,40).map(item=>{
        const style=getComputedStyle(item),rect=item.getBoundingClientRect();
        return {tag:item.tagName.toLowerCase(),id:item.id||null,role:item.getAttribute('role'),className:typeof item.className==='string'?item.className.slice(0,160):null,
          styles:Object.fromEntries(['fontFamily','fontSize','fontWeight','lineHeight','color','backgroundColor','borderRadius','padding','gap','minHeight','transitionDuration','transitionTimingFunction'].map(key=>[key,style[key]])),
          size:{width:Math.round(rect.width),height:Math.round(rect.height)},state:{disabled:Boolean(item.disabled),expanded:item.getAttribute('aria-expanded'),selected:item.getAttribute('aria-selected'),focused:item===document.activeElement}};
      })
    },
    title: document.title,
    h1: [...document.querySelectorAll('h1')].map(item => (item.innerText ?? item.textContent ?? "").trim()).filter(Boolean),
    headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(item => ({ level: Number(item.tagName.slice(1)), text: (item.innerText ?? item.textContent ?? "").trim() })).filter(item => item.text),
    language: document.documentElement.lang || null,
    landmarks: { main: document.querySelectorAll('main,[role="main"]').length, navigation: document.querySelectorAll('nav,[role="navigation"]').length },
    images: { count: document.querySelectorAll('img').length, missingAlt: [...document.querySelectorAll('img')].filter(item => !item.hasAttribute('alt')).map(item => item.getAttribute('src') || '').slice(0, 20) },
    unlabeledInputs: [...document.querySelectorAll('input,select,textarea')].filter(item => {
      const id = item.getAttribute('id');
      return !item.getAttribute('aria-label') && !item.getAttribute('aria-labelledby') && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) && !item.closest('label');
    }).map(item => ({ tag: item.tagName.toLowerCase(), type: item.getAttribute('type'), name: item.getAttribute('name') })).slice(0, 20),
    actions: [...document.querySelectorAll('a,button')].filter(item => {
      const rect = item.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0;
    }).map(item => ({ label: (item.innerText ?? item.textContent ?? "").trim() || item.getAttribute('aria-label') || '', href: item.getAttribute('href') || null })).filter(item => item.label).slice(0, 30),
    controls: [...document.querySelectorAll('a,button,input,select,textarea')].filter(item => {
      const rect = item.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0;
    }).map(item => {
      const rect = item.getBoundingClientRect();
      const ariaControls = item.getAttribute('aria-controls');
      const controlledIds = ariaControls?.trim().split(/\s+/).filter(Boolean) || [];
      return {
        tag: item.tagName.toLowerCase(),
        label: item.innerText?.trim() || item.getAttribute('aria-label') || item.getAttribute('title') || '',
        href: item.getAttribute('href'),
        ariaControls,
        ariaControlsResolved: ariaControls === null ? null : controlledIds.length > 0 && controlledIds.every(id => document.getElementById(id)),
        ariaExpanded: item.getAttribute('aria-expanded'),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    }).slice(0, 40),
    visibleCopy: [...document.querySelectorAll('h1,h2,h3,p,li')].filter(item => {
      const rect = item.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0;
    }).map(item => (item.innerText ?? item.textContent ?? "").trim()).filter(Boolean).slice(0, 40),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
  }));
  dom.accessibility = await captureAccessibility(page);
  return dom;
}

export async function verifyRegionSource(page, region, sourceRoot) {
  if (!region) return null;
  if (!sourceRoot) throw new Error('Region source verification requires the reviewed repository root.');
  const locator = page.locator(region.selector), count = await locator.count();
  if (count !== 1) throw new Error(`Region selector ${region.selector} matched ${count} elements; exactly one is required.`);
  const bounds = await locator.boundingBox();
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) throw new Error(`Region selector ${region.selector} is not visible.`);
  const rendered = await locator.evaluate(element => element.outerHTML);
  if (!rendered.includes(region.source.anchor)) throw new Error(`Region source anchor is not present in the rendered element matched by ${region.selector}.`);
  const outside = value => value === '..' || value.startsWith(`..${sep}`) || isAbsolute(value);
  const root = await realpath(sourceRoot), requested = resolve(root, region.source.file);
  if (isAbsolute(region.source.file) || outside(relative(root, requested))) throw new Error('Region source file must stay inside the reviewed repository.');
  const file = await realpath(requested);
  if (outside(relative(root, file))) throw new Error('Region source file resolves outside the reviewed repository.');
  const bytes = await readFile(file), lines = bytes.toString('utf8').split(/\r?\n/), sourceLine = lines[region.source.line - 1];
  if (sourceLine === undefined) throw new Error(`Region source line ${region.source.line} does not exist in ${region.source.file}.`);
  if (!sourceLine.includes(region.source.anchor)) throw new Error(`Region source anchor was not found at ${region.source.file}:${region.source.line}.`);
  return {
    selector: region.selector,
    ...(region.instance ? {instance:structuredClone(region.instance)} : {}),
    bounds: Object.fromEntries(Object.entries(bounds).map(([key,value])=>[key,Math.round(value)])),
    source: { ...region.source, file: region.source.file.replaceAll('\\','/'), fileHash: createHash('sha256').update(bytes).digest('hex') },
    verification: 'unique-visible-selector-and-shared-source-anchor'
  };
}

export async function captureBrowserPlan({ plan, directory, phase, channel = 'chrome', sourceRoot = null, signal }) {
  signal?.throwIfAborted();
  if (!['before', 'after'].includes(phase)) throw new Error('Phase must be before or after.');
  assertCapturePlan(plan);
  const target = join(directory, phase);
  await mkdir(target, { recursive: true });
  const browser = await chromium.launch({ channel, headless: true });
  const states = [];
  const abort = () => { void browser.close().catch(()=>{}); };
  signal?.addEventListener('abort',abort,{once:true});
  try {
    signal?.throwIfAborted();
    for (const state of plan.states) {
      for (const configuration of configurationsForState(plan, state)) {
        signal?.throwIfAborted();
        const context = await browser.newContext({ viewport: configuration.viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const result = { ...(state.sourceEntries?{plannedState:structuredClone(state)}:{}), ...(state.title ? {title:state.title} : {}), ...(state.region ? {plannedRegion:structuredClone(state.region)} : {}), ...(state.scrollSurface ? {plannedScrollSurface:state.scrollSurface} : {}), captureMode: state.captureMode || 'viewport', stateId: state.id, configurationId: configuration.id, start: state.start, actions: state.actions, ...configuration.viewport, reached: false };
        try {
          let response = await page.goto(state.start.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          if (!response || response.status() >= 400) throw new Error(`Start point returned HTTP ${response?.status() ?? 'no response'}.`);
          if(state.ready){let ready=page.locator(state.ready.selector);if(state.ready.text)ready=ready.filter({hasText:state.ready.text});await ready.first().waitFor({state:'visible',timeout:state.ready.timeoutMs||30000});}
          for (let index = 0; index < state.actions.length; index++) {
            const actionResponse = await replayAction(page, state.actions[index]);
            if(actionResponse?.captureAction)(result.actionEvidence ||= []).push(actionResponse.captureAction);
            if (actionResponse?.status) response = actionResponse;
            result.completedActions = index + 1;
          }
          if (!response || response.status() >= 400) throw new Error(`Final point returned HTTP ${response?.status() ?? 'no response'}.`);
          await settle(page);
          const finalAction = state.actions.filter(action => !['assert-state', 'wait-for'].includes(action.type)).at(-1);
          await settleScrollTarget(page, finalAction);
          if (await page.locator('astro-error-overlay').count()) throw new Error('Preview has an Astro error overlay.');
          const scrollSurface=state.scrollSurface?await prepareSurface(page,state.scrollSurface):null;
          // Only terminal assertions describe the final image. Earlier assertions
          // remain action history (e.g. menu open followed by menu close).
          const terminalAssertions=[];
          for(let i=state.actions.length-1;i>=0&&['assert-state','wait-for'].includes(state.actions[i].type);i--){
            if(state.actions[i].type==='assert-state')terminalAssertions.unshift(state.actions[i]);
          }
          const region = state.region ? await verifyRegionSource(page,state.region,sourceRoot) : null;
          const screenshot = `${captureKey(state.id, configuration.id)}.png`;
          if(state.captureMode === 'full-page')await prepareWholePage(page);
          if(state.captureMode === 'page-surfaces')result.pageSurfaces=await capturePageSurfaces(page,{directory,phase,key:captureKey(state.id,configuration.id)});
          const documentCapture=['full-page','page-surfaces'].includes(state.captureMode);
          const measure=()=>page.evaluate(()=>({width:Math.max(innerWidth,document.documentElement.scrollWidth,document.body?.scrollWidth||0),height:Math.max(innerHeight,document.documentElement.scrollHeight,document.body?.scrollHeight||0)}));
          let documentSize,image,stable=false;
          // A first screenshot can settle native scrollbar geometry. Retry boundedly,
          // never label a screenshot complete while its document still changes.
          for(let attempt=0;attempt<(documentCapture?3:1);attempt++){
            documentSize=await measure();
            if(documentCapture&&documentSize.height>100000)throw Error('Document exceeds the bounded whole-page capture limit.');
            await verifyTerminalState(page,terminalAssertions);
            const instanceBefore=await captureComponentInstance(page,state.region,{fullPage:documentCapture});
            image=await page.screenshot({path:join(target,screenshot),animations:'disabled',fullPage:documentCapture});
            result.finalStateEvidence=await verifyTerminalState(page,terminalAssertions);
            const instance=assertStableComponentInstance(instanceBefore,await captureComponentInstance(page,state.region,{fullPage:documentCapture}));
            if(instance)result.componentInstance=instance;
            if(!documentCapture){stable=true;break;}
            const current=await measure();
            if(current.width===documentSize.width&&current.height===documentSize.height){stable=true;break;}
          }
          if(!stable)throw Error('Document changed while capturing its full-page evidence.');
          const screenshotSize=pngDimensions(image);
          if(result.pageSurfaces)await verifyPageSurfaces(page,result.pageSurfaces);
          if(scrollSurface){
            const current=await measureSurface(page,state.scrollSurface);assertSurfaceMeasurement(current,state.scrollSurface);
            if(JSON.stringify(current.bounds)!==JSON.stringify(scrollSurface.bounds))throw Error('Scroll surface moved while capturing.');
            result.scrollSurface=scrollSurface;
          }
          if(documentCapture&&(screenshotSize.width<documentSize.width||screenshotSize.height<documentSize.height))throw Error('Whole-page screenshot does not cover its complete document.');
          Object.assign(result,{documentSize,screenshotSize});
          Object.assign(result, { reached: true, status: response?.status() ?? null, finalUrl: page.url(), screenshot: `${phase}/${screenshot}`, dom: await captureDom(page), ...(region ? { region } : {}) });
        } catch (error) {
          signal?.throwIfAborted();
          if(error.pageSurfaces)result.pageSurfaces=error.pageSurfaces;
          delete result.finalStateEvidence;
          delete result.componentInstance;
          Object.assign(result, { error: error.message, failedAction: result.completedActions ?? 0, finalUrl: page.url() || state.start.url });
        } finally {
          states.push(result);
          await context.close().catch(()=>{});
        }
      }
    }
    const capture = { schemaVersion: '0.1', at: new Date().toISOString(), adapter: 'web', channel, states, scrollSurfaceCoverage:scrollSurfaceCoverage(states) };
    await writeFile(join(target, 'capture.json'), JSON.stringify(capture, null, 2) + '\n', 'utf8');
    return capture;
  } finally {
    signal?.removeEventListener('abort',abort);
    await browser.close();
  }
}
