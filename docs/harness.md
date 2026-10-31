# Run the Product Designer Harness

The local Harness turns one evidence-backed finding into a reviewable change. It captures desktop and mobile evidence, checks that the finding still applies, prepares a scoped brief for a coding agent, optionally edits an isolated Git worktree, compares the result, and records a human decision. It does not claim that structural checks measure design quality.

## Workbench automatic repair

For an existing-page review, the primary workflow is **Diagnose → Repair → Verify → Final review**. After diagnosis, **Fix automatically** delegates the current evidence-backed candidates to the agent. A candidate-specific action repairs that candidate; the main action includes all eligible candidates. There is no intermediate issue-confirmation or plan-approval dialog. Existing CLI/manual commands below remain available for explicit scoped integrations.

The service saves a source-bound `repair-request.json`, records `authority: user-delegated` (not human verification), generates an integrity-bound plan, and uses the existing isolated execution, recapture, structural checks and independent review pipeline. The agent must reproduce candidates first, skip false positives and report repaired/skipped/unresolved IDs. Stale source, incomplete model diagnosis, changed requests and duplicate submissions stop execution. A repair click never records final acceptance, pushes, merges or deploys. The final human decision is unchanged; failed QA cannot be accepted as a pass.

The workbench shell mirrors the website's Radix Luma tokens and `hh-theme` preference. Its theme never changes target screenshots or the design system of an embedded project. New-project bootstrap/Foundation creation remains a separate workflow.

## Requirements

- Node.js and pnpm (`pnpm install` at the repository root).
- Installed Chrome or Edge for browser capture. Use `--browser msedge` if Chrome is unavailable.
- A running local or public HTTP(S) preview of the app.
- A valid Experience Spec such as `examples/happyclaw-site/experience.json`.
- A supported coding agent CLI and a clean local Git checkout, only for the optional `execute` stage. Run `pnpm harness agents` to see which are registered.

## One finding, one run

For a first review, put the repository, preview command and Experience Spec in a project config. One command validates the Git checkout, starts the preview when configured, waits for a healthy page, creates the run and captures matched desktop/mobile baseline evidence:

```bash
pnpm harness onboard --config examples/happyclaw-site/project.json
```

The command prints the new run directory. Its `run.json` records the repository commit and dirty state, launch description, URL, browser, viewports and onboarding result. `start.env` can provide framework settings such as disabling telemetry in restricted environments. If browser capture fails after a run is created, the error remains visible in the run rather than being recorded as a successful baseline. The included HappyClaw config has case-specific relative repository/start paths, a capture plan and verification scripts. Copy it and review all paths, source anchors, states and checks for your actual checkout before running; it is not a generic ready-to-run project configuration. For a new project, the local Workbench can inspect the repository and propose a preview configuration first; see [local startup](local-workbench.md).

To make an interactive task the baseline, add a Capture Plan to the project config. The plan supplies the review start address when `url` is omitted, and onboarding records every reachable and unreachable state:

```json
{
  "version": "0.1",
  "spec": "experience.json",
  "repo": "../your-app",
  "mode": "review",
  "capturePlan": "capture-plan.json"
}
```

The Workbench pairs Before and After by `stateId + configurationId`, so a checkout state cannot be silently compared with a home-page screenshot. A failed replay stays visible with its action error.

A state may declare an optional source-backed region. This is explicit evidence rather than source inference: `selector` must match exactly one visible DOM element, while `source.file`, `source.line` and `source.anchor` must match a real line inside the reviewed repository. The same anchor must also appear in the matched element's rendered HTML, so the DOM and source checks cannot pass as two unrelated facts. Prefer a stable attribute such as `data-review-region="hero"`. The capture records the element bounds, component name, file hash and verification method. Any mismatch makes that state unreachable instead of publishing a guessed location:

```json
{
  "id": "hero",
  "start": { "url": "http://127.0.0.1:4321/" },
  "actions": [{ "type": "scroll-to", "selector": "#hero", "offset": 80 }],
  "region": {
    "selector": "#hero",
    "source": { "file": "src/components/Hero.astro", "line": 12, "anchor": "id=\"hero\"", "component": "Hero" }
  }
}
```

Project onboarding supplies the reviewed repository automatically. With the manual `capture --plan` command, add `--repo` whenever the plan contains source-backed regions; for an after capture, point it at the changed worktree.

The manual equivalent remains available when a preview is already running:

