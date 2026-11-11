# Product Designer Harness architecture

The product serves independent developers after an app exists and when they are about to add a new surface. Hypit is a packaging and architecture reference: a domain spec, planner, execution adapters, and validation. Our domain is product experience, not video.

There are two entry routes into the same system:

- **Review existing product:** extract the current foundation, diagnose a rendered task, improve one priority problem, and prove the result against the baseline.
- **Design a new surface:** establish and approve the foundation first, define the page task and composition second, generate the page third, and evaluate the first render for conformance. A page generator is therefore an execution adapter downstream of the foundation, not a separate source of design decisions.

## Core model

```text
Product context + user task
          ↓
Browser evidence + source reference
          ↓
Design Foundation inventory (brand / tokens / components / patterns)
          ↓
Human foundation review (approve / replace / deprecate)
          ↓
Experience Spec v0.1 ──→ finding selection / priority rationale
          ↓
Run manifest + baseline artifacts
          ↓
Human evidence-match confirmation (supported / stale)
          ↓
Scoped agent brief ──→ isolated Git worktree ──→ code change
          ↓
Same-state desktop/mobile capture
          ↓
Deterministic checks + independent Visual QA + human decision
          ↓
Accept/reject + reason ──→ later expertise proposal / regression case
          ↓
Approved foundation updates + project memory
```

The **Experience Spec** owns project goal, audience, critical task, evidence, findings, a proposed fix, judgment and an optional Design Foundation inventory. Findings must cite evidence IDs. Observations from code, browser or a person are labeled by origin. Foundation entries distinguish observed conventions from approved rules and deprecated artifacts. It is an intermediate representation, not a prompt dump.

The **Design Foundation** is the product's evolving source for brand principles, voice, assets, design tokens, components, variants, states and reusable interaction patterns. The first review extracts what already exists, including duplication and inconsistency. Extraction does not silently turn every current implementation into a rule: a human can approve, replace or deprecate each artifact. Scoped edits must reuse approved components and tokens where possible; accepted new patterns become proposed foundation updates before they affect later reviews. For a new page, foundation approval is a hard gate: the page brief may compose approved tokens, components and patterns, but may not quietly invent a second visual language.

The minimum approved foundation for page generation contains semantic colour and typography roles, spacing and radius scales, elevation and motion rules, brand voice and assets, core components with variants and interaction states, responsive behaviour, and accessibility constraints. Completeness is contextual: the system records absent coverage rather than filling it with model defaults. The first rendered page is evaluated for task quality and foundation conformance; it is not described as an improvement when no earlier page exists.

The **Run** owns execution state and artifacts. Each run snapshots the spec and records the target URL, selected finding, captures, agent execution, evaluation and decision. It lives under `.harness/runs/<id>/` by default and is ignored by Git. The spec can be versioned in a project; the run is local evidence and must not silently overwrite an earlier comparison.

## Executable stages

| Stage | Input | Output | Gate |
| --- | --- | --- | --- |
| Onboard | Project config | Run directory and baseline capture | Checkout valid and preview responds |
| Init | Valid Experience Spec, URL | `run.json`, spec snapshot | HTTP(S) URL and schema validity |
| Capture before | URL | desktop/mobile PNG and DOM summary | Browser load |
| Attest hierarchy (optional) | Baseline screenshots | visual review record | Reviewer and version named; baseline screenshots only, no `after/` reference |
| Skill | Run, Skill ID, optional repository | immutable versioned result under `skills/` | Registered Skill with an allow-listed handler; one result per run |
| Diagnose | Skill results and spec observations | `diagnosis.json` evidence graph and priorities | Score withheld unless a versioned rubric gives all six dimensions a score, a weight above zero, a rationale and evidence that resolves, and coverage reaches 80% |
| Approve foundation | Observed inventory and proposed rules | Versioned approved foundation | Human approves, replaces or deprecates every rule used by generation |
| Confirm | Baseline, finding ID, human note | supported or stale verdict | Stale evidence cannot reach the agent |
| Plan | Supported finding | `codex-brief.md` | Finding cites existing evidence |
| Execute | Brief, clean Git repository, selected agent | New worktree, agent event log, diff | Explicit command; no push or deploy; host repository unchanged |
| Capture after | Same or explicit updated URL | matching PNG and DOM summary | Baseline exists |
| Evaluate | Both captures | `evaluation.json` | Same viewport dimensions |
| Attest Visual QA | Matched before/after screenshots | visual review record | Reviewer and version named; matched before/after reference in every captured viewport |
| Judge | Evaluation, attestation, human decision | updated spec and run manifest | Reason required; accept unavailable until Visual QA passes |

`export` and `reindex` are not loop stages. `export` copies an allow-list of a finished run into a statically served folder so the Workbench can read it; the worktree and the agent event log are never copied. `reindex` rebuilds `index.json` from runs already exported and copies nothing.

