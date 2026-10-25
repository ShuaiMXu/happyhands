import {realpath} from 'node:fs/promises';
import {repositoryFingerprint,repositoryMetadata,sameRepositoryFingerprint} from './repository-fingerprint.js';
import {readRepositoryInputs,repositoryChanges} from './repository-inputs.js';
import {readJudgmentWithdrawal} from './judgment-withdrawal.js';
import {verificationHash} from './verification.js';
import {visualReviewFor} from './workflow.js';
import {designSystemContext} from '../skill-core/design-system.js';
import {sourceFiles} from '../skill-core/scan.js';
import {componentGraph,moduleGraphEvidence} from '../skill-core/component-graph.js';
import {sourceContent} from '../skill-core/source-content.js';
import {productSource} from '../skill-core/components.js';
import {sourceImpact} from './source-impact.js';
import {selectIncrementalStates} from './incremental-capture.js';
import {readVisualReviewBinding} from './visual-review-binding.js';
const NORMAL = value => String(value || '').replaceAll('\\', '/').toLowerCase();

export async function verifiedIncrementalDelta(parent,repo,{source,plan}={}){
  const unavailable=(reasonCode,reason)=>({status:'unavailable',baselineRunId:parent?.manifest?.id||null,reasonCode,reason,changes:[]});
  if(parent?.manifest?.judgment?.decision!=='accept'||parent.manifest.judgmentWithdrawal||visualReviewFor(parent.manifest,'visual-qa-evaluator')?.verdict!=='pass')return unavailable('unaccepted-parent','The previous review has no active accepted decision and passing QA.');
  try{
    if(source&&source!==parent.spec?.project?.source)return unavailable('different-project','The previous review belongs to another project.');
    if(!parent.manifest.onboarding?.repository?.root||await realpath(parent.manifest.onboarding.repository.root)!==await realpath(repo))return unavailable('different-project','The previous review is not bound to this repository.');
    if(await readJudgmentWithdrawal(parent.directory,parent.manifest.judgment,parent.manifest.id))return unavailable('unaccepted-parent','The previous judgment was withdrawn.');
    const baseline=await readRepositoryInputs(parent,'after');
    if(!baseline)return unavailable('baseline-inputs-missing','The accepted review has no complete repository input inventory.');
    const extraction=(await designSystemContext(parent)).after;
    if(!extraction)return unavailable('source-binding-unavailable','The accepted source inventory has no bound extraction.');
    await readVisualReviewBinding(parent,visualReviewFor(parent.manifest,'visual-qa-evaluator'),{requireBound:true});
    const current=await repositoryFingerprint(repo,{includeFiles:true});
    if(current.dirty)return unavailable('current-source-dirty','Commit current changes before deriving an incremental review.');
    const changes=repositoryChanges(baseline.files,current.files);
    const snapshot=await sourceFiles(repo,{includeDesignDocs:true}),graph=componentGraph(snapshot.files.filter(file=>productSource(file)||file.path.endsWith('.json')).map(file=>({...file,...sourceContent(file)})),{truncated:snapshot.truncated});
    const currentGraph={...moduleGraphEvidence(graph,{truncated:snapshot.truncated}),files:snapshot.files.map(file=>({path:file.path,hash:verificationHash(file.content)}))};
    const impact=sourceImpact(changes,{baseline:extraction.moduleGraph,current:currentGraph,plan,capture:parent.manifest.captures.after});
    const captureSelection=selectIncrementalStates({changes,baseline:extraction.moduleGraph,current:currentGraph,plan,baselineCapture:parent.manifest.captures.after});
    if(!sameRepositoryFingerprint(current,await repositoryFingerprint(repo)))return unavailable('source-binding-unavailable','Repository inputs changed while deriving source impacts.');
    if(await readJudgmentWithdrawal(parent.directory,parent.manifest.judgment,parent.manifest.id))return unavailable('unaccepted-parent','The previous judgment was withdrawn.');
    return {status:'verified',method:'complete-repository-input-diff',baselineRunId:parent.manifest.id,baseline:baseline.fingerprint,current:repositoryMetadata(current),changes,diffHash:verificationHash(changes),impact,captureSelection};
  }catch{return unavailable('source-binding-unavailable','A complete and consistent repository input comparison is not available.');}
}

