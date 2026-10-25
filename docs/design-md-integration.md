# design-md 工程接入

用户提供的官网安装命令返回 HTTP 429，官网安装包未取得。工程实际安装的是公开源码 [nolly-studio/agent-skills](https://github.com/nolly-studio/agent-skills/tree/2008e7f671eb9f55989b73f9e33cbe06e74c428a/skills/design-md) 的 design-md v1.0.0，MIT 许可，固定提交 `2008e7f671eb9f55989b73f9e33cbe06e74c428a`。这不是对官网当前包字节或版本一致性的声明。

完整 SKILL、两个参考模板、许可证及文件哈希保留在 `.agents/skills/design-md/`，没有删减原文。portable frontend-design 从该包模板生成，添加来源版本标记；它优先服从项目 DESIGN.md，没有覆盖用户全局同名 skill。

本仓库按 Mode B 合并已有实现和约定：根 DESIGN.md 链接共享 token、三个正式视图的共同控制器与现有方法文档。AGENTS.md 是读取入口。旧文档原样保留；旧标题字体、局部值和通用 craft 默认值的差异写入 Open questions，没有以整理文档授权 UI 重构。

`pnpm design:check` 校验固定来源/哈希、portable skill 原文、许可证、根文档链接及已有 token。`pnpm build` 先执行该检查再进行原有 Vite 构建。skill 本身是 Agent 指令文档，不作为浏览器运行时代码打包，也没有注册成新的 operational 诊断 handler。

目标项目的 DESIGN.md 已可通过既有 capture-time design-system extraction 进入规范证据、计划和独立复核。这里不把本文变成已批准 Foundation，不修改历史采集或人工判断，也不把工作台壳层字体/颜色推广为被审项目品牌。后续官网需在它自己的仓库建立对应规范，不能共用本工程的壳层 token。

校验不是视觉、交互、模型应用或设计质量认证。变更已批准规则需要原有的明确决策和版本流程；生成文档不授予发布或重构权限。

本次验证：设计契约检查通过（4 个原始来源文件、portable skill、文档链接及 18 个已有 token），Vite 生产构建通过，19 项设计系统/品牌来源相关测试通过。一次明确标注为 source-only 的接入检查确认根 DESIGN.md 原文进入既有 extraction、控件圆角 token 仍为 observed、rendered 列表为空；没有虚构截图或批准。没有重新宣称全量测试、模型视觉质量或远端 CI 通过。
