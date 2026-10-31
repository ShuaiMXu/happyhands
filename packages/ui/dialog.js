// DOM content adapter around the site's shadcn/Radix Dialog composition.
// Business code retains its DOM, listeners and close/cancel contract. Radix owns
// modal focus containment, Escape, background isolation and focus restoration.
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import * as Dialog from '@radix-ui/react-dialog';
const h=React.createElement;

export function createDialog(document=globalThis.document) {
  const content=document.createElement('section');
  content.dataset.uiDialog='true';
  let root=null,host=null,opened=false,opener=null;
  content.returnValue='';
  Object.defineProperty(content,'open',{get:()=>opened});
  content.showModal=()=>{
    if(opened)return;
    opened=true;opener=document.activeElement;content.setAttribute('open','');
    host=document.createElement('div');host.dataset.hhPrimitive='dialog';document.body.append(host);root=createRoot(host);
    const title=content.getAttribute('aria-label')||content.querySelector('h1,h2,h3')?.textContent?.trim()||content.querySelector('header')?.textContent?.trim()||'Dialog';
    flushSync(()=>root.render(h(Dialog.Root,{open:true,onOpenChange:value=>{if(!value)content.close();}},
      h(Dialog.Portal,null,
        h(Dialog.Overlay,{'data-slot':'dialog-overlay',className:'hh-dialog-overlay',onPointerDown:event=>{if(event.target===event.currentTarget&&content.dataset.dismissOutside==='true'){event.preventDefault();content.close();}}}),
        h(Dialog.Content,{'data-slot':'dialog-content',className:'hh-dialog-content','aria-describedby':undefined,
          onPointerDownOutside:event=>{event.preventDefault();if(content.dataset.dismissOutside==='true')content.close();},
          onEscapeKeyDown:event=>{const cancel=new Event('cancel',{cancelable:true});if(!content.dispatchEvent(cancel))event.preventDefault();},
          onCloseAutoFocus:event=>{event.preventDefault();if(opener?.isConnected)opener.focus({preventScroll:true});},
        },h(Dialog.Title,{className:'hh-visually-hidden'},title),h('div',{className:'hh-dialog-dom',ref:node=>{if(node&&!node.contains(content))node.append(content);}})),
      ))));
    content.dispatchEvent(new Event('open'));
  };
  content.close=(value='')=>{
    if(!opened)return;
    opened=false;content.returnValue=String(value);content.removeAttribute('open');
    // Preserve the authored subtree for static/reusable dialogs before unmount.
    content.remove();const previous=root;root=null;
    flushSync(()=>previous?.unmount());host?.remove();host=null;
    content.dispatchEvent(new Event('close'));
  };
  content.show=content.showModal;
  return content;
}

export function replaceStaticDialogs(root=document) {
  for(const old of root.querySelectorAll('dialog')){
    const next=createDialog(old.ownerDocument);
    for(const attribute of old.attributes)if(attribute.name!=='open')next.setAttribute(attribute.name,attribute.value);
    next.append(...old.childNodes);old.replaceWith(next);
  }
}
