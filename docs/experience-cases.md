# Experience cases

Cases are local historical examples, not design rules or acceptance of a new change. Current-page AI slop and UI detail checks still come first, followed by shared components, task/layout decisions and multi-device regression.

## Collection and provenance

Saving an independent visual review, human judgment, judgment withdrawal or PR reference automatically collects a content-addressed candidate under the run's `experience-cases/` directory. Repeated collection of the same source state is idempotent. Review retries and later decisions create new snapshots; old snapshots remain available.

Each candidate contains the source manifest, capture/state references, review and judgment history, source commit, plan/Skill references, PR reference when present, and hashes of original screenshots, review attachments, reviews, the experience specification, remediation artifacts and code patch when applicable. Original bytes stay in the existing run; this avoids copying private images into another database. Missing or changed evidence is reported, never silently treated as current. Preserve the complete local run for durable replay: the case index is not an independent backup.

Explicitly backfill an existing run:

```sh
pnpm harness case-collect --run /absolute/path/to/run
pnpm harness case-list --run /absolute/path/to/run --query dropdown
```

The list includes source snapshots, artifact paths/hashes, admissions and stale/missing evidence. Cases remain local and are not added to the public export allow-list.

## Admission

Collection never approves a case. After the existing human judgment, record a separate decision about what the example demonstrates:

```sh
pnpm harness case-admit --run /absolute/path/to/run --id CASE_HASH --kind preserved --reason "The existing hierarchy serves this task; retain it" --tags card,hierarchy
```

Supported kinds:

- `improved`: an accepted change with passing independent QA.
- `preserved`: a reasonable design retained in an accepted run with passing QA. Do not claim the before state was defective.
- `regressed`: a rejected change, explicitly classified by the operator as a regression. Rejection alone does not automatically imply regression.
- `withdrawn`: a recorded judgment withdrawal. The reason explains what became unreliable; withdrawal alone does not prove a visual defect.

Positive admission revalidates the existing QA and remediation bindings. Comparative improvement/regression admission requires both before and after originals; preservation requires at least one original. Every admission requires current evidence, an explanation and optional task/component/problem tags. Admissions are immutable records. Later judgment changes invalidate old admissions for retrieval; recollect and explicitly admit the new state. No candidate is promoted automatically into a universal rule or project-memory principle.

## Retrieval and regression protection

New plans retrieve up to 20 currently admitted examples from sibling runs for the same repository. The brief includes the classification, explanation, tags, source commit, adopted rule IDs and full snapshot path. This first version uses a deterministic bounded selection, not semantic ranking. The executor must check applicability to the current task and treat negative examples as warnings, never desired outcomes.

The plan records a digest of this reference set. Before and after execution the host recomputes it: changed evidence, withdrawn judgments or changed admissions block execution success and require replanning. This is provenance regression protection, not an automatic rerun of historical UI tests. To verify a new Skill against old pages, capture and review them as new runs; never rewrite historical verdicts.

Historical examples and scoped project memory serve different roles. Examples retain the original evidence. An approved scoped memory entry records where a particular lesson applies and which existing check tests it. Remaining work for examples includes a visual case browser, task-aware ranking, and a historical UI replay suite.

### Scoped project memory

Use a locally retained source Run with a recorded human judgment. `memory --action propose` records a candidate. A separate `decide` action with `approve` and a reason activates it. A source withdrawal, missing or changed source record, retirement, or expired review date stops new recall. Earlier project-wide approvals remain readable and keep their existing scope.

```sh
hh memory --run SOURCE_RUN --action propose --input PROPOSAL.json
hh memory --run SOURCE_RUN --action decide --input DECISION.json
hh memory --run CURRENT_RUN --action checks
```

The proposal uses the existing `principle`, `context`, `reason` and optional `exceptions` fields. Add `scope` with a `failureClass`, `trigger`, optional UTC `reviewBy` date, and `check`. For example:

```json
{
  "principle": "The save button should have the accessible name Save changes",
  "context": "The default state of the editor save control",
  "reason": "The original icon-only button had no accessible name",
  "scope": {
    "failureClass": "missing-button-name",
    "trigger": {"states": ["editor-default"], "files": ["src/editor/SaveButton.tsx"]},
    "check": {"type": "technical", "policy": {"kind": "button-name", "selector": "#save", "name": "Save changes"}}
  }
}
```

`trigger` accepts exact `tasks`, `states`, `components`, and repository-relative `files`. Within a field, any value can match. Across the fields, the task must match and one captured baseline state must supply the selected state, component and file evidence. Files come from declared capture source entries, a component region source, a verified incremental delta, or the declared file from a source check. An absent state or file reference appears as missing scope evidence. Unrelated principles stay out of the model's reading context.

`check` can refer to the exact built-in technical policy from the Run, a `specialist` check with `id` and its recorded `sha256` (`checkHash` in verification evidence), or a `visual` remediation `ruleId`. These use the existing verification and independent review stages. Recall alone does not execute a command. The CLI and report show selected checks that have not run, checks skipped with a reason, failures, and passing checks backed by evidence. An unrelated check with the same name or a changed definition cannot certify the rule. A visual rule needs its own state-level independent review.

Linked Git worktrees share a memory registry under the same local Harness run root because Git identifies their common directory. Standalone clones or forks remain separate. Lightweight runs keep memory alongside their run directories. The full source Run remains local, and explicit run exceptions still exclude rules without removing the original approval.

## Validation

Lifecycle and store integration tests cover candidate idempotency, explicit admission, missing/changed evidence, incompatible classifications, tampered snapshots, project isolation and withdrawal invalidating planned references. The existing design-source binding regression is retained: case context is placed before the bound design-source suffix rather than weakening its verification.

A previous real GPT-6 Astra run was backfilled through the public CLI. Its 12 referenced artifacts remained current and no admission was fabricated: independent QA alone does not provide final human acceptance. Synthetic test screenshots are used only in automated fixtures and are not published as real design examples.

## Export and reuse boundary

Public exports omit the historical-case section from current and archived execution briefs. These are display copies; their original plan hashes remain provenance, not a claim that the redacted copy is executable. Local execution briefs are unchanged. Positive historical examples are reused only after validating durable QA binding, specialist verification and remediation evidence again. Invalid examples are excluded and a changed example digest requires replanning.
