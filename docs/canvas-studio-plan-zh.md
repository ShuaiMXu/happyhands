# 无限画布整改工作台 · 产品方案

**Part A = 产品方案（为什么/边界/分期）· Part B = M1 构建规格（逐条怎么做，防漂移）**

## 1. 问题：现在的闭环缺什么

当前 Expert Loop 的每一步都有产物和闸门，但审阅界面是**线性**的：

- 证据是 JSON 列表 + 截图配对（before/after 并排两张）；
- finding 与它所指的界面区域之间，只有文本引用（`screenshot: before/desktop.png`），**没有空间关系**；
- 多状态（capture plan 的 stateId × configuration）之间的全局图景——用户任务在界面上怎么流动——无处可看；
- 整改（agent edit）之后的变化，只能一对一对比，看不到「整个界面面发生了什么」。

## 2. 用户旅程（门户 → 测评 → Review → 整改稿）

```text
门户（/apps/portal）
  「Get Started」→ pnpm harness onboard（一条命令接入 + 采基线）
        ↓
测评环节（Harness 闭环）
  capture（双视口/多状态）→ skills 诊断 → diagnose 证据图
        ↓
Review 机制（画布登场）
  ① 打开 Workbench → 切到「画布视图」（?view=canvas）
     本次 run 的全部状态截图自动摊开：状态行为组、配置为列
  ② FindingPin（便签）钉在它引用的截图上（M1 截图级；区域级见 §7 数据契约）
  ③ 点选便签 → 右侧 Inspector 显示 finding 详情（提案、证据链、优先级理由）
  ④ 人确认 supported / stale：便签上直接操作，经本地服务写账本（M2 起）
     M1 阶段画布只读，确认仍走 CLI，画布顶部给出对应命令
        ↓
整改稿（agent edit → re-render）
  ⑤ agent 在隔离 worktree 修改 → 采集 after → 画布出现 DiffPair：
     新状态节点 + 与基线同 key 连线，节点带结构检查徽章（responded / heading / overflow）
  ⑥ Diff 模式：未变化状态退为半透明底图，只留变化对
  ⑥' **Code Diff 视图（与视觉并置的第二证据轴）**：本次执行的
     `git diff baseCommit..head` 逐文件呈现；Inspector 里点任一变化状态
     → 关联 changedFiles 与 hunk（截图上的变化 ↔ 造成它的代码）
  ⑦ 独立 Visual QA：审阅者在截图上圈注（M3），verdict 入 attestation
  ⑧ 人的 accept/reject + 理由 → 不可变账本
```

关键转变：**review 的主语从「命令行 + JSON」变成「空间里的眼睛」**；CLI 与账本仍是唯一事实源，画布是审阅面。

**双证据轴原则**：视觉 diff 是**结果证据**（界面发生了什么），代码 diff 是**原因线索**（谁造成的）。审阅者先看空间里的结果，再下钻代码确认原因——两条轴互补不互替；代码是线索而非证明（未改文件的间接影响也会造成视觉变化），判定依据仍以证据链为准。

## 3. 界面布局（线框）

```text
┌──────────────────────────────────────────────────────────────┐
│ 顶栏：run 选择 · 视图切换(列表/画布/CodeDiff) · 阶段卡(§B10.2) · 判定区 │
├────────┬───────────────────────────────────────────┬─────────┤
│ 左侧栏  │              画 布 舞 台                  │ 右侧栏   │
│ 状态树  │   ┌────┐ ┌────┐   ╭────────╮             │ Inspec- │
│ (状态×  │   │截图│ │截图│   │DiffPair │  ⌖ Finding  │ tor     │
│  配置)  │   │ 卡 │ │ 卡 │───╯ 前后并置 ╰            │ ·finding │
│  勾选   │   └────┘ └────┘   ┌────┐                 │  详情    │
│  过滤   │        ○ 便签      │截图│                  │ ·证据链  │
│        │   (pin)             └────┘                 │ ·该状态  │
│ Foundation│                                        │  检查    │
│ (M4)    │              [小地图 右下]                 │ ·命令    │
└────────┴───────────────────────────────────────────┴─────────┘
```

