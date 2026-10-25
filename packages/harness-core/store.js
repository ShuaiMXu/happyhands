import {designSourceBrief,designSourcesDigest} from './design-sources.js';
import {verifyBaselineDiagnosis} from './baseline-diagnosis-record.js';
import {foundationRuleFields,foundationWithPatternAdmissions} from '../experience-core/foundation.js';
import {judgmentHash,readJudgmentWithdrawal,JUDGMENT_WITHDRAWAL} from './judgment-withdrawal.js';
import {stageProjectMemory,projectMemoryBrief,projectMemoryForReview,readRunMemoryExceptions,projectMemoryDigest,verifyProjectMemory} from './project-memory.js';
import {readVerificationEvidence,verificationHash} from './verification.js';
import { captureEntries } from './capture-state.js';
import { assertVisualReview } from './visual-review.js';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, writeFile,realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { assertExperienceSpec, bootstrapBrief, codexBrief, recordJudgment, approvedFoundationFrom, foundationApprovalReference, assertFoundationApproval } from '../experience-core/index.js';
import { DEFAULT_LIMITS, visualReviewFor } from './workflow.js';
import { componentReusePlan, componentReuseBrief } from '../experience-core/component-reuse.js';
import {evidenceHash,designSystemContext,designSystemBrief} from '../skill-core/design-system.js';
import {readIncrementalCapturePlan} from './incremental-capture.js';
import {readPatternReview,patternReviewContext} from './pattern-review-record.js';
import {assertReviewStorage,bindVisualReview,readVisualReviewBinding} from './visual-review-binding.js';

const MANIFEST = 'run.json';
const SPEC = 'experience.json';

