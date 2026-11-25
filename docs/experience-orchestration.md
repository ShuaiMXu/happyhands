# Task, design decision and independent experience review

This implements the Issue #26 repair chain in the existing Run. It does not change a product page, approve a design direction or replace the final human judgment. The Domaroo rejected candidate remains rejected; its latest independent review was not run. Passing functional checks was not evidence of improved design.

## Order and responsibility

| Stage | Execution guidance | Deliverable / next gate |
| --- | --- | --- |
| Bound task and baseline | review-product | Actual user, scenario, outcome, constraints, scope and exclusions. Separate original request, operator proposals and assumptions. Capture source-bound originals. |
| Read-only experience pre-audit | review-product for a working interface or web-taste for a public page. Consult the topic raised by the evidence. | Journey questions/actions, observed problems versus hypotheses, impact, root cause, priority and uninspected scope. Inspect current-page AI slop and control detail first; mobile fit is later regression coverage. |
| Select and adapt design basis | foundation-extractor, brand-foundation-extractor, component-inventory; resources search/select | Read actual project sources and selected full references. Record hash, section, target problem, adoption, preservation and rejection. Source observations never become approval. |
| Formal diagnosis and scope | Existing model diagnosis, clear-defect admission, confirmation or delegated repair scope | Evidence-backed defects remain distinct from experience hypotheses. Do not call a missing operator-prescribed format a defect. A proposed experience experiment requires the user's authorized scope, not automatic defect admission. |
| Decide | fix-planner, component-reuse-planner; web-taste for public websites, Impeccable Critique | Reading order, grouping, main action, show/merge/defer content, grid, components/consumers/states, reference application, alternatives, benefits, costs and verification. Compare a lighter alternative or preserving the current design. |
| Isolated repair | experience-remediation; Impeccable Layout/Polish | Actual changed files, each delegated issue and method result, preserved/false-positive/blocked outcomes. Challenge a bad plan and return to decision; do not silently widen scope. No publication authority. |
| Recheck | component-state, consistency, accessibility methods; then responsive/reduced-motion regressions | Inspect normal-page task/detail first, actual open/selected/focus/error/recovery where applicable. Existing per-rule remediation and browser verification requirements still apply. |
| Independent read-only review | visual-qa-evaluator; Impeccable Critique | Original task and baseline first, candidate next, operator rationale and counts last. Separately report task, hierarchy, interaction, design-system and regression. A compliant candidate can fail for worse experience. |
| Human decision and learning | judgment-distiller, regression-case-author | Real acceptance/rejection, remaining issues and bounded positive/negative case. No model-authored human judgment; no global “never use tables” rule. |

Each stage contributes to one run. Start the pre-audit from the task and its original captures. Open the relevant complete method when an observation raises a question. Method quotations and applications retain provenance; they cannot prove that a model actually read, reasoned or operated a browser correctly. Independent review and actual human judgment remain necessary.

## Two records, existing ledger

New lightweight `start` and `continue` review runs require policy `task-design-review@2`, including an explicit `audit.task.goal` (`design-goal@1`): repair, improvement or mixed, an original-request quote, criteria, preservation and allowed changes. Final improvement/mixed QA requires an explicit improved matched-original comparison; preservation may satisfy a repair goal. Existing `task-design-review@1` records remain readable without invented goals; new @2 runs cannot downgrade. An explicit call ceiling is required before new @2 model execution; preflight remains free. Existing low-level `init`/`onboard` and optional workbench records retain their old behavior for compatibility; they are **not retroactively assessed under this policy**. Before using those routes for this design process, submit an audit before diagnosis, which enables the policy. If diagnosis has already happened, continue in a fresh run. No old source, screenshot, failure or acceptance is rewritten.

1. Capture the before originals. For a public website, run `HH experience --run RUN --phase context --surface public-page --step inspect`. Use `app-screen` for a working interface. Before an audit is saved, omitting `--step` also selects `inspect`. Read the user’s task, open its original captures and identify where the user gets stuck. This response lists source paths and hashes so you can open the relevant project rule or selected snapshot directly.
2. Follow the observation to the method. For example, if someone can find a renewal but cannot tell which price covers which term, run `HH experience --run RUN --phase context --surface public-page --step method --topic hierarchy-content`. Open the methods listed for that question. Use the same surface throughout the pre-audit. Without a topic, `--step method` gives the primary method. The `topics` list from inspect identifies the available audit dimensions. Consult another topic when a separate observation needs it. If you already have the applicable method and its exact staged citation for this run, reuse it and proceed to the record. Apply web-taste for public websites and landing pages.
3. If the task needs a design reference, select the relevant document before recording the audit. Project documents come from `designSourcePaths`; external references use `resources search/select`. Inspect again to see newly selected source paths and hashes. Explain how each selected source bears on the task, including any reason to reject it.
4. When ready to write the audit, run `HH experience --run RUN --phase context --surface public-page --step record` for the current `auditSchema`. Report all nine dimensions once. Use `observed` for a check anchored to an original, `inferred` for an interpretation, `needs-evidence` for a gap, or `not-applicable` with a reason. Cite the actual method path, a matching quotation and its application. An issue with a clear primary topic can include `topic` from the inspect list, such as `components-states`. Omit it when the appropriate method is unclear. Submit `HH experience --run RUN --phase audit --input AUDIT.json`.
5. Run formal diagnosis. Inspect the baseline evidence to establish which problems can be reported and what remains uncertain. For authorized follow-up, select the supported scope and confirm or record delegated investigation. Plain `HH experience --run RUN --phase context` supplies the decision guidance and `decisionSchema` after the audit is frozen.
6. Write the decision, then run `HH experience --run RUN --phase decision --input DECISION.json`. Explain how to apply or reject each selected source and how to verify that decision. Keep unselected problems in the audit. Record optional `repairImpact` as `local` for a single identified component instance or usage, or `broad` for a shared implementation, page-level or cross-route change. Leave it unset when consumer impact is unknown.
7. Continue with planning, isolated execution, matched after capture, verification, evaluation, independent review and human judgment. Each stage uses the saved evidence and its own reading plan.