- **顶栏**常驻判定区（Accept/Reject + 理由）；Visual QA 未 pass 时 Accept 锁死并显示原因。
- **左侧栏**：状态树（行为组、列为配置），勾选过滤画布；M4 加 Foundation 面板。
- **右侧 Inspector**：跟随选中对象（节点或便签）。
- **小地图**：右下角，可折叠；节点密度着色。

## 4. 键位与手势

| 操作 | 键位/手势 |
| --- | --- |
| 平移 | 空格+拖 / 触控板双指 / 鼠标中键 |
| 缩放 | `⌘/Ctrl`+滚轮 / 双指张合 |
| 聚焦选中 | `F` |
| 聚焦全部 | `Shift+F`（fit to view） |
| Diff 模式 | `D` 切换 |
| 节点间导航 | `Tab` / `Shift+Tab`（roving tabindex） |
| 便签/节点选中 | 点击 / 回车 |
| 画布视图路由 | `?view=canvas`（列表视图保持默认，画布可设为偏好） |

## 5. 能力矩阵（Loop 阶段 × 画布）

| 画布能力 | 未诊断 | 已诊断待确认 | 已执行待评估 | Visual QA | 已判定 |
| --- | --- | --- | --- | --- | --- |
| 摊开/平移/缩放 | ✅ | ✅ | ✅ | ✅ | ✅ |
| FindingPin 展示 | —（无 findings） | ✅ | ✅ | ✅ | ✅（带判定色） |
| 确认 supported/stale | — | M2 画布 / M1 显示 CLI 命令 | — | — | — |
| DiffPair | — | — | ✅ | ✅ | ✅ |
| Diff 模式 | — | — | ✅ | ✅ | ✅ |
| 圈注（Visual QA） | — | — | — | M3 | 只读 |
| Accept/Reject | 锁 | 锁 | 锁 | QA fail→锁 | M2 起可操作 |
| 框选生成 brief | — | ✅（筛选 scope） | ✅ | — | — |

**stale finding 的处理**：便签变灰 + 删除线，DiffPair 与其解绑——不可删，历史可见。

## 6. 渲染与性能预算

- **选型**：SVG（节点）+ CSS transform（舞台），不用第三方画布库。理由：节点规模 ≤ 数十、图片是主体、SVG 可得 DOM 级无障碍与样式系统；>200 节点再评估 Canvas 混合。
- **图片虚拟化**：视口裁剪（IntersectionObserver）+ 两级缩略图——画布节点用已压缩的 700px 版（`tools/compress-assets.mjs` 产物即合适），Inspector 点击才取原图。
- **预算**：≤20 状态规模下平移缩放 60fps；首屏可交互 < 1.5s（懒加载图片不阻塞）。
- **布局**：自动网格（状态行 × 配置列）；用户拖动后存**本地布局**（见 §7），重置按钮恢复自动。

## 7. 数据契约缺口（需先落 schema，再动交互）

| 需求 | 现状 | 方案 |
| --- | --- | --- |
| FindingPin 钉到截图**区域** | evidenceRefs 只到截图级 | diagnosis schema：finding 增可选 `pins: [{evidenceRef, region: {x, y, w, h}}]`（region 为截图百分比坐标）；M1 不用，M3 圈注时写 |
| Visual QA 圈注形状 | visual-review findings 只有 screenshotRefs | visual-review schema：findings[] 增可选 `shapes: [{type: rect|arrow, region}]` |
| **Code Diff 全文** | execution 已存 `baseCommit/head/diffStat/changedFiles`，**不存 patch 内容**；export 白名单也不含 | 执行完成时一次性生成 `git diff baseCommit..head > diff.patch` 落入 run 目录（属不可变证据，与账本一致）；execution 记录加 `patch: 'diff.patch'`；export 白名单加入该文件（代码 diff 可能含仓库内容——导出即审阅者已授权的范围内，与 codex-brief 同级） |
| 画布布局持久化 | 无 | **不入 run 账本**（不可变）；放 workbench 本地布局存储（localStorage 起，键 `pd-canvas-<runId>`），后续归本地服务 |
| 像素级 diff 高亮 | 结构检查无图像 diff | **降级为 M3+ 待验证能力**：先并排 + 检查徽章；图像 diff 需要单独评估（感知哈希起），没有验证前不进方案承诺 |

