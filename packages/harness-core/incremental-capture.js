import {captureEntries,assertCapturePlan,configurationsForState} from './capture-state.js';
import {verificationHash} from './verification.js';
import {readVerificationFile} from './verification.js';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {repositoryFingerprint,sameRepositoryFingerprint} from './repository-fingerprint.js';
import {readRepositoryInputs,repositoryChanges} from './repository-inputs.js';
import {designSystemContext} from '../skill-core/design-system.js';
import {sourceFiles} from '../skill-core/scan.js';
import {componentGraph,moduleGraphEvidence} from '../skill-core/component-graph.js';
import {sourceContent} from '../skill-core/source-content.js';
import {productSource} from '../skill-core/components.js';
const packageInputs=graph=>(graph?.files||[]).filter(file=>file.path.split('/').includes('node_modules')).map(file=>[file.path,file.hash]).sort((a,b)=>a[0].localeCompare(b[0]));

// A source entry is an explicit project capture contract, not inferred from a
// region, filename resemblance or a component rendered inside the route.
export function selectIncrementalStates({changes,baseline,current,plan,baselineCapture,checkBaseline=true}){
  const full=reason=>({status:'full',reason,selectedStateIds:plan?.states?.map(state=>state.id)||[],excludedStateIds:[],reviewedStateIds:[]});
  if(!plan)return full('capture-plan-missing');
  try{assertCapturePlan(plan);}catch{return full('capture-plan-invalid');}
  if(!changes?.length)return full('source-changes-missing');
  if(!baseline||!current||[baseline,current].some(graph=>graph.status!=='static-reference-only'||graph.issues?.length||!Array.isArray(graph.files)))return full('dependency-graph-incomplete');
  if([baseline,current].some(graph=>packageInputs(graph).some(([,hash])=>!/^[a-f0-9]{64}$/.test(hash||''))))return full('dependency-input-hash-missing');
  if(verificationHash(packageInputs(baseline))!==verificationHash(packageInputs(current)))return full('installed-config-inputs-changed');
  if(changes.some(change=>!/\.(?:[cm]?[jt]sx?|astro|vue|svelte)$/.test(change.path)))return full('global-or-unsupported-input');
  if(plan.states.some(state=>!state.sourceEntries?.length))return full('route-entry-contract-missing');
  if(plan.states.some(state=>state.sourceEntries.some(file=>!/\.(?:[cm]?[jt]sx?|astro|vue|svelte)$/.test(file))))return full('unsupported-route-entry');
  const versions=[baseline,current].map(graph=>({files:new Set(graph.files.map(file=>file.path)),edges:graph.edges}));
  const captured=captureEntries(baselineCapture),closures=new Map();
  for(const state of plan.states){
    if(checkBaseline){
      const entries=captured.filter(entry=>entry.stateId===state.id),configurations=configurationsForState(plan,state);
      if(entries.length!==configurations.length||configurations.some(config=>!entries.some(entry=>entry.configurationId===config.id&&entry.reached===true&&entry.screenshot&&entry.width===config.viewport.width&&entry.height===config.viewport.height&&entry.plannedState&&verificationHash(entry.plannedState)===verificationHash(state))))return full('baseline-state-contract-changed');
    }
    const dependencies=new Set();
    for(const graph of versions){
      if(state.sourceEntries.some(file=>!graph.files.has(file)))return full('route-entry-source-missing');
      const forward=new Map();for(const edge of graph.edges){if(!forward.has(edge.file))forward.set(edge.file,[]);forward.get(edge.file).push(edge.target);}
      const visited=new Set(),queue=[...state.sourceEntries];for(let index=0;index<queue.length;index++){
        const file=queue[index];if(visited.has(file))continue;visited.add(file);
        if(queue.length>10000)return full('dependency-closure-limit');
        dependencies.add(file);for(const target of forward.get(file)||[])if(!visited.has(target))queue.push(target);
      }
    }
    closures.set(state.id,dependencies);
  }
  // New/unmapped modules may be routes, server hooks or global effects. They
  // cannot be dismissed merely because another changed module has consumers.
  if(changes.some(change=>![...closures.values()].some(files=>files.has(change.path))))return full('changed-source-not-mapped');
  const selectedStateIds=plan.states.filter(state=>changes.some(change=>closures.get(state.id).has(change.path))).map(state=>state.id);
  const excludedStateIds=plan.states.map(state=>state.id).filter(id=>!selectedStateIds.includes(id));
  return {status:excludedStateIds.length?'selected':'full',reason:excludedStateIds.length?'declared-entry-dependency-closure':'all-state-entries-affected',
    configuredPlanHash:verificationHash(plan),selectedStateIds,excludedStateIds,reviewedStateIds:[],
    dependencyInputHash:verificationHash(packageInputs(current)),
    stateEvidence:plan.states.map(state=>({stateId:state.id,sourceEntries:state.sourceEntries,changedFiles:changes.filter(change=>closures.get(state.id).has(change.path)).map(change=>change.path)}))};
}

