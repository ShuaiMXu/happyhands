import {mkdir,lstat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {PNG} from 'pngjs';
import {captureOriginals} from './capture-state.js';
import {pngDimensions} from './whole-page.js';
import {readVerificationFile,verificationHash as hash} from './verification.js';

const ORIGINAL_LIMIT=24*1024*1024,OUTPUT_LIMIT=40*1024*1024,MAX_PIXELS=40_000_000;
const escape=value=>String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/gu,'�').replace(/[\uD800-\uDFFF]/gu,'�').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
function text(value) {if(typeof value!=='string'||!value.trim()||value.length>8000)throw Error('Annotation text is missing or exceeds its limit.');return value;}
function lines(value,width) {
 const out=[];let row='',used=0;const capacity=Math.max(24,Math.floor((width-48)/9));
 for(const character of value.replaceAll('\r','')) {const cost=character.codePointAt(0)>255?2:1;if(character==='\n'||used+cost>capacity){out.push(row);row='';used=0;}if(character!=='\n'){row+=character;used+=cost;}}
 if(row)out.push(row);return out;
}
function groups(review,manifest) {
 const annotations=review.annotations||[];
 if(!Array.isArray(annotations)||annotations.length>256)throw Error('Invalid annotation count.');
 const originals=new Set(['before','after'].flatMap(phase=>captureOriginals(manifest.captures?.[phase]))),ids=new Set(),result=new Map();
 for(const annotation of annotations) {
  const finding=review.findings?.find(item=>item.id===annotation.findingId),box=annotation.box;
  if(!annotation.id||ids.has(annotation.id)||!originals.has(annotation.screenshot)||!review.screenshotRefs?.includes(annotation.screenshot)||!finding?.screenshotRefs?.includes(annotation.screenshot))throw Error('Annotation must link an inspected original and finding.');
  ids.add(annotation.id);text(annotation.id);text(annotation.label);text(finding.id);text(finding.title);text(finding.observation);
  if(!box||![box.x,box.y,box.width,box.height].every(Number.isFinite)||box.x<0||box.y<0||box.width<=0||box.height<=0||box.x+box.width>1||box.y+box.height>1)throw Error('Annotation bounds must fit the original.');
  if(!result.has(annotation.screenshot))result.set(annotation.screenshot,[]);
  result.get(annotation.screenshot).push({annotation,finding});
 }
 if(result.size>48)throw Error('Too many annotated originals; split the review.');
 return result;
}

async function render(directory,review,manifest,screenshot,items) {
 const original=await readVerificationFile(directory,screenshot,ORIGINAL_LIMIT),originalSha256=hash(original);
 for(const phase of ['before','after']) {
  const bound=manifest.captures?.[phase]?.verificationOriginalHashes?.[screenshot];
  if(bound!==undefined&&bound!==originalSha256)throw Error('Annotation original changed from its capture-time hash.');
 }
 const {width,height}=pngDimensions(original);
 if(width*height>MAX_PIXELS||width>32768||height>100000)throw Error('Annotation original exceeds pixel limits.');
 // Validate PNG payload/CRC, not only its IHDR; the original bytes are embedded unchanged.
 PNG.sync.read(original,{checkCRC:true});
 const canvasWidth=Math.max(width,640),legend=[`Original: ${screenshot}`,`Original SHA-256: ${originalSha256}`,'Derived annotation overlay. Review evidence, not automatic proof of correctness.'];
 const boxes=items.map(({annotation:a,finding:f},index)=>{
  const number=index+1,b=a.box,x=b.x*width,y=b.y*height,w=b.width*width,h=b.height*height;
  const badgeWidth=Math.min(width,30),badgeHeight=Math.min(height,24),badgeX=Math.max(0,Math.min(x,width-badgeWidth)),badgeY=Math.max(0,Math.min(y,height-badgeHeight)),fontSize=Math.min(14,badgeWidth/(String(number).length+1),badgeHeight*.65);
  legend.push('',`${number}. ${a.label} [${f.id}]`,f.title,`Observed finding: ${f.observation}`);
  return `<g><title>${escape(`${number}. ${a.label} [${f.id}]`)}</title><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#b91c1c" stroke-width="3"/><rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" fill="#b91c1c"/><text x="${badgeX+badgeWidth/2}" y="${badgeY+badgeHeight/2+fontSize*.35}" text-anchor="middle" font-size="${fontSize}" fill="white">${number}</text></g>`;
 });
 const checks=(review.structureChecks||[]).filter(row=>row.screenshot===screenshot);
 if(checks.length>5)throw Error('Too many structure checks for annotated original.');
 if(checks.length)legend.push('','Structure review for this original:');
 for(const row of checks)legend.push(`${text(row.dimension)}: ${text(row.status)}`,`Observed: ${text(row.observed)}`,`Expected: ${text(row.expected)}`,`Basis: ${text(row.basis)}`,`Method: ${text(row.method)}`);
 const wrapped=legend.flatMap(line=>line?lines(line,canvasWidth):['']);
 const canvasHeight=height+48+wrapped.length*22;
 if(canvasHeight>150000)throw Error('Annotation legend exceeds output limit.');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" role="img"><title>Annotated original: ${escape(screenshot)}</title><desc>Numbered findings over the original capture at native size, with evidence legend below.</desc><rect width="100%" height="100%" fill="white"/><image x="0" y="0" width="${width}" height="${height}" href="data:image/png;base64,${original.toString('base64')}"/><g font-family="monospace">${boxes.join('')}${wrapped.map((line,index)=>`<text x="24" y="${height+32+index*22}" font-size="14" fill="#161616">${escape(line)}</text>`).join('')}</g></svg>\n`;
 const bytes=Buffer.from(svg);
 if(bytes.length>OUTPUT_LIMIT)throw Error('Annotation output exceeds file limit.');
 const sha256=hash(bytes);
 return {bytes,record:{screenshot,path:`reviews/annotations/${sha256}.svg`,sha256,originalSha256,annotationIds:items.map(item=>item.annotation.id)}};
}

