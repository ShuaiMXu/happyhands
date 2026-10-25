import {tileOffsets,completePageSurfaces} from './page-surface-coverage.js';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

// A document overview plus separate original viewports. Never resize the page,
// unclip an element, stitch images, or infer virtualized-content completeness.
export function discoverPageSurfaces() {
  const selector=e=>{const parts=[];for(let n=e;n&&n!==document.documentElement;n=n.parentElement){if(n.id&&document.querySelectorAll('#'+CSS.escape(n.id)).length===1){parts.unshift('#'+CSS.escape(n.id));break;}const siblings=[...n.parentElement.children].filter(s=>s.tagName===n.tagName);parts.unshift(n.tagName.toLowerCase()+':nth-of-type('+(siblings.indexOf(n)+1)+')');}return parts.join(' > ');};
  return [...document.querySelectorAll('body *')].filter(e=>{const s=getComputedStyle(e);if(e.checkVisibility&&!e.checkVisibility({checkVisibilityCSS:true,contentVisibilityAuto:true}))return false;for(let p=e.parentElement;p;p=p.parentElement){if(p.tagName==='DETAILS'&&!p.open&&!p.querySelector(':scope > summary')?.contains(e))return false;}return s.visibility!=='hidden'&&e.getClientRects().length&&e.clientWidth>0&&e.clientHeight>0&&(['auto','scroll'].includes(s.overflowY)&&e.scrollHeight>e.clientHeight+2||['auto','scroll'].includes(s.overflowX)&&e.scrollWidth>e.clientWidth+2);}).map(e=>({selector:selector(e),width:e.scrollWidth,height:e.scrollHeight,clientWidth:e.clientWidth,clientHeight:e.clientHeight,left:e.scrollLeft,top:e.scrollTop}));
}
export async function capturePageSurfaces(page,{directory,phase,key}) {
  const initial=await page.evaluate(()=>({x:scrollX,y:scrollY}));
  const discovered=await page.evaluate(discoverPageSurfaces);
  if(discovered.length>32)throw Error('Page exceeds 32 scroll surfaces; explicitly split the scope.');
  const dimensions=items=>items.map(({left,top,...item})=>item);
  const bundle={version:1,status:'capturing',discovered:dimensions(discovered),surfaces:[],limitations:['Separate viewport originals plus a document overview; no stitched full-page claim.','Pixel intervals and stable text are recorded; sticky occlusion and semantic completeness require independent review. Virtualized content is not certified.']};
  const hash=text=>createHash('sha256').update(text).digest('hex');
  let count=0;
  const restore=async()=>{for(const item of discovered)await page.locator(item.selector).evaluate((e,p)=>e.scrollTo({left:p.left,top:p.top,behavior:'instant'}),item);await page.evaluate(p=>scrollTo({left:p.x,top:p.y,behavior:'instant'}),initial);};
  try {
    // Warm document lazy content before measuring stable inner surfaces.
    const height=await page.evaluate(()=>document.documentElement.scrollHeight);
    if(height>100000)throw Error('Document exceeds bounded overview limit.');
    for(let top=0;top<height;top+=600){await page.evaluate(top=>scrollTo({top,behavior:'instant'}),top);await page.waitForTimeout(40);}
    for(const declared of discovered) {
      const locator=page.locator(declared.selector);if(await locator.count()!==1)throw Error('Surface identity changed.');
      const contentHash=hash(await locator.textContent());
      const surface={selector:declared.selector,contentHash,tiles:[]};bundle.surfaces.push(surface);
      for(const top of tileOffsets(declared.height,declared.clientHeight))for(const left of tileOffsets(declared.width,declared.clientWidth)) {
        if(++count>200)throw Error('Page exceeds 200 surface originals; explicitly split the scope.');
        await locator.evaluate((e,p)=>{e.scrollIntoView({block:'center',inline:'center',behavior:'instant'});e.scrollTo({top:p.top,left:p.left,behavior:'instant'});},{top,left});
        await page.waitForTimeout(100);
        const measure=()=>locator.evaluate(e=>{
          const r=e.getBoundingClientRect(),b={x:r.x+e.clientLeft,y:r.y+e.clientTop,width:e.clientWidth,height:e.clientHeight};
          let visible=b.x>=-1&&b.y>=-1&&b.x+b.width<=innerWidth+1&&b.y+b.height<=innerHeight+1;
          for(let parent=e.parentElement;parent;parent=parent.parentElement){const p=parent.getBoundingClientRect(),s=getComputedStyle(parent);if(['auto','scroll','hidden','clip'].includes(s.overflowY)&&(b.y<p.top-1||b.y+b.height>p.bottom+1))visible=false;if(['auto','scroll','hidden','clip'].includes(s.overflowX)&&(b.x<p.left-1||b.x+b.width>p.right+1))visible=false;}
          for(const x of [.1,.5,.9])for(const y of [.1,.5,.9])if(!e.contains(document.elementFromPoint(b.x+b.width*x,b.y+b.height*y)))visible=false;
          const unloadedImages=[...e.querySelectorAll('img')].filter(i=>{const q=i.getBoundingClientRect();return q.width&&q.height&&q.bottom>b.y&&q.top<b.y+b.height&&q.right>b.x&&q.left<b.x+b.width&&(!i.complete||!i.naturalWidth)}).length;
          return {left:e.scrollLeft,top:e.scrollTop,width:e.clientWidth,height:e.clientHeight,scrollWidth:e.scrollWidth,scrollHeight:e.scrollHeight,bounds:b,visible,unloadedImages};
        });
        const before=await measure();
        if(!before.visible||before.unloadedImages||before.scrollWidth!==declared.width||before.scrollHeight!==declared.height||before.width!==declared.clientWidth||before.height!==declared.clientHeight||Math.abs(before.left-left)>2||Math.abs(before.top-top)>2)throw Error('Surface is clipped, changed, unloaded or did not reach its planned position: '+declared.selector);
        const screenshot=`${phase}/surface-${hash(key).slice(0,24)}-${count}.png`;
        await page.screenshot({path:join(directory,screenshot),animations:'disabled'});
        if(JSON.stringify(before)!==JSON.stringify(await measure())||contentHash!==hash(await locator.textContent()))throw Error('Surface changed during capture: '+declared.selector);
        surface.tiles.push({...before,screenshot});
      }
      surface.finalContentHash=hash(await locator.textContent());
    }
    await restore();await page.waitForTimeout(100);
    bundle.finalDiscovered=dimensions(await page.evaluate(discoverPageSurfaces));
    // Scrolling starts lazy requests; allow them to settle without accepting broken images.
    await page.waitForFunction(()=>[...document.images].every(i=>!i.getBoundingClientRect().width||!i.getBoundingClientRect().height||i.complete),null,{timeout:10000}).catch(error=>{if(error.name!=='TimeoutError')throw error;});
    const missing=await page.evaluate(()=>[...document.images].filter(i=>i.getBoundingClientRect().width&&i.getBoundingClientRect().height&&(!i.complete||!i.naturalWidth)).length);
    if(missing)throw Error('Page overview contains unloaded images.');
    bundle.status='captured';
    if(!completePageSurfaces({captureMode:'page-surfaces',pageSurfaces:bundle}))throw Error('Page surface inventory or interval coverage changed: '+JSON.stringify({before:bundle.discovered,after:bundle.finalDiscovered}));
    return bundle;
  } catch(error){error.pageSurfaces=bundle;throw error;} finally {await restore();}
}

export async function verifyPageSurfaces(page,bundle) {
  const inventory=(await page.evaluate(discoverPageSurfaces)).map(({left,top,...item})=>item);
  if(JSON.stringify(inventory)!==JSON.stringify(bundle.discovered))throw Error('Page surface inventory changed during overview capture.');
  for(const surface of bundle.surfaces){const text=await page.locator(surface.selector).textContent();if(createHash('sha256').update(text).digest('hex')!==surface.contentHash)throw Error('Page surface content changed during overview capture.');}
}