The brief is still written as `codex-brief.md`. That name predates multi-agent support and is kept so existing runs stay readable; every registered agent consumes the same file.

The capture contract models a task state as a start point, ordered replay actions and a named configuration. Web configurations currently describe viewports; a later native adapter can describe a device without changing the ledger shape. New comparisons match `stateId + configurationId`, and an after version that cannot reach a baseline state records `stateReached: false` instead of silently skipping it. Legacy single-URL captures remain readable as one implicit `page` state with zero actions.

The browser adapter currently uses official Playwright Core with an installed Chrome or Edge channel. The default capture command produces legacy 1280×800 desktop and 390×844 mobile evidence; `capture --plan FILE` executes the state contract. Every state/configuration pair receives a fresh browser context, replays the bounded action vocabulary using accessible roles and labels, and either records a screenshot and DOM summary or an explicit unreachable result. The deterministic evaluator only checks state reachability, page response, heading presence and horizontal overflow. It exposes before/after text and image paths; it does **not** claim aesthetic improvement or calculate an Experience Score.

## Agent adapters and the permission boundary

Any coding agent may perform the edit, so the promise the Harness makes cannot depend on which one runs. `packages/harness-core/agents.js` declares the boundary once — non-interactive, writes confined to the run worktree, repository instruction files not auto-loaded, no push or merge or deploy, and bounded turns or wall-clock time — and every adapter must describe how it addresses each clause, including weaker controls.

The runner applies adapter flags and supplies an inherited Git configuration to block pushes to configured remotes. It fingerprints the host checkout before and after execution and records changes outside the run branch as failures. The remote override is best effort, so use only trusted agents and projects.

Two implementation adapters are registered. Codex runs `codex exec` with `-s workspace-write`. The Alpha.2 release records a real Codex diagnosis, isolated repair and independent review. The current Codex adapter treats repository instructions as data in the prompt. Its CLI flags do not disable automatic repository instruction discovery. Claude Code runs `claude -p` with `--permission-mode acceptEdits`, `--bare` and `--disallowed-tools` for selected publication and Git configuration commands. Claude Code has adapter-level checks, with end-to-end validation pending. The adapters report their verification status in `harness agents`. These are operational controls for trusted local development. The Git fingerprint is a detection mechanism for the inspected local checkout and refs. It cannot detect every external side effect.

Execution always happens in a **new Git worktree** taken from a clean repository. The brief is passed through stdin; the runner retains the event log, worktree path, exit code, signal and timing. Repository files, public pages and evidence are untrusted data; they cannot grant new instructions to the agent. If the agent fails, times out or breaches the boundary, the worktree and logs remain available for review.

## Ownership boundaries

- `packages/experience-core`: spec validation, explainable priority, brief generation, judgment.
- `designFoundation` in the Experience Spec: portable brand, token, component and pattern inventory with lifecycle status.
- `packages/harness-core/store.js`: local run ledger and stage gates.
- `packages/harness-core/workflow.js`: the Expert Loop state machine and its execution limits.
- `packages/harness-core/browser.js`: replaceable browser evidence adapter.
- `packages/harness-core/agents.js`: the declared permission boundary and the agent adapter registry.
- `packages/harness-core/runner.js`: worktree setup, agent execution and host-repository verification.
- `packages/harness-core/export.js`: allow-list export and manifest redaction.
- `packages/harness-core/evaluate.js`: deterministic comparison contract.
- `scripts/harness.mjs`: CLI orchestration, also used by the installed lightweight Skill.
- `packages/workbench/service.js`: optional local HTTP interface for run creation, job orchestration and stage writes through the same store. A static build reads exported runs only.

## Invariants and limits

One run selects one finding and one task. The selected finding must be explicitly confirmed against the baseline; a stale verdict invalidates any prepared brief. Before/after screenshots must use identical viewport sizes. Acceptance is unavailable until an independent Visual QA attestation passes, and a failing attestation permits only reject. A run whose agent changed the host repository outside its worktree is failed whatever its exit code. A run never converts a repository change into a claim about the live site without verifying deployment source and URL. A failed capture, missing evidence or agent error remains visible in the run; it must not be replaced with a sample success. Human acceptance is recorded separately from deterministic checks. Observed foundation entries are never treated as approved design rules without review.

Version 0.1 runs locally. Bounded model diagnosis and independent visual review are available via Codex in the workbench and the lightweight Skill. Deterministic evaluation still reports structural evidence separately, and a model verdict still needs a human decision. The first source-bound lightweight repair has matching originals, an independent verdict and explicit user acceptance. See the [Alpha.2 roadmap](next-steps.md) for verified cases and remaining cross-agent, onboarding and release work.
