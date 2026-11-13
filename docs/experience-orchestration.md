# Task, design decision and independent experience review

This implements the Issue #26 repair chain in the existing Run. It does not change a product page, approve a design direction or replace the final human judgment. The Domaroo rejected candidate remains rejected; its latest independent review was not run. Passing functional checks was not evidence of improved design.

## Order and responsibility

| Stage | Execution guidance | Deliverable / next gate |
| --- | --- | --- |
| Bound task and baseline | review-product | Actual user, scenario, outcome, constraints, scope and exclusions. Separate original request, operator proposals and assumptions. Capture source-bound originals. |
| Read-only experience pre-audit | IA, interaction, error-recovery, visual-hierarchy and content-design methods; OJO design-audit; Impeccable Audit/Critique | Journey questions/actions, observed problems versus hypotheses, impact, root cause, priority and uninspected scope. Inspect current-page AI slop and control detail first; mobile fit is later regression coverage. |
| Select and adapt design basis | foundation-extractor, brand-foundation-extractor, component-inventory; resources search/select | Read actual project sources and selected full references. Record hash, section, target problem, adoption, preservation and rejection. Source observations never become approval. |
| Formal diagnosis and scope | Existing model diagnosis, clear-defect admission, confirmation or delegated repair scope | Evidence-backed defects remain distinct from experience hypotheses. Do not call a missing operator-prescribed format a defect. A proposed experience experiment requires the user's authorized scope, not automatic defect admission. |
| Decide | fix-planner, component-reuse-planner; web-taste for public websites, OJO composition, Impeccable Critique | Reading order, grouping, main action, show/merge/defer content, grid, components/consumers/states, reference application, alternatives, benefits, costs and verification. Compare a lighter alternative or preserving the current design. |
| Isolated repair | experience-remediation; relevant complete OJO recipes/tokens/icons/motion and Impeccable Layout/Polish | Actual changed files, each delegated issue and method result, preserved/false-positive/blocked outcomes. Challenge a bad plan and return to decision; do not silently widen scope. No publication authority. |
| Recheck | component-state, consistency, accessibility methods; then responsive/reduced-motion regressions | Inspect normal-page task/detail first, actual open/selected/focus/error/recovery where applicable. Existing per-rule remediation and browser verification requirements still apply. |
| Independent read-only review | visual-qa-evaluator; OJO audit, Impeccable Critique | Original task and baseline first, candidate next, operator rationale and counts last. Separately report task, hierarchy, interaction, design-system and regression. A compliant candidate can fail for worse experience. |
| Human decision and learning | judgment-distiller, regression-case-author | Real acceptance/rejection, remaining issues and bounded positive/negative case. No model-authored human judgment; no global “never use tables” rule. |

These are responsibilities in one pipeline, not a new approval step for each Skill. The complete local method directories, OJO and design packages are staged intact; the agent reads relevant complete references. Method quotations and applications retain provenance; they cannot prove that a model actually read, reasoned or operated a browser correctly. Independent review and actual human judgment remain necessary.

## Two records, existing ledger

New lightweight `start` and `continue` review runs require policy `task-design-review@1`. Existing low-level `init`/`onboard` and optional workbench records retain their old behavior for compatibility; they are **not retroactively assessed under this policy**. Before using those routes for this design process, submit an audit before diagnosis, which enables the policy. If diagnosis has already happened, continue in a fresh run. No old source, screenshot, failure or acceptance is rewritten.