```bash
pnpm harness init --spec examples/happyclaw-site/experience.json --url http://127.0.0.1:4321/
# Copy the printed run directory into the commands below.
pnpm harness capture --run .harness/runs/RUN_ID --phase before
pnpm harness skills
pnpm harness skill --run .harness/runs/RUN_ID --skill foundation-extractor --repo ../your-app
pnpm harness skill --run .harness/runs/RUN_ID --skill consistency-auditor --repo ../your-app
pnpm harness skill --run .harness/runs/RUN_ID --skill visual-hierarchy-reviewer
pnpm harness diagnose --run .harness/runs/RUN_ID
pnpm harness next --run .harness/runs/RUN_ID
pnpm harness confirm --run .harness/runs/RUN_ID --finding F1 --verdict supported --note "The current page still shows this problem."
pnpm harness plan --run .harness/runs/RUN_ID --finding F1
pnpm harness execute --run .harness/runs/RUN_ID --repo ../your-app
# Start the preview of the worktree printed by execute, then capture its URL.
pnpm harness capture --run .harness/runs/RUN_ID --phase after --url http://127.0.0.1:4322/
pnpm harness evaluate --run .harness/runs/RUN_ID
pnpm harness attest --run .harness/runs/RUN_ID --input visual-qa.json
pnpm harness judge --run .harness/runs/RUN_ID --decision accept --reason "The main task is clearer on both screen sizes."
pnpm harness status --run .harness/runs/RUN_ID
pnpm harness export --run .harness/runs/RUN_ID
```

For a task that crosses UI states without distinct URLs, author a Capture Plan and replay it for both phases:

```bash
pnpm harness capture --run .harness/runs/RUN_ID --phase before \
  --plan examples/capture-plan.example.json --repo ../your-app

# After the scoped edit, point the plan's start URLs at the changed preview.
pnpm harness capture --run .harness/runs/RUN_ID --phase after \
  --plan capture-plan.after.json --repo ../changed-worktree
```

A plan names configurations rather than assuming desktop/mobile and names task states independently of URLs. Each state starts fresh and replays `navigate`, accessible-role `click`, labelled-field `fill`, and visible-text `wait-for` actions in order. A failed action records the state as unreachable with its error and action index while the remaining states continue. Evaluation matches `stateId + configurationId`; a missing changed state becomes `stateReached: false` evidence.

First model diagnosis retains the complete capture scope and inspects up to 96 original images in batches of at most 24. Each read-only batch cites every assigned original and records its input hashes and complete result. The aggregate publishes model candidates only after every batch completes against unchanged source, Foundation, memory and capture inputs. Unreached planned states or a batch needing evidence keep the aggregate incomplete, with individual batch results retained. This does not establish cross-batch visual consistency or human acceptance. Larger scopes are rejected explicitly before capture; internal scroll and interaction originals also count toward the actual diagnosis budget.

Read the baseline screenshots before confirming. If the page has already changed, record `--verdict stale` with a note. A stale finding cannot be planned or executed. `execute` is an explicit step; it creates a `pd/RUN_ID` branch in a new Git worktree, retains the agent log and does not push or deploy. You may capture and evaluate a change made outside the Harness, but the run will show no agent execution; identify that change separately when reviewing it.

`next` reads the run ledger and returns the current stage, the next valid command and any blocking reason. The state machine enforces baseline → diagnosis → human confirmation → plan → execution → matched render → structural evaluation → independent Visual QA → human judgment. A run defaults to three rounds and a 60-minute execution window. The window bounds the agent process itself, measured from the moment `execute` starts, so reading screenshots and confirming a finding at your own pace does not consume it; an agent that overruns is stopped and the run records `timedOut`. Exceeding either limit requires fresh evidence in a new run. Acceptance reasons are optional; rejection and evidence re-review reasons remain required. An explicit human decision and its timestamp are still recorded. An `accept` decision requires passing independent Visual QA; failed Visual QA may only be rejected, so a visible regression cannot be recorded as accepted.

Every run is stored in `.harness/runs/RUN_ID/` and ignored by Git. `run.json` is the stage ledger, `experience.json` is the run's spec copy, `before/` and `after/` contain screenshots and DOM summaries, `skills/` contains immutable versioned Skill results, `codex-brief.md` is the scoped task handed to the agent (the filename predates multi-agent support), and `evaluation.json` contains deterministic checks and before/after references. A Skill can run once per review run so later output cannot silently replace its evidence. A failed agent run retains its worktree and log. The evaluator checks HTTP response, H1 presence and horizontal overflow at identical viewport sizes; a person must assess the screenshots and user task before accepting a change.

