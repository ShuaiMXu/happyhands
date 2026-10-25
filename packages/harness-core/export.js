import {verifyBaselineDiagnosis} from './baseline-diagnosis-record.js';
import {readVerificationEvidence,readVerificationFile} from './verification.js';
import {readProjectMemorySnapshot,readMemoryExceptionSnapshot} from './project-memory.js';
import {JUDGMENT_WITHDRAWAL} from './judgment-withdrawal.js';
import {readRepositoryInputs} from './repository-inputs.js';
import {readIncrementalCapturePlan} from './incremental-capture.js';
import {readVisualReviewBinding} from './visual-review-binding.js';
import {readPatternReview} from './pattern-review-record.js';
import {readPatternAdmissions} from './pattern-admission.js';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { copyFile, mkdir, readFile, readdir, rename, writeFile,realpath } from 'node:fs/promises';
import { loadRun } from './store.js';
import { captureEntries, captureKey, captureOriginals } from './capture-state.js';
import { randomUUID,createHash } from 'node:crypto';
import {designSystemContext} from '../skill-core/design-system.js';

const INDEX = 'index.json';

// A run directory also holds a full Git worktree and the raw Codex event log.
// Neither belongs in a statically served folder: the worktree is a second copy
// of the target repository, and the log echoes repository content and local
// paths. Export copies an allow-list instead of walking the directory.
const CAPTURE_FILES = ['capture.json'];
const LEGACY_SCREENSHOTS = ['desktop.png', 'mobile.png'];
const RUN_FILES = ['experience.json', 'diagnosis.json', 'evaluation.json', 'codex-brief.md', 'component-reuse-plan.json', 'diff.patch', 'execution-context.json'];

async function writeJson(path, value) {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  for (let attempt = 0; ; attempt++) {
    try { await rename(temporary, path); break; }
    catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 10) throw error;
      await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
}

async function copyIfPresent(from, to) {
  try {
    await copyFile(from, to);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

// A capture's `screenshot` becomes an image URL in the workbench. Publish only
// references that name a file this export actually copies, so a hand-edited or
// future-format manifest cannot point the page outside the run folder.
function assertSafeScreenshots(manifest) {
  for (const phase of ['before', 'after']) {
    const capture = manifest.captures[phase];
    if (!capture) continue;
    const originals=captureOriginals(capture);
    if(new Set(originals).size!==originals.length)throw Error('Duplicate capture originals');
    for(const view of captureEntries(capture)){if(view.interactionParts?.length>200)throw Error('Interaction exceeds 200 original parts');for(const part of view.interactionParts||[])if(!new RegExp(`^${phase}/part-[a-f0-9]{24}-[0-9]+\\.png$`).test(part.screenshot))throw Error('Unsafe interaction original');}
    for(const view of captureEntries(capture))for(const surface of view.pageSurfaces?.surfaces||[])for(const tile of surface.tiles)if(!new RegExp(`^${phase}/surface-[a-f0-9]{24}-[0-9]+\\.png$`).test(tile.screenshot))throw Error('Unsafe page surface original');
    for (const view of captureEntries(capture)) {
      const reference = view.screenshot;
      if (reference === undefined || reference === null) continue;
      const allowed = view.legacy
        ? LEGACY_SCREENSHOTS.map(name => `${phase}/${name}`)
        : [`${phase}/${captureKey(view.stateId, view.configurationId)}.png`];
      if (!allowed.includes(reference)) {
        throw new Error(`Run ${manifest.id} has an unexpected screenshot reference for ${phase}/${view.stateId}/${view.configurationId}: ${reference}. Export publishes only ${allowed.join(' or ')}.`);
      }
    }
  }
}

// `skill.id` names a file in both the source and destination trees. Same rule
// as a run id: one plain segment, so a `..` cannot read outside the run
// directory or write outside this run's export folder.
const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

function assertSafeSkillIds(manifest) {
  for (const skill of manifest.skills) {
    if (!SEGMENT.test(String(skill.id ?? ''))) {
      throw new Error(`Run ${manifest.id} has an unusable skill id: ${skill.id}. A skill id must be one segment of letters, digits, underscores or hyphens.`);
    }
  }
}

function insideRoot(root, target) {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep) && !/^[A-Za-z]:/.test(rel));
}

