# Deterministic Skill regression checks

Related to #11. This is the deterministic portion of the release gate, not completion of model evaluation or Expertise release governance.

## Run and inspect

```sh
pnpm regression --output regression-report.json
pnpm regression --baseline previous-report.json --output candidate-report.json
```

The corpus in `regression/cases.json` is synthetic: it contains no customer screenshots, repository content or inferred human decisions. Its 14 cases cover positive, negative and missing-evidence behavior for finding detection, priority, fix proposals, visual QA and score calibration. Each case records inputs, expected machine-checkable fields and forbidden conclusions. The forbidden prose is a review checklist, not an automated semantic or model-quality judgment.

The command returns a nonzero exit status when an expectation fails. A baseline comparison also blocks when a case is removed, its contract changes, or its output changes while still meeting its expectations. Such a change needs review; passing a rewritten expectation is not proof of a fix. Additions, fixes, regressions, changed contracts and removed cases are reported individually.

Reports carry corpus and case hashes, implementation hash, Skill versions (where applicable), diagnosis evaluator version and actual outputs. Runtime timestamps are excluded so a repeat run can be compared deterministically. CI runs the suite on Linux and Windows and uploads the report even if the regression command fails. Keep the baseline report from the reviewed commit outside the candidate branch when comparing releases.

## Enforced boundaries

- A fix plan requires the selected finding's own `supported` human confirmation. Missing, stale or mismatched confirmation returns `needs-evidence` without a plan.
- Skill Results reject findings with absent or empty evidence records. This is structural validation; it does not establish the truth of supplied evidence or resolve arbitrary source paths.
- A Skill handler cannot publish an aggregate `score`; scores use the existing diagnosis rubric evaluator, with dimension, weight, rationale and evidence coverage checks.
- DOM evidence and matched screenshots cannot make the visual QA evaluator claim a visual pass.
- Cases derived from human feedback must include `feedback.status: reviewed`, `feedback.reviewer` and `feedback.reason`. This records a review assertion; access control and reviewer identity verification remain outside this local tool.

## Still required before closing #11

Release creation now reruns the repository corpus and matches the submitted evidence against current package JavaScript, lockfile, Skill directory contents and case outputs. Independent review must reference that evidence hash. Input drift during regression is rejected, as are stale reports and altered case results even when their submitted hashes are recomputed. Activation validates version syntax before reading a release path.

Independent prompt/rubric/model configuration versioning, reviewed model-comparison reports and trusted baseline selection remain incomplete. Reviewer fields are local assertions, not authenticated identities. The tool assumes a quiescent local checkout and does not provide a transactional source snapshot or validate installed dependencies against the lockfile. The report explicitly says model review was not run. Synthetic success must not be promoted into a model-quality claim or an automatic global Expertise release.

## Activation and interrupted rollback

Activation takes an exclusive `expertise/activation.lock` before reading the current pointer. Another writer fails without changing it. The target release must contain bound regression/review digests and a matching Skill contract hash; older unbound releases require regeneration and review. This validates internal consistency, not a cryptographic signature or reviewer identity.

Each activation writes a synced immutable `activations/<activationId>.json`, then a synced temporary pointer and renames that pointer over `active.json` in the same directory. Readers see a complete old or new pointer. `active.json` and its `previousActivationId` chain establish committed activations; unreferenced records are prepared intents, not successful changes. Pre-existing pointers without activation IDs remain valid migration starting points. The pointer records the exact release-file hash. This is metadata activation, not installation or restoration of executable Skill packages.

A process exit before rename leaves the old pointer active and the lock in place. Never remove a lock merely because it is old: verify the owning process has terminated, inspect the pointer and prepared record, then remove only that lock and retry the requested activation. Do not promote an orphan record by hand. A crash after rename leaves the new complete pointer authoritative, even if lock cleanup did not finish. Directory metadata is not fsynced on every platform; sudden power loss and network filesystem guarantees are not claimed.

Tests terminate a child process immediately before rename and verify the old pointer survives, subsequent activation is blocked until explicit recovery, and the successful retry links to the actual previous activation. Separate checks cover a held/unreadable lock and inconsistent release contents. These tests use temporary synthetic releases, not production approval or rollback acceptance.

Validation on 2026-10-18: 398 tests, 14 deterministic cases and production build passed locally. Release tests use explicitly labelled synthetic reviewers in temporary registries; no actual release was approved or activated. GitHub CI billing remains a separate unresolved service limitation.
