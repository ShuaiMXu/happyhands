import {auditReadingMethods, METHOD_POLICY} from '../skill-core/method-policy.js';
import {EXPERIENCE_POLICY,REVIEW_DIMENSIONS,experienceRequired} from './experience-contract.js';
export {EXPERIENCE_POLICY,REVIEW_DIMENSIONS,experienceRequired,assertExperienceAssessments} from './experience-contract.js';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,realpath,readFile,mkdtemp,rename,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {filesUnder} from '../../skills/happyhands/lib/integrity.mjs';
import Ajv from 'ajv/dist/2020.js';
import {loadRun,withRunLock,writeJson} from './store.js';
import {captureOriginals} from './capture-state.js';
import {readVerificationFile} from './verification.js';
import {designSourceContext} from './design-sources.js';
import {stageDesignGuidance} from '../skill-core/design-guidance.js';
import {stageOjoGuidance} from '../skill-core/ojo-guidance.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
const digest=value=>hash(JSON.stringify(value));
const text={type:'string',minLength:1,maxLength:12000,pattern:'\\S'};
const list=items=>({type:'array',minItems:1,maxItems:100,items});
const object=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const strings=list(text);
const evidence=list(text);
export const AUDIT_DIMENSIONS=['task-flow','hierarchy-content','grid-layout','components-states','ai-slop','feedback-recovery','accessibility','motion','responsive'];
const check=object({dimension:{enum:AUDIT_DIMENSIONS},status:{enum:['observed','inferred','needs-evidence','not-applicable']},observation:text,screenshotRefs:{type:'array',maxItems:100,items:text},reason:text});
const source=object({source:text,sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},authority:{enum:['project-rule','observed','reference']},section:text,problem:text,adopt:text,preserve:text,avoid:text});
const method=object({path:text,quote:text,application:text});
const auditSchema=object({
 version:{const:EXPERIENCE_POLICY},surface:{enum:['public-page','app-screen']},
 task:object({originalRequest:text,user:text,scenario:text,outcome:text,constraints:{type:'array',maxItems:100,items:text},operatorProposals:{type:'array',maxItems:100,items:text},assumptions:{type:'array',maxItems:100,items:text},scope:text,outOfScope:text}),
 journey:list(object({step:text,userQuestion:text,action:text,observation:text,screenshotRefs:evidence,unknowns:{type:'array',maxItems:100,items:text}})),
 issues:{type:'array',maxItems:100,items:object({id:text,kind:{enum:['defect','hypothesis','user-request']},problem:text,impact:text,rootCause:text,priority:{enum:['high','medium','low']},screenshotRefs:evidence})},
 checks:list(check),designBasis:object({sources:{type:'array',maxItems:128,items:source},missingSourcesReason:text}),methods:list(method)
});
const decisionSchema=object({
 version:{const:EXPERIENCE_POLICY},findingId:text,problemIds:strings,readingOrder:strings,grouping:text,primaryAction:text,
 content:object({show:strings,merge:{type:'array',maxItems:100,items:text},defer:{type:'array',maxItems:100,items:text},reason:text}),
 layout:text,components:list(object({source:text,consumers:strings,states:strings,decision:text})),
 alternatives:list(object({kind:{enum:['preserve','lighter','other']},description:text,benefit:text,cost:text})),
 chosen:text,whyBetterForTask:text,tradeoffs:text,referenceApplications:{type:'array',maxItems:128,items:object({source:text,application:text,verification:text})},
 verification:list(object({criterion:text,method:text,expectedEvidence:text})),methods:list(method)
});
const ajv=new Ajv({allErrors:true});
const validators={audit:ajv.compile(auditSchema),decision:ajv.compile(decisionSchema)};
function validate(phase,input){
 if(!validators[phase](input))throw Error('Invalid experience '+phase+': '+ajv.errorsText(validators[phase].errors));
 if(Buffer.byteLength(JSON.stringify(input))>256*1024)throw Error('Experience record exceeds 256 KiB. Narrow the scope; no content was truncated.');
}
export function experienceGuidanceProfile(run){
 const configured=run.manifest.onboarding?.config?.designGuidance||{};
 const surface=run.manifest.experienceAudit?.surface;
 return surface?{...configured,taste:surface,dials:undefined}:configured;
}
async function binding(run){
 const originals=[];
 // Hash one original at a time: a large capture plan must not load every PNG into memory together.
 for(const path of captureOriginals(run.manifest.captures.before))originals.push({path,sha256:hash(await readVerificationFile(run.directory,path,24*1024*1024))});
 const sources=await designSourceContext(run);
 return {hash:digest({project:run.spec.project,foundation:run.spec.designFoundation||null,before:run.manifest.captures.before,repository:run.manifest.onboarding?.repository||null,originals,sources:sources.map(({content,...ref})=>ref)}),sources,originals};
}