// The manifest records where Codex ran on this machine. Keep the fact of a
// worktree and drop the absolute path.
function publicManifest(manifest) {
  const copy = structuredClone(manifest);
  if (copy.execution) {
    copy.execution = {
      ...copy.execution,
      worktree: basename(copy.execution.worktree || ''),
      log: undefined,
      logRetained: Boolean(copy.execution.log)
    };
    delete copy.execution.log;
  }
  if (copy.onboarding) {
    copy.onboarding = {
      ...copy.onboarding,
      config: copy.onboarding.config ? {
        ...copy.onboarding.config,
        configPath: basename(copy.onboarding.config.configPath || ''),
        repo: basename(copy.onboarding.config.repo || ''),
        start: copy.onboarding.config.start ? {
          ...copy.onboarding.config.start,
          cwd: basename(copy.onboarding.config.start.cwd || ''),
          // onboard.js now records envKeys and never the values; keep reducing a
          // legacy manifest that still carries env so older runs stay safe.
          envKeys: copy.onboarding.config.start.envKeys || Object.keys(copy.onboarding.config.start.env || {}),
          env: undefined
        } : null
      } : null,
      repository: copy.onboarding.repository ? {
        ...copy.onboarding.repository,
        root: basename(copy.onboarding.repository.root || '')
      } : null
    };
    if (copy.onboarding.config?.start) delete copy.onboarding.config.start.env;
  }
  return copy;
}

function summarise(manifest, spec) {
  const finding = manifest.findingId ? spec.findings.find(item => item.id === manifest.findingId) : null;
  return {
    id: manifest.id,
    createdAt: manifest.createdAt,
    project: spec.project.name,
    source: manifest.source,
    mode: manifest.mode || 'review',
    url: manifest.url,
    findingId: manifest.findingId,
    findingTitle: finding?.title ?? null,
    confirmation: manifest.confirmation?.verdict ?? null,
    captured: { before: Boolean(manifest.captures.before), after: Boolean(manifest.captures.after) },
    executed: Boolean(manifest.execution),
    evaluated: Boolean(manifest.evaluation),
    judgment: manifest.judgmentWithdrawal?'withdrawn':manifest.judgment?.decision ?? null,
    originalJudgment: manifest.judgment?.decision ?? null,
    skills: manifest.skills.map(item => item.id)
  };
}

