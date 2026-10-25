import test from 'node:test';import assert from 'node:assert/strict';
import {captureRouteKey,isWholePageCapture,wholePageReviewCoverage,pngDimensions} from '../packages/harness-core/whole-page.js';
const whole=(phase,route='/',config='mobile')=>({stateId:'overview',configurationId:config,start:{url:`http://${phase==='before'?'127.0.0.1:4321':'localhost:4322'}${route}`},actions:[],captureMode:'full-page',width:390,height:844,documentSize:{width:390,height:5000},screenshotSize:{width:390,height:5000},reached:true,screenshot:`${phase}/overview--${config}.png`});
test('only complete original default-state overviews count as whole-page context',()=>{
 const entry=whole('before');assert.equal(isWholePageCapture(entry),true);
 for(const invalid of [{...entry,captureMode:'viewport'},{...entry,screenshotSize:{width:390,height:844}},{...entry,actions:[{type:'click'}]},{...entry,region:{}},{...entry,reached:false},{...entry,documentSize:null}])assert.equal(isWholePageCapture(invalid),false);
 assert.equal(captureRouteKey({...entry,finalUrl:'http://user:secret@localhost/'}),null);
});
test('whole-page context matches loopback ports while keeping routes, devices and phases distinct',()=>{
 const manifest={captures:{before:{states:[whole('before')]},after:{states:[whole('after')]}}};assert.equal(wholePageReviewCoverage(manifest).ready,true);
 manifest.captures.after.states.push({...whole('after','/settings'),stateId:'settings'});const coverage=wholePageReviewCoverage(manifest);assert.equal(coverage.ready,false);assert.equal(coverage.expectedContexts,4);assert.deepEqual(coverage.missingContexts,['before:local-preview/settings:mobile']);
});
test('bootstrap needs only rendered overviews, failed after states still block whole-page QA',()=>{
 const manifest={baseline:{status:'absent'},captures:{before:null,after:{states:[whole('after')]}}};assert.equal(wholePageReviewCoverage(manifest).ready,true);
 manifest.captures.after.states.push({...whole('after'),stateId:'menu',captureMode:'viewport',reached:false,screenshot:null});assert.equal(wholePageReviewCoverage(manifest).ready,false);assert.deepEqual(wholePageReviewCoverage(manifest).missingStates,['menu--mobile']);
});
test('too many overviews never silently drop routes to fit one independent session',()=>{
 const states=Array.from({length:13},(_,i)=>whole('after',`/page${i}`));const before=states.map((entry,i)=>whole('before',`/page${i}`));const coverage=wholePageReviewCoverage({captures:{before:{states:before},after:{states}}});assert.equal(coverage.exceeded,true);assert.equal(coverage.ready,false);assert.equal(coverage.selected.length,0);assert.equal(coverage.coveredContexts,26);
});
test('five routes on two devices fit the actual 24-image review contract in both phases',()=>{
 const states=phase=>Array.from({length:5},(_,i)=>['desktop','mobile'].map(config=>({...whole(phase,`/page${i}`,config),stateId:`page${i}`}))).flat();
 const manifest={captures:{before:{states:states('before')},after:{states:states('after')}}};
 const coverage=wholePageReviewCoverage(manifest);
 assert.equal(coverage.ready,true);assert.equal(coverage.expectedContexts,20);assert.equal(coverage.selected.length,20);
 assert.equal(wholePageReviewCoverage(manifest,12).exceeded,true);
});
test('PNG dimensions are read from originals and malformed headers fail closed',()=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');assert.deepEqual(pngDimensions(png),{width:1,height:1});assert.throws(()=>pngDimensions(Buffer.from('not-png')),/Invalid PNG/);
});