async function safeOutputDirectory(directory) {
 for(const segment of ['reviews','reviews/annotations']) {
  const path=join(directory,segment);try{await mkdir(path);}catch(error){if(error.code!=='EEXIST')throw error;}
  const stat=await lstat(path);if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('Annotation storage cannot use symlinks.');
 }
}

// Deterministic derived copies only. Capture hashes are checked when present, never invented.
export async function buildReviewAnnotationArtifacts({directory,review,manifest}) {
 const entries=groups(review,manifest);if(!entries.size)return [];
 const rendered=[];let total=0;
 for(const [screenshot,items] of entries){const item=await render(directory,review,manifest,screenshot,items);total+=item.bytes.length;if(total>128*1024*1024)throw Error('Annotation output exceeds total limit.');rendered.push(item);}
 await safeOutputDirectory(directory);
 for(const {bytes,record} of rendered) {
  try{await writeFile(join(directory,record.path),bytes,{flag:'wx'});}
  catch(error){if(error.code!=='EEXIST')throw error;const existing=await readVerificationFile(directory,record.path,OUTPUT_LIMIT);if(!existing.equals(bytes))throw Error('Existing annotation output changed.');}
 }
 return rendered.map(item=>item.record);
}

export async function assertReviewAnnotationArtifacts({directory,review,manifest,artifacts,checkOriginals=true}) {
 const entries=groups(review,manifest);
 if(!Array.isArray(artifacts)||artifacts.length!==entries.size)throw Error('Missing or unexpected annotation output.');
 const seen=new Set();let total=0;
 for(const record of artifacts) {
  const items=entries.get(record.screenshot);
  if(!items||seen.has(record.screenshot))throw Error('Duplicate or unknown annotation output.');seen.add(record.screenshot);
  if(!checkOriginals) {
   if(!/^[a-f0-9]{64}$/.test(record.sha256||'')||!/^[a-f0-9]{64}$/.test(record.originalSha256||'')||record.path!==`reviews/annotations/${record.sha256}.svg`||JSON.stringify(record.annotationIds)!==JSON.stringify(items.map(item=>item.annotation.id)))throw Error('Annotation output binding changed.');
   const bytes=await readVerificationFile(directory,record.path,OUTPUT_LIMIT);total+=bytes.length;if(total>128*1024*1024)throw Error('Annotation output exceeds total limit.');
   if(hash(bytes)!==record.sha256)throw Error('Annotation output changed.');
   continue;
  }
  const expected=await render(directory,review,manifest,record.screenshot,items);
  if(record.path!==expected.record.path||record.sha256!==expected.record.sha256||record.originalSha256!==expected.record.originalSha256||JSON.stringify(record.annotationIds)!==JSON.stringify(expected.record.annotationIds))throw Error('Annotation output binding changed.');
  const bytes=await readVerificationFile(directory,record.path,OUTPUT_LIMIT);total+=bytes.length;if(total>128*1024*1024)throw Error('Annotation output exceeds total limit.');
  if(!bytes.equals(expected.bytes))throw Error('Annotation output changed.');
 }
 return artifacts;
}
