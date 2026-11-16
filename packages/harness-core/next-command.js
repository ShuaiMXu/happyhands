// `next` used to return workbench-flavoured hints ("ai-review", "repair") that
// are not CLI commands, so an agent driving the CLI had to translate them. This
// projection turns each workflow stage into the exact CLI step(s): argv with the
// run directory and every value the ledger already knows filled in, the
// placeholders that remain, and whether the step belongs to the agent or must
// be decided by the user. The agent loop becomes: call `next`, run `cli.steps`,
// ask the user when `cli.actor` is "user", repeat.

const run = directory => ['--run', directory];

function step(argv, needs = {}) {
  return {argv, needs};
}

export function nextCliCommand(state, manifest, directory, {pendingSelf = false} = {}) {
  const repo = manifest.onboarding?.repository?.root || 'REPO';
  const worktree = manifest.execution?.worktree || 'WORKTREE';
  const finding = manifest.confirmation?.findingId || 'FINDING_ID';
  const capturePlan = manifest.onboarding?.config?.capturePlan || 'CAPTURE_PLAN';
  const surface = 'SURFACE';
  const surfaceNeed = {SURFACE: 'public-page for websites and landing pages, app-screen for working interfaces'};
  switch (state.stage) {
    case 'needs-baseline':
      return {actor: 'agent', steps: [step(['capture', ...run(directory), '--phase', 'before', '--plan', capturePlan, '--repo', repo, '--bind-evidence', 'true'], {CAPTURE_PLAN: 'Capture Plan JSON covering the task states (schema: capture-state.schema.json)'})]};
    case 'needs-experience-audit':
      return {actor: 'agent', steps: [
        step(['experience', ...run(directory), '--phase', 'context', '--surface', surface], surfaceNeed),
        step(['experience', ...run(directory), '--phase', 'audit', '--input', 'AUDIT_JSON'], {AUDIT_JSON: 'audit written against the schema the context step returns'})
      ]};
    case 'needs-diagnosis':
      return {actor: 'agent', steps: [step(['model-diagnose', ...run(directory)])], alternatives: [step(['diagnose', ...run(directory)])]};
    case 'awaiting-confirmation':
      return {actor: 'user', ask: 'Show the user the diagnosed candidates and ask which to repair. Record only what they authorise.', steps: [
        step(['repair-scope', ...run(directory), '--finding', 'FINDING_ID'], {FINDING_ID: 'candidate the user chose, or replace --finding with --all true'}),
        step(['confirm', ...run(directory), '--finding', 'FINDING_ID', '--verdict', 'supported', '--note', 'NOTE'], {FINDING_ID: 'reproduced finding', NOTE: 'what you observed in the current page'})
      ], chooseOne: true};
    case 'needs-design-decision':
      return {actor: 'agent', steps: [step(['experience', ...run(directory), '--phase', 'decision', '--input', 'DECISION_JSON'], {DECISION_JSON: 'decision written against the schema from experience --phase context'})]};
    case 'needs-plan':
      return {actor: 'agent', steps: [step(['plan', ...run(directory), '--finding', finding])]};
    case 'needs-first-render-plan':
      return {actor: 'agent', steps: [step(['plan', ...run(directory)])]};
    case 'needs-execution':
      if (pendingSelf) return {actor: 'agent', before: `Finish editing ${manifest.execution?.worktree || 'the run worktree'} as the brief in execution-prompt.txt describes.`, steps: [step(['execute-finish', ...run(directory)])]};
      return {actor: 'agent', steps: [step(['execute', ...run(directory), '--repo', repo, '--agent', 'AGENT'], {AGENT: 'self to make the edit yourself in the prepared worktree, or a CLI adapter the user chose; `agents` lists them'})]};
    case 'needs-after-capture':
      return {actor: 'agent', before: `Start the preview of ${worktree} with the project's own dev command and wait until it serves.`, steps: [
        step(['capture', ...run(directory), '--phase', 'after', '--url', 'AFTER_URL', '--plan', 'AFTER_PLAN', '--repo', worktree, '--bind-evidence', 'true'], {AFTER_URL: 'preview URL of the worktree', AFTER_PLAN: 'the baseline Capture Plan with start URLs pointed at AFTER_URL'})
      ]};
    case 'needs-structural-evaluation':
      return {actor: 'agent', steps: [step(['evaluate', ...run(directory)])]};
    case 'needs-specialist-verification':
      return {actor: 'agent', steps: [step(['verify', ...run(directory), '--config', 'PROJECT_CONFIG', '--repo', worktree], {PROJECT_CONFIG: 'the project config used for start/onboard'})]};
    case 'needs-visual-qa':
      return {actor: 'agent', steps: [step(['model-review', ...run(directory)])], alternatives: [step(['attest', ...run(directory), '--input', 'VISUAL_QA_JSON'], {VISUAL_QA_JSON: 'independent review in visual-review.schema.json format'})]};
    case 'awaiting-judgment':
    case 'visual-qa-failed':
      return {actor: 'user', ask: 'Present the before/after originals (compare), checks and open items. Record the decision the user gives you; never decide yourself.', steps: [
        step(['judge', ...run(directory), '--decision', 'DECISION', '--reason', 'REASON'], {DECISION: state.stage === 'visual-qa-failed' ? 'reject (a failed review cannot be accepted)' : 'accept or reject, as the user said', REASON: "the user's reason"})
      ]};
    case 'needs-absent-baseline':
      return {actor: 'agent', steps: [step(['baseline', ...run(directory), '--reason', 'REASON'], {REASON: 'why no baseline can exist'})]};
    case 'needs-foundation-approval':
      return {actor: 'user', ask: 'A person must approve the Design Foundation.', steps: [step(['foundation-approve', ...run(directory), '--input', 'APPROVAL_JSON'], {APPROVAL_JSON: 'the approval the user reviewed'})]};
    case 'complete':
      return {actor: null, steps: []};
    default:
      return {actor: 'user', ask: state.reason || 'The run is blocked; show the user the reason.', steps: []};
  }
}