export async function exportRun({ directory, outputRoot, allowPendingBootstrap = false }) {
  const run = await loadRun(directory);
  if (run.manifest.mode === 'bootstrap') {
    // Static exports normally require the first render. The local workbench can also
    // publish a pending control record, with both capture flags still false.
    if (!run.manifest.captures.after && !allowPendingBootstrap) throw new Error('Nothing to publish: capture the first render before exporting a bootstrap run.');
  } else if (!run.manifest.captures.before) {
    throw new Error('Nothing to publish: capture the baseline before exporting a run.');
  }
  assertSafeScreenshots(run.manifest);
  assertSafeSkillIds(run.manifest);
  for(const reference of run.manifest.visualReviews||[])await readVisualReviewBinding(run,reference);
  const patternReviews=[];
  // Originals are bounded per review; avoid retaining multiple large image
  // reads concurrently when exporting a library with several proposals.
  for(const reference of run.manifest.patternReviews||[])patternReviews.push(await readPatternReview(run,reference));
  await readPatternAdmissions(run);
  const designSystem=await designSystemContext(run);
  const incrementalCapture=await readIncrementalCapturePlan(run);
  const verification=run.manifest.verificationEvidence?await readVerificationEvidence(directory,run.manifest):{records:[]};
  // Read the index before copying anything: a corrupt index must not leave a
  // published run folder that nothing points at.
  const index = await readIndex(outputRoot);
  const root = resolve(outputRoot);
  const target = join(root, run.manifest.id);
  if (!insideRoot(root, target)) throw new Error('Refusing to write outside the export directory.');
  await mkdir(target, { recursive: true });

  const copied = [];
  let staleModelDiagnosis=null;
  if(run.manifest.diagnosis){
    const diagnosis=JSON.parse(await readFile(join(run.directory,run.manifest.diagnosis.path),'utf8'));
    const model=await verifyBaselineDiagnosis(run,diagnosis,{current:false});
    if(model?.foundationChanged){staleModelDiagnosis=structuredClone(diagnosis);staleModelDiagnosis.modelDiagnosis={...diagnosis.modelDiagnosis,status:'needs-evidence',summary:'Design Foundation changed after this diagnosis; rerun diagnosis before confirming model findings.',limitations:[...diagnosis.modelDiagnosis.limitations,'These model observations refer to the previous Foundation snapshot.']};for(const item of staleModelDiagnosis.findings)if(item.sources?.some(source=>source.id==='baseline-model-diagnosis')){item.verificationStatus='stale-candidate';item.priority=0;}}
    if(model){await mkdir(join(target,'baseline-diagnosis'),{recursive:true});await writeFile(join(target,diagnosis.modelDiagnosis.path),model.bytes);copied.push(diagnosis.modelDiagnosis.path);}
  }
  if(incrementalCapture){await writeJson(join(target,'incremental-capture-plan.json'),incrementalCapture);copied.push('incremental-capture-plan.json');}
  for (const name of RUN_FILES) {
    if (await copyIfPresent(join(run.directory, name), join(target, name))) copied.push(name);
  }
  if(staleModelDiagnosis)await writeJson(join(target,'diagnosis.json'),staleModelDiagnosis);
  if(run.manifest.judgmentWithdrawal){
    await copyFile(join(run.directory,JUDGMENT_WITHDRAWAL),join(target,JUDGMENT_WITHDRAWAL));copied.push(JUDGMENT_WITHDRAWAL);
  }
  const exceptions=run.manifest.projectMemoryExceptions?await readMemoryExceptionSnapshot(run,run.manifest.projectMemoryExceptions):null;
  if(exceptions){
    await mkdir(join(target,'project-memory-exceptions'),{recursive:true});
    await writeJson(join(target,run.manifest.projectMemoryExceptions.path),exceptions);copied.push(run.manifest.projectMemoryExceptions.path);
    for(const event of exceptions.events){
      if(!event.priorPlan)continue;
      const bytes=await readFile(join(run.directory,event.priorPlan.path));
      if(createHash('sha256').update(bytes).digest('hex')!==event.priorPlan.hash)throw Error('Archived project memory plan changed.');
      await mkdir(join(target,'project-memory-plans'),{recursive:true});await writeFile(join(target,event.priorPlan.path),bytes);copied.push(event.priorPlan.path);
    }
  }
  const memoryRefs=[run.manifest.plan?.projectMemory,run.manifest.diagnosis?.projectMemory,...(exceptions?.events||[]).map(event=>event.priorPlan?.metadata?.projectMemory)].filter(Boolean);
  for(const reference of new Map(memoryRefs.map(value=>[value.path,value])).values()){
    const snapshot=await readProjectMemorySnapshot(run,reference);
    await mkdir(join(target,'project-memory'),{recursive:true});
    await writeJson(join(target,reference.path),snapshot);copied.push(reference.path);
  }
  if (run.manifest.foundationApproval?.path) {
    const name = run.manifest.foundationApproval.path;
    if (!/^foundation-[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?\.json$/.test(name)) throw new Error(`Run ${run.manifest.id} has an unsafe Foundation Approval path.`);
    if (await copyIfPresent(join(run.directory, name), join(target, name))) copied.push(name);
  }
  for (const phase of ['before', 'after']) {
    const capture = run.manifest.captures[phase];
    if (!capture) continue;
    await mkdir(join(target, phase), { recursive: true });
    const inputs=await readRepositoryInputs(run,phase);
    if(inputs){await writeJson(join(target,phase,'repository-inputs.json'),inputs);copied.push(`${phase}/repository-inputs.json`);}
    const screenshots = captureOriginals(capture).map(path=>path.slice(`${phase}/`.length));
    for (const name of [...CAPTURE_FILES, ...screenshots]) {
      if (await copyIfPresent(join(run.directory, phase, name), join(target, phase, name))) copied.push(`${phase}/${name}`);
    }
    if(designSystem[phase]){
      await copyFile(join(run.directory,phase,'design-system.json'),join(target,phase,'design-system.json'));
      copied.push(`${phase}/design-system.json`);
    }
  }
  if (run.manifest.skills.length) {
    await mkdir(join(target, 'skills'), { recursive: true });
    for (const skill of [...(run.manifest.skillAttempts || []), ...run.manifest.skills]) {
      const path = skill.path || `skills/${skill.id}.json`;
      const name = path.slice(7);
      if (!path.startsWith('skills/') || !/^[a-zA-Z0-9_-]+\.json$/.test(name)) throw new Error('Invalid Skill attempt path');
      if (await copyIfPresent(join(run.directory, 'skills', name), join(target, 'skills', name))) copied.push(`skills/${name}`);
    }
  }
  if (run.manifest.visualReviews?.length || run.manifest.visualReviewHistory?.length) {
    await mkdir(join(target, 'reviews'), { recursive: true });
    for (const review of [...(run.manifest.visualReviewHistory||[]),...(run.manifest.visualReviews||[])]) {
      if (!SEGMENT.test(String(review.skillId ?? ''))) throw new Error(`Run ${run.manifest.id} has an unusable visual review skill id.`);
      const name = review.path?.slice(8)||`${review.skillId}.json`;
      if(review.path!==`reviews/${name}`||!new RegExp(`^${review.skillId}(?:-[a-f0-9]{64})?\\.json$`).test(name))throw Error('Invalid review history path');
      if (await copyIfPresent(join(run.directory, 'reviews', name), join(target, 'reviews', name))) copied.push(`reviews/${name}`);
      if(review.evidenceBinding){
        await readVisualReviewBinding(run,review,{checkContext:false,checkOriginals:false});
        const binding=review.evidenceBinding.path;await copyFile(join(run.directory,binding),join(target,binding));copied.push(binding);
      }
    }
  }
  for(const index of [...(run.manifest.verificationHistory||[]),...(run.manifest.verificationEvidence?[run.manifest.verificationEvidence]:[])]){
    const bundle=await readVerificationEvidence(directory,{...run.manifest,verificationEvidence:index});
    const paths=[index.path,...bundle.records.flatMap(record=>[record.path,...record.images.map(image=>image.path)])];
    for(const path of paths){
      const bytes=await readVerificationFile(directory,path,path.endsWith('.png')?12*1024*1024:256*1024);
      await mkdir(join(target,path.slice(0,path.lastIndexOf('/'))),{recursive:true});await writeFile(join(target,path),bytes);copied.push(path);
    }
  }
  for (const attachment of run.manifest.reviewAttachments || []) {
    if (!/^[a-f0-9-]{36}$/.test(attachment.id) || attachment.path !== `reviews/attachments/${attachment.id}.png`) throw new Error('Invalid review attachment path');
    await mkdir(join(target,'reviews','attachments'),{recursive:true});
    await copyFile(join(run.directory,attachment.path),join(target,attachment.path));
    copied.push(attachment.path);
  }
  const patternFiles=[...new Set([...patternReviews.flatMap(review=>review.files),...(run.manifest.patternAdmissions||[]).map(reference=>reference.path)])];
  for(const path of patternFiles){
    await mkdir(join(target,dirname(path)),{recursive:true});
    if(await realpath(join(target,dirname(path)))!==join(await realpath(target),dirname(path)))throw Error('Pattern export cannot use links.');
    const limit=path.endsWith('.png')?24*1024*1024:1024*1024,bytes=await readVerificationFile(run.directory,path,limit);
    try{await writeFile(join(target,path),bytes,{flag:'wx'});}catch(error){
      if(error.code!=='EEXIST')throw error;
      if(!(await readVerificationFile(target,path,limit)).equals(bytes))throw Error('Published pattern artifact changed; export to a fresh directory.');
    }
    copied.push(path);
  }
  await writeJson(join(target, 'run.json'), publicManifest({...run.manifest,verificationRecords:verification.records.map(({result,...record})=>record)}));
  copied.push('run.json');
  const published={directory:target,manifest:JSON.parse(await readFile(join(target,'run.json'),'utf8')),spec:JSON.parse(await readFile(join(target,'experience.json'),'utf8'))};
  for(const reference of published.manifest.visualReviews||[])await readVisualReviewBinding(published,reference);
  for(const reference of published.manifest.patternReviews||[])await readPatternReview(published,reference);
  await readPatternAdmissions(published);

  const summary = summarise(run.manifest, run.spec);
  const runs = index.runs.filter(item => item.id !== summary.id).concat(summary);
  runs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  await writeJson(join(root, INDEX), { version: '0.1', generatedAt: new Date().toISOString(), runs });
  return { directory: target, files: copied, summary };
}

export async function readIndex(outputRoot) {
  try {
    const parsed = JSON.parse(await readFile(join(resolve(outputRoot), INDEX), 'utf8'));
    if (!Array.isArray(parsed.runs)) throw new Error('its "runs" field is not an array');
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return { version: '0.1', generatedAt: null, runs: [] };
    throw new Error(`Cannot read ${join(resolve(outputRoot), INDEX)}: ${error.message}. Run "pnpm harness reindex" to rebuild it from the exported folders.`);
  }
}

// Rebuild the index from whatever is already on disk; used after a run folder is
// deleted by hand so the workbench does not keep offering a missing run.
export async function reindex(outputRoot) {
  const root = resolve(outputRoot);
  let entries = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const manifest = JSON.parse(await readFile(join(root, entry.name, 'run.json'), 'utf8'));
      const spec = JSON.parse(await readFile(join(root, entry.name, 'experience.json'), 'utf8'));
      for(const reference of manifest.visualReviews||[])await readVisualReviewBinding({directory:join(root,entry.name),manifest,spec},reference);
      for(const reference of manifest.patternReviews||[])await readPatternReview({directory:join(root,entry.name),manifest,spec},reference);
      await readPatternAdmissions({directory:join(root,entry.name),manifest,spec});
      runs.push(summarise(manifest, spec));
    } catch {
      // A directory without a readable manifest is not an exported run.
    }
  }
  runs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  await mkdir(root, { recursive: true });
  await writeJson(join(root, INDEX), { version: '0.1', generatedAt: new Date().toISOString(), runs });
  return runs;
}