async function writeJson(path, value) {
  // Unique per write, not per process: two concurrent writers inside one
  // process (library callers, tests) would otherwise share a temp name and
  // consume each other's file at the rename.
  const temporary = `${path}.${process.pid}.${randomUUID().slice(0, 6)}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  for (let attempt = 0; ; attempt++) {
    try { await rename(temporary, path); break; }
    catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 10) throw error;
      await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
}

// Manifest-declared artifact paths are read back by later commands, and the
// ledger is a local, hand-editable file. A usable path names a file inside the
// run directory — one safe segment at a time, the same rule the export layer
// applies before publishing anything.
const RUN_RELATIVE = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*(?:\.[A-Za-z0-9_-]+)+$/;

export function runFilePath(directory, relativePath) {
  const value = String(relativePath ?? '').replaceAll('\\', '/');
  if (!RUN_RELATIVE.test(value)) {
    throw new Error(`A run artifact path must name a file inside the run directory, got ${JSON.stringify(relativePath)}`);
  }
  return join(directory, value);
}

// One writer at a time per run. Every save* reads the manifest, mutates it and
// renames a replacement into place; without a lock, two harness processes
// working the same run would silently drop each other's stage records. The lock
// is a file created exclusively, naming the owning pid, and a lock whose pid no
// longer exists is reclaimed as stale. Like every advisory lock this is
// best-effort: it covers a single-user CLI, not a shared server.
const LOCK_FILE = 'run.lock';

function processAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; } // exists, but is not ours to signal
}

export async function withRunLock(directory, operation, { maxAttempts = 100, intervalMs = 50 } = {}) {
  const lockPath = join(directory, LOCK_FILE);
  for (let attempt = 0; ; attempt++) {
    try {
      const handle = await open(lockPath, 'wx');
      try { await handle.writeFile(`${process.pid}\n`, 'utf8'); } finally { await handle.close(); }
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner = null;
      try { owner = Number((await readFile(lockPath, 'utf8')).trim()); } catch { /* an unreadable lock is stale */ }
      // A lock naming this same pid is live, not stale: a process can hold the
      // lock in one async flow while another waits on it. Only a pid that no
      // longer exists (or a lock that cannot be read) is reclaimable.
      const stale = !Number.isInteger(owner) || owner <= 0 || !processAlive(owner);
      if (stale) {
        // Two racing reclaimers both remove; the exclusive create settles who owns it next.
        await rm(lockPath, { force: true });
      } else if (attempt >= maxAttempts) {
        throw new Error(`Another harness writer (pid ${owner}) is writing to this run; retry when it finishes.`);
      } else {
        await new Promise(wait => setTimeout(wait, intervalMs));
      }
    }
  }
  try { return await operation(); } finally {
    // A failed release must not mask the operation's own error; a lock left
    // behind is reclaimable as stale once its pid is gone.
    await rm(lockPath, { force: true }).catch(() => {});
  }
}

export async function createRun({ spec, url, outputRoot, id = randomUUID().slice(0, 8), mode = 'review', entry = null }) {
  assertExperienceSpec(spec);
  if (!['review', 'bootstrap'].includes(mode)) throw new Error('Run mode must be review or bootstrap.');
  const parsed = url ? new URL(url) : null;
  if (parsed && !['http:', 'https:'].includes(parsed.protocol)) throw new Error('Capture URL must use http or https.');
  if (!parsed && mode !== 'bootstrap') throw new Error('A review run requires a capture URL.');
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(id)) throw new Error('Run ID must be 4–64 letters, digits, underscores or hyphens.');
  const directory = resolve(outputRoot, id);
  await mkdir(directory, { recursive: false });
  const manifest = {
    version: '0.1',
    id,
    createdAt: new Date().toISOString(),
    limits: { ...DEFAULT_LIMITS },
    source: spec.project.source,
    mode,
    url: parsed ? parsed.href : null,
    entry,
    baseline: null,
    foundationApproval: null,
    findingId: null,
    confirmation: null,
    captures: { before: null, after: null },
    foundationInventory: null,
    plan: null,
    execution: null,
    skills: [],
    visualReviews: [],
    diagnosis: null,
    evaluation: null,
    judgment: null
  };
  await writeJson(join(directory, SPEC), spec);
  await writeJson(join(directory, MANIFEST), manifest);
  return { directory, manifest };
}

export async function saveOnboarding(directory, onboarding) {
  return withRunLock(directory, async () => {
    const run = await loadRun(directory);
    run.manifest.onboarding = onboarding;
    await writeJson(join(run.directory, MANIFEST), run.manifest);
    return run.manifest;
  });
}

export async function saveDiagnosis(directory, diagnosis) {
  return withRunLock(directory, async () => {
    const run = await loadRun(directory);
    const memory=await projectMemoryForReview(run);
    await verifyBaselineDiagnosis(run,diagnosis);
    const report={...diagnosis};
    delete report.projectMemory;
    if(memory)report.projectMemory=memory;
    await writeJson(join(run.directory, 'diagnosis.json'), report);
    run.manifest.diagnosis = {
      path: 'diagnosis.json',
      schemaVersion: diagnosis.schemaVersion,
      evaluatorVersion: diagnosis.evaluatorVersion,
      findingCount: diagnosis.findings.length,
      scoreStatus: diagnosis.experienceScore.status,
      generatedAt: diagnosis.generatedAt
    };
    if(memory)run.manifest.diagnosis.projectMemory=memory.reference;
    await writeJson(join(run.directory, MANIFEST), run.manifest);
    return run.manifest;
  });
}

export async function loadRun(directory) {
  const root = resolve(directory);
  const manifest = JSON.parse(await readFile(join(root, MANIFEST), 'utf8'));
  const spec = assertExperienceSpec(JSON.parse(await readFile(join(root, SPEC), 'utf8')));
  if (manifest.version !== '0.1') throw new Error('Unsupported run version.');
  if (!Array.isArray(manifest.skills)) manifest.skills = [];
  if (!Array.isArray(manifest.visualReviews)) manifest.visualReviews = [];
  manifest.limits = { ...DEFAULT_LIMITS, ...(manifest.limits || {}) };
  if (!manifest.mode) manifest.mode = 'review';
  const withdrawal=await readJudgmentWithdrawal(root,manifest.judgment,manifest.id);
  if(manifest.judgmentWithdrawal&&!withdrawal)throw Error('Judgment withdrawal artifact is missing.');
  if(withdrawal)manifest.judgmentWithdrawal={...withdrawal,path:JUDGMENT_WITHDRAWAL};
  let executionContext=null,hasExecutionContext=false;
  try{executionContext=JSON.parse(await readFile(join(root,'execution-context.json'),'utf8'));hasExecutionContext=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  if(hasExecutionContext){
    if(!executionContext||!manifest.plan||executionContext.schemaVersion!=='0.1'||executionContext.runId!==manifest.id||executionContext.planHash!==projectMemoryDigest(manifest.plan)||!Number.isFinite(Date.parse(executionContext.recordedAt)))throw Error('Execution context changed or its plan is no longer available.');
    manifest.executionContext={...executionContext,path:'execution-context.json'};
  }else if(manifest.executionContext)throw Error('Execution context artifact is missing.');
  return { directory: root, manifest, spec };
}

// A bootstrap run has no baseline because the surface does not exist. The absence is
// recorded with its reason instead of being replaced by a placeholder capture.
export async function recordAbsentBaseline(directory, reason, entries = []) {
  return withRunLock(directory, async () => {
    const run = await loadRun(directory);
    if (run.manifest.mode !== 'bootstrap') throw new Error('Only a bootstrap run can record an absent baseline; capture one instead.');
    if (run.manifest.captures.before) throw new Error('This run already has a baseline capture.');
    if (run.manifest.baseline) throw new Error('This run already recorded why the baseline is absent.');
    if (!reason?.trim()) throw new Error('Recording an absent baseline requires a reason.');
    run.manifest.baseline = { status: 'absent', reason: reason.trim(), entries, at: new Date().toISOString() };
    await writeJson(join(run.directory, MANIFEST), run.manifest);
    return run.manifest;
  });
}

export async function stagePatternAdmission(directory,{reviewId,repo,expectedFoundation}){
  const {readPatternAdmissions,currentPatternProposal,admittedPatternEntry}=await import('./pattern-admission.js');
  return withRunLock(directory,async()=>{
    const run=await loadRun(directory);
    if(run.manifest.foundationApproval||run.manifest.plan||run.manifest.execution||run.manifest.captures.after)throw Error('Pattern admission is frozen after Foundation approval or planning; start a new run.');
    if(run.manifest.mode!=='bootstrap'&&!run.manifest.captures.before)throw Error('Capture the current product before staging a shared pattern.');
    if(!run.spec.designFoundation)throw Error('Extract the current Foundation before staging a pattern.');
    if(!expectedFoundation||evidenceHash(expectedFoundation)!==evidenceHash(run.spec.designFoundation))throw Error('Foundation changed before pattern admission; reload the current review.');
    const reference=run.manifest.patternReviews?.find(item=>item.id===reviewId);
    if(!reference)throw Error('A registered pattern guidance review is required.');
    const reviewed=await currentPatternProposal(run,reference,repo),records=await readPatternAdmissions(run);
    const prior=(run.manifest.patternAdmissions||[]).find(item=>item.reviewId===reviewId);
    if(prior)return prior;
    if(records.length>=128)throw Error('Pattern admission limit reached; review this Foundation version first.');
    if(records.some(record=>record.entry.source===reference.source)||run.spec.designFoundation.patterns.some(item=>item.source===reference.source&&item.name===reviewed.input.candidate.name))throw Error('A pattern for this source already exists; use explicit replacement instead of adding a duplicate.');
    const id=randomUUID(),entry=admittedPatternEntry(run.manifest.id,id,reference,reviewed);
    const record={schemaVersion:'0.1',id,runId:run.manifest.id,action:'stage-for-foundation-review',recordedAt:new Date().toISOString(),review:reference,baseFoundationHash:evidenceHash(run.spec.designFoundation),entry};
    assertExperienceSpec({...run.spec,designFoundation:foundationWithPatternAdmissions(run.spec.designFoundation,[...records,record])});
    const bytes=JSON.stringify(record,null,2)+'\n';if(Buffer.byteLength(bytes)>1024*1024)throw Error('Pattern admission exceeds 1 MiB.');
    await mkdir(join(run.directory,'pattern-admissions'),{recursive:true});
    if(await realpath(join(run.directory,'pattern-admissions'))!==join(await realpath(run.directory),'pattern-admissions'))throw Error('Pattern admissions cannot use links.');
    const path=`pattern-admissions/${id}.json`;await writeFile(join(run.directory,path),bytes,{flag:'wx'});
    const admitted={id,path,hash:evidenceHash(bytes),entryHash:evidenceHash(entry),source:entry.source,reviewId};
    run.manifest.patternAdmissions=[...(run.manifest.patternAdmissions||[]),admitted];await writeJson(join(run.directory,MANIFEST),run.manifest);return admitted;
  });
}

export async function saveFoundationApproval(directory, input) {
  const {readPatternAdmissions,currentPatternProposal}=await import('./pattern-admission.js');
  return withRunLock(directory, async () => {
    const run = await loadRun(directory);
    if (run.manifest.mode !== 'bootstrap' && !run.manifest.captures.before) throw new Error('Capture the current product before approving its foundation.');
    if (run.manifest.plan || run.manifest.execution || run.manifest.captures.after) throw new Error('Foundation approval cannot change after page planning begins; start a new run for another version.');
    if (run.manifest.foundationApproval) throw new Error('This run already records a Foundation Approval; start a new run for another version.');
    // New evidence-bearing candidates cannot disappear or lose provenance via
    // a direct API call. Replacement changes the rule, not its observed source.
    const collections=foundation=>({tokens:foundation?.tokens||[],components:foundation?.components||[],patterns:foundation?.patterns||[],assets:foundation?.brand?.assets||[]});
    const admissions=await readPatternAdmissions(run),submitted=collections(input?.foundation);
    const observedFoundation=foundationWithPatternAdmissions(run.spec.designFoundation,admissions);
    for(const [collection,observedItems]of Object.entries(collections(observedFoundation))){
      if(!observedItems.some(item=>item.evidence))continue; // Legacy/manual snapshots remain supported.
      const items=submitted[collection];
      if(items.length!==observedItems.length)throw Error(`Foundation ${collection} must retain every candidate exactly once; approve, replace or deprecate instead of adding/removing entries.`);
      const used=new Set();
      for(const observed of observedItems){
        const matches=items.map((item,index)=>({item,index})).filter(({item})=>item.name===observed.name&&(observed.evidence
          ? JSON.stringify(item.evidence)===JSON.stringify(observed.evidence)
          : (item.decision?.previous?.source||item.source)===observed.source));
        if(matches.length!==1||used.has(matches[0]?.index))throw Error(`Foundation evidence must be retained exactly once for ${collection}/${observed.name}.`);
        const {item:match,index}=matches[0];used.add(index);
        if(match.decision?.action!=='replace'&&JSON.stringify(foundationRuleFields(match))!==JSON.stringify(foundationRuleFields(observed)))throw Error(`Changed Foundation rule ${observed.name} requires a replacement decision.`);
        if(match.decision?.action==='replace'&&JSON.stringify(match.decision.previous)!==JSON.stringify(foundationRuleFields(observed)))throw Error(`Foundation replacement must preserve previous values for ${observed.name}.`);
      }
    }
    assertFoundationApproval(input);
    for(const pattern of input.foundation.patterns){
      const provenance=pattern.evidence?.provenance;
      if(provenance?.type!=='pattern-guidance-admission')continue;
      const admitted=admissions.find(record=>record.id===provenance.admissionId&&provenance.runId===run.manifest.id);
      if(!admitted){
        if(!run.spec.designFoundation?.patterns.some(item=>JSON.stringify(item.evidence)===JSON.stringify(pattern.evidence)))throw Error('Pattern guidance must be registered for Foundation review before approval.');
      }else if(pattern.status!=='deprecated')await currentPatternProposal(run,admitted.review,run.manifest.onboarding?.repository?.root);
    }
    const approval = structuredClone(input);
    approval.reviewedAt ||= new Date().toISOString();
    const nextSpec = structuredClone(run.spec);
    nextSpec.designFoundation = approvedFoundationFrom(approval);
    assertExperienceSpec(nextSpec);
    const file = `foundation-${approval.foundationVersion}.json`;
    await writeJson(join(run.directory, file), approval);
    await writeJson(join(run.directory, SPEC), nextSpec);
    run.manifest.foundationApproval = { ...foundationApprovalReference(approval), path: file };
    await writeJson(join(run.directory, MANIFEST), run.manifest);
    return run.manifest;
  });
}

// Extraction is evidence gathering, not approval. It may populate an observed
// candidate before planning starts, but it never replaces a frozen human
// approval or changes the brief after implementation planning has begun.
export async function saveFoundationInventory(directory, inventory, foundation = null) {
  return withRunLock(directory, async () => {
    const run = await loadRun(directory);
    const record = structuredClone(inventory);
    record.at ||= new Date().toISOString();
    record.materialized = false;
    if (foundation) {
      if (run.manifest.foundationApproval || run.spec.designFoundation?.status === 'approved') {
        record.materializationReason = 'approved-foundation-frozen';
      } else if (run.manifest.plan || run.manifest.execution || run.manifest.captures.after) {
        record.materializationReason = 'workflow-already-planned';
      } else {
        const nextSpec = structuredClone(run.spec);
        nextSpec.designFoundation = structuredClone(foundation);
        assertExperienceSpec(nextSpec);
        await writeJson(join(run.directory, SPEC), nextSpec);
        record.materialized = true;
        record.materializationReason = 'observed-candidate-saved';
      }
    }
    run.manifest.foundationInventory = record;
    await writeJson(join(run.directory, MANIFEST), run.manifest);
    return record;
  });
}

export async function savePatternReview(directory,reference,expectedContextHash){
  return withRunLock(directory,async()=>{
    const run=await loadRun(directory);
    if(patternReviewContext(run)!==expectedContextHash)throw Error('Pattern review context changed before publication.');
    await readPatternReview(run,reference);
    const previous=(run.manifest.patternReviews||[]).find(item=>item.id===reference.id||item.inputDigest===reference.inputDigest);
    if(previous){await readPatternReview(run,previous);if(previous.id===reference.id&&JSON.stringify(previous)!==JSON.stringify(reference))throw Error('Pattern review already exists with different evidence.');return previous;}
    run.manifest.patternReviews=[...(run.manifest.patternReviews||[]),reference];
    await writeJson(join(run.directory,MANIFEST),run.manifest);return reference;
  });
}

export async function saveSkillResult(directory, result, { retry = false, expectedPath = null } = {}) {
  return withRunLock(directory, async () => {
    const run = await loadRun(directory);
    const previous = run.manifest.skills.find(item => item.id === result.skill.id);
    if (previous && !retry) throw new Error(`Skill ${result.skill.id} already ran; request an explicit retry.`);
    if ((previous?.path || null) !== expectedPath) throw new Error('Skill result changed during execution; reload before retrying.');
    if (retry && (!previous || previous.status === 'complete' || run.manifest.confirmation || run.manifest.plan || run.manifest.execution || run.manifest.judgment)) throw new Error('Retry requires an incomplete result before confirmation and planning; start a new run.');
    const target = previous ? `skills/${result.skill.id}-${randomUUID()}.json` : `skills/${result.skill.id}.json`;
    await mkdir(join(run.directory, 'skills'), { recursive: true });
    await writeJson(runFilePath(run.directory, target), result);
    if (previous) {
      run.manifest.skillAttempts ||= [];
      run.manifest.skillAttempts.push(previous);
      run.manifest.skills = run.manifest.skills.filter(item => item.id !== result.skill.id);
      run.manifest.diagnosis = null;
    }
    run.manifest.skills.push({ id: result.skill.id, version: result.skill.version, status: result.status, path: target, runAt: result.runAt });
    await writeJson(join(run.directory, MANIFEST), run.manifest);
    return run.manifest;
  });
}

export async function saveReviewAttachment(directory, { screenshot, fingerprint, image, notes }) {
  return withRunLock(directory, async () => {
    const run = await loadRun(directory);
    const qa=run.manifest.visualReviews?.find(item=>item.skillId==='visual-qa-evaluator');
    if(run.manifest.judgment||run.manifest.judgmentWithdrawal||(qa&&(qa.verdict!=='fail'||qa.reviewer?.type!=='model')))throw new Error('Visual QA is already recorded; start a new review.');
    if(qa)await readVisualReviewBinding(run,qa,{requireBound:true});
    if (!/^(before|after)\/[a-z0-9][a-z0-9_-]*\.png$/.test(screenshot || '')) throw new Error('Invalid attachment screenshot');
    const captures = Object.values(run.manifest.captures || {}).flatMap(capture => captureEntries(capture));
    if (!captures.some(entry => entry.screenshot === screenshot)) throw new Error('Attachment screenshot is absent from this run');
    const hash = value => createHash('sha256').update(value).digest('hex');
    if (hash(await readFile(runFilePath(directory, screenshot))) !== fingerprint) throw new Error('Attachment source changed; reopen the canvas');
    if (!Buffer.isBuffer(image) || image.length > 12*1024*1024 || !image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Attachment must be a PNG under 12 MB');
    if (typeof notes !== 'string' || !notes.trim() || notes.length > 20000) throw new Error('Attachment notes are required');
    const id = randomUUID(), path = `reviews/attachments/${id}.png`;
    await mkdir(join(directory,'reviews','attachments'),{recursive:true});
    await writeFile(runFilePath(directory,path),image,{flag:'wx'});
    const record = {id,path,screenshot,fingerprint,imageHash:hash(image),notes:notes.trim(),createdAt:new Date().toISOString()};
    run.manifest.reviewAttachments ||= [];
    run.manifest.reviewAttachments.push(record);
    await writeJson(join(directory,MANIFEST),run.manifest);
    return record;
  });
}

export async function saveVisualReview(directory, review, { screenshotHashes = {} } = {}) {
  return withRunLock(directory, async () => {
    const run = await loadRun(directory);
    const verification=await readVerificationEvidence(directory,run.manifest);
    assertVisualReview(review, {...run.manifest,verificationRecords:verification.records});
    const expectedHashes={...screenshotHashes};
    for (const id of review.attachmentRefs || []) {
      const attachment = run.manifest.reviewAttachments.find(item => item.id === id);
      if (attachment.path !== `reviews/attachments/${id}.png`) throw new Error('Invalid review attachment path');
      for (const [path, expected] of [[attachment.path,attachment.imageHash],[attachment.screenshot,attachment.fingerprint]]) {
        if(expectedHashes[path]&&expectedHashes[path]!==expected)throw Error('Visual review attachment or source changed');
        expectedHashes[path]=expected;
      }
    }
    if (!Array.isArray(run.manifest.visualReviews)) run.manifest.visualReviews = [];
    const previous=run.manifest.visualReviews.find(item=>item.skillId===review.skillId);
    if(review.attempt){if(!previous)throw Error('Review retry has no prior attestation.');const {assertProtocolRetry,assertEvidenceRetry}=await import('./review-retry.js');await (review.attempt.kind==='evidence-retry'?assertEvidenceRetry:assertProtocolRetry)(run,previous,review);}
    if(previous && !review.attempt && (review.skillId!=='visual-qa-evaluator'||!verification.digest||previous.verificationDigest===verification.digest||run.manifest.judgment))throw new Error(`Visual review for ${review.skillId} already exists in this run.`);
    if(previous){run.manifest.visualReviewHistory=[...(run.manifest.visualReviewHistory||[]),previous];run.manifest.visualReviews=run.manifest.visualReviews.filter(item=>item!==previous);}
    await assertReviewStorage(run.directory);
    const path = previous ? `reviews/${review.skillId}-${review.attempt?verificationHash(randomUUID()):verification.digest}.json` : `reviews/${review.skillId}.json`;
    await writeJson(runFilePath(run.directory, path), review);
    const evidenceBinding=await bindVisualReview({...run,manifest:{...run.manifest,verificationRecords:verification.records}},review,path,expectedHashes);
    run.manifest.visualReviews.push({ skillId: review.skillId, verdict: review.verdict, reviewer: review.reviewer, reviewedAt: review.reviewedAt, path, evidenceBinding, ...(verification.digest?{verificationDigest:verification.digest}:{}) });
    await writeJson(join(run.directory, MANIFEST), run.manifest);
    return run.manifest;
  });
}

export async function saveCapture(directory, phase, capture) {
  if (!['before', 'after'].includes(phase)) throw new Error('Phase must be before or after.');
  return withRunLock(directory, async () => {
    const run = await loadRun(directory);
    const selectedDesignSources=await designSourceBrief(run);
    const bootstrap = run.manifest.mode === 'bootstrap';
    if (bootstrap && phase === 'before') throw new Error('A bootstrap run has no baseline; record the absent baseline, then capture the first render as after.');
    // A change made outside the Harness can still be captured, in either mode, as long as the
    // run recorded what constrained it. Here that is the bootstrap plan.
    if (bootstrap && phase === 'after' && !run.manifest.plan) throw new Error('Plan the first render before capturing it.');
    if (!bootstrap && phase === 'after' && !run.manifest.captures.before) throw new Error('Capture before before capturing after.');
    if (!bootstrap && phase === 'after' && run.manifest.confirmation?.verdict !== 'supported') throw new Error('Confirm a supported finding before capturing after.');
    if (run.manifest.captures[phase]) throw new Error(`${phase} is already captured; start a new run for another comparison.`);
    run.manifest.captures[phase] = capture;
    await writeJson(join(run.directory, MANIFEST), run.manifest);
    return run.manifest;
  });
}

export async function saveDesignSystemExtraction(directory, extraction) {
  return withRunLock(directory, async () => {
    const run=await loadRun(directory),phase=extraction.phase;
    if(!['before','after'].includes(phase)||!run.manifest.captures[phase])throw Error('A matching capture is required for design system extraction.');
    if(extraction.captureHash!==evidenceHash(run.manifest.captures[phase]))throw Error('Design system capture binding changed.');
    if(run.manifest.designSystemExtractions?.[phase])throw Error('Design system extraction is immutable; start a new run.');
    if(phase==='before'&&(run.manifest.plan||run.manifest.execution||run.manifest.captures.after))throw Error('Cannot attach baseline design system evidence after planning.');
    const path=`${phase}/design-system.json`,bytes=JSON.stringify(extraction,null,2)+'\n';
    await mkdir(join(run.directory,phase),{recursive:true});
    await writeFile(join(run.directory,path),bytes,'utf8');
    const record={path,hash:evidenceHash(bytes),status:extraction.status,sourceHash:extraction.source.snapshotHash};
    run.manifest.designSystemExtractions={...run.manifest.designSystemExtractions,[phase]:record};
    await writeJson(join(run.directory,MANIFEST),run.manifest);
    return record;
  });
}

export async function savePlan(directory, findingId) {
  return withRunLock(directory, async () => {
    const run = await loadRun(directory);
    if(run.manifest.patternAdmissions?.length&&!run.manifest.foundationApproval)throw Error('Review staged patterns and approve a Foundation version before planning.');
    if(run.manifest.executionContext)throw Error('The execution context is locked. Start a new review to change its plan.');
    const selectedDesignSources = await designSourceBrief(run);
    const bootstrap = run.manifest.mode === 'bootstrap';
    if (run.manifest.captures.after) throw new Error(`Cannot revise the plan after the ${bootstrap ? 'first render' : 'comparison'} capture.`);
    if (bootstrap) {
      if (findingId) throw new Error('A bootstrap run has no findings to plan against; it is constrained by the approved design foundation.');
      if (!run.manifest.baseline) throw new Error('Record why the baseline is absent before planning a first render.');
      if (!run.manifest.foundationApproval) throw new Error('Record a versioned Foundation Approval before planning a first render.');
      // The approved Foundation replaces the confirmed Finding as the gate: with nothing rendered,
      // there is no evidence to confirm, so the constraint has to come from the spec.
      const memory=await stageProjectMemory(run);
      const brief = bootstrapBrief(run.spec, { entries: run.manifest.baseline.entries || [], reason: run.manifest.baseline.reason, approval: run.manifest.foundationApproval })+projectMemoryBrief(memory)+selectedDesignSources;
      await writeFile(join(run.directory, 'codex-brief.md'), brief, 'utf8');
      run.manifest.plan = { path: 'codex-brief.md', kind: 'bootstrap', briefHash: createHash('sha256').update(brief).digest('hex'), foundationVersion: run.manifest.foundationApproval.foundationVersion, createdAt: new Date().toISOString() };
      if(selectedDesignSources)run.manifest.plan.designSourcesDigest=designSourcesDigest(run.manifest.onboarding.config.designSources);
      if(memory)run.manifest.plan.projectMemory=memory;
      await writeJson(join(run.directory, MANIFEST), run.manifest);
      return run.manifest;
    }
    if (!run.manifest.captures.before) throw new Error('Capture the baseline before planning a change.');
    if (run.manifest.confirmation?.verdict !== 'supported' || run.manifest.confirmation.findingId !== findingId) {
      throw new Error('Confirm this finding against the current baseline before planning.');
    }
    const designSystem = (await designSystemContext(run)).before;
    const incrementalCapture=await readIncrementalCapturePlan(run);
    const reuse = componentReusePlan(run.spec, findingId, designSystem);
    const reusePath = 'component-reuse-plan.json';
    await writeJson(join(run.directory, reusePath), reuse);
    const memory=await stageProjectMemory(run);
    const captureScope=incrementalCapture?`\n\nIncremental capture scope (declared entry dependencies, not a whole-site pass):\n${JSON.stringify(incrementalCapture.selection)}\nOnly the selected states have current before evidence. If the change requires an excluded route/state or a new unknown/global dependency, stop and request a full baseline instead of silently widening the edit or claiming skipped pages were reviewed.\n`:'';
    let requestContext = '';
    try {
      const request = JSON.parse(await readFile(join(directory,'change-request.json'),'utf8'));
      requestContext = `\n\nRequest provenance: ${join(directory,'change-request.json')}\n${request.annotationPath === 'canvas-reference.png' ? 'Annotated reference: '+join(directory,'canvas-reference.png') : ''}\nInspect the fresh baseline before editing. If it contradicts this request, explain and stop.\n`;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const confirmedScope = `\n\n## Human-confirmed scope\n\nConfirmation note (JSON string): ${JSON.stringify(run.manifest.confirmation.note)}\n\nThis confirmation narrows the diagnosis proposal. Follow these explicit boundaries; do not implement unconfirmed suggestions.\n`;
    const brief = codexBrief(run.spec, findingId) + confirmedScope + componentReuseBrief(reuse) + designSystemBrief(designSystem) + (run.manifest.foundationApproval ? `\n\nApproved Foundation version: ${run.manifest.foundationApproval.foundationVersion}\nApproval artifact: ${run.manifest.foundationApproval.path}\n` : '')+projectMemoryBrief(memory)+captureScope+requestContext+selectedDesignSources;
    await writeFile(join(run.directory, 'codex-brief.md'), brief, 'utf8');
    run.manifest.findingId = findingId;
    run.manifest.plan = { path: 'codex-brief.md', kind: 'fix', briefHash: createHash('sha256').update(brief).digest('hex'), confirmationHash: projectMemoryDigest(run.manifest.confirmation), componentReuse: {path: reusePath, findingId, status: reuse.status}, createdAt: new Date().toISOString() };
    if(selectedDesignSources)run.manifest.plan.designSourcesDigest=designSourcesDigest(run.manifest.onboarding.config.designSources);
    if(incrementalCapture)run.manifest.plan.incrementalCapturePlan=run.manifest.onboarding.incrementalCapturePlan;
    if(memory)run.manifest.plan.projectMemory=memory;
    await writeJson(join(run.directory, MANIFEST), run.manifest);
    return run.manifest;
  });
}

