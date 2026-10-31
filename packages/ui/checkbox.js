import * as React from 'react';
import {createRoot} from 'react-dom/client';
import * as Primitive from '@radix-ui/react-checkbox';
const h=React.createElement;

// Same Root/Indicator composition and 18px/5px geometry as the site's adapted
// shadcn Checkbox. The hidden native model remains authoritative for existing
// forms, validity, labels and input/change listeners.
export function installCheckboxControls(root=document){
  const doc=root.ownerDocument||root,win=doc.defaultView,widgets=new Map();
  function sync(w){
    const input=w.input;if(input.validity.valid)w.invalid=false;
    w.react.render(h(Primitive.Root,{'data-slot':'checkbox',className:'hh-checkbox',checked:input.indeterminate?'indeterminate':input.checked,disabled:input.matches(':disabled'),'aria-label':input.getAttribute('aria-label')||w.label,'aria-required':input.required||undefined,'aria-invalid':w.invalid||undefined,
      ref:node=>w.button=node,onCheckedChange:checked=>{input.indeterminate=false;input.checked=checked===true;input.dispatchEvent(new win.Event('input',{bubbles:true}));input.dispatchEvent(new win.Event('change',{bubbles:true}));}},
      h(Primitive.Indicator,{'data-slot':'checkbox-indicator'},h('svg',{viewBox:'0 0 24 24','aria-hidden':true},h('path',{d:input.indeterminate?'M5 12h14':'m5 12 4 4L19 6'})))));
  }
  function enhance(input){
    if(widgets.has(input)||input.closest('.hh-checkbox-widget,.tl-container,.tldraw,[data-ui-external]'))return;
    const label=input.labels?.[0]?.cloneNode(true);label?.querySelectorAll('input,button,a').forEach(el=>el.remove());
    const host=doc.createElement('span');host.className='hh-checkbox-widget';
    const w={input,host,react:createRoot(host),label:label?.textContent.trim()||input.name||'Checkbox',hidden:input.hidden,tab:input.getAttribute('tabindex'),aria:input.getAttribute('aria-hidden'),abort:new win.AbortController()};widgets.set(input,w);
    input.hidden=true;input.dataset.hhModel='checkbox';input.tabIndex=-1;input.setAttribute('aria-hidden','true');input.after(host);
    input.addEventListener('change',()=>sync(w),{signal:w.abort.signal});
    input.addEventListener('invalid',event=>{event.preventDefault();w.invalid=true;sync(w);queueMicrotask(()=>w.button?.focus());},{signal:w.abort.signal});
    for(const name of ['checked','indeterminate']){const descriptor=Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,name);Object.defineProperty(input,name,{configurable:true,get(){return descriptor.get.call(this);},set(value){descriptor.set.call(this,value);sync(w);}});}
    input.focus=options=>w.button?.focus(options);sync(w);
  }
  function scan(){
    for(const [input,w]of widgets)if(!input.isConnected){w.abort.abort();w.react.unmount();w.host.remove();for(const name of ['checked','indeterminate','focus'])delete input[name];input.hidden=w.hidden;delete input.dataset.hhModel;for(const [name,value]of [['tabindex',w.tab],['aria-hidden',w.aria]])if(value===null)input.removeAttribute(name);else input.setAttribute(name,value);widgets.delete(input);}
    for(const input of root.querySelectorAll('input[type=checkbox]'))enhance(input);
    for(const w of widgets.values())sync(w);
  }
  const observer=new win.MutationObserver(records=>{if(records.every(record=>record.target.closest?.('.hh-checkbox-widget,.hh-select-widget,.hh-select-menu,[data-radix-popper-content-wrapper]')))return;scan();});
  observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['checked','disabled','required','aria-label','type']});
  doc.addEventListener('reset',()=>win.setTimeout(scan,0));scan();
}
