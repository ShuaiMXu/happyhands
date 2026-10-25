# Project memory lifecycle

Related to #9, not its completion. The workbench project/task dialog now records optional exceptions and offers withdrawal for a candidate or retirement for an approved principle. A reason is required. Original proposals and approval/rejection records remain immutable; retirement is a separate versioned record. Retired principles cannot be revived by overwriting a review. Propose a new candidate for new review instead.

Repository-scoped `active()` returns only approved, non-retired entries. Retirement takes precedence even if approval races with withdrawal. Content hashes and review bindings are checked on read: changed text cannot silently inherit its old approval. Historical proposals without exceptions retain their original hash format. These are local integrity checks, not authenticated reviewer identities or protection against a user rewriting all stored hashes.

Tests cover approval, retained history, exceptions, withdrawal, retirement, changed content and racing approval. A Chrome fixture exercises actual Chinese and English dialog controls against isolated memory stores. It does not make a real project judgment or claim production user acceptance.

## Later plans and execution

Connected runs under the workbench's `.harness/runs` directory now snapshot approved project principles when creating a fix or bootstrap plan. The immutable, content-addressed JSON retains source run/judgment, review, applicability and exceptions; the plan references its digest and count. The implementation prompt includes the verified snapshot as historical context, not instructions or current evidence. Current evidence, approved Foundation and confirmed scope take precedence.

Execution verifies the snapshot against the current effective project rules before worktree creation and again immediately before launching the agent. Retirement, a new approval, changed contents or repository identity requires replanning. A legacy plan without a snapshot also blocks when approved rules exist. Historical snapshots are never overwritten when rules are retired. Rules can still change after the final preflight: this is not a lease or a guarantee that an already running agent observes a later retirement.

Tests exercise actual planning and execution entry points using isolated Git repositories and a deliberately failing stand-in executable. They verify prompt delivery, unchanged current capture/confirmation, retirement blocking before a branch is created, snapshot integrity, repository separation and legacy-plan rejection. No real model judgment is inferred from these checks.

## Diagnosis and independent review

Saving a connected diagnosis now attaches an authoritative project-memory snapshot separately from findings and scores. Caller-supplied memory is discarded. The report shows a collapsed historical-context section with applicability, exceptions and source run IDs. Export includes referenced diagnosis and plan snapshots after digest validation; retirement does not rewrite older evidence. Deterministic diagnosis findings and scoring are unchanged.

Independent AI review receives one consistent snapshot across its regional and cross-region sessions. Its prompt requires current screenshot evidence for any claimed conflict, keeps current evidence and approved Foundation above historical preferences, and forbids deriving a finding, score or verdict from preference alone. Current effective memory is checked before and after each model call and before aggregate publication. A changed context rejects the new attestation. Existing completed reviews remain historical artifacts; this does not retroactively assert that they considered today's principles. Prompt version is `ai-visual-review@9`, with the snapshot included in the hashed context provenance.

Tests verify unchanged diagnosis findings/scores, exported snapshots, model input boundaries and retirement during a simulated model call. Chrome checks both languages and literal rendering of HTML-shaped principle text. These are pipeline and UI checks, not evidence of real model judgment quality.

## Withdrawing a source judgment

The project/task dialog offers a reasoned withdrawal for an existing decision. The CLI equivalent is `pnpm harness withdraw-judgment --run DIRECTORY --reason TEXT`. Withdrawal creates an exclusive `judgment-withdrawal.json` bound to the exact original judgment and mirrors it in the manifest. It preserves the original Experience Spec, Accept/Reject, reason, captures, QA and source changes. Reassessment requires a new run; a withdrawal is not an edit or rollback of source code.

The immutable artifact is authoritative when a process exits before the manifest mirror updates. A missing artifact with a recorded mirror, an inconsistent original judgment or malformed withdrawal blocks reading/reuse. It must not silently restore an accepted state. Export carries the artifact and marks the index decision withdrawn while retaining the original decision. A failed export is reported separately after local withdrawal succeeds; it does not claim the old static export was updated.

Project memory checks each source run's withdrawal before proposal, approval and effective-rule selection. Derived candidates/approved rules become `source-withdrawn` while retaining their previous reviews. Existing plan and AI-review snapshot checks then reject changed effective rules. Incremental routing falls back to full review; `judgment-distiller@0.2.0` does not emit candidates from a withdrawn judgment. Earlier snapshots and previously released artifacts remain historical records; this does not automatically revoke globally released Expertise.

Tests use synthetic judgments in temporary runs to cover preservation, withdrawal reason, stale manifest recovery, missing/mismatched artifacts, derived-memory suppression, stale plan rejection, distillation/incremental guards, exported status and the actual local HTTP endpoint's origin/run checks. Chrome exercises Chinese and English withdrawal controls. No real user's decision was withdrawn during validation.

## Exceptions for one run

Before execution/result capture, an approved principle can be excluded for one run with a reason and its current content hash. It can be restored with a new reason. The project/task memory list exposes both actions. The CLI equivalent is `pnpm harness memory-exception --run DIRECTORY --principle ID --hash CONTENT_HASH --decision exclude|apply --reason TEXT`. These actions leave the global principle and other runs unchanged.

Each decision appends to an immutable, content-addressed `project-memory-exceptions/<hash>.json` snapshot referenced by the run manifest. The current manifest reference determines which snapshot is committed. An interrupted update may leave an unreferenced file; that is not an applied exception. Existing plans are archived with their exact text/hash, removed from the current plan, and must be regenerated. The current evidence confirmation remains, and execution still requires explicit scope approval. Snapshots include effective entries, excluded entries with reasons and the full exception history. Diagnosis, implementation and independent review consume the same run exception data; exclusions cannot waive current evidence, approved Foundation or QA requirements. Export includes the exception snapshot and hash-verified prior plans.

Immediately before worktree creation, the runner acquires the run lock, rechecks the expected plan and memory, and writes `execution-context.json` with the plan hash. This is execution intent, not a successful execution or acceptance. The immutable record remains authoritative if its manifest mirror is stale. Once intent exists, changing the plan, confirmation or per-run exceptions requires a new run. Retrying the exact same plan after a missing binary remains allowed, and result capture is still permitted. Global principle retirement can occur later and remains subject to existing memory checks; this is not a transaction across the project store and running model.

Tests cover run isolation, reason/hash validation, exclusion/restoration history, stale plan rejection, exact archived exports, tampered snapshots, pre-result execution freezing, retry/result capture compatibility and the actual browser-to-local-service-to-store path in Chinese and English. A simulated QA call receives exclusions and cannot change them after capture. These fixtures do not establish model quality or real user acceptance.

Remaining #9 work: governed Expertise promotion traced to reviewed regression cases, including withdrawal impact on already promoted rules. Standalone custom run directories outside the workbench layout have no inferred memory store. Reviewer identity verification and real project acceptance remain separate. Global Skills are never modified by an individual judgment; the distiller contract version changes document an engineering behavior change.