`HH` means the installed Skill’s Node entry point. Context reads can be repeated or resumed and require no user approval. Saving the audit checks the record, its originals, sources and method citations. A missing observation may be recorded as a gap. An audit field or method lookup is never proof that someone checked the running page.

Each record is immutable and hash-addressed in the same Run. It binds the task, baseline manifest and original bytes, repository identity, selected source hashes; the decision also binds the audit, current diagnosis and confirmed scope. A changed reference, source, screenshot, task or scope requires a fresh round. Runtime-only model sessions receive the public-page route from the frozen audit. A selected external Design.md can be a reference but cannot become a project rule. `project-rule` records an existing document's role, **not an approval event**; extraction and inference must stay observed, and explicit Foundation approval retains its existing separate authority.

The public static export remains a display copy, not an executable/importable Run. Local audit/decision and complete method snapshots stay in the local ledger; the execution brief’s private planning section is omitted from its public display copy; avoid publishing private inputs without deliberate review.

## Acceptance and regression limits

All five experience dimensions are required for independent QA under this policy. Task and hierarchy cannot be skipped. A reported failure or missing evidence blocks a pass even when functional checks pass. Regional sessions assess their assigned evidence; their reports and the complete-task cross-region session retain the existing aggregation and coverage gates. A missing full-task review is not acceptance.

The regression tests exercise real command/ledger/model-context boundaries with explicit synthetic model output. They test source tampering, missing deliverables, false reference authority, missing section/quote, immutable records, a lighter alternative, delivery to execution/review and blocking an acknowledged hierarchy regression despite functional success. They also permit a comparison table when its task-specific decision justifies it. **These tests do not show that a real model can independently recognize the rejected Domaroo design.** A fresh real-page run and human comparison remain pending until page work is authorized again.


## Existing implementation and evidence boundaries retained

The new task/audit/decision gates supplement these providers and constraints; they do not replace their complete methods or claim that bounded handlers execute all professional judgment.

This map describes actual Harness providers. A Skill supplies methods; a host stage executes and checks artifacts. Reading a Skill is not execution evidence. Project-approved sources and confirmed scope take precedence over generic style suggestions.

| Stage | Applicable methods and sources | Actual provider | Required result / gate |
|---|---|---|---|
| Scope and baseline | Project DESIGN.md/Foundation; own experience-remediation; finding-admission policy | Onboarding, Capture Plan, baseline diagnosis | User task, target routes/current viewport, original screenshots and actual interaction evidence; uncertainty stays explicit |
| Current-page diagnosis | Surface method, relevant issue topics, project sources and any explicitly adopted remediation checks | baseline-diagnosis + configured diagnostic handlers | Original evidence for admitted defects, reasonable choices to preserve and evidence gaps |
| Plan | experience-remediation; project component/grid sources; admitted historical cases | savePlan | Confirmed/delegated issue scope, bound method/Skill snapshot, source references, case digest and verification targets |
| Shared-component remediation | experience-remediation; Impeccable polish | isolated agent runner | Reproduce the defect, repair shared cause, inspect consumers and actual states; exact per-rule/per-issue result |
| Task and layout remediation | web-taste task-specific composition; Impeccable layout when intent=layout | same isolated runner | Explain content order, grouping, retained/removed copy, component proportions and adopted grid decisions |
| Motion, only if applicable | Impeccable animate when intent=animate | same runner + actual browser checks | Useful transition and reduced-motion evidence; never infer motion from a screenshot |
| Recapture and regression | Own state checklist; project device/grid contract | Capture Plan + specialist verification | Current-page default/open/selected/focus/keyboard evidence first, then other planned devices/routes; no manufactured controls |
| Independent acceptance | Own Skill; Impeccable audit/critique; web-taste review route; project sources | separate ai-review session, visual-review gate | Every assigned rule/state accounted for; executor claims alone cannot pass; failures and missing evidence remain visible |
| Human judgment and cases | Own method-evolution rules | saveJudgment, case collection/admission | Explicit accept/reject; candidate collection is automatic, admission is separate; improved/preserved/regressed/withdrawn cases retain provenance |

