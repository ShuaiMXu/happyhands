import { chromium } from 'playwright-core';
import { createHash } from 'node:crypto';
import { assertCapturePlan, configurationsForState } from './capture-state.js';
import { DEFAULT_VIEWPORTS } from './browser.js';
import { inspectScrollSurfaces, surfaceOffsets } from './scroll-surface.js';

export const discoveryLimits = Object.freeze({ routes: 12, targets: 100 });
const digest = value => createHash('sha256').update(value).digest('hex').slice(0,12);
const unsafeRoute = /(?:logout|signout|delete|remove|unsubscribe|checkout|pay)(?:\/|$)/i;
export function localReviewUrl(value, base) {
  const url = new URL(value, base), origin = new URL(base).origin;
  if (url.origin !== origin || url.username || url.password || !['http:','https:'].includes(url.protocol)) throw Error('Review targets must use the configured preview origin without credentials.');
  url.hash = ''; return url.href;
}

// Discovery only reads rendered DOM. It neither clicks a control nor invents a
// source location. Unsupported controls remain visible gaps for a manual plan.
export async function inspectReviewPage(page) {
  const data = await page.evaluate(() => {
    const unique = selector => document.querySelectorAll(selector).length === 1;
    const selector = element => {
      if (element.id) { const value='#'+CSS.escape(element.id); if(unique(value))return value; }
      for(const attr of ['data-testid','name'])if(element.getAttribute(attr)){const value=element.tagName.toLowerCase()+'['+attr+'='+JSON.stringify(element.getAttribute(attr))+']';if(unique(value))return value;}
      return null;
    };
    const label = element => {
      const ids=element.getAttribute('aria-labelledby')?.split(/\s+/)||[];
      return element.getAttribute('aria-label') || ids.map(id=>document.getElementById(id)?.textContent||'').join(' ').trim() || element.labels?.[0]?.textContent?.trim() || element.innerText?.trim() || '';
    };
    const visible=element=>{const rect=element.getBoundingClientRect();return rect.width>0&&rect.height>0&&getComputedStyle(element).visibility!=='hidden';};
    const controls=[...document.querySelectorAll('button,[role="button"],a[aria-controls]')].filter(visible).map(element=>({
      selector:selector(element),name:label(element),role:element.getAttribute('role')||(element.tagName==='A'?'link':'button'),
      controls:element.getAttribute('aria-controls'),expanded:element.getAttribute('aria-expanded'),
      popup:element.getAttribute('aria-haspopup'),popover:element.getAttribute('popovertarget'),
      targetSelector:(element.getAttribute('aria-controls')||element.getAttribute('popovertarget'))&&document.getElementById(element.getAttribute('aria-controls')||element.getAttribute('popovertarget'))?selector(document.getElementById(element.getAttribute('aria-controls')||element.getAttribute('popovertarget'))):null
    }));
    const forms=[...document.forms].map(form=>({selector:selector(form),noValidate:form.noValidate,fields:[...form.elements].filter(element=>['INPUT','TEXTAREA','SELECT'].includes(element.tagName)&&!['submit','button','reset','hidden'].includes(element.type)).map(element=>({selector:selector(element),label:label(element),type:element.type,required:element.required,disabled:element.disabled,readOnly:element.readOnly,pattern:element.getAttribute('pattern'),min:element.getAttribute('min'),max:element.getAttribute('max'),minLength:element.minLength,maxLength:element.maxLength}))}));
    return {title:document.title,links:[...document.querySelectorAll('a[href]')].map(a=>a.href),controls,forms,
      dialogs:[...document.querySelectorAll('dialog,[role="dialog"]')].map(element=>({selector:selector(element),visible:visible(element)})),
      unownedInputs:[...document.querySelectorAll('input,select,textarea')].filter(element=>!element.form&&element.type!=='hidden').length,
      alerts:[...document.querySelectorAll('[role="alert"]')].map(element=>({selector:selector(element),visible:visible(element)}))};
  });
  data.scrollSurfaces = await page.evaluate(inspectScrollSurfaces);
  return data;
}

