import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectVideo,reviewVideo,validateManifest,technicalChecks,runVideoReview,videoExitCode} from '../skills/review-video/scripts/video-review.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSAAAAABJRU5ErkJggg==','base64');
const probe={streams:[{codec_type:'video',codec_name:'h264',width:1920,height:1080,r_frame_rate:'60/1',sample_aspect_ratio:'1:1'},{codec_type:'audio',codec_name:'aac'}],format:{duration:'2.005'}};
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'hh-video-review-'));t.after(()=>rm(root,{recursive:true,force:true}));
 for(const phase of ['before','after']){await mkdir(join(root,phase));await writeFile(join(root,phase,'source.js'),phase);await writeFile(join(root,phase,'video.mp4'),'controlled-'+phase);}
 const manifest={version:1,project:{name:'Fixture',audience:'Fixture reviewers',channel:'Controlled test',message:'Test gates, not media quality',action:'Inspect evidence',editorId:'fixture-editor'},constraints:{width:1920,height:1080,fps:60,durationSeconds:2,audio:'sfx-only'},before:{video:'before/video.mp4',sourceRoot:'before',sourceFiles:['source.js'],provenance:'Controlled fixture original'},after:{video:'after/video.mp4',sourceRoot:'after',sourceFiles:['source.js'],provenance:'Controlled fixture candidate'},segments:[{id:'opening',start:0,end:1,purpose:'Fixture one'},{id:'ending',start:1,end:2,purpose:'Fixture two'}]};
 const manifestPath=join(root,'project.json');await writeFile(manifestPath,JSON.stringify(manifest));const out=join(root,'evidence');
 const runTool=async(binary,args)=>{
  if(args[0]==='-version')return binary+' controlled fixture version';if(binary==='ffprobe')return JSON.stringify(probe);
  if(args.at(-1).endsWith('.png'))await writeFile(args.at(-1),png);
  // Reproduce compositor builds that omit null's default wrapped_avframe encoder.
  if(args.at(-1)==='-'&&!['rawvideo','png','libx264'].includes(args[args.indexOf('-c:v')+1]))throw Error('Controlled stripped decoder requires an explicit available video encoder');
  return args.at(-1)==='-'?'frame=120\nprogress=end\n':'';
 };
 return {root,manifest,manifestPath,out,runTool};
}
async function reportFor(f){
 const evidence=JSON.parse(await readFile(join(f.out,'evidence.json'))),report=JSON.parse(await readFile(join(f.out,'review-template.json')));
 report.reviewer={id:'fixture-independent-reviewer',independent:true};report.playback={before:{watched:[{start:0,end:2}],listened:[{start:0,end:2}]},after:{watched:[{start:0,end:2}],listened:[{start:0,end:2}]}};
 report.segments=report.segments.map(x=>({...x,status:'pass',reason:'Controlled fixture does not establish actual media quality.'}));
 report.rules=report.rules.map(x=>({...x,status:'preserved',reason:'Controlled fixture inspected the frozen inputs, not real quality.',ranges:[{start:0,end:2}],beforeRefs:[evidence.versions.before.frames[0].path],afterRefs:[evidence.versions.after.frames[0].path]}));report.verdict='pass';report.limitations=['Synthetic data-flow verification only.'];return report;
}
async function submit(f,report){const path=join(f.root,'review-'+Math.random()+'.json');await writeFile(path,JSON.stringify(report));return reviewVideo({directory:f.out,reportPath:path});}
test('video collection preserves declared inputs, original frames and source hashes in a fresh directory',async t=>{
 const f=await fixture(t),collected=await collectVideo({...f});assert.equal(collected.humanJudgment,'pending');assert.equal(collected.independentReview,'pending');
 assert.equal(collected.technical.after.status,'pass');assert.equal(collected.technical.after.decode,'pass');assert.equal(collected.technical.after.audioContent,'needs-independent-listening');
 const evidence=JSON.parse(await readFile(join(f.out,'evidence.json')));assert.ok(evidence.versions.after.frames.some(x=>x.time===0.983));assert.ok(evidence.versions.after.frames.some(x=>x.time===1));assert.equal((await readFile(join(f.out,'before/source/source.js'))).toString(),'before');
 await assert.rejects(collectVideo({...f}),/EEXIST/);const result=await submit(f,await reportFor(f));assert.equal(result.status,'pass');assert.equal(result.humanJudgment,'pending');assert.ok((await readFile(join(f.out,result.reviewPath))).length);
});
test('self-review, gaps, absent listening, missing rules and missing frame evidence cannot pass',async t=>{
 const f=await fixture(t);await collectVideo({...f});const base=await reportFor(f);
 for(const change of [r=>r.reviewer.id='fixture-editor',r=>r.playback.after.watched=[{start:0,end:0.9},{start:1,end:2}],r=>r.playback.before.listened=[],r=>r.rules.pop(),r=>r.rules[0].afterRefs=[],r=>r.segments[0].status='needs-evidence',r=>r.rules[0].ranges=[{start:1,end:2}]]){const r=structuredClone(base);change(r);await assert.rejects(submit(f,r));}
 const incomplete=structuredClone(base);incomplete.verdict='needs-evidence';incomplete.playback.after.listened=[];incomplete.rules[0].status='needs-evidence';assert.equal((await submit(f,incomplete)).status,'needs-evidence');
});
test('fixed claims require changed declared source and media, and snapshot tampering is rejected',async t=>{
 const f=await fixture(t);await collectVideo({...f});const report=await reportFor(f);report.rules[0].status='fixed';report.rules[0].changedFiles=['unknown.js'];await assert.rejects(submit(f,report),/changed declared source/);report.rules[0].changedFiles=['source.js'];assert.equal((await submit(f,report)).status,'pass');
 await writeFile(join(f.out,'after/source/source.js'),'other');await assert.rejects(submit(f,report),/Frozen video evidence changed/);
});
test('source traversal and symlinks are refused; technical failures stay distinct from editorial acceptance',async t=>{
 const f=await fixture(t);f.manifest.before.sourceFiles=['../after/source.js'];await writeFile(f.manifestPath,JSON.stringify(f.manifest));await assert.rejects(collectVideo({...f}),/relative regular/);assert.equal(JSON.parse(await readFile(join(f.out,'collection-failed.json'))).status,'failed');
 await rm(f.out,{recursive:true});f.manifest.before.sourceFiles=['linked.js'];await symlink(join(f.root,'before/source.js'),join(f.root,'before/linked.js'));await writeFile(f.manifestPath,JSON.stringify(f.manifest));await assert.rejects(collectVideo({...f}),/symbolic links/);
 const checks=technicalChecks({...probe,format:{duration:'9'},streams:[{...probe.streams[0],width:1200}]},f.manifest.constraints);assert.equal(checks.status,'fail');assert.equal(checks.checks.audio,false);
 const bad=structuredClone(f.manifest);bad.segments[1].start=1.1;assert.throws(()=>validateManifest(bad),/complete timeline/);
});
test('a failed complete decode cannot be promoted by an independent pass declaration',async t=>{
 const f=await fixture(t),original=f.runTool;f.runTool=async(binary,args)=>{if(binary==='ffmpeg'&&args.at(-1)==='-')throw Error('Controlled decode failure');return original(binary,args);};const result=await collectVideo({...f});assert.equal(result.technical.after.status,'fail');assert.equal(result.technical.after.decode,'fail');await assert.rejects(submit(f,await reportFor(f)),/Failed or missing technical/);
});
test('recoverable decoder errors stop collection from passing and retain partial diagnostics',async t=>{
 const f=await fixture(t),original=f.runTool;
 f.runTool=async(binary,args)=>{if(binary==='ffmpeg'&&args.at(-1)==='-'){
  // Without -xerror FFmpeg can recover, exit zero and lose one frame within the count tolerance.
  if(!args.includes('-xerror'))return 'frame=119\nprogress=end\n';
  throw Object.assign(Error('Controlled corrupt NAL'),{stderr:'Invalid NAL unit size; Error submitting packet to decoder',stdout:'frame=35\nprogress=continue\n'});
 }return original(binary,args);};
 const result=await collectVideo({...f});assert.equal(result.technical.before.decode,'fail');assert.equal(result.technical.after.decode,'fail');assert.equal(videoExitCode(result),2);
 assert.match(await readFile(join(f.out,'before/decode-error.txt'),'utf8'),/Invalid NAL/);assert.match(await readFile(join(f.out,'before/decode-partial-progress.txt'),'utf8'),/frame=35/);
 await assert.rejects(submit(f,await reportFor(f)),/Failed or missing technical/);
});
test('a valid candidate cannot hide a technically invalid original from collection or independent review',async t=>{
 const f=await fixture(t),original=f.runTool;
 f.runTool=async(binary,args)=>binary==='ffprobe'&&args.at(-1).includes('/before/')?JSON.stringify({...probe,streams:[{...probe.streams[0],width:1280},probe.streams[1]]}):original(binary,args);
 const result=await collectVideo({...f});assert.equal(result.technical.before.status,'fail');assert.equal(result.technical.before.decode,'pass');assert.equal(result.technical.after.status,'pass');assert.equal(result.technical.after.decode,'pass');assert.equal(videoExitCode(result),2);
 await assert.rejects(submit(f,await reportFor(f)),/Failed or missing technical/);
});
test('the reusable video entry routes help and rejects unknown or duplicate options',async()=>{
 assert.equal(videoExitCode(await runVideoReview(['help'])),0);
 await assert.rejects(runVideoReview(['collect','--manifest','x','--out','y','--typo','z']),/Usage/);
 await assert.rejects(runVideoReview(['review','--run','x','--run','y']),/unique/);
 assert.equal(videoExitCode({status:'needs-evidence'}),2);
 assert.equal(videoExitCode({status:'collected',technical:{after:{status:'fail'}}}),2);
 const technical={before:{status:'pass',decode:'pass'},after:{status:'pass',decode:'pass'}};
 assert.equal(videoExitCode({status:'collected',technical}),0);
 for(const phase of ['before','after'])for(const key of ['status','decode']){const value=structuredClone(technical);value[phase][key]='fail';assert.equal(videoExitCode({status:'collected',technical:value}),2);}
});
test('declared cover and editable delivery are frozen and need explicit independent artifact review',async t=>{
 const f=await fixture(t);await writeFile(join(f.root,'cover.png'),png);await writeFile(join(f.root,'source.zip'),Buffer.from('UEsDBBQAAAAIAFxkbF1BTkSJBwAAAAUAAAAJAAAAc291cmNlLmpzS0wrSS0CAFBLAQIUAxQAAAAIAFxkbF1BTkSJBwAAAAUAAAAJAAAAAAAAAAAAAACAAQAAAABzb3VyY2UuanNQSwUGAAAAAAEAAQA3AAAALgAAAAAA','base64'));
 f.manifest.deliverables={cover:'cover.png',editableSource:'source.zip'};await writeFile(f.manifestPath,JSON.stringify(f.manifest));await collectVideo({...f});
 const report=await reportFor(f);await assert.rejects(submit(f,report),/explicit independent artifact review/);
 report.rules.find(x=>x.id==='V-cover').artifactRefs=['deliverables/cover.png'];report.rules.find(x=>x.id==='V-export').artifactRefs=['deliverables/editable-source.zip'];assert.equal((await submit(f,report)).status,'pass');
 report.rules.find(x=>x.id==='V-cover').status='not-applicable';await assert.rejects(submit(f,report),/explicit independent artifact review/);
});