**Code Diff 视图（M1 范围内）**：

- 数据：上述 `diff.patch`；无 patch 的旧 run 降级显示 `changedFiles` 清单 + diffStat（如实标注「旧 run 未存 patch 全文」）。
- 呈现：Workbench 新增第三视图（与列表/画布并列）——文件树 + 逐文件 hunk，等宽着色起步（+绿/−红行级），不引语法高亮依赖。
- 画布联动：DiffPair 节点与 changedFiles 关联展示（「此状态的变化涉及 N 个文件」）；hunk 级截图↔代码双向链接为 M3（需要 pins 区域级配合）。
- 与判定联动：判定理由里引用代码位置为自由文本（schema 已支持）；不改判定闸门。

## 8. 无障碍

- 节点/便签可聚焦：roving tabindex，`Tab` 沿空间顺序移动；
- 画布提供 `role="application"` + aria-label；Inspector 同步朗读选中对象（「finding F1，钉在 checkout 桌面态」）；
- 键盘可完成全部只读操作（不含 M3 圈注绘制，绘制提供数值输入替代）；
- `prefers-reduced-motion`：无平移动画、无缩放过渡；
- 对比度沿用 cream-on-ink 体系（已过 4.5:1）。

## 9. 分期

| 里程碑 | 内容 | 依赖 |
| --- | --- | --- |
| 里程碑 | 内容 | 依赖 |
| --- | --- | --- |
| **M1 只读画布 + Code Diff** | 摊开/DiffPair/Diff 模式/FindingPin（截图级）/键位/小地图/布局本地持久化；**Code Diff 视图与画布文件关联** | patch 落账（harness 小改：执行时存 diff.patch + export 白名单） |
| **M2 判定上画布** | 确认与 Accept/Reject 经本地服务写账本 | Workbench 本地服务 |
| **M3 Visual QA 画布化** | 圈注（shapes schema）、pins 区域级、图像 diff 评估 | M2 + §7 schema |
| **M4 设计基础面板** | FoundationChip 侧栏、token/组件对照 | PR #31 schema |
| **M5 任务流视图** | 状态间导航连线（用户任务的界面流动图） | 多状态 run |

## 10. M1 工程拆解

```text
creative-os-site · apps/designer/canvas/
├── stage.js        舞台：transform、pan/zoom、fit、路由参数
├── nodes.js        StateCapture / DiffPair 节点渲染 + 虚拟化
├── pins.js         FindingPin 定位（evidenceRefs → 截图节点）
├── minimap.js      小地图
├── layout.js       自动布局（状态×配置网格）+ 本地持久化
├── codediff.js     Code Diff 视图（diff.patch 解析、文件树、行级着色）
└── inspector.js    右侧详情（复用现有 finding 渲染逻辑）
```

实现顺序：stage → nodes → layout → pins → diff 模式 → minimap → codediff → inspector 接线。
前置小改（harness 侧）：执行完成时存 diff.patch 入 run 目录；export 白名单加入；onboard/status/next 输出末行打印 Workbench 深链（B10-H2）。
入口：Workbench 顶栏视图切换 + `?view=canvas`；数据复用 `loadRun()` 现有管线。

## 11. 边界与诚实声明

- 画布是**审阅面**，不是设计工具：不做绘图、不做组件编辑。
- 像素 diff 在验证前不承诺（§7）。
- 不因画布放松任何闸门：证据追溯、独立 Visual QA、人的判定，一个不少。
- 自研实现，不复用任何外部站点代码（P0 版权路径）。

## 12. 验收标准（M1）

1. 任一已导出 run 全部状态正确摊开、DiffPair 配对无错；
2. finding ↔ 证据**双向**追溯（点便签高亮证据节点，点证据反查 findings）；
3. Diff 模式只显示变化，未变化退为半透明底图；
4. ≤20 状态 60fps；首屏可交互 < 1.5s；
5. 键位表全项可用；`prefers-reduced-motion` 无动画；移动端退化为纵向列表视图（画布为桌面优先）；
6. 布局拖动后刷新保持，重置可恢复自动布局；
7. Code Diff 视图逐文件正确渲染本次执行 patch；无 patch 的旧 run 降级为文件清单并如实标注。