1. Capture before originals and perform a read-only pre-audit to identify relevant reference questions.
2. Select actual references with existing `resources search/select`, and project design documents with `designSourcePaths`.
3. `HH experience --run RUN --phase context --surface public-page` returns both record schemas, exact original references, full selected texts and complete method snapshot locations. Use `app-screen` for product working interfaces. Public websites and landing pages require web-taste as the primary method; other packages supplement it. Project constraints remain higher priority than reference recipes.
4. Write the audit using that schema and actual observations. `HH experience --run RUN --phase audit --input AUDIT.json` validates and freezes it. Every audit dimension needs an observed/inferred/missing/not-applicable result and reason. Do not fabricate runtime proof from a screenshot. The audit can preserve unknowns; it does not certify quality.
5. Run normal formal diagnosis, select the supported scope and confirm or record delegated investigation.
6. Write the decision, then `HH experience --run RUN --phase decision --input DECISION.json`. Every selected design basis needs a task-specific application or rejection and verification approach. Keep unselected problems in the audit.
7. Existing `plan`, isolated `execute`, matched after capture, `verify`, `evaluate`, `model-review` and human `judge` follow. The executor and independent reviewer receive the actual audit and decision, not just file names. The old per-rule AI slop contract remains required wherever adopted; the nine audit dimensions are not a substitute for those individual checks.

`HH` means the installed Skill's actual Node entry point. Keep input files outside the product checkout. `context` only stages methods and returns data; it does not inspect or edit a webpage. The input schemas are returned from the running version, avoiding duplicate stale examples.

Each record is immutable and hash-addressed in the same Run. It binds the task, baseline manifest and original bytes, repository identity, selected source hashes; the decision also binds the audit, current diagnosis and confirmed scope. A changed reference, source, screenshot, task or scope requires a fresh round. Runtime-only model sessions receive the public-page route from the frozen audit. A selected external Design.md can be a reference but cannot become a project rule. `project-rule` records an existing document's role, **not an approval event**; extraction and inference must stay observed, and explicit Foundation approval retains its existing separate authority.

The public static export remains a display copy, not an executable/importable Run. Local audit/decision and complete method snapshots stay in the local ledger; the execution brief’s private planning section is omitted from its public display copy; avoid publishing private inputs without deliberate review.

## Acceptance and regression limits

All five experience dimensions are required for independent QA under this policy. Task and hierarchy cannot be skipped. A reported failure or missing evidence blocks a pass even when functional checks pass. Regional sessions assess their assigned evidence; their reports and the complete-task cross-region session retain the existing aggregation and coverage gates. A missing full-task review is not acceptance.

The regression tests exercise real command/ledger/model-context boundaries with explicit synthetic model output. They test source tampering, missing deliverables, false reference authority, missing section/quote, immutable records, a lighter alternative, delivery to execution/review and blocking an acknowledged hierarchy regression despite functional success. They also permit a comparison table when its task-specific decision justifies it. **These tests do not show that a real model can independently recognize the rejected Domaroo design.** A fresh real-page run and human comparison remain pending until page work is authorized again.


## Existing implementation and evidence boundaries retained

The new task/audit/decision gates supplement these providers and constraints; they do not replace their complete methods or claim that bounded handlers execute all professional judgment.

This map describes actual Harness providers. A Skill supplies methods; a host stage executes and checks artifacts. Reading a Skill is not execution evidence. Project-approved sources and confirmed scope take precedence over generic style suggestions.