export async function saveRunMemoryException(directory,input) {
  return withRunLock(directory,async()=>{
    const run=await loadRun(directory);
    if(run.manifest.executionContext||run.manifest.execution||run.manifest.captures.after||run.manifest.judgment)throw Error('Run memory exceptions can only change before execution and before after-capture. Start a new review to change them.');
    if(!['exclude','apply'].includes(input.decision))throw Error('Choose exclude or apply for this run.');
    if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>10000)throw Error('A run exception reason is required, up to 10000 characters.');
    const memory=await projectMemoryForReview(run);
    if(!memory)throw Error('Connect this run to its local project before recording a memory exception.');
    const principle=[...memory.context.entries,...(memory.context.excludedEntries||[])].find(entry=>entry.id===input.id);
    if(!principle||principle.contentHash!==input.principleHash)throw Error('The approved principle changed or is unavailable. Reload project memory.');
    const record=await readRunMemoryExceptions(run)||{schemaVersion:'0.1',runId:run.manifest.id,events:[]};
    const event={principleId:principle.id,principleHash:principle.contentHash,decision:input.decision,reason:input.reason.trim(),recordedAt:new Date().toISOString()};
    if(run.manifest.plan){
      const brief=await readFile(runFilePath(run.directory,run.manifest.plan.path),'utf8');
      const hash=createHash('sha256').update(brief).digest('hex'),path=`project-memory-plans/${hash}.md`;
      await mkdir(join(run.directory,'project-memory-plans'),{recursive:true});
      try{await writeFile(join(run.directory,path),brief,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;if(await readFile(join(run.directory,path),'utf8')!==brief)throw Error('Archived plan changed.');}
      event.priorPlan={path,hash,metadata:run.manifest.plan};
    }
    record.events.push(event);
    const hash=projectMemoryDigest(record),path=`project-memory-exceptions/${hash}.json`;
    await mkdir(join(run.directory,'project-memory-exceptions'),{recursive:true});
    await writeFile(join(run.directory,path),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
    run.manifest.projectMemoryExceptions={path,hash};
    delete run.manifest.plan;
    await writeJson(join(run.directory,MANIFEST),run.manifest);
    return {reference:run.manifest.projectMemoryExceptions,event,planInvalidated:Boolean(event.priorPlan)};
  });
}

export async function verifiedExecutionBrief(run) {
  const refs=run.manifest.onboarding?.config?.designSources||[];
  if((refs.length||run.manifest.plan.designSourcesDigest)&&run.manifest.plan.designSourcesDigest!==designSourcesDigest(refs))throw Error('Selected design sources changed after planning. Regenerate and confirm the plan.');
  const brief = await readFile(runFilePath(run.directory, run.manifest.plan.path), 'utf8');
  if (!run.manifest.plan.briefHash || createHash('sha256').update(brief).digest('hex') !== run.manifest.plan.briefHash) throw Error('Execution brief changed or lacks an integrity binding. Regenerate the plan and confirm its scope.');
  if (run.manifest.plan.kind === 'fix' && (!run.manifest.plan.confirmationHash || projectMemoryDigest(run.manifest.confirmation) !== run.manifest.plan.confirmationHash)) throw Error('Confirmed scope changed. Reopen and confirm the scope before execution.');
  if(refs.length&&!brief.endsWith(await designSourceBrief(run)))throw Error('Execution brief does not bind the selected design sources.');
  return brief;
}

export async function beginExecutionContext(directory,repo,expectedPlanHash) {
  return withRunLock(directory,async()=>{
    const run=await loadRun(directory);
    if(!run.manifest.plan||projectMemoryDigest(run.manifest.plan)!==expectedPlanHash)throw Error('The plan changed before execution. Reload and confirm its scope.');
    await verifiedExecutionBrief(run);
    await verifyProjectMemory(run,repo);
    if(run.manifest.executionContext)return run.manifest.executionContext;
    const record={schemaVersion:'0.1',runId:run.manifest.id,planHash:expectedPlanHash,recordedAt:new Date().toISOString()};
    await writeFile(join(run.directory,'execution-context.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
    run.manifest.executionContext={...record,path:'execution-context.json'};
    await writeJson(join(run.directory,MANIFEST),run.manifest);
    return run.manifest.executionContext;
  });
}

export async function confirmFinding(directory, findingId, verdict, note) {
  return withRunLock(directory, async () => {
    const run = await loadRun(directory);
    if (!run.manifest.captures.before) throw new Error('Capture the baseline before confirming a finding.');
    if (!['supported', 'stale'].includes(verdict)) throw new Error('Verdict must be supported or stale.');
    if (typeof note !== 'string' || !note.trim()) throw new Error('A confirmation note is required.');
    if (note.trim().length > 10000) throw new Error('Confirmation note must be at most 10000 characters.');
    if (run.manifest.executionContext || run.manifest.execution) throw new Error('Cannot revise confirmation after execution has started.');
    if (run.manifest.captures.after) throw new Error('Cannot revise confirmation after the comparison capture.');
    if (!run.spec.findings.some(item => item.id === findingId)) {
      if (!run.manifest.diagnosis) throw new Error('Unknown finding.');
      const diagnosis = JSON.parse(await readFile(runFilePath(directory, run.manifest.diagnosis.path), 'utf8'));
      await verifyBaselineDiagnosis(run,diagnosis);
      const finding = diagnosis.findings.find(item => item.id === findingId);
      if (!finding || !finding.evidenceRefs?.length) throw new Error('Unknown or unsupported diagnosis finding.');
      const evidence = finding.evidenceRefs.map(id => {
        const entry = diagnosis.evidence.find(item => item.id === id);
        if (!entry) throw new Error('Diagnosis finding has unresolved evidence.');
        return {id: `diagnosis:${id}`, state: entry.state || entry.source, observation: JSON.stringify(entry), origin: entry.source==='source-code'?'source-code':'browser'};
      });
      const scale = value => Math.max(1,Math.min(5,Math.round(value)));
      run.spec.evidence.push(...evidence.filter(item=>!run.spec.evidence.some(existing=>existing.id===item.id)));
      run.spec.findings.push({id:finding.id,title:finding.title,evidenceIds:evidence.map(item=>item.id),impact:scale(finding.impact),confidence:scale(finding.confidence),effort:scale(finding.effort),proposal:finding.proposal || note.trim()});
      assertExperienceSpec(run.spec);
      await writeJson(join(run.directory,SPEC),run.spec);
    }

    run.manifest.findingId = findingId;
    run.manifest.confirmation = { findingId, verdict, note: note.trim(), at: new Date().toISOString() };
    run.manifest.plan = null;
    await writeJson(join(run.directory, MANIFEST), run.manifest);
    return run.manifest;
  });
}

export async function saveExecution(directory, execution) {
  return withRunLock(directory, async () => {
    const run = await loadRun(directory);
    if (!run.manifest.plan) throw new Error('Plan a finding before executing.');
    if (run.manifest.mode !== 'bootstrap' && (run.manifest.confirmation?.verdict !== 'supported' || run.manifest.confirmation.findingId !== run.manifest.findingId)) {
      throw new Error('Current finding is not confirmed against the baseline.');
    }
    if (run.manifest.execution) throw new Error('This run already has an execution.');
    run.manifest.execution = execution;
    await writeJson(join(run.directory, MANIFEST), run.manifest);
    return run.manifest;
  });
}

export async function saveEvaluation(directory, evaluation) {
  return withRunLock(directory, async () => {
    const run = await loadRun(directory);
    if (run.manifest.mode === 'bootstrap') {
      if (!run.manifest.captures.after) throw new Error('Capture the first render before evaluating it.');
    } else if (!run.manifest.captures.before || !run.manifest.captures.after) {
      throw new Error('Both captures are required for evaluation.');
    }
    if (run.manifest.evaluation) throw new Error('This run is already evaluated; start a new run for another comparison.');
    run.manifest.evaluation = evaluation;
    await writeJson(join(run.directory, 'evaluation.json'), evaluation);
    await writeJson(join(run.directory, MANIFEST), run.manifest);
    return run.manifest;
  });
}

export async function saveJudgment(directory, decision, reason) {
  return withRunLock(directory, async () => {
    const run = await loadRun(directory);
    if (!run.manifest.evaluation) throw new Error('Evaluate the change before recording a judgment.');
    if (run.manifest.judgment) throw new Error('This run already has a judgment; start a new run to reassess it.');
    const visualQa = visualReviewFor(run.manifest, 'visual-qa-evaluator');
    if (!visualQa) throw new Error('Independent Visual QA is required before human judgment.');
    if(decision==='accept')await readVisualReviewBinding(run,visualQa);
    if(decision==='accept')await readVerificationEvidence(directory,run.manifest);
    if (decision === 'accept' && visualQa.verdict !== 'pass') throw new Error('Cannot accept a change that did not pass independent Visual QA.');
    const updated = recordJudgment(run.spec, decision, reason);
    await writeJson(join(run.directory, SPEC), updated);
    run.manifest.judgment = { decision, reason: reason.trim(), at: new Date().toISOString() };
    await writeJson(join(run.directory, MANIFEST), run.manifest);
    return run.manifest;
  });
}

export async function withdrawJudgment(directory,reason) {
  return withRunLock(directory,async()=>{
    const run=await loadRun(directory);
    if(!run.manifest.judgment)throw Error('A recorded human judgment is required before withdrawal.');
    if(run.manifest.judgmentWithdrawal)throw Error('This judgment has already been withdrawn; start a new review to reassess it.');
    if(typeof reason!=='string'||!reason.trim()||reason.length>10000)throw Error('A withdrawal reason is required, up to 10000 characters.');
    const record={schemaVersion:'0.1',runId:run.manifest.id,judgmentHash:judgmentHash(run.manifest.judgment),reason:reason.trim(),withdrawnAt:new Date().toISOString()};
    // The immutable artifact is authoritative. loadRun derives the withdrawal
    // even if a process exits before the manifest mirror is updated.
    await writeFile(join(run.directory,JUDGMENT_WITHDRAWAL),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
    run.manifest.judgmentWithdrawal={...record,path:JUDGMENT_WITHDRAWAL};
    await writeJson(join(run.directory,MANIFEST),run.manifest);
    return run.manifest;
  });
}