## 13. 度量（M2 起采集，验证画布价值）

- 单次 review 的确认耗时（画布 vs 列表视图 A/B）；
- finding→证据追溯操作次数（越少越好，空间定位应减少来回）；
- Visual QA 圈注使用率（M3 后）。

不预设结论：若度量显示画布不缩短审阅，收缩回列表视图为主——空间呈现必须被验证为更好，而不是默认更好。

---

# Part B · M1 构建规格（防漂移）

> Part A 回答「为什么与是什么」；本部分回答「逐条怎么做」。
> 实现者规则：**本规格未定义的行为不做**，拿规格去问，而不是发明。
> 任何偏离须先改本文档（记录到决策表）再写代码。

## B0. 决策记录（已定，不再议）

| # | 决策 | 理由 |
| --- | --- | --- |
| D1 | SVG 节点 + CSS transform 舞台，不用第三方画布库 | 节点规模小；要 DOM 级无障碍与样式系统 |
| D2 | 画布布局持久化在 localStorage（键 `pd-canvas-<runId>`），**永不入 run 账本** | 账本不可变；视图状态非证据 |
| D3 | 不承诺像素级视觉 diff（M3+ 评估感知哈希） | 无数据来源的能力不承诺 |
| D4 | Code Diff = patch 全文 hunk 视图，行级着色，不引语法高亮 | 够用且零依赖 |
| D5 | M1 画布完全只读；确认/判定显示对应 CLI 命令 | 写路径等本地服务（M2） |
| D6 | 桌面优先；`<900px` 退化为纵向状态列表 | 触控手势成本另评 |
| D7 | 视觉沿用 appllama token 体系（与门户同源） | 一套设计语言 |
| D8 | 入口 `?view=canvas`；列表视图保持默认 | 可渐进采用 |
| D9 | **工作台和 Harness 一起归 creative-os；creative-os-site 只负责线上官网** | 2026-09-28 用户确认；取代旧拆分。见 local-workbench.md |

## B1. M1 范围

**IN**：摊开（自动布局）/ DiffPair / Diff 模式 / FindingPin（截图级，单向：点便签→高亮证据）/ 平移缩放聚焦 / 小地图 / Code Diff 视图 / 布局本地持久化 / 空态与降级。

**OUT（写代码前不需要讨论，直接不做）**：圈注、区域级 pins、截图↔hunk 链接、判定写入、确认写入、**框选生成 brief（归 M2，复用列表视图已有的 brief 下载能力，画布侧重选集）**、Foundation 面板、任务流连线、像素 diff、协同。

## B2. 数据映射（精确到字段与解析规则）

输入 = 已导出 run（`public/runs/<id>/`），复用 `loadRun()` 管线：

| 画布元素 | 来源 | 解析规则 |
| --- | --- | --- |
| 节点（StateCapture） | `captures.before/after` 的 capture.json | `captureEntries()`（兼容 legacy viewports）；节点 ID = `${phase}:${stateId}--${configurationId}`（legacy 为 `before:page--desktop`） |
| 节点图片 | entry.screenshot（如 `before/checkout--desktop.png`） | 经 SAFE_SHOT 同款白名单校验后拼 URL |
| 状态行/配置列 | stateId / configurationId | 行序 = capture.json states 顺序；列序 = 首次出现顺序 |
| 检查徽章 | `evaluation.views[key].checks` | key 与节点 ID 的 state 部分匹配；无 evaluation → 无徽章（不猜） |
| FindingPin | `diagnosis.findings[].evidenceRefs` | 仅取 `capture:before:*` 引用；`*` 即节点 ID（before 侧）；其余类型引用计入 Inspector「文本证据」计数，不上画布 |
| 未达状态 | entry.reached === false | 节点显示错误文案卡（error + failedAction），不显示截图占位图 |
| DiffPair 判定 | 见 B4 变化定义 | — |