The workbench turns an observed Design Foundation into an explicit human decision. Each token, component, pattern and brand asset must be approved, replaced or deprecated; principles and voice can be corrected before approval. Approval writes an immutable `foundation-VERSION.json`, updates the run snapshot and freezes once page planning begins. The workbench can compare the candidate with approved versions from the same connected repository. Bootstrap execution checks that its plan still references the same approval version and records that version in execution provenance.

A fresh review may use an accepted parent only after checking the same canonical repository, active human acceptance, bound passing independent QA and the accepted source input snapshot. The current source delta is recomputed against that snapshot; the previous execution's `changedFiles` is not reused as the current change. Old unbound evidence, withdrawn decisions and unknown source/configuration provenance fall back to full review.

Reduced state capture additionally requires complete before/current module graphs and explicitly declared whole-state `sourceEntries`, with compatible task, actions, configurations and capture contracts. Unknown dependencies, global assets or unclassified changes retain full capture. The immutable capture plan records selected and unreviewed states; code or ignored package configuration drift outside that plan blocks recapture. Use the Workbench's full-review action to establish a new complete baseline when needed. See [actual incremental capture](incremental-capture-selection-2026-10-18.md) and [package configuration snapshots](package-config-snapshots-2026-10-18.md). This engine behavior does not promote the contract-only incremental Skill to operational maturity.

Expertise releases are separate from individual Skill results. `pnpm expertise publish` writes an immutable release manifest only after deterministic regression passes without unexplained changes and an independent model review records its reviewer and reason. `activate` and `rollback` point at an existing immutable release and append an activation audit record; they never rewrite the release.

Every command that writes to a run takes a per-run lock (`run.lock` in the run directory), so two harness processes working the same run serialise instead of silently dropping each other's stage records. A lock naming a dead process is reclaimed as stale; a live one blocks the writer, which fails loudly after a short wait. Reads never lock — manifest writes are atomic renames, so a reader always sees a complete file. The lock is advisory and best-effort, matching a single-user CLI; it is not a server-grade coordination mechanism. Artifact paths read back from the ledger (`skills/…`, `diagnosis.json`, the brief) must name a file inside the run directory, so a hand-edited `run.json` cannot point a later command at files outside the run.

The Skill handlers deliberately have narrow authority. `foundation-extractor` inventories CSS custom properties with their declared values — most frequent value per name, an inferred category (name first, value shape second), observed variants, and a light/dark themes pair when declarations inside prefers-color-scheme:dark or data-theme=dark blocks override the base — plus component source files, all as `observed` and promotable into the Experience Spec token shape without re-typing. `brand-foundation-extractor` records referenced visual assets with filename-inferred roles (logo, mark, favicon, icon, og-image, font) and formats, and rendered voice evidence citing the state each sample appeared in, as candidates, while `component-inventory` maps sources, exports and static consumers. `consistency-auditor` flags repeated literal color and radius values for review. `design-system-drift-detector` splits drift into ungoverned values, semantic conflicts and off-scale steps, reports whether snapping a duration would change behaviour, counts how much of the implementation already reads tokens, and records the direction of each fix as unresolved rather than assuming the token file is right. `component-state-auditor` compares documented and observed component states against `rubric.json` beside the Skill, separating what the foundation declares from what the source suggests, and requiring nothing of a component whose class the rubric does not recognise. `token-contrast-auditor` computes WCAG contrast for the colour pairs the token names or the source state, reports which band each ratio falls in rather than a verdict it cannot know without the text size, and skips translucent colours instead of measuring them against a guessed backdrop. The v0.2 information architecture, interaction and content reviewers collect concrete page evidence but retain `needs-evidence` for full task-level judgment. Accessibility and responsive reviewers complete bounded DOM/layout checks while stating the remaining manual coverage. `visual-hierarchy-reviewer` exposes heading/action evidence and returns `needs-evidence` because DOM structure alone cannot prove visual quality. Each skill has a `SKILL.md` for agent guidance and `skill.json` for the machine-readable version, role, inputs and allow-listed handler.

## When the surface does not exist yet

