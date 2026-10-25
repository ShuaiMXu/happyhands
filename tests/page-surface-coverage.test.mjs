import test from 'node:test';
import assert from 'node:assert/strict';
import {tileOffsets,completePageSurfaces} from '../packages/harness-core/page-surface-coverage.js';
import {captureOriginals} from '../packages/harness-core/capture-state.js';
import {wholePageReviewCoverage,isWholePageCapture} from '../packages/harness-core/whole-page.js';
const entry=(phase='after')=>{
 const declared={selector:'#scroll',width:600,height:455,clientWidth:300,clientHeight:200};
 const tiles=tileOffsets(455,200).flatMap((top,y)=>tileOffsets(600,300).map((left,x)=>({left,top,width:300,height:200,visible:true,unloadedImages:0,screenshot:`${phase}/surface-${'a'.repeat(24)}-${y*3+x+1}.png`})));
 return {stateId:'overview',configurationId:'mobile',start:{url:'http://localhost/'},captureMode:'page-surfaces',actions:[],width:390,height:844,reached:true,screenshot:`${phase}/overview--mobile.png`,documentSize:{width:390,height:1200},screenshotSize:{width:390,height:1200},pageSurfaces:{version:1,status:'captured',discovered:[declared],finalDiscovered:[declared],surfaces:[{selector:'#scroll',contentHash:'b'.repeat(64),finalContentHash:'b'.repeat(64),tiles}]}};
};
test('interval grid includes both axes and avoids overlapping tolerance at final edge',()=>{
 assert.deepEqual(tileOffsets(135,80),[0,55]);
 const e=entry();assert.equal(completePageSurfaces(e),true);assert.equal(isWholePageCapture(e),false);
 assert.equal(captureOriginals({states:[e]}).length,1+e.pageSurfaces.surfaces[0].tiles.length);
 assert.equal(wholePageReviewCoverage({captures:{before:{states:[entry('before')]},after:{states:[e]}}}).ready,true);
});
test('incomplete, duplicated, changed, occluded and unloaded surface grids fail closed',()=>{
 for(const mutate of [e=>e.pageSurfaces.surfaces[0].tiles.pop(),e=>e.pageSurfaces.surfaces[0].tiles[1]={...e.pageSurfaces.surfaces[0].tiles[0]},e=>e.pageSurfaces.surfaces[0].finalContentHash='changed',e=>e.pageSurfaces.surfaces[0].tiles[0].visible=false,e=>e.pageSurfaces.surfaces[0].tiles[0].unloadedImages=1,e=>e.pageSurfaces.finalDiscovered=[],e=>e.pageSurfaces.status='capturing']){const e=entry();mutate(e);assert.equal(completePageSurfaces(e),false);}
});
test('32 contexts require explicit external capacity and never relax automatic 24-image limit',()=>{
 const states=phase=>Array.from({length:16},(_,i)=>({...entry(phase),stateId:`overview-${i}`,start:{url:`http://localhost/page-${i}`}}));const manifest={captures:{before:{states:states('before')},after:{states:states('after')}}};
 assert.equal(wholePageReviewCoverage(manifest).exceeded,true);assert.equal(wholePageReviewCoverage(manifest,128).ready,true);
});

test('variable interaction parts preserve semantic state identity without certifying whole-page coverage',()=>{
 const before={...entry('before'),captureMode:'viewport',pageSurfaces:undefined,interactionParts:[{screenshot:'before/part-'+ 'c'.repeat(24)+'-1.png'},{screenshot:'before/part-'+ 'c'.repeat(24)+'-2.png'}]};
 const after={...entry(),captureMode:'viewport',pageSurfaces:undefined,interactionParts:[{screenshot:'after/part-'+ 'c'.repeat(24)+'-1.png'}]};
 const coverage=wholePageReviewCoverage({captures:{before:{states:[before]},after:{states:[after]}}});assert.deepEqual(coverage.missingStates,[]);assert.equal(coverage.ready,false);assert.equal(captureOriginals({states:[before]}).length,3);
});
