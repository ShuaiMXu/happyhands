<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/happyhands-logo-paper.png">
    <img src="public/brand/happyhands-logo-ink.png" alt="HappyHands" width="340">
  </picture>
</p>

<h3 align="center">让每一次界面修改都有依据。</h3>

<p align="center">在本地发现界面问题、调用编码 Agent 修复，再核对修改结果。</p>

<p align="center">
  <a href="https://happyhands.cc"><img alt="官网" src="https://img.shields.io/badge/website-happyhands.cc-202020?style=flat"></a>
  <a href="docs/next-steps.md"><img alt="Local Web Alpha" src="https://img.shields.io/badge/status-Local_Web_Alpha-F79B60?style=flat"></a>
  <a href="docs/harness.md"><img alt="Harness 指南" src="https://img.shields.io/badge/docs-Harness_guide-202020?style=flat"></a>
</p>

<p align="center">
  <a href="#开始使用">开始使用</a> / <a href="#一次审阅怎么进行">审阅流程</a> / <a href="https://happyhands.cc">官网</a> / <a href="README.md">English</a>
</p>

HappyHands 将界面诊断、Agent 修复和前后对比放在同一个本地工作台中。查看页面与交互状态，发起一次范围明确的修复，再决定是否采纳并提交草稿 PR。

## 产品演示

37 秒产品演示。

https://github.com/user-attachments/assets/19607c8f-3fb4-4db5-826e-ff664980dbce

## 开始使用

准备 Git、Node.js **22.15+**、pnpm **11.19**，以及用于浏览器采集的已安装 Chrome 或 Edge。本仓库提供本地工作台与 Harness 源码。工作台内置模型诊断和视觉复核需要已配置、已登录的 **Codex CLI**；代码实现所需的 CLI 配置取决于所选执行器。区别见[配合你的编码工具](#配合你的编码工具)。

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

1. **查看问题。** 连接仓库和预览，核对采集范围，查看桌面、手机截图及对应问题。在当前审阅中切换设备、版本和交互状态，点击截图即可页内放大。
2. **一键修复。** 工作台根据当前源码核实诊断问题，准备修改范围和计划，再调用编码 Agent 在隔离的 Git 工作副本中执行。完成后重新采集页面，运行适用检查和独立视觉复核。缺失证据和失败记录会保留。
3. **核对结果。** 查看前后对比，决定接受或拒绝。接受时理由选填；拒绝或提交反证重新复核时需说明原因。已接受且通过验证的修复，可再点击提交**草稿 PR**，工作台不会替你合并或部署。

一键修复代表你授权工作台处理本轮中间的范围与计划步骤，最终结果仍由你判断。没有原页面的新界面，依然需要先明确批准[设计基础](docs/harness.md)，再开始实现。

### 问题需要什么依据

正式问题需要有可复现的现象、明确的错误说明，以及对应的 skill 快照引用。Harness 会核对引用的章节、行号和原文。宽泛的设计建议、个人审美偏好不能单独成为自动修复依据。

修改遵循被审项目自己的设计来源。HappyHands UI 规范用于工作台，以及明确采用这套规范的项目。原始截图、早期失败和未录入建议都会保留，具体要求见[问题录入与判断依据](docs/finding-admission-policy.md)。

[HappyClaw 重审记录](docs/counter-evidence-review-2026-10-21.md) 展示了一次实际过程：补充反证后重新独立复核，同时保留原失败报告。这份记录说明的是该案例的审阅路径，不代表整个产品已验收或部署。

### 设计资源

[官网](https://happyhands.cc) 提供 Design.md 参考、设计系统、组件和主题工作室，可用于选择设计方向、预览主题和准备项目设计文件。这些是审阅时的可选输入，浏览某个参考不会自动把它批准为项目规范。

## 配合你的编码工具

HappyHands 支持任意 AI CLI 参与开放的编码 Agent 工作流。外部 Agent 具备所需的本地终端、仓库和浏览器访问能力时，可以操作 Harness；在 Harness 外完成的修改也可采集和审阅。通过 `harness execute` 直接执行则需要已注册的适配器，当前默认使用 Codex。这不代表每个 CLI 都有内置接入，也不代表所有功能都已在每个 CLI 上验证。

| 工具 | 当前用途 |
| --- | --- |
| Codex CLI | 内置模型诊断、截图视觉复核，也是默认代码执行适配器；执行路径已有使用记录，不等于所有功能均已完成全流程验证。 |
| Claude Code | 对已确认任务提供代码执行适配器；需先完成配置，完整端到端验证仍待完成。 |
| Cursor、Kimi Code、WorkBuddy | 工具具备本地浏览器、终端和仓库访问能力时，可以指导和操作 Harness；目前没有各自的代码执行适配器。 |

运行 `pnpm harness agents` 查看已注册执行器，通过 `harness execute --agent ID` 选择；`--command PATH` 只更改该适配器的二进制路径，不改变 CLI 协议。其他 CLI 若要直接执行，需要添加适配器。外部修改没有 Harness Agent 执行记录，审阅时需单独说明。具体行为和限制见[适配器说明](docs/architecture.md#agent-adapters-and-the-permission-boundary)。

## 当前范围

HappyHands 目前是**免费的本地 Web Alpha**。外部模型和 CLI 服务可能需要单独的账号、订阅或按量付费。结论以采集计划和已完成检查为准，未查看的页面、未测试的交互仍属未审阅范围。专业校准、真实用户验收等缺口见[当前待办](docs/next-steps.md)。

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

关注核心项目：

[![Stars](https://img.shields.io/github/stars/ShuaiMXu/happyhands?style=flat&label=Stars)](https://github.com/ShuaiMXu/happyhands/stargazers)
[![Forks](https://img.shields.io/github/forks/ShuaiMXu/happyhands?style=flat&label=Forks)](https://github.com/ShuaiMXu/happyhands/forks)
[Star history](https://www.star-history.com/?repos=ShuaiMXu%2Fhappyhands&type=date)

自有 HappyHands 源码采用 MIT。第三方代码和依赖保留各自许可，包括 tldraw 独立的生产使用要求，详见 [第三方声明](THIRD_PARTY_NOTICES.md)。
