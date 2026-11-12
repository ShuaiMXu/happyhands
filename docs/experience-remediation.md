# Strict experience remediation

This flow turns the complete own experience-remediation Skill and the existing OJO, Taste and Impeccable packages into execution and acceptance contracts. It does not replace them with a blacklist, invent approval or migrate the target's framework.

## Activate for a project

Add an explicit, reviewed configuration to the existing project JSON:

```json
{
  "designGuidance": {
    "taste": "app-screen",
    "intent": "layout",
    "remediation": {
      "profile": "happyhands",
      "adoptionReason": "This project explicitly adopts the HappyHands UI rules for the requested remediation."
    }
  }
}
```

Use `profile: "project"` for a target that does not adopt HappyHands's house style. Both profiles cover user task, layout/grid, shared components/states, icons and motion. `happyhands` additionally covers the 19 original AI slop checks and the later adjacency, disclosure, reuse, radius and nested-shell rules (29 checks in total). Configuration is an operator declaration, not a model's claim of ownership. The workbench's existing project config path uses this same option. No new approval dialog is added.

This is explicitly enabled per project. Existing configurations and historical runs do not silently acquire new gates. Start a new run to enable it. The active plan binds its contract and adopted profile: editing the profile or deleting required artifacts without replanning fails verification. Explicit replanning before execution stages a new contract; after execution starts, use a new run to change scope or rules. No maturity label was rewritten to claim unproven operational quality.

## Actual invocation chain

| Node | Method / provider | Required output |
|---|---|---|
| Diagnosis | Existing rule handlers + independent baseline model; own Skill + OJO and Taste/Impeccable review methods | One `methodChecks` entry for every rule × supplied original state, alongside evidence-backed findings |
| Plan | Existing `savePlan`, component reuse and design source context | `remediation-contract.json`, own Skill snapshot and plan hash binding |
| Implementation | Existing isolated agent runner; own Skill, complete assigned OJO references, Impeccable Polish/Layout/Animate as configured, Taste | `.harness-remediation-result.json` in the target worktree, one row per rule and delegated issue |
| Collection | Host runner | Archive report outside the target, remove the temporary file, validate exact IDs, decisions and changed-file claims; blocked or malformed results fail execution |
| Recapture | Existing Capture Plan and specialist verification | Same-state after originals and actual interaction records |
| Independent QA | Existing separate model sessions, regional and cross-region review | Per-rule/per-state verdicts bound to the contract; missing coverage or unresolved checks cannot pass |
| Acceptance / export | Existing judgment, evidence binding and export | Revalidate contract, Skill and execution report; preserve human decision gate |

The result is a versioned own method, not a new competing execution pipeline. Register-based diagnostic handlers and the model implementation runner remain distinct providers.

## Execution priority

Start with the current page, not responsive adaptation: recurring AI slop and UI details → shared components and their actual interaction states → task, hierarchy and current-page layout/grid → phone and other viewport regression. Collecting multiple viewport captures does not change that priority. A responsive fix cannot stand in for current-page remediation. The contract records this workflow and the own Skill directs the executor and reviewer to follow it.

## Grids and composition

The `UX-grid` check requires observing the adopted content width, columns, gutter, outer margins, alignment and responsive reflow. The executor records the actual source and its design decision. OJO's 12-column/8pt examples are reference defaults, not a universal project constraint. Existing DESIGN.md, approved Foundation, captured DOM and source evidence determine the target's grid. Unknown evidence stays unknown. Do not hide horizontal overflow to mask clipped content, force every section into equal cards, or break reading order to fit an arbitrary grid.

Select the actual project design source files through the existing project configuration before capture. Their content and hashes now reach independent QA as well as diagnosis and the implementation brief; source drift during QA blocks publication. This is how existing grid rules remain available at acceptance, rather than relying on the executor to paraphrase them.

The own Skill also covers information grouping, primary actions, copy removal/retention and shared component consumers. For menus, inspect the real open/selected/focus/disabled and keyboard behavior, not only the trigger. A static card can legitimately have no loading or keyboard interaction; record why it is not applicable rather than manufacturing states.

## HappyHands 官网 Hero

这项约定是显式选入的首页 Hero 任务约束，不说明官网现有发布已经使用 Three.js 或完成了动效验收。用独立的首页 Hero 运行启用，先由目标项目实现能输出下述证据的真实检查器，再配置 `hero-motion` 专项检查。Capture Plan 的首个状态应为 `hero`，指向对应预览的 `/apps/portal/` 或 `/en/apps/portal/`，配置正常桌面与手机尺寸。采集同一页面的 before 与 after，验证时使用 after 的实际预览入口。

下列仅为设计范围配置，不能单独启动或通过 Hero 验收：

```json
{
  "designGuidance": {
    "taste": "public-page",
    "intent": "animate",
    "remediation": {
      "profile": "happyhands",
      "surface": "homepage-hero",
      "adoptionReason": "The approved HappyHands homepage cover orbit and glass logo."
    }
  }
}
```

