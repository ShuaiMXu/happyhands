# Operational experience orchestration

## 2026-11-13：web-taste 替换默认 Taste

用户明确要求：官网与落地页必须以 web-taste 作为主要设计与执行方法，使用 public-page 路由；OJO、Impeccable 为补充方法，独立审查也读取 web-taste。产品操作界面不自动套用宣传页规则。

新运行的 existing、app-screen、public-page 默认接入完整 web-taste 本地版本（Taste 2.5.1，基于 f6b76575f949707b4e3c37cd86cb44b0b98643e8）。来源和更名说明见 skills/vendor/web-taste/source.json 与 upstream/NOTICE。旧 taste／taste-v2 原文及已有运行快照不改写；仅通过显式 dials-v1／legacy-v2 选择旧方法。

诊断、执行与独立审查共用当前版本的来源快照，包含真实二进制素材的字节校验。完整原文保留，按实际表面读取相关完整方法。官网生成规则不自动适用于产品操作界面；不强制新增整屏章节、Hero、照片数量、随机配色或动效，不移除真实联系方式和必要的样例／交易说明。用户目标、批准设计系统和选定 Design.md 的适配判断优先。上游 Stop hook 与脚本不自动安装或执行，其 GATE 结果不替代 Harness 独立审查和人工接受。

历史章节中的旧默认路由以本节为准。这次只替换方法接入，不宣称 Issue #26 的完整编排方案已经实现。


This map describes actual Harness providers. A Skill supplies methods; a host stage executes and checks artifacts. Reading a Skill is not execution evidence. Project-approved sources and confirmed scope take precedence over generic style suggestions.

| Stage | Methods to read in full | Actual provider | Required result / gate |
|---|---|---|---|
| Scope and baseline | Project DESIGN.md/Foundation; own experience-remediation; finding-admission policy | Onboarding, Capture Plan, baseline diagnosis | User task, target routes/current viewport, original screenshots and actual interaction evidence; uncertainty stays explicit |
| Current-page diagnosis | Own 29 adopted checks; OJO SKILL, anti-patterns, design-audit; Impeccable audit/critique; Taste app-screens or public-page critique/layout | baseline-diagnosis + configured diagnostic handlers | Per-rule evidence, applicable defects and preservation decisions; a preference is not a repair finding |
| Plan | experience-remediation; project component/grid sources; admitted historical cases | savePlan | Confirmed/delegated issue scope, bound method/Skill snapshot, source references, case digest and verification targets |
| Shared-component remediation | experience-remediation; OJO component-recipe and icon-guidelines; Impeccable polish | isolated agent runner | Reproduce the defect, repair shared cause, inspect consumers and actual states; exact per-rule/per-issue result |
| Task and layout remediation | OJO visual-tokens and design-audit; Taste task-specific composition; Impeccable layout when intent=layout | same isolated runner | Explain content order, grouping, retained/removed copy, component proportions and adopted grid decisions |
| Motion, only if applicable | OJO motion-system; Impeccable animate when intent=animate | same runner + actual browser checks | Useful transition and reduced-motion evidence; never infer motion from a screenshot |
| Recapture and regression | Own state checklist; project device/grid contract | Capture Plan + specialist verification | Current-page default/open/selected/focus/keyboard evidence first, then other planned devices/routes; no manufactured controls |
| Independent acceptance | Own Skill; OJO review bundle; Impeccable audit/critique; Taste review route; project sources | separate ai-review session, visual-review gate | Every assigned rule/state accounted for; executor claims alone cannot pass; failures and missing evidence remain visible |
| Human judgment and cases | Own method-evolution rules | saveJudgment, case collection/admission | Explicit accept/reject; candidate collection is automatic, admission is separate; improved/preserved/regressed/withdrawn cases retain provenance |

## Routing constraints

- `designGuidance.taste=public-page` selects Taste public-page critique/layout; `app-screen` selects app-screens. Mixed website and studio work should use separate scoped runs rather than one inappropriate route.
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
