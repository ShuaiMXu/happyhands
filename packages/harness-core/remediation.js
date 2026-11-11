import {readFile,writeFile,lstat,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {captureEntries,captureKey} from './capture-state.js';

const digest=value=>createHash('sha256').update(value).digest('hex');
const encode=value=>JSON.stringify(value,null,2)+'\n';
const text=value=>typeof value==='string'&&value.trim().length>=5&&value.length<=16000;
const files={contract:'remediation-contract.json',skill:'remediation-SKILL.md',result:'remediation-result.json'};
export const RESULT_FILE='.harness-remediation-result.json';
export const HERO_SURFACE='homepage-hero';
export const HERO_MOTION_RULE='HH-HERO-MOTION';
export const HERO_VERIFICATION_ID='hero-motion';

export function isHomepageHero(entry){
  const value=entry?.finalUrl||entry?.start?.url;
  if(!value||!URL.canParse(value))return false;
  return ['/', '/apps/portal', '/en/apps/portal'].includes(new URL(value).pathname.replace(/\/+$/,'')||'/');
}

export function remediationProfile(value){
  if(value===undefined)return null;
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['profile','adoptionReason','surface'].includes(k))||!['project','happyhands'].includes(value.profile)||!text(value.adoptionReason))throw Error('Remediation requires project/happyhands profile and an explicit adoptionReason.');
  if(value.surface!==undefined&&(value.profile!=='happyhands'||value.surface!==HERO_SURFACE))throw Error('The homepage-hero surface requires the HappyHands owned profile.');
  return {profile:value.profile,adoptionReason:value.adoptionReason,...(value.surface?{surface:value.surface}:{})};
}
export async function remediationDefinition(profile){
  if(!profile)return null;
  const skill=await readFile(new URL('../../skills/experience-remediation/SKILL.md',import.meta.url),'utf8');
  const catalog=JSON.parse(await readFile(new URL('../../skills/experience-remediation/rules.json',import.meta.url),'utf8'));
  return {version:catalog.version,workflow:catalog.workflow,profile,skill,skillHash:digest(skill),rules:catalog.rules.filter(r=>(r.profile==='project'||profile.profile==='happyhands')&&(!r.surface||r.surface===profile.surface))};
}
export async function stageRemediation(run,findingId){
  const config=run.manifest.onboarding?.config;
  const profile=remediationProfile(config?.designGuidance?.remediation);
  if(!profile)return null;
  if(profile.surface===HERO_SURFACE){
    const check=config.verificationChecks?.find(check=>check.id===HERO_VERIFICATION_ID&&check.stage==='normal-interaction'&&check.screenshots?.length>=2);
    const states=captureEntries(run.manifest.captures?.before);
    if(!check||!states.some(entry=>entry.screenshot&&check.stateIds.includes(entry.stateId)&&isHomepageHero(entry))) {
      throw Error('Homepage Hero remediation requires a captured homepage state assigned to the hero-motion normal-interaction check with at least two original frames.');
    }
  }
  const definition=await remediationDefinition(profile);
  const contract={...definition,issueIds:run.manifest.repair?.findingIds||[findingId||'BOOTSTRAP'],sourceCommit:run.manifest.onboarding?.repository?.commit||null};
  const bytes=encode(contract);
  await writeFile(join(run.directory,files.contract),bytes);
  await writeFile(join(run.directory,files.skill),definition.skill);
  return {path:files.contract,hash:digest(bytes),ruleIds:contract.rules.map(r=>r.id)};
}
async function regular(directory,name){
  const path=join(directory,name),stat=await lstat(path);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2*1024*1024)throw Error('Invalid remediation artifact: '+name);
  return readFile(path,'utf8');
}
export async function readRemediation(run,{execution=false}={}){
  const reference=run.manifest.plan?.remediation;
  if(!reference){if(run.manifest.plan&&run.manifest.onboarding?.config?.designGuidance?.remediation)throw Error('Missing required remediation plan contract.');return null;}
  if(reference.path!==files.contract)throw Error('Invalid remediation contract path.');
  const bytes=await regular(run.directory,files.contract);
  if(digest(bytes)!==reference.hash)throw Error('Remediation contract changed.');
  const contract=JSON.parse(bytes);
  if(JSON.stringify(reference.ruleIds)!==JSON.stringify(contract.rules.map(r=>r.id)))throw Error('Remediation rule inventory changed.');
  if(digest(await regular(run.directory,files.skill))!==contract.skillHash)throw Error('Remediation Skill changed.');
  if(JSON.stringify(contract.profile)!==JSON.stringify(remediationProfile(run.manifest.onboarding?.config?.designGuidance?.remediation)))throw Error('Remediation adoption changed after planning.');
  let result=null;
  if(execution){
    const record=run.manifest.execution?.remediation;
    if(!record||record.path!==files.result)throw Error('Missing structured remediation execution result.');
    const raw=await regular(run.directory,files.result);
    if(digest(raw)!==record.hash)throw Error('Remediation execution evidence changed.');
    result=JSON.parse(raw);
    assertExecutionResult(result,contract,reference.hash,run.manifest.execution.changedFiles);
  }
  return {contract,hash:reference.hash,result};
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
export async function collectRemediation(run,worktree,changedFiles){
  const method=await readRemediation(run);if(!method)return null;
  const raw=await regular(worktree,RESULT_FILE);
  // Keep the original report even when validation fails; the caller records failure.
  await writeFile(join(run.directory,files.result),raw,{flag:'wx'});
  await unlink(join(worktree,RESULT_FILE));
  const value=JSON.parse(raw);
  assertExecutionResult(value,method.contract,method.hash,changedFiles);
  return {path:files.result,hash:digest(raw)};
}
export function executionMethodPrompt(method,runDirectory,ojoReference){
  if(!method)return '';
  return `\nSTRICT EXPERIENCE REMEDIATION. Read ${join(runDirectory,files.skill)} in full, the bound contract ${join(runDirectory,files.contract)}, and the COMPLETE OJO references below (not only their filenames). Follow project layout/grid sources and approved Foundation, not universal column counts.\n${[...new Set(method.contract.rules.map(r=>join(runDirectory,ojoReference,r.reference)))].join('\n')}\nchecks MUST contain exactly these ruleIds, taken only from contract.rules: ${JSON.stringify(method.contract.rules.map(r=>r.id))}. issues MUST contain exactly these IDs: ${JSON.stringify(method.contract.issueIds)}. Workflow phases describe ordering, never extra checks or issues. Scheduled independent host/browser QA is a later gate: describe source-only verification honestly; it does not itself make completed source implementation blocked. Use blocked when unresolved evidence prevents a safe implementation decision or an issue remains unfixed. Never claim an unperformed browser check. For EVERY contract rule record observed evidence, concrete design decision, changed files and actual verification. Reproduce EVERY delegated issue. Preserve reasonable existing design choices with reasons. Do not invent adoption, tests or screenshots. Write ${RESULT_FILE} at the target worktree root, JSON only: {contractHash:${JSON.stringify(method.hash)},checks:[{ruleId,status:"fixed|preserved|not-applicable|blocked",observed,decision,files:[],verification}],issues:[{id,status,observed,decision,files:[],verification}]}. Use exact IDs in the contract, one row each; each status is a single enum value. Fixed rows must name actual changed source files. A grid decision must name the observed container/columns/gutters/margins/alignment/breakpoints or explicitly state the missing evidence. Blocked means execution is incomplete; do not disguise it as not-applicable. The host archives this report; do not commit it. These are executor claims, not independent acceptance.\n`;
}
export function methodStateEntries(manifest){
  return captureEntries(manifest.captures?.after||manifest.captures?.before).filter(e=>e.screenshot).map(e=>({key:captureKey(e.stateId,e.configurationId)+":"+e.screenshot,screenshot:e.screenshot}));
}
export function methodReviewPrompt(method,manifest){
  if(!method)return '';
  return `\nSTRICT METHOD REVIEW: Read remediation in review-context.json (or context.json for diagnosis), including the complete own Skill and rule references. Return methodChecks for EVERY rule x assigned state: {ruleId,stateKey,status:"pass|fail|needs-evidence|not-applicable",reason,screenshotRefs:[]}. Each status is one enum value. Exact state keys: ${JSON.stringify(methodStateEntries(manifest))}. Do not trust executor assertions. Cite the state's original in each row, including not-applicable; explain applicability. Unseen interactions require needs-evidence, not pass. Check the adopted grid, alignment, gutters, responsive reflow and shared component consumers. Any fail/needs-evidence prevents an overall pass. This covers assigned states only.\n`;
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
export function aggregateMethodChecks(reviews){
  const severity={'not-applicable':0,pass:1,'needs-evidence':2,fail:3},map=new Map();
  for(const review of reviews)for(const row of review.methodChecks||[]){const key=row.ruleId+'|'+row.stateKey,old=map.get(key);if(!old||severity[row.status]>severity[old.status])map.set(key,row);}
  return [...map.values()];
}
export const remediationExportFiles=Object.values(files);