- `HH-HERO-MOTION` 保留原封面与旋转轨迹，用 Three.js 的透视强化近大远小。检查开场倾斜、鼠标响应、滚动退出与恢复、标题和导航可读性、减少动态效果及 WebGL 降级。这一例外只适用于已采纳的首页旋转封面。
- `HH-HERO-MARK` 要求中央玻璃 Logo 保持单一轮廓，高光限制在 Logo 内。深浅主题和正常桌面、手机尺寸都检查是否有重影。

诊断和计划加载这两条规则，执行逐条记录决定。After 采集后用现有 `verify` 运行专项检查，再交独立复核。缺少通过的绑定浏览器记录或动态原图时，Hero 复核不能通过。被专项检查覆盖的首屏状态，两条规则都须明确通过。WebGL 绘制和截图序列用于证据，设计完成度由独立评审检查，人工接受仍单独记录。普通 HappyHands 与其他项目的规则清单不变。

项目检查器须使用实际预览地址并在指定输出目录写入 `result.json` 与声明顺序的 PNG 原图；`verificationChecks` 使用 `id:"hero-motion"`、`stage:"normal-interaction"`，并列出实际 `stateIds`、执行命令、方法、限制和截图文件。这里不提供假定已存在的执行命令。2026-11-12 核对的官网 main 中，`tests/homepage-motion-browser.mjs` 仅使用 `SITE_URL` 检查减少动态效果，不支持这里所需的参数、产物和 WebGL 证明；它不能作为本协议的完整检查器。真实 Hero 案例及该检查器仍需另行实现和验收。

Hero 专项检查器还须实现以下新结果契约。示例中的状态、配置和索引必须替换为本次真实运行值；`frameIndexes` 是 `verificationChecks.screenshots` 顺序中从 0 开始的索引，不是文件名。

```json
{
  "status": "pass",
  "heroMotion": {
    "version": 1,
    "contexts": [{
      "stateId": "hero",
      "configurationId": "desktop-dark",
      "motionObserved": true,
      "frameIndexes": [0, 1]
    }]
  }
}
```

每个 before 首页状态与配置都须在 after 保留相同路由和视口，并有唯一的 `motionObserved:true` 记录。每个上下文至少提供两张不同哈希、由实际 PNG 派生的尺寸与该视口一致的原图，不得跨上下文复用同一组帧。静态主题切换不能冒充观察到动态；未观察到动态就记录 false 或 needs-evidence。缺少这些证据、发生错误跳转或只测桌面，都不能通过完整首页复核。记录和帧仍需独立审阅其真实动作、主题、降级与视觉质量，结构门槛不代替人的判断。

## Reports and gates

Execution `checks` and `issues` each contain exact IDs, status (`fixed`, `preserved`, `not-applicable`, `blocked`), observed evidence, a concrete decision, actual changed files and verification description. Fixed requires a changed source file. Workflow phase labels are ordering guidance, never additional rule IDs. The reserved report filename is rejected if already tracked by the target; collected reports are removed from both the worktree and its Git index, including malformed reports archived for diagnosis. Blocked stops successful execution. These are executor claims, not independent visual proof.

Review `methodChecks` contains `ruleId`, `stateKey`, `status` (`pass`, `fail`, `needs-evidence`, `not-applicable`), reason and screenshot references. State keys are supplied by the host; copy them exactly. Every assigned primary capture state needs every rule accounted for. Supplemental verification and attachment images remain mandatory review inputs under the existing evidence/retry contracts; they do not expand the primary rule matrix. Include each device/state in the Capture Plan when full per-device rule coverage is required. Not-applicable still cites the inspected original and gives a reason. Still images cannot prove unseen interactions; use supplied action/specialist records or return needs-evidence. Aggregation retains regional failures even if another reviewer passes the same check.

The existing finding-admission rule remains in force: an optional preference is not a confirmed defect. Baseline method failures must be supported before entering repair. A zero-finding result is not an experience pass. Additional matrix coverage ensures that checks are reported, not that a model's judgments are infallible.

These records are included in the existing run export. Private screenshots and agent logs remain local and are not committed by this change. No automatic human acceptance, merge or deploy is introduced.

## Evolving our methods

Edit `skills/experience-remediation/SKILL.md` and its rule catalog through reviewed changes. Preserve the full upstream snapshots. Add a real accepted example and regression cases before promoting a new general rule; scope preferences to projects and keep exceptions explicit. New runs capture new versions; historical snapshots remain verifiable. This release does not implement automatic generalization from feedback or claim real end-to-end validation for every agent.

Case collection, admission and same-project execution references are now available; see [Experience cases](experience-cases.md).

## Evidence completeness

Baseline diagnosis validates exactly one method check for every adopted rule and supplied state. Missing, duplicate or unknown rows are rejected. A needs-evidence row prevents a complete diagnosis; a fail row can describe a completed inspection with a defect and is not a QA pass. Multi-batch records retain all method checks. QA binds the exact archived execution-result reference and hash; replacing the report requires a fresh review. Existing strict-method reviews without this binding must be rerun.
