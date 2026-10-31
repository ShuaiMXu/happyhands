/** Native-element components adapted from happyhands-site shadcn radix-luma
 * Button/Input/Textarea/Label (2c4e0a0). These components are native in shadcn
 * too; retain business nodes and event/form semantics instead of replacing them
 * with React roots. Stateful primitives are supplied separately by Radix.
 */
import {createDialog} from './dialog.js';
const slots={button:'button',textarea:'textarea',label:'label',input:'input',fieldset:'fieldset',legend:'legend'};
const excluded='.tl-container,.tldraw,[data-ui-external],.hh-select-widget,.hh-select-menu,.hh-checkbox-widget';
export function applyControl(element){
  const slot=element.localName==='a'&&element.matches('.button,.wb-button,.studio-button')?'button':slots[element.localName];
  if(!slot||element.closest(excluded)||element.dataset.hhPrimitive)return element;
  if(element.dataset.slot&&!Object.values(slots).includes(element.dataset.slot))return element;
  if(element.localName==='input'&&['checkbox','radio','range','color','hidden','file'].includes(element.type)){
    element.removeAttribute('data-hh-control');element.removeAttribute('data-slot');return element;
  }
  element.dataset.slot=slot;element.dataset.hhControl='true';
  if(slot==='button'){
    element.dataset.variant=element.matches('.primary,.wb-button-primary,.review-action-button,.cowart-primary')?'default':element.matches('.page-review-target')?'media':element.closest('.workbench-navigation')?'ghost':'outline';
  }
  return element;
}
export function createControl(tag,document=globalThis.document){
  return tag==='dialog'?createDialog(document):applyControl(document.createElement(tag));
}
export function installNativeControls(root=document){
  const scan=node=>{if(node.nodeType!==1&&node!==root)return;if(node.nodeType===1)applyControl(node);for(const element of node.querySelectorAll('button,input,textarea,label,fieldset,legend,a.button,a.wb-button,a.studio-button'))applyControl(element);};
  scan(root);
  const observer=new MutationObserver(records=>{for(const record of records){if(record.type==='attributes')applyControl(record.target);else for(const node of record.addedNodes)scan(node);}});
  observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','type']});
  return ()=>observer.disconnect();
}
