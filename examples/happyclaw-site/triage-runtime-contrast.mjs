import {parseArgs} from 'node:util';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRun} from '../../packages/harness-core/store.js';
import {readVerificationFile,verificationHash} from '../../packages/harness-core/verification.js';
import {verifyRuntimeEvidence} from './verify-runtime-evidence.mjs';

// Geometric uncertainty takes priority over any attempted contrast measurement.
export function contrastEvidenceKind(reason){
 if(/\b(?:obscur\w*|overlap\w*|occlu\w*|clipped|clipping)\b/i.test(reason))return 'visibility-review';
 if(/gradient/i.test(reason))return 'gradient-review';
 return 'unresolved-evidence';
}

export async function triageRuntimeContrast(directories){
 const groups=new Map(),inputs=[],seenRuns=new Set();
 for(const directory of directories){
  const run=await loadRun(directory);
  if(seenRuns.has(run.manifest.id))throw Error('Duplicate runtime run: '+run.manifest.id);seenRuns.add(run.manifest.id);
  const integrity=await verifyRuntimeEvidence(directory);
  const bytes=await readVerificationFile(run.directory,'runtime-foundation.json',4*1024*1024),report=JSON.parse(bytes);
  if(verificationHash(bytes)!==integrity.reportHash||verificationHash(run.manifest.captures.before)!==integrity.captureHash)throw Error('Runtime inputs changed during triage; start a fresh inspection.');
  inputs.push({runId:run.manifest.id,reportHash:verificationHash(bytes),source:integrity.source});
  for(const check of report.checks)for(const item of [...(check.violations||[]),...(check.incomplete||[])]){
   if(item.id!=='color-contrast')continue;
   const outcome=(check.violations||[]).includes(item)?'reported-violation':'incomplete';
   for(const [index,target] of item.targets.entries()){
    const reason=item.details?.[index]||'',kind=contrastEvidenceKind(reason);
    // Astro's generated attribute is not a new product element; retain the
    // original target on every occurrence even when grouping its selector.
    const normalizedTarget=target.map(selector=>typeof selector==='string'?selector.replace(/\[data-astro-cid-[^\]]+\]/g,''):selector);
    const key=JSON.stringify([kind,normalizedTarget]);
    if(!groups.has(key))groups.set(key,{kind,target:normalizedTarget,status:'needs-evidence',occurrences:[]});
    if(outcome==='reported-violation')groups.get(key).status='reported-violation';
    const capture=run.manifest.captures.before.states.find(state=>state.width===check.width&&state.stateId===check.state);
    groups.get(key).occurrences.push({runId:run.manifest.id,sourceCommit:report.source.repositoryCommit,width:check.width,state:check.state,outcome,target,reason,
     relatedCapture:capture?{path:capture.screenshot,hash:run.manifest.captures.before.verificationOriginalHashes[capture.screenshot],relationship:'captured before this axe check; not proof of visibility at check time'}:null});
   }
  }
 }
 return {schemaVersion:'0.1',inputs,groups:[...groups.values()],limitations:[
  'Read-only triage of bound observations; no contrast measurement, visual approval or human judgment is created.',
  'Obscured, overlapped or clipped elements require normal-state visibility review first. Do not calculate through occlusion.',
  'Related captures precede axe execution. Future capture-backed inspection must first establish unobstructed visibility in that exact normal state and couple capture and measurement in the same execution boundary.',
  'Grouping retains all original targets, reasons, viewports and states; it does not dismiss repeated evidence.'
 ]};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {values}=parseArgs({options:{run:{type:'string',multiple:true}}});
 if(!values.run?.length)throw Error('Provide one or more --run paths for completed runtime records.');
 console.log(JSON.stringify(await triageRuntimeContrast(values.run),null,2));
}
