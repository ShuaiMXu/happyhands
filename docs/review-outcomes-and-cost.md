# Goal-bound review, recovery and measured review cost

Unpublished isolated implementation for issues #7/#26/#34/#14. It extends merged #28/#30/#31 and does not duplicate draft #29. No product page, human acceptance or deployment is changed.

## A. Task goals and deterministic preparation

New lightweight start/continue runs use task-design-review@2. Their audit.task.goal is mandatory: version design-goal@1, kind repair/improvement/mixed, an exact quote from originalRequest, criteria, preservation and allowed changes. The audit and decision must use the same policy; a new run cannot downgrade. Existing @1 records remain valid without fabricated goals or retrospective acceptance.

Final independent QA for improvement/mixed cannot pass without an explicit improved designComparison with an explanation and inspected matched before/after originals. Repair tasks may preserve appearance. Regional assessments cannot certify a whole-task goal. Operator-authored requests still require real authorization; the schema cannot prove user intent or visual improvement.

Native review validates all planned PNG files and cross-region capacity/dimensions before regional calls. Every later call rechecks complete original hashes, rejecting drift before another model invocation. Inline encoded image text is rejected in prompt/context. This prepares native CLI -i delivery; it does not certify visual perception, external MCP delivery, or actual human inspection.

Use model-review --run RUN --preflight-only true to produce native-review-plan.json with complete image hashes, potential calls, requested policy and current measured costs. No model call or cost reservation occurs. New @2 runs require an explicit call ceiling (persisted maxCalls or invocation max-model-calls) before actual model execution; the prepared plan is retained when it is missing. No arbitrary numeric default or per-batch approval is invented.

review-normalize --run RUN --input RAW.json --out NEW.json supports only exact unique verification UUID→record-ID conversion and removal of misplaced verification UUID attachment refs when their record and original images are already cited. All semantic fields remain unchanged. The original is retained; separate provenance records object and byte hashes and field conversions. Unknown/ambiguous or missing-evidence references are rejected, not guessed. Normalization does not attest or claim inspection.

## B. Same-run raw batch recovery

Use model-review --run RUN --model MODEL --resume-review true. Runtime identity includes explicit model, observed CLI version/executable, hashed config/layered instruction files and environment; config/credential bytes are not copied. A changed identity disables reuse. This binds request configuration, not immutable remote model weights or arbitrary external tool state.

Each raw batch result is immutable/hash-addressed and referenced by the current Run. Its key includes complete original hashes, spec, frozen task/scope/decision, methods, prompt/context, verification, model/runtime identity and relevant regional results. Every reused result is parsed and validated again, with current source/context/coverage checks. Failures/needs-evidence remain failures/needs-evidence. Invalid metadata is cached as raw output so it does not trigger random paid rerolls. Regional output does not replace the final cross-region review or human decision.

A later failure retains completed batches and raw logs; rerun performs only missing/invalidated work. Same-key pending calls cannot double-spend. Known failed-call retries require --retry-reason. Uncertain execution requires call-specific receipt reconciliation first. A still-live pending local owner cannot be declared not-started by reconciliation; unknown owner liveness remains blocked. A completed call whose original output is missing is blocked for recovery, rather than silently duplicated. Reconciliation is explicitly operator-supplied evidence, not a machine-certified provider receipt.

The existing accepted-parent source-incremental route and its human-acceptance requirement remain unchanged. This same-run recovery does not permit unaccepted parents to qualify for that route.

## C. Native visual-review accounting and cumulative policy

All native visual-review model invocations reserve and settle under the existing Run lock. Immutable review-cost snapshots preserve hash-linked history, original failures and reconciliations. Calls, total/cached/uncached input, output, unknown usage, pending/uncertain execution and policy changes are reported separately.

Codex JSONL parsing handles split chunks, exact duplicate terminal summaries and bounded lines. One unambiguous turn.completed usage record is supported; conflicting/missing/truncated usage is unknown, never zero. This does not estimate a bill or count uninstrumented external/diagnostic/coding-agent sessions.

- --max-model-calls N: hard ceiling for new calls in this invocation. Bound cache hits do not spend it.
- --max-total-calls N: reservation ceiling for measured native visual-review attempts across this continuation chain. Failed/cancelled reservations are not automatically refunded.
- --max-input-tokens N / --max-output-tokens N: observed cumulative thresholds checked before the next call; NOT hard per-call token caps. A single call can exceed a threshold because no reliable worst-case input/output ceiling is available.
- Missing usage blocks subsequent token-budgeted calls. Pending/uncertain execution blocks new spending, even without token limits. A later reconciliation requires a bound call-specific receipt, measured usage (or explicit not-started zero usage), provider reference and reason. These are operator assertions with retained hashes, not proof fabricated by the Harness.

review-costs --run RUN reads the report. review-budget --run RUN --input POLICY.json --reason TEXT explicitly revises policy, preserving usage and history. POLICY supports maxCalls/maxInputTokens/maxOutputTokens. review-reconcile --run RUN --input INPUT.json expects {callId,reason,evidencePath}; evidencePath is within the Run and contains {callId,execution:completed|not-started,usage:{input_tokens,cached_input_tokens,output_tokens},providerReceipt}. Readback rechecks receipt bytes. It cannot substitute for final human acceptance.

Continuation freezes complete source cost records, totals and policy without resetting them. Pending/uncertain execution must be reconciled before creating a successor. A predecessor with a successor cannot spend or revise its active policy. The source-bound lossless 0.2 gzip snapshot uses the earlier isolated fix: 2 MiB stored, 16 MiB expanded, hashes/byte counts, bounded decompression and old 0.1 compatibility. Evidence is not omitted to fit.

Older unmeasured histories remain explicit and cannot claim a complete-task cumulative budget. Token precision required for an inherited history must be established before it is frozen in a continuation; inherited unknown values are not reclassified as zero. Cost history has bounded readers (2 MiB current snapshot, 32 MiB hash-linked history); exceeding a bound blocks rather than truncates.

Export adds a sanitized cost summary plus per-review outcome display copies. Repair verification, comparative design, regression, model QA and the actual separate human record remain distinct. Old passes do not become design improvement.

## Remaining boundaries

External adapter image-delivery preflight, external/diagnostic/coding-agent usage adapters and graphical budget controls are not implemented here. Native workbench API uses the same ledger/policy, but same-run recovery is opt-in via the explicit-model CLI/programmatic identity, not an automatic UI feature. Remote CI, real model cost benchmarks, actual design improvement, Windows runtime identity and human comparison remain unverified. D requires authorized real cases and real people; synthetic protocol tests do not establish those outcomes.
