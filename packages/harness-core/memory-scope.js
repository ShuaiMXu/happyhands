import {isDeepStrictEqual} from 'node:util';
import {captureEntries} from './capture-state.js';
import {validateEvidencePolicy,evidenceLevel} from './evidence-policy.js';

const identifier = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const sha256 = /^[a-f0-9]{64}$/;
const path = value => typeof value === 'string' && value.length <= 500 && !/[:\\\0]/.test(value) &&
  value.split('/').every(segment => segment && segment !== '.' && segment !== '..');
const label = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 500;
const hasOnly = (value,keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));
const selectors = {files:path,states:value=>identifier.test(value),components:label,tasks:label};

export function validateMemoryScope(scope) {
  if (scope === undefined) return;
  if (!hasOnly(scope,['failureClass','trigger','check','reviewBy']) || typeof scope.failureClass !== 'string' || !identifier.test(scope.failureClass) ||
      !hasOnly(scope.trigger,Object.keys(selectors)) || !Object.keys(scope.trigger).length) throw Error('Scoped memory requires a failure class and a nonempty trigger.');
  for (const [key,values] of Object.entries(scope.trigger)) {
    if (!Array.isArray(values) || !values.length || values.length > 20 || new Set(values).size !== values.length ||
        values.some(value => typeof value !== 'string' || !selectors[key](value))) throw Error('Use unique exact memory trigger values and repository-relative files.');
  }
  if (scope.reviewBy !== undefined) {
    const value=scope.reviewBy;
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) {
      throw Error('The memory review date must be a real YYYY-MM-DD UTC date.');
    }
  }
  const check=scope.check;
  if (check?.type === 'technical' && hasOnly(check,['type','policy']) && check.policy && evidenceLevel(check.policy) !== 'visual') {
    validateEvidencePolicy(check.policy);
  } else if (check?.type === 'specialist' && hasOnly(check,['type','id','sha256']) && typeof check.id === 'string' && identifier.test(check.id) && typeof check.sha256 === 'string' && sha256.test(check.sha256)) {
    return;
  } else if (check?.type === 'visual' && hasOnly(check,['type','ruleId']) && typeof check.ruleId === 'string' && /^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(check.ruleId)) {
    return;
  } else throw Error('Scoped memory requires an exact technical policy, specialist check digest, or visual remediation rule.');
}

export function memoryScopeContext(run, incremental) {
  const {manifest}=run;
  const changedFiles=new Map((incremental?.selection.stateEvidence||[]).map(row=>[row.stateId,row.changedFiles]));
  const browser = captureEntries(manifest.captures?.before).filter(entry => entry.screenshot && entry.reached !== false && !entry.error && !(entry.status >= 400));
  const baseline = [...browser.map(entry => {
    const source=entry.plannedRegion?.source;
    return {state:entry.stateId,component:source?.component,files:[...(entry.plannedState?.sourceEntries || []),...(changedFiles.get(entry.stateId)||[]),source?.file].filter(Boolean)};
  }), ...(manifest.technicalEvidence?.before?.checks || []).filter(check=>check.status !== 'needs-evidence').map(check=>({
    state:check.stateId,component:check.component,files:check.file?[check.file]:(check.sourceEntries||[])
  }))];
  return {task:run.spec.project.task,baseline};
}

export function recallMemory(entry,{task,baseline},asOf=new Date().toISOString().slice(0,10)) {
  const scope=entry.scope;
  if (!scope) return {reason:'legacy-project-wide',matchedStates:[]};
  if (scope.reviewBy && scope.reviewBy < asOf) return {reason:'review-date-expired',matchedStates:[]};
  const {files,states,components,tasks}=scope.trigger;
  if (tasks && !tasks.includes(task)) return {reason:'scope-mismatch',matchedStates:[]};
  if (!files && !states && !components) return {reason:'matched',matchedStates:[]};
  const available=baseline.filter(row=>(!states||row.state)&&(!components||row.component)&&(!files||row.files.length));
  if(!available.length)return {reason:'scope-evidence-missing',matchedStates:[]};
  const matches=available.filter(row=>(!states||states.includes(row.state))&&
    (!components||components.includes(row.component))&&(!files||row.files.some(file=>files.includes(file))));
  return {reason:matches.length?'matched':'scope-mismatch',matchedStates:[...new Set(matches.map(row=>row.state).filter(Boolean))].sort()};
}

export function sameTechnicalPolicy(manifest,check) {
  return isDeepStrictEqual(manifest.evidencePolicy,check.policy);
}
