<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/happyhands-logo-paper.png">
    <img src="public/brand/happyhands-logo-ink.png" alt="HappyHands" width="340">
  </picture>
</p>

<h3 align="center">让每一次界面修改都有依据。</h3>

<p align="center">为编码 Agent 构建的产品提供本地设计审阅工作台。</p>

<p align="center">
  <a href="https://happyhands.cc"><img alt="官网" src="https://img.shields.io/badge/website-happyhands.cc-202020?style=flat"></a>
  <a href="docs/next-steps.md"><img alt="Local Web Alpha" src="https://img.shields.io/badge/status-Local_Web_Alpha-F79B60?style=flat"></a>
  <a href="docs/harness.md"><img alt="Harness 指南" src="https://img.shields.io/badge/docs-Harness_guide-202020?style=flat"></a>
</p>

<p align="center">
  <a href="#开始使用">开始使用</a> / <a href="#一次审阅怎么进行">审阅流程</a> / <a href="https://happyhands.cc">官网</a> / <a href="README.md">English</a>
</p>

HappyHands 帮你发现界面问题、确定修改范围，再核对实际效果。截图、项目设计规范、Agent 的代码修改和审阅决定，都保存在同一个本地工作台中。

## 开始使用

准备 Git、Node.js **22.15+**、pnpm **11.19**，以及 Chrome 或 Edge。模型诊断和视觉复核需要已配置、已登录的 **Codex CLI**。本仓库提供本地工作台与 Harness 源码。

```sh
git clone https://github.com/ShuaiMXu/happyhands.git
cd happyhands
pnpm install --frozen-lockfile
pnpm workbench
```

打开 **http://127.0.0.1:4190/apps/designer/**，连接要审阅的项目。准备可用的预览，并说明具体任务，例如：

```text
项目仓库：/path/to/your-product
预览地址：http://localhost:3000
用户任务：完成注册并创建第一个项目
设计来源：DESIGN.md、src/styles/tokens.css、src/components
```

采集前核对建议的页面、设备和交互状态。项目配置和命令行操作见 [Harness 指南](docs/harness.md)。[官网](https://happyhands.cc) 提供使用指引和设计资源，仓库审阅流程在本地运行。

## 一次审阅怎么进行

1. 按确认的范围采集桌面、手机页面及交互状态。
2. 对照截图和源码检查问题，整理项目已有的设计规则，在需要时明确批准约束。
3. 确认本次要改的问题与计划，由编码 Agent 在隔离的 Git 工作副本中执行。
4. 对比修改前后的页面，完成适用检查和独立复核，再由你记录接受或拒绝。

Harness 将证据和阶段记录关联起来，模型复核通过不会替你接受修改。没有原页面的新界面采用[设计基础优先流程](docs/harness.md)，先批准设计规则，再开始实现。

### 可以逐项核对的结果

- 切换页面、设备、版本和交互状态，需要细节时打开原始截图。
- 从项目自己的 token、组件和品牌来源形成修改依据，区分观察结果与已批准的规则。
- 保留计划、代码差异、失败检查和早期复核，方便追溯每次决定的依据。

[HappyClaw 重审记录](docs/counter-evidence-review-2026-10-21.md) 记载了一个实际案例：补充反证后重新进行独立复核，同时保留原来的失败报告。

## 配合你的编码工具

| 工具 | 当前用途 |
| --- | --- |
| Codex CLI | 模型诊断、截图视觉复核，也提供代码执行适配器。 |
| Claude Code | 对已确认任务提供代码执行适配器；需先完成配置，完整端到端验证仍待完成。 |
| Cursor、Kimi Code、WorkBuddy | 工具具备本地浏览器、终端和仓库访问能力时，可以指导和操作 Harness；目前没有各自的代码执行适配器。 |

运行 `pnpm harness agents` 查看已注册执行器。具体行为和限制见[适配器说明](docs/architecture.md#agent-adapters-and-the-permission-boundary)。

## 当前范围

HappyHands 目前处于**本地 Web Alpha**。结论以采集计划和已完成检查为准，未查看的页面、未测试的交互仍属未审阅范围。专业校准、真实用户验收等缺口见[当前待办](docs/next-steps.md)。

运行记录存放在 `.harness/`。模型辅助步骤会通过 CLI 将所选源码上下文和图片发送给配置的模型服务。工作副本与仓库检查属于流程保护，不是安全沙箱。分享导出记录前应检查敏感内容，详见[数据与执行说明](docs/local-workbench.md)。

<details>
<summary>开发与仓库说明</summary>

```sh
pnpm dev             # 本地开发，端口 4173
pnpm design:check    # 设计文档和接入契约检查
pnpm test           # 工程测试
pnpm regression     # 版本化发布案例
pnpm build          # 契约检查及生产构建
pnpm harness skills # 已注册方法及其成熟度
```

工作台界面位于 `apps/designer/`，本地服务位于 `packages/workbench/`，采集、执行和运行记录位于 `packages/harness-core/`。当前公开官网由 [happyhands-site](https://github.com/ShuaiMXu/happyhands-site) 独立维护；本仓库的静态构建不提供可写本地服务。

贡献前阅读 [AGENTS.md](AGENTS.md)、[DESIGN.md](DESIGN.md) 和[架构文档](docs/architecture.md)。保留批准边界、来源信息及完整上游 Skills，如实记录实际执行的检查；不要提交凭证、私有截图或本地运行记录。

</details>

## 项目链接

[官网](https://happyhands.cc) / [Harness 指南](docs/harness.md) / [待办](docs/next-steps.md) / [问题反馈](https://github.com/ShuaiMXu/happyhands/issues)

以下为公开官网仓库的活跃度：

[![官网 Stars](https://img.shields.io/github/stars/ShuaiMXu/happyhands-site?style=flat&label=Website%20stars)](https://github.com/ShuaiMXu/happyhands-site/stargazers)
[![官网 Forks](https://img.shields.io/github/forks/ShuaiMXu/happyhands-site?style=flat&label=Website%20forks)](https://github.com/ShuaiMXu/happyhands-site/forks)
[Star history](https://www.star-history.com/?repos=ShuaiMXu%2Fhappyhands-site&type=date)

自有 HappyHands 源码采用 MIT。第三方代码和依赖保留各自许可，详见 [第三方声明](THIRD_PARTY_NOTICES.md)。