function sourceMatches(file, source) {
  const normalize=value=>String(value||'').replaceAll('\\','/');
  return normalize(file)===normalize(source);
}

export function incrementalReviewPlan(parent, foundation,delta=null) {
  const changedFiles = delta?.status==='verified'?delta.changes.map(change=>change.path):[];
  if (parent?.manifest?.judgmentWithdrawal || parent?.manifest?.judgment?.decision !== 'accept') return { mode: 'full', reason: 'The previous change has no active accepted human judgment.',reasonCode:'unaccepted-parent', changedFiles, affectedFoundation: [], skills: null,delta };
  if(delta?.status!=='verified')return {mode:'full',reason:delta?.reason||'Current changes have not been verified against the accepted source.',reasonCode:delta?.reasonCode||'baseline-inputs-missing',changedFiles,affectedFoundation:[],skills:null,delta};
  if (!changedFiles.length) return { mode: 'full', reason: 'No source input changes were found; a new task still needs its configured review.',reasonCode:'unchanged-source', changedFiles, affectedFoundation: [], skills: null,delta };
  if(changedFiles.some(path=>!(/\.(?:css|scss|sass|less|[cm]?[jt]sx?|astro|vue|svelte|mdx?|html)$/.test(path))))return {mode:'full',reason:'Changes outside the current UI file routing require a full review.',reasonCode:'unsupported-changes',changedFiles,affectedFoundation:[],skills:null,delta};
  const entries = [
    ...(foundation?.brand?.assets || []).map(item => ({ kind: 'brand', ...item })),
    ...(foundation?.tokens || []).map(item => ({ kind: 'token', ...item })),
    ...(foundation?.components || []).map(item => ({ kind: 'component', ...item })),
    ...(foundation?.patterns || []).map(item => ({ kind: 'pattern', ...item }))
  ];
  const affectedFoundation = entries.filter(item => changedFiles.some(file => sourceMatches(file, item.source))).map(item => ({ kind: item.kind, name: item.name, source: item.source }));
  const names = changedFiles.map(NORMAL);
  const skills = new Set(['accessibility-reviewer', 'responsive-reviewer','information-architecture-reviewer','content-design-reviewer','visual-hierarchy-reviewer']);
  if (names.some(file => /\.(css|scss|sass|less)$|token|theme|style/.test(file)) || affectedFoundation.some(item => ['token', 'brand'].includes(item.kind))) {
    skills.add('visual-hierarchy-reviewer'); skills.add('token-contrast-auditor'); skills.add('design-system-drift-detector');
  }
  if (names.some(file => /component|\.[cm]?[jt]sx?$|\.astro$|\.vue$|\.svelte$/.test(file)) || affectedFoundation.some(item => item.kind === 'component')) {
    skills.add('interaction-reviewer'); skills.add('visual-hierarchy-reviewer'); skills.add('component-state-auditor');
  }
  if (names.some(file => /route|page|screen|content|copy|\.mdx?$|\.html$/.test(file))) {
    skills.add('information-architecture-reviewer'); skills.add('content-design-reviewer');
  }
  const scoped=delta.captureSelection?.status==='selected';
  return { mode: 'incremental', reason: `${changedFiles.length} current verified file change(s) select diagnostic Skills${scoped?' and capture states through declared entry dependencies':'; the configured capture plan is unchanged'}.`,reasonCode:'verified-source-delta', changedFiles, affectedFoundation, skills: [...skills].sort(),delta,scope:scoped?'declared-entry-state-selection; skipped states remain unreviewed':'skill-routing-only; no route or state is marked reviewed'};
}