export function selectedCapturePlan(plan,selection){
  if(selection?.status!=='selected')return plan;
  if(selection.configuredPlanHash!==verificationHash(plan))throw Error('Incremental capture plan changed.');
  const selected=new Set(selection.selectedStateIds);
  const excluded=new Set(selection.excludedStateIds),ids=plan.states.map(state=>state.id);
  if(!selected.size||selected.size!==selection.selectedStateIds.length||excluded.size!==selection.excludedStateIds.length||[...selected,...excluded].some(id=>!ids.includes(id))||ids.some(id=>selected.has(id)===excluded.has(id)))throw Error('Invalid incremental capture state partition.');
  return assertCapturePlan({...plan,states:plan.states.filter(state=>selected.has(state.id))});
}

export async function writeIncrementalCapturePlan(run,plan,delta){
  if(delta?.captureSelection?.status!=='selected')return null;
  selectedCapturePlan(plan,delta.captureSelection);
  const record={schemaVersion:'0.1',runId:run.manifest.id,configuredPlan:plan,selection:delta.captureSelection,deltaHash:verificationHash(delta)};
  const bytes=JSON.stringify(record,null,2)+'\n',path='incremental-capture-plan.json';
  if(Buffer.byteLength(bytes)>8*1024*1024)throw Error('Incremental capture contract exceeds artifact limits.');
  await writeFile(join(run.directory,path),bytes,{flag:'wx'});
  return {path,hash:verificationHash(bytes)};
}

export async function readIncrementalCapturePlan(run,configuredPlan){
  const reference=run.manifest.onboarding?.incrementalCapturePlan;
  if(!reference){if(run.manifest.plan?.incrementalCapturePlan||run.manifest.onboarding?.incrementalReview?.delta?.captureSelection?.status==='selected')throw Error('Incremental capture artifact is missing.');return null;}
  if(run.manifest.plan&&verificationHash(run.manifest.plan.incrementalCapturePlan||null)!==verificationHash(reference))throw Error('Incremental capture scope is not bound to the confirmed plan.');
  if(reference.path!=='incremental-capture-plan.json')throw Error('Invalid incremental capture artifact path.');
  const bytes=await readVerificationFile(run.directory,reference.path,8*1024*1024);
  if(verificationHash(bytes)!==reference.hash)throw Error('Incremental capture artifact changed.');
  const record=JSON.parse(bytes);
  if(record.schemaVersion!=='0.1'||record.runId!==run.manifest.id||record.selection?.status!=='selected'||record.deltaHash!==verificationHash(run.manifest.onboarding.incrementalReview.delta)||verificationHash(record.selection)!==verificationHash(run.manifest.onboarding.incrementalReview.delta.captureSelection))throw Error('Incremental capture binding changed.');
  if(configuredPlan&&verificationHash(record.configuredPlan)!==verificationHash(configuredPlan))throw Error('Configured capture plan changed after incremental selection.');
  const effective=selectedCapturePlan(record.configuredPlan,record.selection);
  const expected=effective.states.flatMap(state=>configurationsForState(effective,state).map(configuration=>JSON.stringify([state.id,configuration.id])));
  for(const phase of ['before','after'])if(run.manifest.captures?.[phase]){
    const actual=captureEntries(run.manifest.captures[phase]).map(entry=>JSON.stringify([entry.stateId,entry.configurationId]));
    if(actual.length!==expected.length||new Set(actual).size!==actual.length||actual.some(key=>!expected.includes(key)))throw Error('Captured states do not match the frozen incremental scope.');
  }
  if(run.manifest.captures?.before){
    const before=(await designSystemContext(run)).before;
    if(verificationHash(packageInputs(before?.moduleGraph))!==(record.selection.dependencyInputHash||verificationHash([])))throw Error('Installed config inputs changed after incremental planning.');
  }
  return record;
}

export async function assertIncrementalRecapture(run,repo,record){
  const baseline=await readRepositoryInputs(run,'before'),extraction=(await designSystemContext(run)).before;
  if(!baseline||!extraction?.moduleGraph)throw Error('Incremental before evidence is unavailable.');
  const current=await repositoryFingerprint(repo,{includeFiles:true}),snapshot=await sourceFiles(repo,{includeDesignDocs:true});
  const graph=componentGraph(snapshot.files.filter(file=>productSource(file)||file.path.endsWith('.json')).map(file=>({...file,...sourceContent(file)})),{truncated:snapshot.truncated});
  if(!sameRepositoryFingerprint(current,await repositoryFingerprint(repo)))throw Error('Repository changed while validating incremental recapture.');
  const currentGraph={...moduleGraphEvidence(graph,{truncated:snapshot.truncated}),files:snapshot.files.map(file=>({path:file.path,hash:verificationHash(file.content)}))};
  if(verificationHash(packageInputs(extraction.moduleGraph))!==verificationHash(packageInputs(currentGraph)))throw Error('Installed config inputs changed; start a new full review.');
  const changes=repositoryChanges(baseline.files,current.files);if(!changes.length)return;
  const selection=selectIncrementalStates({changes,baseline:extraction.moduleGraph,current:currentGraph,plan:record.configuredPlan,checkBaseline:false});
  if(selection.selectedStateIds.some(id=>!record.selection.selectedStateIds.includes(id)))throw Error('Source changes now affect excluded or unknown states; start a new full review.');
}