**Code Diff**：`diff.patch`（新 run）→ 逐文件 hunk；旧 run → `execution.changedFiles` + `diffStat` 列表，页头标注「此 run 未存 patch 全文」。

## B3. 布局算法规格

- 网格：行 = 状态，列 = 配置；行首左沟槽 120px 显示状态名（mono 12px）。
- 单元格内：`[before 节点]—8px—[检查徽章列]—8px—[after 节点]`；无 after 时只放 before，右侧留空。
- 节点尺寸：**列内统一宽**——desktop 列 220px、mobile 列 132px（按列内多数配置宽高比判定，3:4 以上视为窄列）；高度 = 宽 × 截图宽高比，等比。
- 间距：列间 32px，行间 48px。
- 初始视图：fit all（含沟槽），缩放范围 25%–400%，`⌘`+滚轮以指针为锚点。
- 用户拖动：仅改节点位置（存 D2 的 localStorage）；「重置布局」按钮清空该键恢复自动。

## B4. 「变化状态」定义（Diff 模式的过滤依据）

一个 `stateId--configurationId` 视为**变化**当且仅当存在 after 节点且满足任一：

1. `evaluation.views[key].checks` 任一为 false；
2. `beforeH1` ≠ `afterH1`（evaluation 提供）；
3. before 节点 `reached === false` 且 after 可达（恢复场景）。

其余（after 存在且全过且 H1 相同）= 未变化 → Diff 模式下降至 35% 不透明度。**无 evaluation 数据时不启用 Diff 模式**，按钮置灰并提示「需先 evaluate」——不基于截图目测猜变化。

## B5. 交互行为规格表

| 对象 | 触发 | 行为 | 边界 |
| --- | --- | --- | --- |
| 舞台 | 空格+拖 / 中键 / 双指 | 平移 | 无 |
| 舞台 | `⌘`+滚轮 | 以指针为锚缩放 | 夹在 25%–400% |
| 舞台 | `Shift+F` | fit all | 无 |
| 节点 | `F` | fit 选中节点 | 无选中时 = fit all |
| 节点 | 单击 | 选中：cream 2px 描边；Inspector 加载该状态详情（状态/配置/URL/状态码/检查/涉及文件） | — |
| 节点 | 双击 | lightbox 显示 700px 压缩图，再点原图链接取原尺寸 | — |
| FindingPin | 单击 | 选中 finding；其 evidenceRefs 指向的节点保持全亮，**其余节点降至 35%**（400ms 过渡，reduced-motion 直切）；Inspector 显示 finding | 点空白处清除高亮 |
| 反查 | Inspector 内证据条目点击 | 高亮对应节点并居中 | 仅 capture: 引用可反查 |
| Diff 模式 | `D` / 顶栏开关 | 按 B4 过滤；开关态按钮高亮 | 无 evaluation 时禁用（见 B4） |
| 小地图 | 拖动视口框 | 同步平移 | 节点 >60 时才显示，否则隐藏 |
| 视图切换 | 顶栏 | 列表/画布/Code Diff 三态；写 URL `?view=` | 刷新保持 |
| before 节点角标「整改后 ↗」 | 点击（存在 after 时才显示） | 平移聚焦对应 after 节点：居中 + 2px cream ring 800ms 后消退；反向同理 | reduced-motion 下 ring 常显不消退 |
| DiffPair 徽章 | 双击 | fit 该对（前后同屏） | 无 after 时无徽章 |
| 便签（finding） | 选中时 | Inspector 底部提示「整改后请在 after 状态上观察本 finding 是否解决」 | M1 无自动关联，不假装有 |

## B6. 空态与降级

| 情形 | 呈现 |
| --- | --- |
| run 无 before 采集 | 空态卡：「此 run 没有可摊开的状态」+ 指向 capture 命令 |
| 无 after（大多数 run） | 正常摊开 before；DiffPair 单边；Diff 模式按 B4 禁用条件处理 |
| 无 diagnosis | 无便签；左栏提示「未诊断：harness diagnose」 |
| 无 evaluation | 无徽章、Diff 模式禁用（B4） |
| run.json 读取失败 | 错误态文案 + 返回列表视图链接；不静默空白 |
| `<900px` 视口 | 整体替换为纵向状态列表（标题+缩略图+检查结果），不做触控画布 |
| 截图加载中 | 节点内显示 surface 底 + mono 状态文案「载入中」；超过 5s 换「重试」链接（点击重载该图） |