// Preserve full local method directories, including referenced rules. No handlers execute here.
const localMethods=['review-product','experience-remediation',...['information-architecture-reviewer','interaction-reviewer','error-recovery-reviewer','visual-hierarchy-reviewer','content-design-reviewer','foundation-extractor','brand-foundation-extractor','component-inventory','fix-planner','component-reuse-planner','component-state-auditor','consistency-auditor','accessibility-reviewer','visual-qa-evaluator','judgment-distiller','regression-case-author'].map(id=>'product-design/'+id)];
async function stageLocalMethods(directory){
 const root=fileURLToPath(new URL('../../skills/',import.meta.url)),documents=[];
 for(const method of localMethods)for(const path of await filesUnder(join(root,method))){const content=await readFile(join(root,method,path));documents.push({path:method+'/'+path,content,sha256:hash(content)});}
 const sharedWorkflow=await readFile(join(root,'happyhands/references/workflow.md'));
 documents.push({path:'happyhands/references/workflow.md',content:sharedWorkflow,sha256:hash(sharedWorkflow)});
 const files=documents.map(({path,sha256})=>({path,sha256})),sha256=digest(files),reference='experience-methods/v1/'+sha256,destination=join(directory,reference);
 await mkdir(dirname(destination),{recursive:true});
 try{await realpath(destination);}catch(error){
  if(error.code!=='ENOENT')throw error;
  const temporary=await mkdtemp(join(dirname(destination),'.pending-'));
  try{
   for(const doc of documents){const path=join(temporary,doc.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,doc.content,{flag:'wx'});}
   try{await rename(temporary,destination);}catch(error){if(!['EEXIST','ENOTEMPTY','EPERM','EACCES'].includes(error.code))throw error;}
  }finally{await rm(temporary,{recursive:true,force:true});}
 }
 for(const doc of documents)if(hash(await readVerificationFile(directory,reference+'/'+doc.path,2*1024*1024))!==doc.sha256)throw Error('Local experience method snapshot changed.');
 return {reference,sha256,files,methodPolicy:METHOD_POLICY,readFirst:auditReadingMethods().map(path=>reference+'/'+path+'/SKILL.md'),availability:'Complete methods available; not proof of execution.'};
}