Mode is a property of the surface under review, not of the project. A repository can hold reviewable surfaces and unbuilt ones at the same time, and a run targets one critical user task. `onboard` decides by probing the entry routes before anything else runs:

```json
{ "version": "0.1", "spec": "experience.json", "repo": "../your-app", "url": "http://127.0.0.1:4321/", "routes": ["/jobs"] }
```

A route that returns text is a baseline to review. A route that is missing, unreachable or blank has to be built first, and the run becomes a bootstrap run. `url` is optional; without it there is nothing to probe and the run is always a bootstrap run. A route that returns scripts but no server-rendered text is reported as ambiguous rather than guessed: a fetch cannot tell an empty route from a client-rendered one, so the config has to set `"mode": "review"` or `"mode": "bootstrap"` explicitly.

A bootstrap run changes four gates and nothing else:

- **There is no baseline.** `baseline` records why it is absent, with the probe results. The absence stays visible in the ledger; it is never replaced by a placeholder capture.
- **A versioned Foundation Approval replaces the confirmed Finding.** With nothing rendered there is no evidence to confirm. `foundation-approve` records the complete reviewed snapshot, semantic version, reviewer and reason, and updates the run's Experience Spec. Every entry must be explicitly `approved` or `deprecated`; an `observed` candidate cannot constrain generation.
- **The page brief cites the approved version.** `plan` includes the Foundation version and only approved tokens, components and patterns. Anything missing must remain local and return as an update candidate instead of silently becoming shared design-system truth.
- **Evaluation is conformance, not comparison.** `evaluate` runs the same deterministic render checks against the first render alone and states that no improvement can be claimed. A human still decides.

Independent Visual QA is not relaxed, because a first render has less structural evidence than a comparison, not more: with no baseline, the deterministic checks prove less and the human look is most of what stands between a render and an accepted surface. The attestation cannot cite `before/` screenshots that do not exist, so the matched-pair requirement becomes full coverage of what was rendered — every captured viewport has to be cited, and one desktop screenshot cannot stand in for the rest. `judge` still refuses to accept without a passing review. A run that simply has no baseline capture, without having recorded why one is absent, is still rejected.

```bash
pnpm harness onboard --config examples/bootstrap-surface/project.json
pnpm harness foundation-approve --run .harness/runs/RUN_ID --input examples/bootstrap-surface/foundation-approval.json
pnpm harness plan --run .harness/runs/RUN_ID          # no --finding; the approved foundation is the constraint
pnpm harness execute --run .harness/runs/RUN_ID --repo ../your-app
# Start the preview of the worktree printed by execute, then capture the route it built.
pnpm harness capture --run .harness/runs/RUN_ID --phase after --url http://127.0.0.1:4322/jobs
pnpm harness evaluate --run .harness/runs/RUN_ID
pnpm harness judge --run .harness/runs/RUN_ID --decision accept --reason "The operator can start a job and recover from a failed step."
```

`next` knows the difference: a bootstrap run is pointed at `baseline`, Foundation Approval, then `plan`, and never at a baseline capture it cannot take. The approval is stored as `foundation-VERSION.json`; it is immutable after planning begins and is included in an exported review. `diagnose` is unavailable in a bootstrap run because there is nothing rendered to diagnose. Once the first render is accepted it becomes the baseline of the next run, so a surface passes through bootstrap once and then stays in the normal review loop. Without a project config, `pnpm harness init --spec FILE --mode bootstrap` followed by `pnpm harness baseline --run DIRECTORY --reason TEXT` does the same thing by hand.

## Evidence-backed diagnosis and scoring gate

`diagnose` writes `diagnosis.json`, combining Experience Spec observations, browser captures and completed Skill results into one versioned evidence graph. Every Finding references evidence IDs, identical root causes are merged, and the ordered list retains every source. Authored findings remain `authored-candidate`; deterministic heuristics remain `review-target` until a reviewer or qualified evaluator confirms them. Those labels order the list before any priority number is compared: a finding confirmed against the current baseline leads, then authored candidates, then review targets, then stale ones. Without that, a machine finding wins every contest — it is certain by construction and usually declares a small effort, so a missing landmark at `3 × high / 1` outranks a judged hero problem at `5 × 4 / 2`. The numbers stay visible on every finding, and `prioritize` promotes anything a person decides matters, recording who moved it and why. When the Experience Spec names a baseline commit and onboarding captured a different commit, those findings become `stale-candidate` and are demoted to priority zero instead of being presented as current truth.

