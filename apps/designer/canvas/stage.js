export class Stage {
  constructor(element) { this.el=element;this.x=0;this.y=0;this.scale=1;this.listeners=new Set();this.abort=new AbortController();this.space=false;this.mode="select";this.bind(); }
  bind(){
    const on=(el,type,fn,opts={})=>el.addEventListener(type,fn,{...opts,signal:this.abort.signal});
    on(document,'keydown',e=>{if(e.code==='Space' && !e.target.closest('input,textarea,select,button,summary')){this.space=true;e.preventDefault();}});
    on(document,'keyup',e=>{if(e.code==='Space')this.space=false;});on(window,'blur',()=>{this.space=false;});
    let pan=null;
    on(this.el,'pointerdown',e=>{if(e.button===1 || this.space || this.mode==='hand' || e.target===this.el){e.preventDefault();this.panMoved=false;this.el.setPointerCapture(e.pointerId);pan={x:e.clientX,y:e.clientY,ox:this.x,oy:this.y};this.el.style.cursor='grabbing';}});
    on(this.el,'pointermove',e=>{if(!pan)return;if(Math.abs(e.clientX-pan.x)+Math.abs(e.clientY-pan.y)>3)this.panMoved=true;this.x=pan.ox+e.clientX-pan.x;this.y=pan.oy+e.clientY-pan.y;this.refresh();});
    const end=()=>{pan=null;setTimeout(()=>{this.panMoved=false;},0);this.el.style.cursor=this.mode==='hand'?'grab':'';};on(this.el,'pointerup',end);on(this.el,'pointercancel',end);
    on(this.el,'wheel',e=>{if(matchMedia('(max-width:899px)').matches)return;e.preventDefault();const r=this.el.getBoundingClientRect();if(e.ctrlKey||e.metaKey)this.zoomAt(e.clientX-r.left,e.clientY-r.top,Math.exp(-e.deltaY*.002));else{this.x-=e.deltaX;this.y-=e.deltaY;this.refresh();}},{passive:false});
  }
  zoomAt(px,py,factor){const next=Math.max(.25,Math.min(4,this.scale*factor));const ratio=next/this.scale;this.x=px-(px-this.x)*ratio;this.y=py-(py-this.y)*ratio;this.scale=next;this.refresh();}
  fit(width,height){const r=this.el.getBoundingClientRect();this.scale=Math.max(.25,Math.min(1.4,(r.width-64)/Math.max(1,width),(r.height-64)/Math.max(1,height)));this.x=(r.width-width*this.scale)/2;this.y=(r.height-height*this.scale)/2;this.refresh();}
  fitNode(node){if(matchMedia('(max-width:899px)').matches){node.scrollIntoView({block:'center'});return;}const r=node.getBoundingClientRect(),v=this.el.getBoundingClientRect();this.x+=v.width/2-(r.left+r.width/2-v.left);this.y+=v.height/2-(r.top+r.height/2-v.top);this.refresh();}
  refresh(){this.el.style.setProperty('--pd-x',`${this.x}px`);this.el.style.setProperty('--pd-y',`${this.y}px`);this.el.style.setProperty('--pd-scale',this.scale);this.el.style.setProperty('--pd-grid-step',`${22*this.scale}px`);for(const fn of this.listeners)fn(this);}
  onChange(fn){this.listeners.add(fn);}
  destroy(){this.abort.abort();this.listeners.clear();}
}
