import {verificationPreviewFingerprint} from './preview-fingerprint.js';
import {captureEntries,captureOriginals} from './capture-state.js';
import {readVerificationFile,verificationHash} from './verification.js';
import {repositoryFingerprint,repositoryMetadata,sameRepositoryFingerprint} from './repository-fingerprint.js';
import {writeRepositoryInputs} from './repository-inputs.js';
import {sourceFiles} from '../skill-core/scan.js';
import {runHandler} from '../skill-core/handlers.js';
import {buildDesignSystemExtraction,snapshotHash,designSystemContext} from '../skill-core/design-system.js';
import {captureOnce,loadRun,saveCapture,saveDesignSystemExtraction} from './store.js';
import {inspectRepository} from './onboard.js';

// Both UI and CLI use this capture boundary. Source is sampled on each side of
// the real browser capture; later source cannot be attached to an older image.
export async function captureWithDesignSystem({directory,repo,phase,capture,signal,scan=sourceFiles,inspect=inspectRepository,bindVerificationSource=false,verificationUrl,fingerprintPreview=verificationPreviewFingerprint,fingerprint=repositoryFingerprint,extract=true}) {
  return captureOnce(directory,phase,async()=>{
    signal?.throwIfAborted();
    if(!extract&&!bindVerificationSource)throw Error('Capture without design-system extraction requires complete source and original-image binding.');
    // Retain the digest, not a second full copy of a large source scan, while
    // the browser is running.
    const previewBefore=bindVerificationSource?await fingerprintPreview(verificationUrl):null;
    const repositoryBefore=await fingerprint(repo,{includeFiles:extract}).catch(error=>{if(bindVerificationSource){if(error.code==='REPOSITORY_INDEX_LIMIT')return fingerprint(repo);throw error;}return null;});
    const beforeHash=extract?snapshotHash(await scan(repo,{includeDesignDocs:true})):null;
    const identity=await inspect(repo).catch(()=>null);
    const result=await capture();
    signal?.throwIfAborted();
    const after=extract?await scan(repo,{includeDesignDocs:true}):null;
    const current=await inspect(repo).catch(()=>null);
    if((extract&&beforeHash!==snapshotHash(after)) || identity?.commit!==current?.commit || identity?.dirty!==current?.dirty)throw Error('Design system source changed during capture; start a fresh capture.');
    if(repositoryBefore){
      const repositoryAfter=await fingerprint(repo,{includeFiles:Array.isArray(repositoryBefore.files)});
      if(!sameRepositoryFingerprint(repositoryBefore,repositoryAfter))throw Error('Repository inputs changed during capture.');
      result.incrementalSource=Array.isArray(repositoryAfter.files)?await writeRepositoryInputs(directory,phase,repositoryAfter):{status:'unavailable',reason:extract?'The complete input inventory exceeds incremental storage limits; use full review.':'Explicit narrow capture omits module/design-system extraction; use full review, not incremental inference.'};
      if(bindVerificationSource){
        if(await fingerprintPreview(verificationUrl)!==previewBefore)throw Error('Verification preview changed during capture.');
        result.verificationPreviewFingerprint=previewBefore;
        result.verificationSource=repositoryMetadata(repositoryAfter);
        result.verificationOriginalHashes={};
        for(const screenshot of captureOriginals(result))result.verificationOriginalHashes[screenshot]=verificationHash(await readVerificationFile(directory,screenshot,24*1024*1024));
      }
    }else result.incrementalSource={status:'unavailable',reason:'Complete repository inputs are not available; use full review.'};
    result.designSystemSource=extract?{snapshotHash:snapshotHash(after),repositoryCommit:current?.commit||null,dirty:current?.dirty??null,status:'capture-scan-match'}:{status:'not-extracted',reason:'Explicit narrow capture; complete repository fingerprint and originals remain bound. Use selected design sources and full review, not incremental inference.'};
    await saveCapture(directory,phase,result);
    if(extract)await extractDesignSystem({directory,repo,phase,snapshot:after,signal});
    return result;
  });
}

export async function extractDesignSystem({directory,repo,phase,snapshot,signal}) {
  signal?.throwIfAborted();
  const run=await loadRun(directory);
  if(run.manifest.designSystemExtractions?.[phase])return (await designSystemContext(run))[phase];
  const capture=run.manifest.captures[phase];
  if(!capture)throw Error('Capture the page before extracting its design system.');
  const source=snapshot||await sourceFiles(repo,{includeDesignDocs:true});
  if(capture.designSystemSource && capture.designSystemSource.snapshotHash!==snapshotHash(source))throw Error('Source no longer matches captured design system evidence.');
  const foundation=await runHandler('foundationExtractor',{repo,sourceSnapshot:{...source,files:source.files.filter(file=>!file.path.endsWith('.md'))}});
  const extraction=buildDesignSystemExtraction({snapshot:source,foundation,capture,phase});
  extraction.source={...extraction.source,repositoryCommit:capture.designSystemSource?.repositoryCommit||null,
    dirty:capture.designSystemSource?.dirty??null,binding:capture.designSystemSource?.status||'unverified-legacy-capture'};
  if(!extraction.source.repositoryCommit)extraction.limitations.push('No repository revision is bound to these observations; the binding covers scanned content only.');
  signal?.throwIfAborted();
  await saveDesignSystemExtraction(directory,extraction);
  return extraction;
}
