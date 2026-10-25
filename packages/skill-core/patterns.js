import {inventoryComponents} from './components.js';
import {componentCoverage} from './component-coverage.js';
import {captureEntries} from '../harness-core/capture-state.js';
import {evidenceHash} from './design-system.js';

// Deterministic evidence collection only. A repeated composition is a review
// candidate, not a professionally validated pattern or an approved constraint.
export function patternCandidates(snapshot,history){
  const components=inventoryComponents(snapshot.files,{truncated:snapshot.truncated});
  const candidates=[];
  if(history.status==='checked'&&!snapshot.truncated&&components.length<=512)for(const component of components){
    const dependencies=components.filter(child=>child.source!==component.source&&child.consumerEvidence.some(edge=>edge.file===component.source)).map(child=>({name:child.name,source:child.source}));
    const consumers=[...new Set(component.consumerEvidence.map(edge=>edge.file))].sort();
    if(component.consumerGraphTruncated||component.moduleResolutionIssues.length||dependencies.length<2||consumers.length<2)continue;
    const file=snapshot.files.find(file=>file.path===component.source),sourceHash=evidenceHash(file.content),groups=new Map();
    for(const record of history.records||[]){
      const capture=record.capture;
      const entries=captureEntries(capture),coverage=componentCoverage({...component,sourceHash},capture);
      for(const reference of coverage.references.filter(ref=>typeof ref.instance?.domPath==='string'&&ref.instance.domPath.length<=4096&&ref.instance.domPath.startsWith('html:nth-of-type(1)>'))){
        const entry=entries.find(item=>item.stateId===reference.stateId&&item.configurationId===reference.configurationId);
        const original=record.originals.find(item=>item.path===reference.screenshot);
        if(!original||!entry?.start?.url)continue;
        let url;try{url=new URL(entry.start.url);}catch{continue;}
        // Require two roots in the SAME route/configuration/action context.
        // Desktop/mobile copies, replays, before/after and selector aliases do not multiply uses.
        const route=url.pathname+url.search+url.hash;
        const context=evidenceHash({runId:record.runId,origin:url.origin,route,configurationId:entry.configurationId,actions:entry.actions||[]});
        const examples=groups.get(context)||[];
        examples.push({runId:record.runId,stateId:entry.stateId,configurationId:entry.configurationId,route,instanceId:reference.instance.id,domPath:reference.instance.domPath,selector:reference.selector,screenshot:original.path,imageHash:original.hash,qaHash:record.qaHash,judgmentHash:record.judgmentHash});
        groups.set(context,examples);
      }
    }
    const examples=[...groups.values()].find(items=>new Set(items.map(item=>item.domPath)).size>=2&&new Set(items.map(item=>item.instanceId)).size>=2);
    if(!examples)continue;
    const first=examples.find(item=>examples.some(other=>other.domPath!==item.domPath&&other.instanceId!==item.instanceId));
    const second=first&&examples.find(item=>item.domPath!==first.domPath&&item.instanceId!==first.instanceId);
    const distinct=second?[first,second]:[];
    for(const example of examples)if(!distinct.some(item=>item.domPath===example.domPath||item.instanceId===example.instanceId))distinct.push(example);
    if(distinct.length<2)continue;
    if(distinct.length>16)distinct.length=16;
    candidates.push({name:component.name,source:component.source,sourceHash,status:'observed',dependencies,consumers,
      tokenReferences:[...new Set([file,...dependencies.map(child=>snapshot.files.find(file=>file.path===child.source))].filter(Boolean)
        .flatMap(file=>[...file.content.matchAll(/var\(\s*(--[\w-]+)/g)].map(match=>match[1])))],examples:distinct,
      guidanceGaps:['pattern-role','when-to-use','when-to-avoid','exceptions','applicable-variants-and-states'],
      evidenceScope:'accepted declared roots plus static composition; descendant rendering and semantic reuse require professional review'});
    if(candidates.length===128)break;
  }
  return candidates;
}

export function patternLibraryCurator({sourceSnapshot,projectHistory}){
  const candidates=patternCandidates(sourceSnapshot,projectHistory);
  const evidence={...projectHistory,records:projectHistory.records.map(({capture,...record})=>record)};
  return {status:'needs-evidence',evidence:[{type:'accepted-pattern-history',...evidence}],findings:[],
    proposedUpdates:candidates.length?[{type:'pattern-candidates',status:'observed',candidates}]:[],
    limitations:[...projectHistory.limitations,
      candidates.length?'Repeated accepted compositions need professional usage/avoidance guidance and explicit Foundation approval.':'No repeated accepted composition meets the current source and instance requirements.',
      'Collector results contain historical paths and hashes. Optional model review revalidates the source runs and seals original copies separately; a saved candidate alone does not prove its historical decision is still active.',
      'Collection is bounded to 512 source components, 128 candidates and 16 examples per candidate; this is not an exhaustive pattern library.',
      'No candidate is automatically merged into Foundation.patterns. Static child imports do not prove all children rendered, and repeated roots do not establish a reusable interaction pattern.']};
}