function fieldValue(field) {
  if(field.pattern || (field.minLength>0) || field.disabled || field.readOnly)return null;
  if(field.type==='email')return 'review@example.invalid';
  if(field.type==='url')return 'https://example.invalid/';
  if(['text','search','textarea','tel'].includes(field.type))return 'Review fixture';
  if(field.type==='number'&&!field.min&&!field.max)return '1';
  return null;
}
export function reviewCandidates(observations, base) {
  const candidates=[],gaps=[];
  for(const observation of observations){
    const url=localReviewUrl(observation.url,base),routeId='route-'+digest(url),configuration=observation.configurationId;
    const add=(kind,key,title,actions,extra={})=>candidates.push({id:kind+'-'+digest(url+'|'+configuration+'|'+key),kind,title,routeId,
      state:{id:kind+'-'+digest(url+'|'+configuration+'|'+key),title:title.slice(0,200),start:{url},actions,configurations:[configuration],...(kind==='page'?{captureMode:'full-page'}:{})},...extra});
    if(observation.error){gaps.push({url,configuration,reason:observation.error});continue;}
    add('page','overview',observation.title||new URL(url).pathname,[]);
    for(const surface of observation.scrollSurfaces||[]){
      try {
        if(surface.selector.length>300)throw Error('Scroll surface needs a shorter unique selector.');
        for(const [index,top] of surfaceOffsets(surface).entries()){
          const id='surface-'+digest(url+'|'+configuration+'|'+surface.selector+'|'+top);
          candidates.push({id,kind:'scroll-surface',title:'Scroll surface · '+(index+1)+' · '+top+'px',routeId,
            state:{id,title:'Scroll surface · '+(index+1)+' · '+top+'px',start:{url},actions:[],configurations:[configuration],
              scrollSurface:{...surface,top}}});
        }
        gaps.push({url,configuration,reason:'Internal scroll content requires the declared segments. Document full-page capture remains unavailable; segments do not imply complete component/state review.'});
      }catch(error){gaps.push({url,configuration,reason:error.message});}
    }
    for(const control of observation.controls||[]){
      if(!control.selector||!control.name){if(control.controls||control.popup||control.popover)gaps.push({url,configuration,reason:'Control has no unique selector or accessible name; declare its actions manually.'});continue;}
      const click={type:'click-selector',selector:control.selector};
      if(control.expanded==='false'&&control.targetSelector){
        const open=[click,{type:'assert-state',selector:control.selector,attribute:'aria-expanded',value:'true'},{type:'assert-state',selector:control.targetSelector,state:'visible'}];
        add('menu','open:'+control.selector,control.name+' · open',open);
        add('menu','close:'+control.selector,control.name+' · close',[...open,click,{type:'assert-state',selector:control.selector,attribute:'aria-expanded',value:'false'},{type:'assert-state',selector:control.targetSelector,state:'hidden'}]);
      }else if(control.popup==='dialog'&&control.targetSelector || control.popover){
        const target=control.targetSelector;
        // popover IDs with no verified selector remain a gap, not a guessed locator.
        if(!target||target==='#'){gaps.push({url,configuration,reason:'Dialog target needs an explicit unique selector.'});continue;}
        const open=[click,{type:'assert-state',selector:target,state:'visible'}];
        add('dialog','open:'+control.selector,control.name+' · open',open);
        add('dialog','close:'+control.selector,control.name+' · dismiss',[...open,{type:'press-key',selector:target,key:'Escape'},{type:'assert-state',selector:target,state:'hidden'}]);
      }else if(control.controls||control.popup)gaps.push({url,configuration,reason:'Custom control requires explicit expected state: '+control.name});
    }
    for(const form of observation.forms||[]){
      const fields=form.fields||[],required=fields.filter(field=>field.required),values=fields.map(field=>fieldValue(field));
      const supported=form.selector&&!form.noValidate&&required.length&&fields.length&&fields.every((field,index)=>field.selector&&values[index]!==null);
      if(!supported){gaps.push({url,configuration,reason:'Form needs explicit test data/validation/recovery; discovery never submits a form.'});continue;}
      const empty=required.map(field=>({type:'fill-selector',selector:field.selector,value:''}));
      const invalid=[...empty,{type:'validate-form',selector:form.selector,valid:false}];
      add('form','invalid:'+form.selector,'Form · required-field error',invalid,{testData:'Synthetic local values; no form submission.'});
      add('recovery','valid:'+form.selector,'Form · correct required fields',[...invalid,...fields.map((field,index)=>({type:'fill-selector',selector:field.selector,value:values[index]})),{type:'validate-form',selector:form.selector,valid:true}],{testData:'Synthetic local values; no form submission.'});
    }
    for(const dialog of observation.dialogs||[])if(!candidates.some(candidate=>candidate.routeId===routeId&&candidate.state.configurations.includes(configuration)&&candidate.state.actions.some(action=>action.selector===dialog.selector)))gaps.push({url,configuration,reason:'Dialog opener/dismissal must be declared manually.'});
    if(observation.unownedInputs)gaps.push({url,configuration,reason:'Inputs outside a native form require an explicit task and validation/recovery states.'});
    if(observation.alerts?.length)gaps.push({url,configuration,reason:'Custom error/retry states require explicit setup and expected recovery.'});
  }
  return {candidates:[...new Map(candidates.map(candidate=>[candidate.id,candidate])).values()],gaps};
}