## Routing constraints

- `designGuidance.taste=public-page` selects web-taste for a website or landing page. Baseline diagnosis uses review-product for an `app-screen`. Choose the surface that matches the task under review.
- `designGuidance.intent=polish|layout|animate` adds the corresponding implementation reference. These are not three simultaneous adapters. Stage a new scoped run when a different intent is required.
- Own rules activate through explicit `remediation.profile=happyhands` and adoption reason. Other projects can use `project`; their brand is not silently replaced.
- The [homepage Hero rules](experience-remediation.md#happyhands-官网-hero) activate through `remediation.surface=homepage-hero` on the owned profile. A bound browser check and independent review cover the approved orbit, reduced motion and single glass mark.
- Use the project's component variants, grid and motion rules for the affected states.
- Case references are historical context, not fresh evidence or automatic approval. No automatic upstream script execution, human judgment, merge or deployment is implied.

## Mandatory order

Current-page AI slop/details → shared-component states/consumers → user task/hierarchy/layout → cross-device regression → auxiliary stress checks. The common review prompt and own operational Skill use the same order. Evidence-stage identifiers remain compatible; all planned states still require coverage.

## First real-product validation batch

Use the HappyHands website as the target, separately from the Harness workbench. Start with the resource discovery task: browse Design.md, search/filter, open a resource and switch preview/download views. Reproduce the reported dropdown, checkmark, focus, spacing and tab issues against the current version before proposing fixes. Check shared consumers in studio/setup when the implementation is shared. Preserve third-party design specimens.

A batch is complete only with source-bound baseline, actual task/state evidence, justified shared-source changes (or evidence-backed preservation), after evidence, independent QA and an explicit list of remaining gaps. Static fixture success is not this batch's acceptance. Later device checks cannot replace fixing the current-page defects.

## Anti-slop Skill identity and placement

`web-taste` is the primary method for public websites and landing pages. The complete pinned source and its Harness adapter remain available throughout the run. Public-page redesign, implementation and independent review use the references specified by their stage. For implementation and scoped independent review, a confirmed polish or harden repair can defer complementary reading when its bound decision identifies one affected usage. Older decisions with unknown impact, delegated investigations, shared repairs and cross-region review retain the full public-page reading route at those stages. Legacy Taste profiles require explicit selection.

Diagnosis identifies observable task harm or an adopted-rule violation. Implementation records the concrete repair/preservation in the existing per-rule result. Independent review checks the rendered after state and whether simplification removed useful information. Use the project’s existing components and the selected repair method. Our operational Skill owns scope, ordering and report coverage. New unadopted suggestions remain proposals rather than automatic repair obligations.

## Stage reading plan

During pre-audit, `inspect` presents the task and evidence, `method` selects the primary method and an optional topic, and `record` returns the audit schema.

Each baseline session receives the user task and the pre-audit issues linked to its assigned originals, including unclassified issues. Open `experience.fullAudit.readPath` on demand for the full journey, coverage checks, design rationale or issues linked to other originals.

Focused baseline diagnosis starts from the surface method and the issue topics anchored to the originals in that batch. It assigns up to two distinct specialist documents in priority order. The nine dimension checks describe coverage. A normal observation or an issue without a classified topic leaves the specialist reading on demand. Existing audits can omit issue topics. Inspect all assigned originals, including those that had no reported issue. When a new question arises, open its relevant method and apply the existing evidence and citation checks before admitting a finding. A topic directs reading and carries no defect verdict or repair authorization.

Decision, execution and independent review retain their own reading plans. Operators who need the full design guidance can set `HAPPYHANDS_GUIDANCE_DEPTH=full` for that run. The source snapshots stay available for citation and verification in either mode.

The plan uses the surface and intent and, when available, the frozen repair/improvement goal. A scoped review can move references to on-demand while keeping original images, evidence coverage and the independent review and human-decision requirements. Execution records its reading plan alongside its prompt. The plan and byte counts describe available or required inputs. Actual model usage is measured separately.


## Component lineage

For cross-page or resource-rendering changes, use the existing `components-states` audit, component reuse plan, and `design-system` independent assessment. Record the shared implementation path, consumers, token or variant, and applicable states. An extension needs a distinct user-facing purpose and an explanation of why existing APIs are insufficient. Design.md theme values may vary through approved component inputs, and original third-party previews retain their implementation.

Technical checks can confirm registered families and enforce composition boundaries. Reviewers still inspect source relationships and real default, selected, expanded, focus or disabled states where applicable. Record `fail` for verified, unjustified forks. Use `needs-evidence` when sources, variant rationale or real state evidence are unavailable. Keep the existing independent review and human acceptance flow.