async function verifyMethods(run,methods,surface){
 const bindings=[];
 const design=await stageDesignGuidance(run.directory,'review',{...run.manifest.onboarding?.config?.designGuidance,taste:surface,dials:undefined});
 const ojo=await stageOjoGuidance(run.directory,'review');
 const local=await stageLocalMethods(run.directory);
 const prefixes=[design.metadata.reference+'/',ojo.metadata.reference+'/',local.reference+'/'];
 for(const row of methods){
  if(!prefixes.some(prefix=>row.path.startsWith(prefix)))throw Error('Method application must cite a staged complete method, not an authored summary.');
  const content=(await readVerificationFile(run.directory,row.path,2*1024*1024)).toString('utf8');
  if(!row.path.endsWith('.md')||!content.includes(row.quote))throw Error('Method quote does not match its Markdown snapshot.');
  bindings.push({path:row.path,sha256:hash(content)});
 }
 if(surface==='public-page'&&!methods.some(row=>row.path.includes('/web-taste/')))throw Error('Public websites require an applied web-taste method.');
 return bindings;
}
function assertReferences(audit,sources){
 const refs=new Map(sources.map(ref=>[ref.id||ref.path,ref]));
 if(refs.size!==sources.length)throw Error('Duplicate selected design source identities.');
 const used=new Set();
 for(const row of audit.designBasis.sources){
  const ref=refs.get(row.source);
  if(!ref||ref.sha256!==row.sha256||used.has(row.source))throw Error('Design basis must match a unique actual selected source and hash.');
  used.add(row.source);
  // Selecting a public reference never establishes a target project requirement.
  if(ref.id&&row.authority!=='reference')throw Error('Selected external sources are references, not approved project rules.');
  if(row.authority==='project-rule'&&runObserved(ref))throw Error('Observed extraction cannot become a project rule.');
  if(!ref.content.includes(row.section))throw Error('Design basis section is absent from the selected source.');
 }
 if(used.size!==refs.size)throw Error('Explain adaptation or rejection of every selected design source.');
}
const runObserved=ref=>ref.origin==='observed'||ref.status==='observed';
export async function experienceContext(directory,surface='app-screen'){
 if(!['app-screen','public-page'].includes(surface))throw Error('Choose public-page or app-screen.');
 const run=await loadRun(directory),bound=await binding(run);
 const design=await stageDesignGuidance(directory,'review',{...run.manifest.onboarding?.config?.designGuidance,taste:surface,dials:undefined});
 const ojo=await stageOjoGuidance(directory,'review'),local=await stageLocalMethods(directory);
 return {localMethods:local,policy:EXPERIENCE_POLICY,project:run.spec.project,surface,originals:bound.originals,designSources:bound.sources,designGuidance:design.metadata,ojo:ojo.metadata,auditSchema,decisionSchema,instructions:'Read every complete readFirst method and actual source; consult the remaining staged methods only for a demonstrated task need. Planning and learning share the existing decision/review/candidate records, not additional reports. Contract-only methods are guidance, not executed analyzers. Inspect originals; write the audit before formal diagnosis. Record user constraints separately from operator proposals. A quoted method is provenance, not proof of execution. Missing evidence stays unknown. No page edits.'};
}
export async function saveExperienceRecord(directory,phase,input){
 if(!['audit','decision'].includes(phase))throw Error('Choose audit or decision.');
 validate(phase,input);
 return withRunLock(directory,async()=>{
  const run=await loadRun(directory),key=phase==='audit'?'experienceAudit':'designDecision';
  if(run.manifest.mode!=='review'||run.manifest[key]||run.manifest.plan||run.manifest.execution||run.manifest.captures.after||run.manifest.judgment)throw Error('Experience records are immutable review inputs; continue in a fresh run.');
  if(!run.manifest.captures.before)throw Error('Capture before evidence first.');
  if(phase==='audit'&&(run.manifest.diagnosis||run.manifest.confirmation))throw Error('Audit and reference adaptation precede formal diagnosis. Continue in a fresh run.');
  const bound=await binding(run);
  if(!bound.originals.length)throw Error('Experience audit requires original before screenshots.');
  let audit,methodBindings;
  if(phase==='audit'){
   const ids=input.issues.map(row=>row.id);if(new Set(ids).size!==ids.length)throw Error('Duplicate audit problem IDs.');
   if(input.checks.length!==AUDIT_DIMENSIONS.length||AUDIT_DIMENSIONS.some(dimension=>!input.checks.some(row=>row.dimension===dimension)))throw Error('Audit must cover each task/detail dimension exactly once, including unknowns.');
   const refs=new Set(bound.originals.map(row=>row.path));
   for(const row of [...input.journey,...input.issues,...input.checks]){
    if(row.screenshotRefs.some(ref=>!refs.has(ref)))throw Error('Audit cites an unavailable before original.');
    if(row.status==='observed'&&!row.screenshotRefs.length)throw Error('Observed checks require a screenshot anchor; runtime claims additionally require real action records.');
   }
   assertReferences(input,bound.sources);methodBindings=await verifyMethods(run,input.methods,input.surface);
  }else{
   audit=await readExperienceRecord(run,'audit');
   if(!run.manifest.diagnosis||run.manifest.confirmation?.verdict!=='supported'||input.findingId!==run.manifest.confirmation.findingId)throw Error('Decision requires the current diagnosed and confirmed repair scope.');
   if(input.problemIds.some(id=>!audit.data.issues.some(row=>row.id===id)))throw Error('Decision must trace to audited problems.');
   if(!input.alternatives.some(row=>['preserve','lighter'].includes(row.kind)))throw Error('Compare a lighter alternative or preservation before adding structure.');
   const sources=audit.data.designBasis.sources.map(row=>row.source);
   if(input.referenceApplications.length!==sources.length||new Set(input.referenceApplications.map(row=>row.source)).size!==sources.length||input.referenceApplications.some(row=>!sources.includes(row.source)))throw Error('Decision must explain application or rejection and verification of each design basis.');
   methodBindings=await verifyMethods(run,input.methods,audit.data.surface);
  }
  const record={version:EXPERIENCE_POLICY,phase,runId:run.manifest.id,methodBindings,baseline:bound.hash,...(audit?{auditHash:run.manifest.experienceAudit.sha256,scopeHash:digest(run.manifest.confirmation),diagnosisHash:hash(await readVerificationFile(directory,run.manifest.diagnosis.path,2*1024*1024))}:{}),data:input};
  const bytes=JSON.stringify(record,null,2)+'\n',sha256=hash(bytes),path=`experience/${phase}-${sha256}.json`;
  await mkdir(join(directory,'experience'),{recursive:true});if(await realpath(join(directory,'experience'))!==join(await realpath(directory),'experience'))throw Error('Experience storage cannot use symlinks.');await writeFile(join(directory,path),bytes,{flag:'wx'});
  run.manifest.experiencePolicy=EXPERIENCE_POLICY;run.manifest[key]={path,sha256,...(phase==='audit'?{surface:input.surface}:{})};
  await writeJson(join(directory,'run.json'),run.manifest);return run.manifest[key];
 });
}
export async function readExperienceRecord(run,phase){
 const ref=run.manifest[phase==='audit'?'experienceAudit':'designDecision'];
 if(!ref||ref.path!==`experience/${phase}-${ref.sha256}.json`||!/^[a-f0-9]{64}$/.test(ref.sha256))throw Error('Missing or invalid experience '+phase+'; record it before continuing.');
 const bytes=await readVerificationFile(run.directory,ref.path,512*1024);
 if(hash(bytes)!==ref.sha256)throw Error('Experience '+phase+' changed.');
 const record=JSON.parse(bytes);validate(phase,record.data);
 if(record.runId!==run.manifest.id||record.phase!==phase||record.version!==EXPERIENCE_POLICY||record.baseline!==(await binding(run)).hash)throw Error('Experience evidence or task changed; continue in a fresh run.');
 if(phase==='audit'){
  if(ref.surface!==record.data.surface)throw Error('Experience surface changed.');
  assertReferences(record.data,await designSourceContext(run));
 }else{
  await readExperienceRecord(run,'audit');
  if(record.auditHash!==run.manifest.experienceAudit.sha256||record.scopeHash!==digest(run.manifest.confirmation)||record.diagnosisHash!==hash(await readVerificationFile(run.directory,run.manifest.diagnosis.path,2*1024*1024)))throw Error('Design decision scope changed.');
 }
 if(!Array.isArray(record.methodBindings)||record.methodBindings.length!==record.data.methods.length)throw Error('Method bindings missing.');
 for(const [index,row] of record.data.methods.entries()){const ref=record.methodBindings[index];if(ref.path!==row.path||hash(await readVerificationFile(run.directory,row.path,2*1024*1024))!==ref.sha256)throw Error('Applied method snapshot changed.');}
 return record;
}
export async function experienceFor(run,phase='audit'){
 if(!experienceRequired(run))return null;
 const audit=await readExperienceRecord(run,'audit');
 return {methodRoot:run.directory,policy:EXPERIENCE_POLICY,audit:audit.data,...(phase==='decision'?{decision:(await readExperienceRecord(run,'decision')).data}:{}),auditHash:run.manifest.experienceAudit.sha256,...(phase==='decision'?{decisionHash:run.manifest.designDecision.sha256}:{})};
}
export const EXPERIENCE_INSTRUCTIONS='Start from the original user task and baseline, then inspect the candidate; only then read the operator decision and verification counts. Operator proposals and hypotheses are not user requirements or defects. Challenge a compliant solution that worsens hierarchy, grouping, density, reading distance, action clarity or content burden. Compare the lighter/preserve alternative. Tables and labels can be appropriate for comparison tasks; do not ban a format or count fields. Evaluate real component states, grid relationships and source adaptation. Current normal-page task/detail checks precede responsive regressions. Missing evidence is not a pass. Method availability or a quote never proves it was executed.';
