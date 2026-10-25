import { missingAfterStates } from './whole-page.js';
export const DEFAULT_LIMITS = Object.freeze({ maxRounds: 3, maxMinutes: 60, round: 1 });

export function visualReviewFor(manifest, skillId) {
  if(skillId==='visual-qa-evaluator'&&manifest.verificationIntegrity==='invalid')return null;
  const review=(manifest.visualReviews || []).find(item => item.skillId === skillId) || null;
  if(skillId==='visual-qa-evaluator'&&manifest.verificationEvidence?.digest && review?.verificationDigest!==manifest.verificationEvidence.digest)return null;
  return review;
}

function agentName(manifest) {
  return manifest.execution?.agent?.id ? `Agent ${manifest.execution.agent.id}` : 'The agent';
}

// From execution onwards a first render and a change follow the same path: render it, check it
// structurally, have a person look at it, then decide.
function fromExecution(manifest, result) {
  if (!manifest.execution && !manifest.captures.after) return { ...result, stage: 'needs-execution', next: 'execute' };
  if (manifest.execution?.boundaryBreaches?.length) {
    return { ...result, stage: 'boundary-breached', blocked: true, reason: `The agent changed the host repository outside its worktree: ${manifest.execution.boundaryBreaches.join('; ')}.`, next: 'Inspect the repository, then start a new run.' };
  }
  if (manifest.execution?.timedOut) {
    return { ...result, stage: 'execution-failed', blocked: true, reason: `${agentName(manifest)} was stopped at the ${manifest.execution.limits?.maxMinutes ?? 'configured'}-minute execution window; the worktree holds a partial edit.`, next: 'Inspect the retained worktree, then start a new run.' };
  }
  if (manifest.execution && manifest.execution.exitCode !== 0) {
    const how = manifest.execution.exitCode === null || manifest.execution.exitCode === undefined
      ? `was stopped by ${manifest.execution.signal || 'a signal'}`
      : `exited ${manifest.execution.exitCode}`;
    return { ...result, stage: 'execution-failed', blocked: true, reason: `${agentName(manifest)} ${how}; inspect the retained worktree and log.`, next: 'Repair in the retained worktree or start a new run.' };
  }
  if (!manifest.captures.after) return { ...result, stage: 'needs-after-capture', next: 'Start the retained worktree preview, then capture --phase after.' };
  if (!manifest.evaluation) return { ...result, stage: 'needs-structural-evaluation', next: 'evaluate' };
  if (missingAfterStates(manifest).length) return {...result,stage:'visual-qa-needs-evidence',blocked:true,reason:'Some planned after states were not captured. Complete the capture plan and start a new review.',next:'Start a new run with the missing states.'};
  if(manifest.verificationEvidence?.retryable&&manifest.onboarding?.config?.verificationChecks?.length)return {...result,stage:'needs-specialist-verification',next:'ai-review',reason:'Specialist checks need another execution against the same captured source.'};
  const qa = visualReviewFor(manifest, 'visual-qa-evaluator');
  if (!qa) return { ...result, stage: 'needs-visual-qa', next: 'attest --input VISUAL_QA.json' };
  if (qa.verdict === 'needs-evidence') return { ...result, stage: 'visual-qa-needs-evidence', blocked: true, reason: 'Visual QA needs more evidence.', next: 'Start a new run with the missing states.' };
  if (!manifest.judgment) return { ...result, stage: qa.verdict === 'fail' ? 'visual-qa-failed' : 'awaiting-judgment', blocked: qa.verdict === 'fail', reason: qa.verdict === 'fail' ? 'Independent Visual QA found an unresolved regression. Reject or submit new counter-evidence for independent re-review.' : null, next: 'judge' };
  return { ...result, stage: 'complete', next: null };
}

// A bootstrap run has no baseline to capture, nothing rendered to diagnose and no finding to
// confirm. Its constraint is the approved design foundation, so it reaches execution by a shorter
// path — and then meets the same evaluation and human judgment as every other run.
function bootstrapWorkflow(manifest, result) {
  if (!manifest.baseline) return { ...result, stage: 'needs-absent-baseline', blocked: true, reason: 'A run without a baseline has to record why one is absent before it can plan.', next: 'baseline --reason TEXT' };
  if (!manifest.foundationApproval) return { ...result, stage: 'needs-foundation-approval', blocked: true, reason: 'A person must approve a versioned Design Foundation before page composition.', next: 'foundation-approve --input FILE' };
  if (!manifest.plan) return { ...result, stage: 'needs-first-render-plan', next: 'plan' };
  return fromExecution(manifest, result);
}

export function workflowState(manifest) {
  const result = { stage: 'unknown', next: null, blocked: false, reason: null, mode: manifest.mode || 'review' };
  if(manifest.judgmentWithdrawal)return {...result,stage:'judgment-withdrawn',blocked:true,reason:'The recorded human judgment was withdrawn. Preserve this history and start a new review to reassess the current project.',next:'Start a new run.'};
  if (manifest.onboarding?.status === 'failed') return { ...result, stage: 'onboarding-failed', blocked: true, reason: manifest.onboarding.error || 'Project onboarding failed.', next: 'Fix the preview and start a new run.' };
  if (result.mode === 'bootstrap') return bootstrapWorkflow(manifest, result);
  if (!manifest.captures?.before) return { ...result, stage: 'needs-baseline', next: 'capture --phase before' };
  if(manifest.patternAdmissions?.length&&!manifest.foundationApproval)return {...result,stage:'needs-foundation-approval',blocked:true,reason:'Staged patterns need explicit decisions and a Foundation version approval before planning.',next:'foundation-approve --input FILE'};
  // A replay of an already merged change has captures and a confirmed scope,
  // but no new agent execution or diagnosis. Continue through the SAME QA and
  // human-decision gates instead of asking the user to edit the project again.
  if (manifest.captures.after && manifest.confirmation?.verdict === 'supported') return fromExecution(manifest, result);
  if (!manifest.diagnosis) return { ...result, stage: 'needs-diagnosis', next: 'diagnose' };
  if (!manifest.confirmation) return { ...result, stage: 'awaiting-confirmation', blocked: true, reason: 'A person must confirm one current finding and the edit scope.', next: 'confirm' };
  if (manifest.confirmation.verdict === 'stale') return { ...result, stage: 'finding-stale', blocked: true, reason: 'The selected finding no longer matches the baseline.', next: 'Start a new diagnosis or run.' };
  if (!manifest.plan) return { ...result, stage: 'needs-plan', next: 'plan' };
  return fromExecution(manifest, result);
}

export function assertWithinLimits(manifest, now = Date.now()) {
  const limits = { ...DEFAULT_LIMITS, ...(manifest.limits || {}) };
  if (limits.round > limits.maxRounds) throw new Error(`Run exceeded its ${limits.maxRounds}-round limit.`);
  return { ...limits, startedAt: new Date(now).toISOString(), timeoutMs: limits.maxMinutes * 60000 };
}