| Stage | Methods to read in full | Actual provider | Required result / gate |
|---|---|---|---|
| Scope and baseline | Project DESIGN.md/Foundation; own experience-remediation; finding-admission policy | Onboarding, Capture Plan, baseline diagnosis | User task, target routes/current viewport, original screenshots and actual interaction evidence; uncertainty stays explicit |
| Current-page diagnosis | Own 29 adopted checks; OJO SKILL, anti-patterns, design-audit; Impeccable audit/critique; web-taste task-adapted or public-page guidance | baseline-diagnosis + configured diagnostic handlers | Per-rule evidence, applicable defects and preservation decisions; a preference is not a repair finding |
| Plan | experience-remediation; project component/grid sources; admitted historical cases | savePlan | Confirmed/delegated issue scope, bound method/Skill snapshot, source references, case digest and verification targets |
| Shared-component remediation | experience-remediation; OJO component-recipe and icon-guidelines; Impeccable polish | isolated agent runner | Reproduce the defect, repair shared cause, inspect consumers and actual states; exact per-rule/per-issue result |
| Task and layout remediation | OJO visual-tokens and design-audit; web-taste task-specific composition; Impeccable layout when intent=layout | same isolated runner | Explain content order, grouping, retained/removed copy, component proportions and adopted grid decisions |
| Motion, only if applicable | OJO motion-system; Impeccable animate when intent=animate | same runner + actual browser checks | Useful transition and reduced-motion evidence; never infer motion from a screenshot |
| Recapture and regression | Own state checklist; project device/grid contract | Capture Plan + specialist verification | Current-page default/open/selected/focus/keyboard evidence first, then other planned devices/routes; no manufactured controls |
| Independent acceptance | Own Skill; OJO review bundle; Impeccable audit/critique; web-taste review route; project sources | separate ai-review session, visual-review gate | Every assigned rule/state accounted for; executor claims alone cannot pass; failures and missing evidence remain visible |
| Human judgment and cases | Own method-evolution rules | saveJudgment, case collection/admission | Explicit accept/reject; candidate collection is automatic, admission is separate; improved/preserved/regressed/withdrawn cases retain provenance |

## Routing constraints

- `designGuidance.taste=public-page` selects full web-taste public-page references; `app-screen` adapts composition to the working task. Mixed website and studio work should use separate scoped runs rather than one inappropriate route.
- `designGuidance.intent=polish|layout|animate` adds the corresponding implementation reference. These are not three simultaneous adapters. Stage a new scoped run when a different intent is required.
- Own rules activate through explicit `remediation.profile=happyhands` and adoption reason. Other projects can use `project`; their brand is not silently replaced.
- The [homepage Hero rules](experience-remediation.md#happyhands-官网-hero) activate through `remediation.surface=homepage-hero` on the owned profile. A bound browser check and independent review cover the approved orbit, reduced motion and single glass mark.
- OJO's complete bundle remains available. Required component, icon, grid and motion references are named in the execution contract. Generic 12-column/8pt examples never override adopted project values.
- Case references are historical context, not fresh evidence or automatic approval. No automatic upstream script execution, human judgment, merge or deployment is implied.

## Mandatory order

Current-page AI slop/details → shared-component states/consumers → user task/hierarchy/layout → cross-device regression → auxiliary stress checks. The common review prompt and own operational Skill use the same order. Evidence-stage identifiers remain compatible; all planned states still require coverage.

## First real-product validation batch

Use the HappyHands website as the target, separately from the Harness workbench. Start with the resource discovery task: browse Design.md, search/filter, open a resource and switch preview/download views. Reproduce the reported dropdown, checkmark, focus, spacing and tab issues against the current version before proposing fixes. Check shared consumers in studio/setup when the implementation is shared. Preserve third-party design specimens.

A batch is complete only with source-bound baseline, actual task/state evidence, justified shared-source changes (or evidence-backed preservation), after evidence, independent QA and an explicit list of remaining gaps. Static fixture success is not this batch's acceptance. Later device checks cannot replace fixing the current-page defects.

## Anti-slop Skill identity and placement

`web-taste` is the current user-selected method. New diagnosis, implementation and independent review use its pinned complete local variant and Harness adapter. Public-page work reads the complete copy, voice, system, layout and section references; working interfaces retain task-specific grouping and density without public-page quotas. Earlier `design-taste-frontend` / Taste v2 snapshots remain available only through explicit legacy profiles; no parallel executor or acceptance store is introduced.

Diagnosis identifies observable task harm or an adopted-rule violation. Implementation records the concrete repair/preservation in the existing per-rule result. Independent review checks the rendered after state and whether simplification removed useful information. OJO supplies control/icon/grid recipes and Impeccable supplies the selected repair method. Our operational Skill owns scope, ordering and report coverage. New unadopted suggestions remain proposals rather than automatic repair obligations.
