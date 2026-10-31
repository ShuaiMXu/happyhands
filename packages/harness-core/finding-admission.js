// Clear findings only. A skill citation is a reasoning source, never proof that
// a third-party UI adopted a house style or that a screenshot contains a defect.
export const FINDING_POLICY_VERSION='clear-defects@1';
const text=value=>typeof value==='string'&&value.trim().length>=5&&value.length<=10000;
export function findingAdmissionReason(item,{catalog=[],ownedUi=false}={}){
 const basis=item.findingBasis;
 if(!basis||basis.policyVersion!==FINDING_POLICY_VERSION||basis.kind!=='defect')return 'No clear-defect assessment.';
 if(item.confidence!=='high')return 'The problem is not sufficiently certain.';
 if(!['functional','accessibility','layout-break','explicit-contract'].includes(basis.category))return 'A preference or general improvement is not a defect.';
 for(const key of ['observed','expected','whyWrong'])if(!text(basis[key]))return 'Missing observed/expected/error reasoning.';
 for(const key of ['reproduction','alternativesChecked'])if(!Array.isArray(basis[key])||!basis[key].length||basis[key].some(value=>!text(value)))return 'Missing reproduction or alternative-design checks.';
 if(basis.category==='explicit-contract'&&!text(basis.projectContract))return 'No adopted project contract.';
 if(!Array.isArray(basis.skillRefs)||!basis.skillRefs.length||basis.skillRefs.length>8)return 'No specific skill references.';
 for(const ref of basis.skillRefs){
  const source=catalog.find(file=>file.path===ref.path);
  if(!source||!Number.isInteger(ref.line)||ref.line<1||!text(ref.quote)||!text(ref.application)||!['requirement','principle'].includes(ref.authority))return 'Invalid skill reference or application.';
  const preceding=source.content.split('\n').slice(0,ref.line).filter(line=>/^#{1,6}\s+/.test(line)).at(-1)?.replace(/^#{1,6}\s+/, '').trim();
  if(preceding!==ref.section||!source.sections.includes(ref.section)||!source.content.split('\n').slice(ref.line-1,ref.line+5).join('\n').includes(ref.quote))return 'The cited section, line or quote does not match the actual skill.';
  if(source.ownedOnly&&!ownedUi)return 'The target has not adopted the HappyHands-owned profile.';
 }
 return null;
}
export function admitModelFindings(result,context){
 const findings=[],excluded=[];
 for(const item of result.findings){const reason=findingAdmissionReason(item,context);if(reason)excluded.push({title:item.title,reason,finding:item});else findings.push(item);}
 return {...result,findings,excludedFindings:excluded};
}
export function isReportableFinding(finding){
 if(finding.verificationStatus==='stale-candidate')return false;
 if(finding.verificationStatus==='supported')return true;
 if((finding.sources||[]).some(source=>source.type==='model'||source.type==='skill'))return finding.findingBasis?.policyVersion===FINDING_POLICY_VERSION&&finding.findingBasis.kind==='defect';
 return finding.id!=='AUTOMATIC_REPAIR';
}
export function guidanceCatalog(design,ojo){
 const entry=(path,content,ownedOnly=false)=>({path,content,ownedOnly,sections:[...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map(match=>match[1].trim())});
 return [entry(`${design.metadata.reference}/happyhands-ui/SKILL.md`,design.uiRules,true),...design.packs.flatMap(pack=>[entry(`${design.metadata.reference}/${pack.metadata.id}/ADAPTER.md`,pack.adapter),...pack.documents.filter(doc=>doc.path.endsWith('.md')).map(doc=>entry(`${design.metadata.reference}/${pack.metadata.id}/${doc.path}`,doc.content))]),entry(`${ojo.metadata.reference}/ADAPTER.md`,ojo.adapter),...ojo.documents.filter(doc=>doc.path.endsWith('.md')).map(doc=>entry(`${ojo.metadata.reference}/${doc.path}`,doc.content))];
}