export async function discoverReviewTargets({url,routes=[],configurations=Object.entries(DEFAULT_VIEWPORTS).map(([id,viewport])=>({id,viewport})),channel='chrome',signal,onProgress=()=>{}}){
  const base=localReviewUrl(url,url),origin=new URL(base).origin;
  if(!['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname))throw Error('Review discovery requires a managed local preview.');
  const queue=[...new Set([base,...routes.map(route=>localReviewUrl(route,base))])],seen=new Set(),observations=[],gaps=[];
  const browser=await chromium.launch({channel,headless:true});
  const cancel=()=>browser.close().catch(()=>{});signal?.addEventListener('abort',cancel,{once:true});
  try{
    while(queue.length&&seen.size<discoveryLimits.routes){
      signal?.throwIfAborted();const next=queue.shift();if(seen.has(next))continue;seen.add(next);
      if(unsafeRoute.test(new URL(next).pathname)){gaps.push({url:next,reason:'Potential side-effect route skipped. Add it only after checking its behavior.'});continue;}
      await onProgress(next);
      for(const configuration of configurations){
        const context=await browser.newContext({viewport:configuration.viewport,reducedMotion:'reduce',serviceWorkers:'block'});
        try{
          await context.route('**/*',route=>{
            const request=route.request();
            if(!['GET','HEAD','OPTIONS'].includes(request.method()) || request.isNavigationRequest()&&new URL(request.url()).origin!==origin)return route.abort();
            return route.continue();
          });
          const page=await context.newPage(),response=await page.goto(next,{waitUntil:'domcontentloaded',timeout:15000});
          await page.waitForLoadState('networkidle',{timeout:1500}).catch(()=>{});
          if(!response||response.status()>=400)throw Error('Discovery returned HTTP '+response?.status());
          if(await page.locator('astro-error-overlay').count())throw Error('Preview has an Astro error overlay.');
          const data=await inspectReviewPage(page);
          observations.push({...data,url:localReviewUrl(page.url(),base),configurationId:configuration.id});
          for(const link of data.links){try{const candidate=localReviewUrl(link,base);if(!seen.has(candidate)&&!queue.includes(candidate)){if(queue.length<100)queue.push(candidate);else gaps.push({url:base,reason:'Link discovery limit reached; additional routes require a manual plan.'});}}catch{/* External links are outside this project. */}}
        }catch(error){signal?.throwIfAborted();observations.push({url:next,configurationId:configuration.id,error:error.message});}
        finally{await context.close();}
      }
    }
    if(queue.length)gaps.push({url:base,reason:'Route discovery bounded at '+discoveryLimits.routes+' pages; remaining routes need explicit planning.'});
    const proposal=reviewCandidates(observations,base);
    return {schemaVersion:'0.1',limitations:['Only linked and explicitly supplied local routes were discovered. Authentication, dynamic routes and custom state machines need explicit setup. No comprehensive site pass is inferred.'],at:new Date().toISOString(),url:base,configurations,observations,...proposal,gaps:[...gaps,...proposal.gaps],limits:discoveryLimits};
  }finally{signal?.removeEventListener('abort',cancel);await browser.close();}
}

export function confirmedReviewPlan(proposal,selectedIds,existingPlan=null,manualStates=[]){
  if(!Array.isArray(selectedIds)||!Array.isArray(manualStates))throw Error('Select the review targets explicitly.');
  const selected=new Set(selectedIds);
  if(selected.size!==selectedIds.length || selectedIds.some(id=>!proposal.candidates.some(item=>item.id===id)))throw Error('Unknown or duplicate review target. Rediscover the current project.');
  const candidates=proposal.candidates.filter(item=>selected.has(item.id));
  if(!candidates.length&&!manualStates.length)throw Error('Select at least one review target.');
  const configurations=existingPlan?.configurations||proposal.configurations;
  const states=structuredClone(existingPlan?.states||[]);
  const add=state=>{const previous=states.find(item=>item.id===state.id);if(previous){if(JSON.stringify(previous)!==JSON.stringify(state))throw Error('Review state ID conflicts with the existing plan: '+state.id);}else states.push(structuredClone(state));};
  for(const candidate of candidates)add(candidate.state);
  if(manualStates.length)assertCapturePlan({schemaVersion:'0.1',adapter:'web',configurations,states:manualStates});
  for(const state of manualStates)add(state);
  // Every selected route needs a default full-page original on every selected device.
  const urls=new Set(states.map(state=>localReviewUrl(state.start.url,proposal.url)));
  for(const url of urls){
    for(const configuration of configurations){
      if(!states.some(state=>localReviewUrl(state.start.url,proposal.url)===url&&state.captureMode==='full-page'&&!state.actions.length&&!state.region&&configurationsForState({configurations},state).some(item=>item.id===configuration.id)))add({id:'whole-'+digest(url+'|'+configuration.id),title:('Full page · '+new URL(url).pathname).slice(0,200),start:{url},actions:[],captureMode:'full-page',configurations:[configuration.id]});
    }
  }
  const plan=assertCapturePlan({schemaVersion:'0.1',adapter:'web',configurations,states});
  for(const state of plan.states){localReviewUrl(state.start.url,proposal.url);for(const action of state.actions)if(action.type==='navigate')localReviewUrl(action.url,proposal.url);}
  const targets=states.reduce((count,state)=>count+configurationsForState(plan,state).length,0);
  if(targets>discoveryLimits.targets)throw Error('Review plan exceeds '+discoveryLimits.targets+' state/device targets. Split the review explicitly; no targets were discarded.');
  return plan;
}