## B7. 视觉规格（沿用 appllama token）

- 舞台底：`bg-ink`；网格点阵省略（不做装饰）。
- 节点卡：`surface` 底、1px `sep` 描边、18px 圆角、`shadow-catalog-card`；选中 = 2px cream 描边。
- 节点题注：mono 11px `label-quaternary`，格式 `STATE · CONFIG · HTTP 200`。
- 检查徽章：通过 = cream 圆点；失败 = `#FF8A80` 圆点 + 失败项名（mono 10px）。
- FindingPin：cream 底 + ink 字、10px 圆角、mono 优先级数字 + 标题截断 18 字；stale = 灰底 + 删除线。
- 连接：before/after 间不画线（并置即配对），检查徽章列即中介。
- 字体：界面 Instrument Sans/系统；元信息一律 mono。

## B8. QA 手工清单（实现者自查，PR 附结果）

1. 三个真实 run（06dabc2c / 8f60c961 / 本地新建多状态 run）逐一打开：节点数 = 状态×配置，无缺漏；
2. legacy viewports run 正常（单行两列）；
3. 每条 finding 的便签出现在其 evidenceRefs 指向的 before 节点；
4. 点便签 → 高亮正确、再点空白清除；
5. `D` / `Shift+F` / `F` / 缩放锚点 / 25%–400% 夹取全部符合 B5；
6. B6 六种情形逐一如实呈现；
7. `prefers-reduced-motion` 下无过渡；键盘 Tab 可达节点与便签；
8. 拖动后刷新位置保持、重置恢复；
9. Code Diff：hunk 渲染正确、旧 run 降级标注可见；
10. `?view=canvas` 直链与顶栏切换一致；
11. ≤20 状态滚动手测流畅；截图对照 Part A §3 线框无结构性出入；
12. B10 链路项逐条走通：onboard 输出含深链、画布各阶段卡命令可复制、判定后出现回环建议、focus 时静默重读不丢缩放。

## B9. 反漂移机制

- 开工前：实现者通读 Part B，**在 issue #33 勾选「规格已读」并提第一个问题**（证明读过）；
- 开工中：任何 B 部分未定义的行为 → 停下问，答案回写本文档（附决策号）；
- 完工定义：B8 清单全过 + 三张截图（全览 / Diff 模式 / Inspector）对照线框，附于 PR。

## B10. 链路交接规格（阶段之间的交互）

链路上的每个接缝都要有**桥接物**（能复制/能点击的东西）和**下一步指引**。
今天链路的三个硬缝：CLI 完成后不打印 Workbench 链接（上下文断裂）、
执行后无采集引导（靠记忆）、判定后无回环（交互上是开环）。

| # | 交接 | 触发 | 桥接物与交互 | M1 落点 |
| --- | --- | --- | --- | --- |
| H1 | 门户 → 接入 | 复制 onboard 命令 | 已有（copy 按钮） | 已完成 |
| H2 | **接入 → 浏览基线** | onboard/status/next 输出 | **CLI 末行打印深链**：`http://127.0.0.1:4190/apps/designer/?case=run:<id>&view=canvas`（含当前阶段锚点） | harness 小改：输出末尾打印链接；dev server 未跑时打印启动命令 |
| H3 | 浏览 → 诊断 | 人看完截图 | 画布空态/顶栏显示下一条命令（copy 按钮，含 run 目录预填） | M1 只读提示 |
| H4 | 诊断 → 确认 | findings 出现 | 便签/Inspector 显示 confirm 命令（finding ID 预填）；M2 起画布直接确认 | M1 提示 / M2 写入 |
| H5 | 确认 → 执行 | supported | brief 预览 + execute 命令（agent 预填） | M1 提示 |
| H6 | **执行 → after 采集** | execute 成功 | execute 输出 + 画布阶段卡同步显示：「起 worktree 预览 → capture --phase after --url ...」 | M1 提示（CLI 已有此文案，画布同步显示） |
| H7 | 采集 → 评估 → QA | after 存在 | DiffPair 出现；evaluate/attest 命令在顶栏阶段卡 | M1 提示 / M3 圈注 |
| H8 | QA → 判定 | QA pass | 画布顶栏判定区激活（M1 显示 judge 命令；QA fail 则 Accept 锁死并显示原因） | M1 提示 / M2 写入 |
| H9 | **判定 → 回环** | judgment 落账 | 画布显示「下一个 finding」建议（按 diagnosis 排序取下一条）+ 新 run 起始命令；无剩余 finding → 显示「闭环完成，跑 judgment-distiller 沉淀」 | M1 提示 |
| H10 | 跨 run 对比 | — | **不做**（M5+ 再议） | 排除 |

