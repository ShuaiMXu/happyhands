# 在 DeepSeek Harness（DSH）中调用 HappyHands

[English](dsh.md)

在已有 DSH 对话中，通过终端操作 HappyHands，无需启动 HappyHands 工作台。DSH 理解任务和调度，HappyHands 保存截图、计划、隔离执行与验收记录。

## 当前支持范围

- DSH 会话能访问工程、目标仓库、终端和预览时，可以操作 HappyHands CLI。
- **DSH 可以自己改。** `HH execute --run RUN --repo REPO --agent self` 会准备隔离工作副本并写出执行简报；DSH 只在副本里改、在副本里跑检查，然后用 `HH execute-finish --run RUN` 收口。收口走的是和拉起外部 CLI 完全一样的宿主仓库边界校验、diff 记录与台账写入——这是有执行记录的已注册执行，不是台账之外的顺手改。要让 `codex` 或 `claude-code` 来改也可以。
- **诊断和复核必须换一个模型，不能用正在改的那个。** `HH model-diagnose`、`HH model-review` 支持 `--agent claude-code`，也支持用 `HAPPYHANDS_API_*` 配置的 API，不再强制依赖已登录的 Codex CLI。模型必须能读图；纯文本端点无法判断截图。
- 走 `execute`/`execute-finish` 之外的修改仍可复拍、评估，但没有执行记录，不能称作已注册的隔离执行。
- 这里说明外部编排方式，尚不代表已验证“仅依赖 DSH”的完整验收闭环；最终接受或拒绝仍然由人决定。

## 给 DSH 安装 Skill

DSH 从 `~/.agents/skills` 读用户级 Skill，从 `<项目>/.agents/skills` 读项目级 Skill。先构建再安装：

```sh
node scripts/build-lite.mjs --out .harness/lite
node .harness/lite/bin/happyhands.mjs install --agent dsh --scope user
```

改成 `--scope project` 则装进 `<项目>/.agents/skills/happyhands`。之后 [SKILL.md](../skills/happyhands/SKILL.md) 里的 `HH` 就是 `node ~/.agents/skills/happyhands/bin/happyhands.mjs`。

在 HappyHands 工程内部工作时优先用该工程自己的 `node scripts/harness.mjs`（或 `pnpm harness`）。安装出来的是构建那一刻的冻结副本，会与工程产生版本差。

## 文件权限与终端

Harness 几乎每条命令都会拉起 `git`、`node` 和浏览器。阻止子进程的文件沙箱会让 `quickstart`、`capture`、`execute` 和测试套件全部失败；DSH 的 `workspace-write` 模式就是这样，报错形如 `spawn EPERM`。请在不受限的文件权限下运行，或在沙箱外的终端里运行。只读命令（`next`、`status`、`agents`、`doctor`、`review-costs`）两种模式下都能用。

## 从 DSH 桌面端开始

1. 打开可访问 HappyHands 工程和目标产品的 DSH 会话，保留原有未提交内容。提供可运行预览和一个用户任务，例如“表单提交失败后保留已填内容并重试”。
2. 粘贴下方请求。先核对实际 CLI 和项目规则，优先复用已有 HappyHands 工程；需要安装时按 [准备条件](../README.zh-CN.md#开始使用)获取源码并安装依赖，不需要 `pnpm workbench`，也不需要在 DSH 里再放一份 Skill 副本。
3. 保存原始截图，再审阅问题及修改范围。已明确授权的修复沿用原范围，审查请求不能自动扩大为无关修改。
4. 在 Harness 隔离工作副本里用 `--agent self` 自己改（或指定其他执行器），预览该副本，复拍相同状态与尺寸，执行适用检查并独立复核，最后由用户明确接受或拒绝。

```text
请用 HappyHands 审阅当前产品的一个用户任务。先读取 HappyHands 工程中的
docs/dsh.zh-CN.md、docs/harness.md、skills/happyhands/SKILL.md，
以及本次命中的完整 experience-remediation 方法与参考。
复用已提供的仓库、预览和目标，只询问缺失信息。
先核对实际 CLI；复用一份 Harness run，用 next 驱动，不另建验收记录。
先复现并采集原始截图，再提出修复决定，保留项目品牌、设计规范和共享组件。
优先用 --agent self：只在 execute 准备的工作副本里改，在副本里跑检查，
最后用 execute-finish 收口，让这份 run 留下执行记录。换其他执行器前先问我。
诊断与复核换用另一个模型，不要在自己这次会话里复核自己的修改。
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

使用 `HH next --run DIRECTORY`（在工程内也可写成 `pnpm harness next --run DIRECTORY`）和同样形式的 `status` 查看同一份记录。实际命令及配置范例见 [Harness 指南](harness.md#one-finding-one-run)。范例目录需要替换为真实路径。

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
