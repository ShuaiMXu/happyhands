# 在 DeepSeek Harness（DSH）中调用 HappyHands

[English](dsh.md)

在已有 DSH 对话中，通过终端操作 HappyHands，无需启动 HappyHands 工作台。DSH 理解任务和调度，HappyHands 保存截图、计划、隔离执行与验收记录。

## 当前支持范围

- DSH 会话具备工程、终端与必要截图的访问能力时，可以操作 HappyHands 已有 CLI。
- 当前注册的修改执行器是 `codex` 和 `claude-code`，没有 `--agent dsh` 或 `--agent deepseek`。修改前明确选择可用执行器，不能静默切换。
- 内置模型诊断和截图视觉复核仍需要配置并登录 Codex CLI，DSH 不能代替这项依赖。
- DSH 在 `harness execute` 之外的修改可以复拍、评估，但没有 Harness Agent 执行记录，不能冒充已注册的隔离执行。
- 这里说明外部编排方式，尚不代表已验证“仅依赖 DSH”的完整修复与独立验收闭环。

## 从 DSH 桌面端开始

1. 打开可访问 HappyHands 工程和目标产品的 DSH 会话，保留原有未提交内容。提供可运行预览和一个用户任务，例如“表单提交失败后保留已填内容并重试”。
2. 粘贴下方请求。先核对实际 CLI 和项目规则，优先复用已有 HappyHands 工程；需要安装时按 [准备条件](../README.zh-CN.md#开始使用)获取源码并安装依赖，无需运行 `pnpm workbench`。
3. 保存原始截图，再审阅问题及修改范围。已明确授权的修复沿用原范围，审查请求不能自动扩大为无关修改。
4. 由选定的已注册执行器在 Harness 隔离工作副本中修改。预览来自该副本，复拍相同状态与尺寸，执行适用检查并独立复核，最后由用户明确接受或拒绝。

```text
请用 HappyHands 审阅当前产品的一个用户任务。先读取 HappyHands 工程中的
docs/dsh.zh-CN.md、docs/harness.md、skills/review-product/SKILL.md，
以及本次命中的完整 experience-remediation 方法与参考。
复用已提供的仓库、预览和目标，只询问缺失信息。
先核对实际 CLI；复用一份 Harness run，用 next/status 查看进度，不另建验收记录。
先复现并采集原始截图，再提出修复决定，保留项目品牌、设计规范和共享组件。
运行 pnpm harness agents，说明可用的已注册修改执行器，由我选择。
不要编造 --agent dsh，也不要静默切换执行器。
在确认范围内隔离修改，复拍匹配状态并独立复核；保留失败和缺证，由我最终接受或拒绝。
本次审阅不自动推送、合并、部署或发帖。
```

## 每一步由什么指导执行

| 环节 | 方法与程序 | 必须产出 |
| --- | --- | --- |
| 理解与复现 | `review-product`、项目规范、`harness onboard` 或 `init`/`capture` | 单一任务、源码版本与原始证据。 |
| 诊断与决策 | `experience-remediation` 及命中的完整 OJO/Taste/Impeccable 参考 | 先查当前页面细节，再查共享交互、任务与布局，最后补设备回归；区分缺陷、推断与缺证。 |
| 计划与修改 | 已有确认/计划门槛及 `harness execute` | 具体修改决定、真实组件复用与隔离工作副本；读过方法不等于完成整改。 |
| 验证与判断 | 匹配复拍、适用检查、独立视觉复核和人工判断 | 前后证据、未解决项与显式人工决定；命令成功不等于视觉验收通过。 |

使用 `pnpm harness next --run DIRECTORY` 和 `pnpm harness status --run DIRECTORY` 查看同一份记录。实际命令及配置范例见 [Harness 指南](harness.md#one-finding-one-run)。范例目录需要替换为真实路径。

## 可选：无界面调用 DSH

本机核对的 DSH `0.2.2-rc.1` 支持：

```sh
dsh --help
dsh headless --help
dsh headless --json - < review-request.txt
```

`review-request.txt` 是本次任务请求。配置好 DSH 命令和模型路线后，从实际工作目录调用。一次处理一个任务；需要追问和人工选择时优先使用桌面对话。

**桌面端已登录不等于 headless 已登录。** 本机版本的 headless profile 默认禁用托管凭据存储，依次读取启动环境、当前目录 `.env`、`$DSH_HOME/.env`。不能因为桌面可用就宣称命令已接通；按所用 DSH 版本配置，不把密钥放入提示词或提交到仓库，不自动修改认证设置。

DSH 的 `--json` 是事件投影，不是 HappyHands 审阅台账。保留原始 `.harness` 记录，不把 DSH 最终事件当作独立复核或人工接受。不同版本的命令和默认配置可能变化，使用前读取本机帮助。