**画布内的前后互跳**：已并入 B5 行为表（见 B5 末三行），此处不留副本。

**同步机制（诚实边界）**：M1 无推送——CLI 写账本后画布不自动更新。落点：
顶栏「重新读取」按钮 + `window.focus` 时静默 refetch（数据量小，整载 <100ms）；
M2 本地服务落地后改推送。刷新丢缩放位置不可接受（D2 布局持久化已保）。

## B10.1 深链规格（H2 的桥）

- **格式**：`http://127.0.0.1:4190/apps/designer/?case=run:<runId>&view=canvas#stage=<stage>`
  - `<stage>` 取 `workflowState().stage`（needs-diagnosis / awaiting-confirmation / … / complete），画布读取后滚动到对应阶段卡并短暂高亮；
  - 端口非 4190 时按环境变量 `PD_SITE_URL` 覆盖（默认 `http://127.0.0.1:4190`）。
- **打印规则（不变式）**：**任何打印 run 目录的命令都追加打印链接行**——覆盖 onboard / init / status / next / capture / diagnose / confirm / plan / execute / evaluate / attest / judge 全部十二个命令，一处工具函数实现。
- **存活探测**：打印前对站点做 500ms 超时的 HEAD；活着 → 只打链接；不活 → 链接 + 一行「未启动：npm run workbench」。
- **终端可点击**：TTY 支持时用 OSC 8 转义输出超链接（`ESC]8;;URL ESC\`打开画布`ESC]8;;ESC\`），非 TTY/不支持时退化为裸 URL。检测方式：`process.stdout.isTTY && process.env.TERM !== 'dumb'`。
- **输出样例（`next` 命令改造后）**：

```text
Run ab12cd34 · awaiting-confirmation
A person must confirm one current finding and the edit scope.
Next: pnpm harness confirm --run .harness/runs/ab12cd34 --finding F1 \
      --verdict supported --note "…"
