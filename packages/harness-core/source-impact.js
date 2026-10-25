import {captureEntries} from './capture-state.js';

// Positive reachability evidence only. A region is not a route entry point and
// cannot prove that another part of its page is unaffected.
export function sourceImpact(changes,{baseline,current,plan,capture}={}){
  const graphs=[['baseline',baseline],['current',current]].filter(([,graph])=>graph).map(([revision,graph])=>{
    const reverse=new Map();
    for(const edge of graph.edges||[]){if(!reverse.has(edge.target))reverse.set(edge.target,[]);reverse.get(edge.target).push(edge);}
    return [revision,graph,reverse];
  });
  const limitations=[];
  if(!baseline)limitations.push('baseline-module-graph-missing');
  if(!current)limitations.push('current-module-graph-missing');
  if(graphs.some(([,graph])=>graph.status==='partial'))limitations.push('source-snapshot-incomplete');
  if(graphs.some(([,graph])=>graph.issues?.length))limitations.push('unresolved-module-references');
  const targets=plan?.states||captureEntries(capture).map(entry=>({id:entry.stateId,start:entry.start,actions:entry.actions,region:entry.region||entry.plannedRegion}));
  const stateMap=new Map();
  for(const state of targets){
    const key=state.id;
    if(!stateMap.has(key))stateMap.set(key,{stateId:key,urls:[],sources:[],changes:[]});
    const target=stateMap.get(key),source=state.region?.source?.file?.replaceAll('\\','/');
    for(const url of [state.start?.url,...(state.actions||[]).filter(action=>action.type==='navigate').map(action=>action.url)].filter(Boolean))if(!target.urls.includes(url))target.urls.push(url);
    if(source&&!target.sources.includes(source))target.sources.push(source);
  }
  let referenceCount=0;
  const impacts=changes.map(change=>{
    const references=[];
    for(const [revision,,reverse] of graphs){
      const visited=new Set([change.path]),queue=[{file:change.path,via:[]}];
      for(let index=0;index<queue.length;index++)for(const edge of reverse.get(queue[index].file)||[]){
        if(visited.has(edge.file))continue;
        if(queue[index].via.length>=32||queue.length>=257||referenceCount>=4096){if(!limitations.includes('impact-traversal-limit'))limitations.push('impact-traversal-limit');continue;}
        referenceCount++;visited.add(edge.file);const next={file:edge.file,via:[edge,...queue[index].via]};queue.push(next);references.push({revision,...next});
      }
    }
    const affected=new Set([change.path,...references.map(item=>item.file)]),stateIds=[];
    for(const state of stateMap.values())if(state.sources.some(source=>affected.has(source))){stateIds.push(state.stateId);if(!state.changes.includes(change.path))state.changes.push(change.path);}
    return {path:change.path,kind:change.kind,references,stateIds};
  });
  return {schemaVersion:'0.1',status:'positive-source-references-only',changes:impacts,states:[...stateMap.values()].map(state=>({...state,status:state.changes.length?'potentially-affected':'impact-unknown'})),limitations,
    capturePolicy:'all-configured-states',excludedStateIds:[],reviewedStateIds:[]};
}
