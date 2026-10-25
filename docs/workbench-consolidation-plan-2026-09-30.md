# 工作台进度与收口计划

日期：2026-09-30

## 结论

Creative OS 已经具备本地审阅、证据采集、隔离源码修改、重新采集、视觉复核和人工判断的主要技术能力，但还没有在真实 HappyClaw 任务上完成一次新的端到端人工验收。

当前主要问题不是缺少功能，而是正式工作台、HappyClaw 专用流程和画布技术实验集中在同一组叠加 PR 中。PR #41 继续保持草稿，停止增加功能。下一阶段先整理分支、收敛工作台信息架构，并把核心画布改为“真实页面元素选择 → 评论 → AI 修改源码 → 前后复核”。

OpenPencil 的历史评估保留，但独立运行入口已因 `0.15.1` 依赖链存在 critical 漏洞而移出主线。Cowart/tldraw 继续承载已有截图批注与复核附件，不再扩展成 Figma 式页面编辑器。

## 当前能力

### 已实现并经过本地验证

- `creative-os` 承载本地工作台、Harness、证据、隔离执行、评估与人工判断；`creative-os-site` 承载线上官网。
- 工作台可以读取真实运行记录，并展示审阅报告、画布、代码改动和设计方向。
- 已具备项目绑定、基线采集、范围确认、隔离 Git worktree 修改、重新截图、代码 diff、视觉复核和人工 Accept/Reject 的基础链路。
- 图片生成、参考图修改、HTML 和 Slides 创作任务可以通过本地任务服务执行。
- Cowart 批注、区域评论、复核附件、来源指纹和本地持久化已经接入。
- 工作台具有共享侧边栏、HappyHands 品牌和独立的中文、英文界面。
- 最近一次本地验证通过 184 项 Node 测试、14 项 Skill 回归和生产构建。

### 尚未完成

## PR 状态

- PR #37、#38、#39、#40、#41 仍存在并行或叠加关系。
- PR #41 同时包含方向决策、源码执行、UI 统一、国际化、区域评论和 OpenPencil 实验，范围过大。
- PR #41 保持草稿，不直接合并，也不再叠加新产品功能。
- 下一步从已确认的基础分支重新整理提交：正式执行能力、工作台 UI 收口、画布实验分别审阅。

## 产品信息架构

正式工作台收敛为四个入口：

1. **页面**：运行真实被审阅页面，选择 DOM 元素、添加评论并交给 AI 修改。
2. **审阅报告**：查看问题、证据、AI 判断、前后结果和人工接受状态。
3. **代码改动**：查看文件 diff、修改原因和验证结果。
4. **设计实验**：承载 OpenPencil 等设计文件能力，作为 Beta，不进入默认审阅路径。

设计方向不再作为独立的大表单页面。AI 根据当前运行证据生成少量建议，用户在审阅报告中用自然语言或简短选择确认范围。

## 开源项目接入判断

| 项目 | 角色 | 处理方式 |
| --- | --- | --- |
| [React Grab](https://github.com/aidenybai/react-grab) | DOM 到 React 组件、文件和行号的定位 | P0 技术验证；优先补齐真实页面到源码的映射 |
| [agent-ui-annotation](https://github.com/YeomansIII/agent-ui-annotation) | 页面元素选择、评论、selector 和结构化批注 | P0 技术验证；与 React Grab 比较后选择最小组合，避免两套工具栏并存 |
| [Onlook](https://github.com/onlook-dev/onlook) | 真实页面、源码索引和视觉修改写回代码的完整案例 | 参考其架构与数据协议，不整体引入其 WebContainer、云服务和应用外壳 |
| [OpenPencil](https://github.com/open-pencil/open-pencil) | `.fig`、设计节点、组件、变量和设计稿自动化 | P1；保留独立实验入口，完成六项验证后再决定是否正式采用 |
| [Puck](https://github.com/puckeditor/puck) | 使用批准组件库生成和编辑新 React 页面 | P1；用于受 Design Foundation 约束的页面生成，不用于修复任意旧项目 |
| [Penpot](https://github.com/penpot/penpot) | 完整设计协作、评论、原型和设计文件管理 | P2；需要时作为独立服务，通过插件、Open API、Webhook 或 MCP 对接 |
| [stagewise](https://github.com/stagewise-io/stagewise) | 真实页面与 Agent 协同的产品参考 | 仅参考；AGPLv3 和第三方图标授权不适合直接复制进当前产品 |

Excalidraw、BlockSuite 和继续扩展 tldraw 都不作为核心路线。它们适合白板、文档或截图批注，不能解决真实 DOM 与源码定位。

## 执行顺序

1. 冻结 PR #41 的功能范围，整理未合并 PR 与基础分支。
2. 将 OpenPencil 实验与正式工作台改动拆开。
3. 对 React Grab 和 agent-ui-annotation 做小型真实项目验证，形成统一的元素定位与批注协议。
4. 把该协议接入现有隔离源码修改任务，并保留来源 commit、路由、状态和截图证据。
5. 合并重复 CSS，以一套 token 和工作台 Shell 为唯一来源。
6. 将设计方向并入审阅报告，删除默认长表单路径。
7. 用 HappyClaw 完成真实端到端修改、独立视觉 QA 和人工接受。
8. 完成以上步骤后，再评估 OpenPencil 或 Puck 的正式接入。

## 发布门槛

正式工作台至少满足以下条件后再合并到主线：

- 任意受支持项目的当前运行记录都能生成与自身绑定的方向和源码任务。
- 用户选中的页面元素可以解析为稳定的 DOM、组件和源码上下文。
- 修改任务在隔离工作区执行，并能重新采集同一路由、状态和视口。
- 独立视觉 QA 与人工判断均有不可变证据记录。
- 中英文、桌面和移动端主要流程通过浏览器验收。
- GitHub CI 恢复并通过，或明确记录经批准的替代发布检查。


Project-specific historical case sections are excluded from this public source distribution.