画布 → http://127.0.0.1:4190/apps/designer/?case=run:ab12cd34&view=canvas#stage=awaiting-confirmation
```

## B10.2 阶段卡规格（画布顶栏，逐阶段命令表）

卡片结构：`阶段标题（中文）· 一句说明 · 命令块（可复制）`；命令一律**预填本 run 目录**，占位符（`<url>` 等）用 `‹›` 标注并配一行提示。数据源 = `workflowState(manifest)`，阶段与命令严格一一对应：

| workflowState().stage | 卡片标题 | 显示的命令（预填后） |
| --- | --- | --- |
| needs-baseline | 采集基线 | `capture --run <dir> --phase before --url ‹预览地址›` |
| needs-diagnosis | 诊断证据 | `diagnose --run <dir>` |
| awaiting-confirmation | 等人确认 | `confirm --run <dir> --finding ‹ID› --verdict supported --note ‹理由›`（‹ID› 预填排序第一的 finding） |
| needs-plan | 规划修改 | `plan --run <dir> --finding ‹已确认 ID›` |
| needs-execution | 隔离执行 | `execute --run <dir> --repo ‹仓库路径› --agent codex` |
| needs-after-capture | 采集整改后 | 两行：① `cd ‹worktree› && ‹起预览›`（取 project config 的 start）② `capture --run <dir> --phase after --url ‹预览地址›` |
| needs-structural-evaluation | 结构评估 | `evaluate --run <dir>` |
| needs-visual-qa | 独立视觉复核 | `attest --run <dir> --input ‹visual-qa.json›` + 一行「先按 visual-review.schema.json 撰写证明文件」 |
| visual-qa-failed | 复核未过（阻断） | 只允许拒绝：`judge --run <dir> --decision reject --reason ‹理由›`；卡片红边 |
| awaiting-judgment | 等人判定 | `judge --run <dir> --decision ‹accept/reject› --reason ‹理由›` |
| complete | 已判定 | 切换为回环卡（B10.3） |

阻断类阶段（visual-qa-failed、finding-stale、boundary-breached、execution-failed）卡片带红边 + `workflowState().reason` 原文显示，命令区只给「起新 run：init …」。

## B10.3 回环卡规格（H9）

判定完成后顶栏切换为回环卡，三段式：

1. **结果**：`已判定 · accept/reject · 理由首行截断`；
2. **下一个 finding**：取本 run `diagnosis.findings` 按序排除 `manifest.findingId` 后的第一条；有 → 显示 `F2 · 标题 · 优先级`；无（或无 diagnosis）→ 显示「本 run 无剩余 finding」；
3. **两条命令**（均可复制）：
   - 下一轮：`pnpm harness init --spec ‹本 run 的 experience.json 路径› --url ‹本 run 的 url›`（新 run → confirm 下一条 → 闭环继续）；
   - 沉淀：`pnpm harness skill --run <dir> --skill judgment-distiller`（把本次判定理由转成项目学习候选）。

## B10.4 同步与复制细节

- **静默重读**：`window focus` 与 `visibilitychange→visible` 触发，防抖 300ms；重读仅刷新数据层（manifest/captures/diagnosis/evaluation），**舞台 transform、选中、Diff 开关一律保持**；选中节点若已不存在 → 清除选中并 toast「所选状态已不在最新数据中」。
- **失败处理**：重读失败不打断界面，顶栏出现黄点 + 「读取失败 · 重试」；数据维持上一次成功版本。
- **时间戳**：顶栏 mono 显示「更新于 n 分钟前」，以最后一次成功重读计时。
- **复制兜底**：`navigator.clipboard` 拒绝时，命令块自动全选并提示「⌘C 复制」；命令块本身始终可手动选择（不设 user-select:none）。
- **新节点落位**：重读后新增状态节点按 B3 自动布局追加到对应行/列末尾，不挤占用户已拖动节点的位置。

## 2026-09-28 用户方向修订

最新要求以 Cowart 批注画布为 UI 修改入口，前后对照保留在报告；原只读、自研和 OUT 圈注范围为历史方案，不再约束本次用户明确授权的实现。创作生成、源码隔离执行、重新采集与判断写入已由 PR #34 接通。最新逐项现状见 `workbench-issue-audit-2026-09-28.md`；早期待办文档属于历史快照。

## 合并不等于里程碑全部验收：当前待办

- [ ] M1：Cowart 编辑、平移缩放、截图选择已实现；finding 双向追溯、只看变化、完整多状态与移动降级验收、旧 M1 机器 60fps 尚未全部验证。早期只读自研设计已被用户新方向替代。
- [ ] M2：本地服务已有确认、执行、复核、判断写入；真实业务独立复核及人工接受仍待完成。
- [ ] M3：新增画布 PNG 附件保存、来源截图指纹、复核 attachmentRefs 引用、校验和导出；工作台可查看/勾选附件。仍需真实业务复核和浏览器端完整交互验收，现有独立复核 JSON 导入尚待表单化。
- [ ] M4：完整设计基础对照面板、逐项批准/替换与跨版本差异。
- [ ] M5：任务流中的多状态导航连线。

本轮附件只记录批注证据，不自动生成独立复核结论或人工判断。原始截图继续作为 screenshotRefs；批注不能替代必要截图。附件保存后不可覆盖，导入复核时检查原图和附件内容哈希。


Project-specific historical case sections are excluded from this public source distribution.