```bash
pnpm harness diagnose --run .harness/runs/RUN_ID
pnpm harness prioritize --run .harness/runs/RUN_ID --finding F2 --priority 8 --reason "This blocks the current launch task."
```

Priority overrides require a reason and are appended to the diagnosis. By default `experienceScore.status` is `insufficient-evidence` and `score` is `null`. A score is emitted only when a versioned rubric supplies all six MVP dimensions—hierarchy, information architecture, responsive quality, accessibility, consistency and task friction—with rationales and at least 80% valid evidence coverage. The output always records the evaluator version, dimension results and evidence references.

## Screenshot-aware visual review

Visual hierarchy and independent Visual QA require an actual reviewer to inspect screenshots. Put the review in the versioned `visual-review.schema.json` format, then attach it to the run:

```bash
pnpm harness attest --run .harness/runs/RUN_ID --input visual-review.json
```

An attestation declares whether the reviewer is a human or model, its name/version, a pass/fail/needs-evidence verdict, cited screenshots, findings, confidence, rationale and limitations. The Harness rejects screenshots that are absent from the run. Visual QA additionally requires matched before/after evidence for the planned scope and devices. A passing review cannot contain unresolved findings, and a failing review must contain at least one. Reviews are stored separately under `reviews/`; they do not overwrite the original Skill result or create an Experience Score. Explicit replacement preserves the earlier review and its evidence binding rather than rewriting it.

The local Workbench also runs screenshot-aware independent Codex QA, including regional and cross-region review of supplied originals. It requires a working Codex CLI and cannot certify uncaptured routes or unseen interaction states. The deterministic `visual-qa-evaluator` Skill alone does not execute this model review.

New attestations have a durable binding to their exact review bytes, original screenshot hashes and relevant task/capture context. Acceptance, cached model review and export revalidate this binding. An attestation-time snapshot does not prove an external reviewer actually inspected those bytes. Legacy unbound reviews retain their explicitly documented compatibility path; they are not silently upgraded into bound history for incremental reuse. See [binding guarantees and limits](visual-review-evidence-binding-2026-10-18.md).

## Choosing a coding agent

Any AI CLI can participate in the external coding-agent workflow when it has the required local access. Direct `execute` currently supports only the registered Codex and Claude Code adapters; this registry does not define the product’s overall CLI compatibility. Workbench model diagnosis and built-in visual review still use Codex. Changes made outside the Harness can be captured and evaluated, but have no Harness agent-execution record and must be identified separately.

`execute` runs the registered agent selected for the invocation. `pnpm harness agents` lists what is registered; `--agent ID` picks one and `--command PATH` relocates its binary without changing its flags.

```bash
pnpm harness execute --run .harness/runs/RUN_ID --repo ../your-app --agent claude-code
```

Registered adapters share a declared boundary: an isolated worktree, no push, no merge, no deploy, and a reviewed repository treated as data rather than instructions. These are workflow safeguards with the enforcement limits below, not a security sandbox. The boundary is therefore declared once in `packages/harness-core/agents.js`, and an adapter without a declaration for every clause is refused. A declaration does not prove isolation.

| Clause | Requirement |
|---|---|
| `nonInteractive` | Runs without waiting for a human prompt or approval. |
| `worktreeOnly` | Writes confined to the run worktree. |
| `noRepoInstructions` | Declares how repository instructions are handled: Claude Code uses `--bare`; Codex has no equivalent flag here and relies on the prompt treating repository content as data. |
| `noPublish` | Must declare safeguards against push, merge and deploy; see the best-effort limits below. |
| `bounded` | Turns or wall-clock time are bounded. |

Enforcement is two-layer, and the layers are not equally strong.

**Preventive, best effort.** Each adapter's flags — `-s workspace-write` for Codex, `--permission-mode acceptEdits --bare --disallowed-tools "Bash(git push:*) …"` for Claude Code — plus an environment the runner imposes on every agent, repointing each remote's `pushurl` so `git push` fails before reaching a real host. Child processes inherit it, so a shell the agent spawns is covered too. An agent with shell access can still unset the variable or push to an explicit URL.

**Detective, reliable.** The host repository is fingerprinted (HEAD, refs, remote config) before and after the run. If HEAD moved, a remote was added or repointed, or any ref outside the run's own `pd/RUN_ID` branch changed, the run records `boundaryBreaches`, `execute` fails, and `next` reports stage `boundary-breached` — even when the agent exited zero. This half does not depend on the agent cooperating, so it is what the promise actually rests on.

