import {captureEntries,captureKey} from './capture-state.js';

const text=value=>typeof value==='string'&&value.trim().length>=5&&value.length<=16000;

export function remediationProfile(value){
  if(value===undefined)return null;
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['profile','adoptionReason'].includes(k))||!['project','happyhands'].includes(value.profile)||!text(value.adoptionReason))throw Error('Remediation requires project/happyhands profile and an explicit adoptionReason.');
  return {profile:value.profile,adoptionReason:value.adoptionReason};
}

function exactRows(rows,ids,key){
  if(!Array.isArray(rows)||rows.length!==ids.length||new Set(rows.map(r=>r?.[key])).size!==ids.length||rows.some(r=>!ids.includes(r?.[key])))throw Error('Missing, duplicate or unknown remediation '+key+'.');
}
export function assertExecutionResult(value,contract,hash,changedFiles=[]){
  if(value?.contractHash!==hash)throw Error('Execution result uses another remediation contract.');
  exactRows(value.checks,contract.rules.map(r=>r.id),'ruleId');
  exactRows(value.issues,contract.issueIds,'id');
  for(const row of [...value.checks,...value.issues]){
    if(!['fixed','preserved','not-applicable','blocked'].includes(row.status)||!text(row.observed)||!text(row.decision)||!text(row.verification)||!Array.isArray(row.files)||row.files.some(p=>typeof p!=='string'||!changedFiles.includes(p)))throw Error('Incomplete remediation decision or unknown changed file.');
    if(row.status==='fixed'&&!row.files.length)throw Error('Fixed remediation requires changed source files.');
  }
  if([...value.checks,...value.issues].some(r=>r.status==='blocked'))throw Error('Unresolved remediation items remain blocked.');
  return value;
}

export function methodStateEntries(manifest){
  return captureEntries(manifest.captures?.after||manifest.captures?.before).filter(e=>e.screenshot).map(e=>({key:captureKey(e.stateId,e.configurationId)+":"+e.screenshot,screenshot:e.screenshot}));
}

export function assertMethodChecks(rows,ruleIds,manifest,verdict,{supplementalRefs=[]}={}){
  const states=methodStateEntries(manifest),keys=ruleIds.flatMap(id=>states.map(s=>id+'|'+s.key));
  const allowed=new Set([...captureEntries(manifest.captures?.after||manifest.captures?.before).map(e=>e.screenshot),...supplementalRefs]);
  if(!Array.isArray(rows))throw Error('Missing per-rule remediation review.');
  exactRows(rows.map(r=>({...r,key:r.ruleId+'|'+r.stateKey})),keys,'key');
  for(const row of rows){
    const state=states.find(s=>s.key===row.stateKey);
    if(!['pass','fail','needs-evidence','not-applicable'].includes(row.status)||!text(row.reason)||!Array.isArray(row.screenshotRefs)||!row.screenshotRefs.includes(state.screenshot)||row.screenshotRefs.some(ref=>!allowed.has(ref)))throw Error('Remediation check needs assigned original evidence and a reason.');
    if(verdict==='pass'&&['fail','needs-evidence'].includes(row.status))throw Error('Unresolved remediation check prevents passing QA.');
  }
}
