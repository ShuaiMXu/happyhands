#!/usr/bin/env node
import {readFile,writeFile,mkdir,lstat,realpath,access} from 'node:fs/promises';
import {resolve,join,dirname,basename,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execute=promisify(execFile), hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const text=value=>typeof value==='string'&&value.trim().length>0;
const safeId=value=>typeof value==='string'&&/^[a-z][a-z0-9-]{0,47}$/.test(value);
const statuses=new Set(['fixed','preserved','fail','needs-evidence','not-applicable']);
const ruleSource=new URL('../rules.json',import.meta.url);

async function regular(root,path,maxBytes=512*1024*1024){
 if(!text(path)||path.includes('\\')||isAbsolute(path)||path.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Expected a relative regular-file path.');
 let current=await realpath(root);
 for(const part of path.split('/')){current=join(current,part);if((await lstat(current)).isSymbolicLink())throw Error('Evidence sources cannot use symbolic links.');}
 const stat=await lstat(current);if(!stat.isFile()||stat.size>maxBytes)throw Error('Evidence source is missing or exceeds its size limit.');return readFile(current);
}
export function validateManifest(value){
 if(value?.version!==1)throw Error('Video manifest version must be 1.');
 for(const key of ['name','audience','channel','message','action','editorId'])if(!text(value.project?.[key]))throw Error('Missing project '+key+'.');
 const c=value.constraints;
 if(!c||![c.width,c.height].every(n=>Number.isInteger(n)&&n>=16&&n<=7680)||!Number.isFinite(c.fps)||c.fps<1||c.fps>120||!Number.isFinite(c.durationSeconds)||c.durationSeconds<=0||c.durationSeconds>120||!['sfx-only','silent','mixed'].includes(c.audio))throw Error('Invalid short-video delivery constraints.');
 for(const phase of ['before','after']){
  const source=value[phase];if(!source||!text(source.video)||!text(source.sourceRoot)||!text(source.provenance)||!Array.isArray(source.sourceFiles)||!source.sourceFiles.length||source.sourceFiles.length>1024||new Set(source.sourceFiles).size!==source.sourceFiles.length)throw Error('Missing unique declared '+phase+' inputs and provenance.');
 }
 if(!Array.isArray(value.segments)||!value.segments.length||value.segments.length>32)throw Error('Expected 1–32 purposeful segments.');
 let end=0;const ids=new Set();
 for(const s of value.segments){if(!safeId(s.id)||ids.has(s.id)||!text(s.purpose)||!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start!==end||s.end<=s.start||s.end>c.durationSeconds)throw Error('Segments must uniquely cover the complete timeline without gaps.');ids.add(s.id);end=s.end;}
 if(Math.abs(end-c.durationSeconds)>0.000001)throw Error('Segments do not reach the complete timeline end.');return value;
}
function frameTimes(manifest){
 const {durationSeconds,fps}=manifest.constraints,last=durationSeconds-1/fps;
 const values=[0,last,...Array.from({length:Math.floor(durationSeconds)},(_,i)=>i),...manifest.segments.flatMap(s=>[s.start-1/fps,s.start,s.end-1/fps,s.end])];
 return [...new Set(values.filter(t=>t>=0&&t<=last).map(t=>Number(t.toFixed(3))))].sort((a,b)=>a-b);
}
async function tool(binary,args){
 const env={...process.env};
 if(process.platform==='darwin'){try{await access(join(dirname(binary),'libavcodec.dylib'));env.DYLD_LIBRARY_PATH=dirname(binary)+(env.DYLD_LIBRARY_PATH?':'+env.DYLD_LIBRARY_PATH:'');}catch{}}
 const result=await execute(binary,args,{env,timeout:180000,maxBuffer:2*1024*1024});
 if(args.includes('-xerror')&&result.stderr.trim())throw Object.assign(Error('Complete decode reported errors.'),{stderr:result.stderr,stdout:result.stdout});
 return result.stdout;
}
export function technicalChecks(probe,constraints){
 const videos=(probe.streams||[]).filter(s=>s.codec_type==='video'),audios=(probe.streams||[]).filter(s=>s.codec_type==='audio'),stream=videos[0];
 const fraction=String(stream?.r_frame_rate||'0/1').split('/').map(Number),fps=fraction[1]?fraction[0]/fraction[1]:0,duration=Number(probe.format?.duration);
 const checks={singleVideo:videos.length===1,width:stream?.width===constraints.width,height:stream?.height===constraints.height,squarePixels:stream?.sample_aspect_ratio==='1:1',frameRate:Math.abs(fps-constraints.fps)<0.001,duration:Number.isFinite(duration)&&Math.abs(duration-constraints.durationSeconds)<=Math.max(0.05,1/constraints.fps),audio:constraints.audio==='silent'?audios.length===0:audios.length===1};
 return {status:Object.values(checks).every(Boolean)?'pass':'fail',checks,measured:{duration,fps,audioStreams:audios.length},audioContent:constraints.audio==='silent'?'not-applicable':'needs-independent-listening'};
}
async function freeze(root,path,bytes,artifacts,extra={}){await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),bytes,{flag:'wx'});const row={path,sha256:hash(bytes),bytes:bytes.length,...extra};artifacts.push(row);return row;}
export async function collectVideo({manifestPath,out,ffmpeg='ffmpeg',ffprobe='ffprobe',runTool=tool}){
 const absoluteManifest=resolve(manifestPath),raw=await regular(dirname(absoluteManifest),basename(absoluteManifest),4*1024*1024),manifest=validateManifest(JSON.parse(raw));
 await mkdir(out,{recursive:false});const artifacts=[];
 try{
  await freeze(out,'manifest.json',raw,artifacts);const rules=JSON.parse(await readFile(ruleSource));await freeze(out,'rules.json',Buffer.from(json(rules)),artifacts);
  for(const [path,url] of [['method/SKILL.md',new URL('../SKILL.md',import.meta.url)],['method/evidence-contract.md',new URL('../references/evidence-contract.md',import.meta.url)],['method/video-review.mjs',new URL(import.meta.url)]])await freeze(out,path,await readFile(url),artifacts);
  const tools={ffmpeg:{requested:ffmpeg,version:await runTool(ffmpeg,['-version'])},ffprobe:{requested:ffprobe,version:await runTool(ffprobe,['-version'])}};
  await freeze(out,'tools.json',Buffer.from(json(tools)),artifacts);
  const versions={},deliverables={};const base=dirname(resolve(manifestPath));
  if(manifest.deliverables){
   if(typeof manifest.deliverables!=='object'||Array.isArray(manifest.deliverables)||Object.keys(manifest.deliverables).some(key=>!['cover','editableSource'].includes(key)))throw Error('Only cover and editableSource deliverables are supported.');
   for(const [kind,input] of Object.entries(manifest.deliverables)){
    if(!text(input))throw Error('Deliverable paths must be explicit.');const source=resolve(base,input),bytes=await regular(dirname(source),basename(source),kind==='cover'?32*1024*1024:256*1024*1024);
    if(kind==='cover'&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('The cover deliverable must be an actual PNG.');
    if(kind==='editableSource'&&(bytes.length<32||!bytes.subarray(0,4).equals(Buffer.from([80,75,3,4]))))throw Error('The editable source deliverable must be a non-empty ZIP.');
    const path=kind==='cover'?'deliverables/cover.png':'deliverables/editable-source.zip';deliverables[kind]=await freeze(out,path,bytes,artifacts);
   }
  }
  for(const phase of ['before','after']){
   const spec=manifest[phase],sourceRoot=resolve(base,spec.sourceRoot),video=resolve(base,spec.video);const videoRoot=dirname(video),videoName=video.slice(videoRoot.length+1);const bytes=await regular(videoRoot,videoName);
   await freeze(out,phase+'/video.mp4',bytes,artifacts);
   let size=0;const sources=[];
   for(const file of spec.sourceFiles){const content=await regular(sourceRoot,file,64*1024*1024);size+=content.length;if(size>256*1024*1024)throw Error('Declared source snapshots exceed 256 MiB.');const row=await freeze(out,phase+'/source/'+file,content,artifacts);sources.push({file,sha256:row.sha256});}
   const probe=JSON.parse(await runTool(ffprobe,['-v','error','-show_streams','-show_format','-of','json',join(out,phase,'video.mp4')]));
   await freeze(out,phase+'/probe.json',Buffer.from(json(probe)),artifacts);const technical=technicalChecks(probe,manifest.constraints);
   try{
    const progress=await runTool(ffmpeg,['-nostdin','-v','error','-xerror','-i',join(out,phase,'video.mp4'),'-map','0:v:0','-map','0:a?','-c:v','rawvideo','-c:a','pcm_s16le','-progress','pipe:1','-nostats','-f','null','-']);
    await freeze(out,phase+'/decode-progress.txt',Buffer.from(progress),artifacts);
    const frames=[...progress.matchAll(/^frame=\s*(\d+)\s*$/gm)].at(-1);technical.decodedFrames=frames?Number(frames[1]):null;
    if(technical.decodedFrames===null||Math.abs(technical.decodedFrames-manifest.constraints.durationSeconds*manifest.constraints.fps)>1)throw Error('Complete decode frame count does not match the requested duration and frame rate.');
    technical.decode='pass';
   }catch(error){technical.decode='fail';technical.status='fail';await freeze(out,phase+'/decode-error.txt',Buffer.from(String(error.stderr||error.message)),artifacts);if(error.stdout)await freeze(out,phase+'/decode-partial-progress.txt',Buffer.from(String(error.stdout)),artifacts);}
   const frames=[];
   for(const time of frameTimes(manifest)){const path=phase+'/frames/'+time.toFixed(3)+'.png';await mkdir(dirname(join(out,path)),{recursive:true});await runTool(ffmpeg,['-nostdin','-v','error','-n','-ss',String(time),'-i',join(out,phase,'video.mp4'),'-frames:v','1',join(out,path)]);const image=await regular(out,path,32*1024*1024);if(!image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Extracted frame is not an original PNG.');const row={path,sha256:hash(image),bytes:image.length,time};artifacts.push(row);frames.push(row);}
   versions[phase]={videoHash:hash(bytes),sources,technical,frames};
  }
  const evidence={version:1,createdAt:new Date().toISOString(),manifest,versions,deliverables,artifacts};const encoded=json(evidence),digest=hash(encoded);await writeFile(join(out,'evidence.json'),encoded,{flag:'wx'});await writeFile(join(out,'evidence.sha256'),digest+'\n',{flag:'wx'});
  const review={version:1,evidenceDigest:digest,reviewer:{id:'',independent:false},playback:{before:{watched:[],listened:[]},after:{watched:[],listened:[]}},segments:manifest.segments.map(s=>({id:s.id,status:'needs-evidence',reason:''})),rules:rules.rules.map(r=>({id:r.id,status:'needs-evidence',reason:'',ranges:[],beforeRefs:[],afterRefs:[],artifactRefs:[],changedFiles:[]})),verdict:'needs-evidence',limitations:['Complete independent playback and listening are still required.']};
  await writeFile(join(out,'review-template.json'),json(review),{flag:'wx'});return {status:'collected',directory:out,evidenceDigest:digest,technical:{before:versions.before.technical,after:versions.after.technical},independentReview:'pending',humanJudgment:'pending'};
 }catch(error){await writeFile(join(out,'collection-failed.json'),json({status:'failed',message:error.message}));throw error;}
}
function covers(ranges,duration){
 if(!Array.isArray(ranges)||!ranges.length)return false;let end=0;
 for(const r of [...ranges].sort((a,b)=>a.start-b.start)){if(!Number.isFinite(r.start)||!Number.isFinite(r.end)||r.start<0||r.end<=r.start||r.end>duration+0.05||r.start>end+0.001)return false;end=Math.max(end,r.end);}return end>=duration;
}
function exact(items,ids){if(!Array.isArray(items)||items.length!==ids.length||new Set(items.map(x=>x.id)).size!==ids.length||items.some(x=>!ids.includes(x.id)))throw Error('Review inventory must contain exactly every declared rule and segment.');}
const completeTechnicalPass=technical=>technical?.status==='pass'&&technical?.decode==='pass';
export function validateVideoReview(report,evidence,digest){
 const {manifest,versions,artifacts}=evidence,rules=evidence.artifacts.find(x=>x.path==='rules.json');
 if(report?.version!==1||report.evidenceDigest!==digest||!text(report.reviewer?.id)||report.reviewer.id===manifest.project.editorId||report.reviewer.independent!==true)throw Error('Independent review identity and exact evidence binding are required.');
 if(!['pass','fail','needs-evidence'].includes(report.verdict)||!Array.isArray(report.limitations)||report.limitations.some(x=>!text(x)))throw Error('Invalid review verdict or limitations.');
 const inventory=evidence.ruleIds;if(!inventory?.length||!rules)throw Error('Frozen rule inventory missing.');exact(report.rules,inventory);exact(report.segments,manifest.segments.map(s=>s.id));
 const duration=manifest.constraints.durationSeconds,artifactMap=new Map(artifacts.map(a=>[a.path,a])),changed=new Set(versions.after.sources.filter(s=>!versions.before.sources.some(b=>b.file===s.file&&b.sha256===s.sha256)).map(s=>s.file));
 for(const segment of report.segments)if(!['pass','fail','needs-evidence'].includes(segment.status)||!text(segment.reason))throw Error('Every segment requires an observed conclusion.');
 for(const row of report.rules){
  if(!statuses.has(row.status)||!text(row.reason)||row.reason.length<8||!Array.isArray(row.ranges)||!row.ranges.length||row.ranges.some(r=>!Number.isFinite(r.start)||!Number.isFinite(r.end)||r.start<0||r.end<=r.start||r.end>duration+0.05))throw Error('Every rule needs a reason and actual time ranges.');
  for(const phase of ['before','after']){const refs=row[phase+'Refs'];if(!Array.isArray(refs)||!refs.length||refs.some(ref=>!ref.startsWith(phase+'/frames/')||!artifactMap.has(ref)||!row.ranges.some(r=>artifactMap.get(ref).time>=r.start-1/manifest.constraints.fps&&artifactMap.get(ref).time<=r.end+1/manifest.constraints.fps)))throw Error('Every rule must cite bound original frames within its ranges.');}
  if(!Array.isArray(row.changedFiles)||row.changedFiles.some(f=>!text(f)))throw Error('Rule source changes must be explicit.');
  if(row.artifactRefs!==undefined&&(!Array.isArray(row.artifactRefs)||row.artifactRefs.some(path=>!artifactMap.has(path))))throw Error('Review deliverable references must name frozen artifacts.');
  if(row.status==='fixed'&&(versions.before.videoHash===versions.after.videoHash||!row.changedFiles.length||row.changedFiles.some(f=>!changed.has(f))))throw Error('Fixed conclusions require changed media and actual changed declared source.');
 }
 if(report.verdict==='pass'){
  if(['before','after'].some(phase=>!covers(report.playback?.[phase]?.watched,duration)||(versions[phase].technical.measured.audioStreams>0&&!covers(report.playback?.[phase]?.listened,duration))))throw Error('Passing review requires complete actual before/after playback and listening.');
  if(['before','after'].some(phase=>!completeTechnicalPass(versions[phase].technical))||report.segments.some(s=>s.status!=='pass')||report.rules.some(r=>!['fixed','preserved','not-applicable'].includes(r.status)))throw Error('Failed or missing technical, segment or rule evidence cannot pass.');
  for(const [kind,id] of [['cover','V-cover'],['editableSource','V-export']]){
   const item=evidence.deliverables?.[kind],row=report.rules.find(rule=>rule.id===id);
   if(item&&(row.status==='not-applicable'||!row.artifactRefs?.includes(item.path)))throw Error('Declared cover and editable-source delivery require explicit independent artifact review.');
  }
 }
 return {status:report.verdict,humanJudgment:'pending'};
}
export async function reviewVideo({directory,reportPath}){
 const raw=await regular(directory,'evidence.json',4*1024*1024),digest=(await regular(directory,'evidence.sha256',128)).toString().trim();if(hash(raw)!==digest)throw Error('Video evidence index changed.');const evidence=JSON.parse(raw);
 for(const row of evidence.artifacts){const bytes=await regular(directory,row.path,row.bytes+1);if(hash(bytes)!==row.sha256||bytes.length!==row.bytes)throw Error('Frozen video evidence changed: '+row.path);}
 evidence.ruleIds=JSON.parse((await regular(directory,'rules.json')).toString()).rules.map(r=>r.id);
 const absoluteReport=resolve(reportPath),reportBytes=await regular(dirname(absoluteReport),basename(absoluteReport),512*1024);const report=JSON.parse(reportBytes);const result=validateVideoReview(report,evidence,digest);
 const folder=join(directory,'reviews');await mkdir(folder,{recursive:true});const id=randomUUID();await writeFile(join(folder,id+'.json'),reportBytes,{flag:'wx'});await writeFile(join(folder,id+'.status.json'),json({...result,evidenceDigest:digest,reportHash:hash(reportBytes),reviewer:report.reviewer}),{flag:'wx'});return {...result,reviewPath:'reviews/'+id+'.json'};
}
export async function runVideoReview(argv){
 if(!Array.isArray(argv)||argv.some(arg=>typeof arg!=='string'))throw Error('Video arguments must be strings.');
 if(!argv.length||argv[0]==='help'||argv[0]==='--help'){if(argv.length>1)throw Error('Video help takes no arguments.');return {status:'help',commands:['collect --manifest FILE --out NEW_DIR [--ffmpeg PATH --ffprobe PATH]','review --run DIR --report FILE'],independentReview:'required',humanJudgment:'explicit user decision required'};}
 const [command,...args]=argv,opts={};for(let i=0;i<args.length;i+=2){if(!/^--[a-z-]+$/.test(args[i]||'')||!args[i+1]||args[i+1].startsWith('--')||opts[args[i]])throw Error('Use unique --option VALUE pairs.');opts[args[i]]=args[i+1];}
 const allowed=command==='collect'?['--manifest','--out','--ffmpeg','--ffprobe']:command==='review'?['--run','--report']:[];if(!allowed.length||Object.keys(opts).some(k=>!allowed.includes(k)))throw Error('Usage: video-review.mjs collect --manifest FILE --out NEW_DIR [--ffmpeg PATH --ffprobe PATH] | review --run DIR --report FILE');
 if(command==='collect'){if(!opts['--manifest']||!opts['--out'])throw Error('Collect requires a manifest and fresh output directory.');return collectVideo({manifestPath:resolve(opts['--manifest']),out:resolve(opts['--out']),ffmpeg:opts['--ffmpeg'],ffprobe:opts['--ffprobe']});}
 if(!opts['--run']||!opts['--report'])throw Error('Review requires its run and independent report.');return reviewVideo({directory:resolve(opts['--run']),reportPath:resolve(opts['--report'])});
}
export function videoExitCode(result){return result.status==='help'?0:result.status==='collected'?(['before','after'].every(phase=>completeTechnicalPass(result.technical?.[phase]))?0:2):result.status==='pass'?0:2;}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))runVideoReview(process.argv.slice(2)).then(result=>{console.log(json(result));process.exitCode=videoExitCode(result);}).catch(error=>{console.error(error.message);process.exitCode=1;});
