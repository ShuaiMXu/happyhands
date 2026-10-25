import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceOffsets,assertSurfaceMeasurement,scrollSurfaceCoverage} from '../packages/harness-core/scroll-surface.js';
import {reviewCandidates,confirmedReviewPlan} from '../packages/harness-core/review-discovery.js';
import {assertCapturePlan} from '../packages/harness-core/capture-state.js';
const surface={selector:'#scroll',top:0,scrollHeight:2200,clientHeight:800,clientWidth:390};
const url='http://127.0.0.1:5000/',configurations=[{id:'mobile',viewport:{width:390,height:800}}];
test('scroll discovery creates explicit overlapping segments through the exact end, not a whole-page substitute',()=>{
 assert.deepEqual(surfaceOffsets(surface),[0,700,1400]);
 const p={...reviewCandidates([{url,configurationId:'mobile',scrollSurfaces:[surface]}],url),url,configurations};
 const segments=p.candidates.filter(c=>c.kind==='scroll-surface');assert.equal(segments.length,3);
 const plan=confirmedReviewPlan(p,segments.map(c=>c.id));assert.equal(plan.states.length,4);assertCapturePlan(plan);
 assert.equal(plan.states.filter(s=>s.captureMode==='full-page').length,1);assert.ok(p.gaps.length);
 assert.throws(()=>assertCapturePlan({...plan,states:[{...segments[0].state,captureMode:'full-page'}]}),/viewport/);
 assert.throws(()=>assertCapturePlan({...plan,states:[{...segments[0].state,scrollSurface:{...surface,top:1500}}]}),/offset/);
});
test('failed intervals and inconsistent dimensions cannot be aggregated as captured; actions do not fill layout gaps',()=>{
 const entries=surfaceOffsets(surface).map((top,i)=>({start:{url},configurationId:'mobile',actions:[],reached:true,screenshot:'before/'+i+'.png',plannedScrollSurface:{...surface,top},scrollSurface:{...surface,top,visible:true,left:0,scrollWidth:390,overflowY:'auto',unloadedImages:[],status:'observed-segment'}}));
 assert.equal(scrollSurfaceCoverage(entries)[0].status,'planned-intervals-captured');
 const failed=structuredClone(entries);failed[1].reached=false;
 assert.equal(scrollSurfaceCoverage(failed)[0].status,'needs-evidence');assert.deepEqual(scrollSurfaceCoverage(failed)[0].missing,[{start:800,end:1400}]);
 failed[1]={...entries[1],actions:[{type:'click-selector',selector:'#tab'}]};assert.equal(scrollSurfaceCoverage(failed)[0].status,'needs-evidence');
 const drift=structuredClone(entries);drift[1].plannedScrollSurface.clientWidth=400;assert.equal(scrollSurfaceCoverage(drift)[0].inconsistent,true);
});
test('unstable, clipped, horizontal, unloaded and wrong-offset surface evidence is rejected',()=>{
 const good={...surface,visible:true,overflowY:'auto',left:0,scrollWidth:390,unloadedImages:[]};
 assert.doesNotThrow(()=>assertSurfaceMeasurement(good,surface));
 for(const change of [{visible:false},{scrollWidth:400},{scrollHeight:2300},{top:10},{unloadedImages:['missing.png']},{overflowY:'hidden'}])assert.throws(()=>assertSurfaceMeasurement({...good,...change},surface));
 assert.throws(()=>surfaceOffsets({...surface,scrollHeight:100001}),/bounded/);
 assert.throws(()=>surfaceOffsets({...surface,scrollHeight:100000,clientHeight:101}),/100 segments/);
});
