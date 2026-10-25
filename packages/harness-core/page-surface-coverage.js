export function tileOffsets(size,visible) {
  if(!Number.isSafeInteger(size)||!Number.isSafeInteger(visible)||visible<40||size<visible||size>100000)throw Error('Surface dimensions exceed bounded capture limits.');
  const end=size-visible,step=Math.max(1,visible-Math.min(100,Math.floor(visible/3))),values=[];
  for(let n=0;n<end-2;n+=step){if(values.length>=99)throw Error('Surface exceeds 100 intervals.');values.push(n);}
  return [...values,end];
}
export function completePageSurfaces(entry) {
  const bundle=entry.pageSurfaces;
  if(entry.captureMode!=='page-surfaces'||!bundle||bundle.version!==1||bundle.status!=='captured'||!Array.isArray(bundle.discovered)||!Array.isArray(bundle.finalDiscovered)||!Array.isArray(bundle.surfaces)||bundle.surfaces.length>32||JSON.stringify(bundle.discovered)!==JSON.stringify(bundle.finalDiscovered))return false;
  if(bundle.surfaces.length!==bundle.discovered?.length)return false;
  let total=0;const paths=new Set(),selectors=new Set();
  try{for(let i=0;i<bundle.surfaces.length;i++){
    const surface=bundle.surfaces[i],declared=bundle.discovered[i];
    if(surface.selector!==declared.selector||! /^[a-f0-9]{64}$/.test(surface.contentHash)||surface.contentHash!==surface.finalContentHash)return false;
    if(typeof surface.selector!=='string'||!surface.selector||selectors.has(surface.selector))return false;selectors.add(surface.selector);
    const xs=tileOffsets(declared.width,declared.clientWidth),ys=tileOffsets(declared.height,declared.clientHeight);
    if(surface.tiles.length!==xs.length*ys.length)return false;
    const covered=new Set();
    for(const tile of surface.tiles){
      if(++total>200||!tile.screenshot||paths.has(tile.screenshot)||!tile.visible||tile.unloadedImages!==0||tile.width!==declared.clientWidth||tile.height!==declared.clientHeight)return false;
      const x=xs.findIndex(v=>Math.abs(v-tile.left)<=2),y=ys.findIndex(v=>Math.abs(v-tile.top)<=2);
      if(x<0||y<0||covered.has(`${x}:${y}`))return false;
      covered.add(`${x}:${y}`);paths.add(tile.screenshot);
    }
  }}catch{return false;}
  return true;
}