Adapters record how far they have been verified: `flags` means the invocation was checked against the binary's own `--help`; `shipped` means it predates the registry and has run in practice. Neither means the full loop has been exercised with that agent.

## Open a saved run in the web workbench

`export` copies a finished run into `public/runs/`, which Vite serves at `/runs`. The review workspace lists every exported run in its case picker beside the two bundled examples, and shows the selected run's before/after screenshots, structural checks, Skill results and recorded decision.

```bash
pnpm harness export --run .harness/runs/RUN_ID   # --out changes the destination
pnpm harness reindex                             # rebuild index.json after deleting a run folder by hand
pnpm dev                                         # then open /apps/designer/
```

Export copies an allow-list: `run.json`, `experience.json`, `evaluation.json`, `codex-brief.md`, the two capture folders, `skills/` and governed `reviews/`. It never copies the Git worktree or `agent-events.jsonl`, because a worktree is a second copy of the target repository and the agent log echoes repository content and local paths. The published `run.json` also reduces the absolute worktree path to a bare name and records only whether a log was retained.

The page is read-only for runs. A run keeps its decision in `.harness/runs/RUN_ID/`, so record one with `pnpm harness judge`; the judgment control is disabled while a run is open. `public/runs/` is ignored by Git, so exporting does not commit evidence about someone else's product.

For the HappyClaw case, use the supplied `happyclaw-site` repository as the source of truth. The public `happyclaw.cc` deployment differs from that repository, so a local comparison is not a claim about what is live. See [the case record](happyclaw-case.md) and [the architecture](architecture.md).

## 正常尺寸优先的审阅顺序

计划与实现 brief、完整设计方法的编排提示和每个独立 QA 会话共用 `packages/experience-core/review-order.js`。先查看正常字号的桌面与手机整页及全部计划区域，再核验关键操作，最后才把200%文字放大等压力检查作为辅助诊断。正常界面是否顺畅好看须查看真实原图，不能以“没有溢出”代替视觉判断。

QA 将同一状态的 before/after 原图保留成对，先排列默认整页与区域，再执行交互批次；整页审阅的不同阶段不会混入同一批。没有整页且总计不超过12张的历史局部审阅仍保留原单会话范围，在会话内先布局后交互，避免新增整页门槛。每批最多12张，最终跨区域会话仍核对整页与确认范围原图，任何失败或缺失都不能被后续通过覆盖。每次 `review-context.json` 保存政策版本和当前阶段，其 hash 进入既有审阅凭证。小范围历史单批不会因此宣称全站通过。

当前原生 Capture Plan 记录 viewport 和操作，不具备缩放配置。200%观察需另存真实证据，不能声称流水线自动完成了辅助检查。明确确认的无障碍修复仍须按范围验收；辅助通过不能抵消正常页面的回归。品牌、单词与短标签不应插入任意断词，长命令可在组件内部滚动并保留完整选择/复制能力。不得为压力用例给产品添加缩放控制或改坏默认布局。

OJO、Taste、Impeccable 完整上游包、适配层与引用仍保留；这里约束执行顺序，不替换完整方法，也不记录人工 Accept。

## 专项验证自动进入独立复核

项目配置可以声明 `verificationChecks`。CLI 需先用带此配置的 `onboard` 建立 Run，再 `capture --phase after` 和 `verify`；CLI 与工作台共用采集时的指纹边界。没有专项配置的普通采集保持原有范围，不要求完整仓库指纹。工作台在 after 原生采集完成后、同一个受管理预览关闭前执行这些脚本。正常布局检查先于正常交互，辅助压力检查排在最后。脚本不需要自己组装独立 review 提示词，也不需要手动搬运报告或截图。

```json
{
  "verificationChecks": [{
    "id": "menu-keyboard",
    "command": "node",
    "args": ["scripts/verify-menu.mjs", "--url", "{url}", "--out", "{out}"],
    "stage": "normal-interaction",
    "stateIds": ["menu-open", "menu-escape"],
    "method": "Chrome 原生键盘输入，检查焦点循环、Escape、inert 和滚动恢复",
    "limitations": ["未验证实体手机和其他浏览器"],
    "screenshots": ["menu-open-390.png"],
    "timeoutMs": 120000
  }]
}
```

