# 开源借鉴与 Harness 补强计划

2026-09-28。原则：成熟工具负责事实采集与转换，模型 Skill 负责解释和建议，Harness 控制版本、证据、执行和人工决定。引入前固定版本、保留许可证与 NOTICE；本计划不是全部功能已实现的声明。

## A：执行正确性（当前批次）
- [x] review 执行前验证 baseline 仓库身份与 commit；旧 run 缺身份要求新采集。
- [x] 工作台默认诊断传项目 repo 给无障碍 Skill。
- [x] Runner 校验所有 Skill 的 requiredInputs；缺输入返回 needs-evidence，不生成建议。
- [ ] attempt 模型：补证据可重跑，但旧结果不可覆盖。
- [ ] 有效输入摘要覆盖源码、确认、judgment、rubric/references；独立版本测试。
验收：缺参、旧提交、旧身份均拒绝；匹配版本仍可执行。该批不新增外部依赖。

## B：可确定检查（依赖 A）
参考 axe-core（MPL-2.0）与 PostCSS（MIT）。
- 在现有 Playwright capture 状态上执行 axe，保存 violations/incomplete、规则、节点与截图定位；不要把自动通过表述为无障碍认证。
- 以 CSS AST 替换逐行声明提取；保留选择器、媒体条件、文件位置、原值和别名，不自动决定语义。
验收：一页 HappyClaw 的真实问题可复核；多行、嵌套主题、重复/循环 token、不可解析输入有回归。不得因扫描失败返回无问题。
来源：https://github.com/dequelabs/axe-core 、https://github.com/postcss/postcss

## C：专业设计判断（依赖 A/B，关联 #36）
参考 Impeccable（Apache-2.0）与 OJO（MIT），抽取上下文、视觉层级、设计规格的方法，不直接执行其修改命令，不复制与 HappyHands 冲突的审美禁令。
- 新增模型执行适配器：版本化 SKILL/references + 项目目标 + 截图/源码证据 → schema 校验后的候选。
- 先接 visual-hierarchy-reviewer 与独立 visual QA；记录模型、提示、预算、输入内容摘要和审阅执行来源。
- 人工确认问题后才进入修改，最终 accept/reject 仍人工决定。
验收：完成 #36，一个真实页面闭环、一个拒绝或缺证据案例；不能用执行模型的自评充当独立通过。
来源：https://github.com/pbakaus/impeccable 、https://github.com/touchine-ojo/OJO-Design-Skills

## D：设计系统资产（依赖 B）
参考 Style Dictionary（Apache-2.0）与 Storybook（MIT 核心）。有 Tokens Studio 格式需求时再引入 sd-transforms。
- 显式 Token 映射 proposal，统一 Foundation 契约来源与版本摘要。
- 一个组件状态试点（default/disabled/loading/error 等按类别决定），使用可执行 story/play 产出证据。
验收：提取→Studio 映射→批准→工作台修改→复核使用同一版本；品牌/组件不丢失，不将 token-only 当完整 Foundation。
来源：https://github.com/style-dictionary/style-dictionary 、https://storybook.js.org/docs/writing-tests/interaction-testing

## E：增量审阅与学习（依赖 C/D）
参考 dependency-cruiser、promptfoo（各根许可证 MIT；引入的具体目录另核对）。
- diff→组件依赖→路由/任务映射；无法判断影响时扩大检查并说明覆盖不足。
- 人工判断→脱敏案例→模型/提示对比报告→人工批准发布。既有确定性 regression 继续保留。
验收：实际项目增量用例不遗漏已知影响；退步、改写用例、移除用例均触发审阅。评分校准需要多案例，不随接入直接上线总分。
来源：https://github.com/sverweij/dependency-cruiser 、https://github.com/promptfoo/promptfoo

## 暂不做
不迁移整个 Agent 框架，不一次引入全部工具，不用 Appllama 的移动端指南冒充 SwiftUI 适配，不把 tldraw 当无需生产授权的 MIT SDK。官网模板文案与交付物对齐、CI 恢复并行跟踪。

## 本批验证
155 项 Node 测试通过（含新增旧版本/缺身份/缺 Finding 回归）。不覆盖真实模型质量或业务视觉验收。后续检查结果见 PR。
## 第一批后续：重跑与追溯

已实现未完成 Skill 的显式 retry（工作台重新诊断会重试未完成项）。历史文件不覆盖，manifest.skillAttempts 保留旧记录，skills 指向当前记录；导出包含全部 attempts。确认、规划或执行后拒绝 retry，完整结果也不能替换。提交时比较上一条路径，拒绝基于旧结果的并发写入。

输入摘要现包含 Spec、captures、selected finding、confirmation、judgment 及实际扫描内容；处理器使用同一份内存扫描快照。契约摘要覆盖 Skill 目录内普通文件，包括 rubric/references，状态审计使用已读取的 rubric。扫描仍受文件类型、数量和大小限制，不等于完整仓库快照或渲染截图内容哈希；模型配置与独立审阅来源在 C 批补充。

验证：157 项 Node 测试、14 个合成回归、构建通过。新增缺证据补跑、历史文件不变、导出含历史、确认后拒绝重跑、源码摘要变化及完整结果不可替换的测试。

## B 批初版：axe-core 与 PostCSS

固定依赖 axe-core 4.13.0（MPL-2.0）和 PostCSS 8.5.28（MIT），通过包管理器使用，保留上游包内许可证，不复制第三方源码。来源：https://github.com/dequelabs/axe-core 、https://github.com/postcss/postcss 。

两条浏览器采集路径都在 DOM 证据中保存 axe 的版本、violations、incomplete、节点选择器与失败说明；每条规则最多保存 30 个节点，同时保留总数。注入或执行失败明确记录 failed，Skill 返回 needs-evidence。incomplete 同样要求复核。旧 capture 没有 axe 结果时保留旧的有限语义检查，不视为已运行 axe。

foundation-extractor 0.4.0 对独立 .css 使用 PostCSS AST，记录祖先规则/媒体条件与行号。多行声明、嵌套 dark 规则及解析失败有测试。非 CSS 文件仍使用原启发式扫描；任意主题名称、混合主题选择器、运行时样式及语义命名仍需人工判断。accessibility-reviewer 升为 0.3.0。

运行 npm run test:tools:browser 可在本机 Edge 验证真实 axe 检出无名称按钮并在修改后消除该条问题；也可用 BROWSER_CHANNEL 选择已安装浏览器。此测试使用合成页面，不是 HappyClaw 业务验收，不要求执行付费模型。

### C 阶段进展：设计语言审查规则

已将 Impeccable 与 OJO 的适用方法改写为本地共享 rubric，接入 visual-hierarchy-reviewer 0.2.0 与独立 AI QA；未引入上游执行器。OJO 完整 Skill 与九份 references、MIT 许可证已进一步收录到本地，通过适配层进入诊断、设计执行和独立 QA，详见 [OJO 接入](ojo-integration.md)。固定来源、未采纳规则与验证边界见 [设计语言审查](design-language-review.md)。这完成规则及证据链接入，不代表真实案例视觉效果已经验收。
