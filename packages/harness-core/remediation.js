import {readFile,writeFile,lstat,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {remediationProfile,assertExecutionResult,methodStateEntries} from './remediation-validation.js';
export {remediationProfile,assertExecutionResult,methodStateEntries,assertMethodChecks} from './remediation-validation.js';

const digest=value=>createHash('sha256').update(value).digest('hex');
const encode=value=>JSON.stringify(value,null,2)+'\n';
const files={contract:'remediation-contract.json',skill:'remediation-SKILL.md',result:'remediation-result.json'};
export const RESULT_FILE='.harness-remediation-result.json';

export async function remediationDefinition(profile){
  if(!profile)return null;
  const skill=await readFile(new URL('../../skills/experience-remediation/SKILL.md',import.meta.url),'utf8');
  const catalog=JSON.parse(await readFile(new URL('../../skills/experience-remediation/rules.json',import.meta.url),'utf8'));
  return {version:catalog.version,workflow:catalog.workflow,profile,skill,skillHash:digest(skill),rules:catalog.rules.filter(r=>r.profile==='project'||profile.profile==='happyhands')};
}
export async function stageRemediation(run,findingId){
  const profile=remediationProfile(run.manifest.onboarding?.config?.designGuidance?.remediation);
  if(!profile)return null;
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
export function methodReviewPrompt(method,manifest){
  if(!method)return '';
  return `\nSTRICT METHOD REVIEW: Read remediation in review-context.json (or context.json for diagnosis), including the complete own Skill and rule references. Return methodChecks for EVERY rule x assigned state: {ruleId,stateKey,status:"pass|fail|needs-evidence|not-applicable",reason,screenshotRefs:[]}. Each status is one enum value. Exact state keys: ${JSON.stringify(methodStateEntries(manifest))}. Do not trust executor assertions. Cite the state's original in each row, including not-applicable; explain applicability. Unseen interactions require needs-evidence, not pass. Check the adopted grid, alignment, gutters, responsive reflow and shared component consumers. Any fail/needs-evidence prevents an overall pass. This covers assigned states only.\n`;
}
export function aggregateMethodChecks(reviews){
  const severity={'not-applicable':0,pass:1,'needs-evidence':2,fail:3},map=new Map();
  for(const review of reviews)for(const row of review.methodChecks||[]){const key=row.ruleId+'|'+row.stateKey,old=map.get(key);if(!old||severity[row.status]>severity[old.status])map.set(key,row);}
  return [...map.values()];
}
export const remediationExportFiles=Object.values(files);