`{url}` 是受管理预览地址，`{out}` 是本次专用输出目录，`{harness}` 是当前 Harness 目录，`{context}` 是绑定当前 Run、capture hash、源码提交和扫描指纹的 JSON。脚本在目标源码目录中执行，参数以数组传入，不经过 shell；完整 Skill 不变，也不会自动安装上游工具。`stateIds` 必须对应 after 已登记状态。脚本输出 `{out}/result.json`，顶层必须包含 `status: pass|fail|needs-evidence`；其余字段完整保留，可记录每个断言、实际剪贴板读回、滚动几何或焦点路径。PNG 必须逐一声明。只输出适合随审阅导出的记录，不把凭证或原始进程日志写入 result。

执行前后校验源码提交、工作区修改状态、源文件扫描指纹和预览入口响应指纹。工作台保留的未提交修改以 capture 时所有 Git 跟踪及非忽略文件的完整内容指纹绑定（包括 JSON、MJS、图片，不使用设计系统扫描子集代替源码），并记录 dirty 状态；不要求代理自行提交，也不把未提交内容说成提交版本。该响应指纹证明入口响应一致，不等于所有资源或物理设备认证。旧 capture 缺少完整仓库指纹、采集时的原图 hash 或预览响应指纹时，必须重新采集，不能追溯生成绑定。历史结果保持原样。模拟 Clipboard API 拒绝、200% 根字号模拟必须在 method/limitations 中说明，不能被描述成真实系统权限拒绝或浏览器缩放。

最多8份专项 JSON，总计256 KiB，以及12张、每张不超过12 MiB的原始 PNG；超限会报错，不截断或挑选通过记录。索引、结果和原图复制到 Run 的 `verification/`，逐文件保存 hash，并绑定 before/after 原始截图字节；受管理采集在 before 和 after 生成截图时均固化原图 hash，防止事后替换。拒绝路径穿越和符号链接。脚本退出成功但报告缺失、JSON 损坏、PNG 缺失或超限，同样登记为新的缺证版本，使旧通过结论失效。完整仓库指纹不静默截断：单文件超过64 MiB、总输入超过512 MiB，或包含未显式支持的符号链接/子模块时拒绝绑定。独立区域审阅收到对应状态的专项记录，跨区域和小范围单会话收到完整记录；模型必须返回 `verificationRefs` 并引用每张专项原图。正常检查失败或缺证会阻止 pass；辅助记录仍会交给审阅者，但不会自动要求改坏正常布局。专项执行记录不替代视觉审阅或人工判断。

已有符合上述绑定要求的 Run 可以对同一源码补跑配置（预览需已经可用）：

```bash
pnpm harness verify --run .harness/runs/RUN_ID --config project.json --repo /path/to/retained/worktree
```

随后使用工作台原有“独立复核”主动作。证据更新使旧结论失效，新会话重新审阅全部计划范围，并收到旧结论作为上下文；旧 JSON 和证据版本原样保留，新结论写入独立文件，界面和导出保留历史链接。脚本失败或缺证时，主动作提供“补跑专项验证并复核”，在相同源码上重新启动受管理预览并生成新的不可变证据版本。正常专项已明确失败则仍需整改；修改源码后需要新 capture。已有人工作出判断的 Run 不再接受补证，应新建 Run。配置声明的必要脚本没有完成时，不会退回到无专项记录的旧审阅路径。HappyClaw 的现有脚本可用 `examples/happyclaw-site/verify-specialist.mjs` 适配输出协议，无须改写或裁剪设计 Skill。

工作台展示当前复核状态和保存人工接受前，都会重新校验专项记录、原图和索引。证据被删除或修改时，不再显示可接受的当前通过结果，须重新采集。离线导出仅是历史只读记录，不能直接执行接受操作。

## Disputed visual findings

In the local workbench, a failed model review can be rejected or independently re-reviewed with genuinely new, source-bound PNG counter-evidence. Open “处理复核问题”, choose “提交反证重新复核”, select/upload the evidence and state the method, actual results and limitations. The complete original failure stays in history. A fresh final reviewer must explicitly resolve every prior finding; unresolved findings and missing coverage block pass. A new pass only enables the human decision form, whose default remains empty. Existing human decisions, unchanged evidence, altered sources or broken parent bindings cannot be overridden. See [the real counter-evidence case](counter-evidence-review-2026-10-21.md).
