# OJO Skill 合并与运行接入

OJO 的价值不限于“去 AI 味”：它从产品目标和用户出发，建立视觉方向，再将方向落实到设计变量、组件、素材、动效和审查。本次将完整方法收录进 Harness，而不是只摘录反模式清单。

## 收录内容

来源：[touchine-ojo/OJO-Design-Skills](https://github.com/touchine-ojo/OJO-Design-Skills/tree/fbd2c2d158e5ebda8930f4bc63ed635a8500d31f/skills/app-ui-ux-best-practices)，固定提交 `fbd2c2d158e5ebda8930f4bc63ed635a8500d31f`。

`skills/vendor/ojo/upstream/` 保留未修改的核心 SKILL.md、九份 references 和 MIT LICENSE。九份资料包括 anti-patterns、visual-tokens、component-recipe、motion-system、material-metaphor、design-audit、hero-enrichment、icon-guidelines、component-libraries。

`source.json` 记录上游路径、提交、SHA-256 和 Git blob SHA；导入时逐文件核对了上游 Git blob。运行时校验本地文件清单与 SHA-256，不联网下载最新版，不执行上游安装脚本。

## 怎么进入原有工作流

| 原有环节 | 接入方式 | 能力边界 |
| --- | --- | --- |
| 品牌提取、视觉诊断、视觉 QA 的 Skill 执行 | 输出 designGuidance 元数据，并在 run 下保存完整 OJO 快照；provenance 包含 bundleHash | 提取器仍是有限实现；保存方法资料不代表模型已看图或完成品牌推导 |
| 已确认的修改／已批准基础上的首次页面生成 | executeWithAgent 给执行模型传入 OJO 适配说明和首读文件位置，按任务加载其余资料 | 继续复用原有计划、确认、工作区隔离与时间限制；不会把 OJO 文件写入目标项目差异 |
| 修改后的独立 AI 复核 | 在只读模型工作目录中提供同版 OJO 原文、审查参考和本地 rubric | 输出仍使用已有视觉审查 schema、截图覆盖与哈希校验；不替代用户验收 |

品牌／视觉诊断由三个已有 Skill 承接，不新增同名重复执行入口：brand-foundation-extractor 0.4.0、visual-hierarchy-reviewer 0.3.0、visual-qa-evaluator 0.3.0。它们仍为 bounded。

## 保留 OJO 的方法，明确项目约束

保留实用型／品牌体验型路径、五个视觉表达维度、品牌驱动方法、语义设计变量、相关组件状态、素材真实性、动效目的与完整审查参考。

`skills/vendor/ojo/ADAPTER.md` 单独处理衔接；上游原文不被偷偷修改：

- 遵循 OJO 自带的 General Skill Mode，已确认的局部修改不用再强制选择 A/B/C。真正缺少批准的新方向走现有 Foundation Approval，不在无交互执行中等待对话。
- 保留有依据的品牌选择。固定配色、渐变等禁令解释为需要结合语境审查的默认模式，不覆盖用户批准的身份。
- Tailwind、组件库和工具名是方法示例，不强制改变现有技术栈，也不安装额外工具。
- 上游对系统提示词、语言、Agent 编排的假设不接管 Harness。输出语言、结构、工具权限与执行范围以当前任务为准。
- 设计审查仍需真实证据；不使用审美总分证明质量，不通过静态图推断动效或隐藏状态。

## 可追溯与更新

每次运行的 `ojo-guidance/v2/<bundleHash>/` 含原文、许可证、来源记录、适配说明和首读清单。review 首读原 Skill、anti-patterns、design-audit；implementation 首读原 Skill、anti-patterns，再按任务选择 tokens、components、motion 等。完整资料均可读取，不强迫每次把所有参考内容塞进提示词。

bundleHash 覆盖来源记录、全部文件哈希、适配说明、运行模式和首读清单。先在同级唯一临时目录完整写入并校验，再通过目录重命名原子发布；并发调用校验并复用同一已完成快照。中断遗留的临时目录不会阻塞重试。旧版直接写入的 `ojo-guidance/<bundleHash>/` 保持原样，使用 v2 路径重新生成，避免旧半成品阻塞运行。已发布的 v2 快照与预期内容不同或缺失文件仍会报错，不静默覆盖。执行记录增加 designGuidance 和 promptHash，本地保留 execution-prompt.txt；独立复核记录包含 OJO 指纹，模型工作目录保留提示词、上下文和审查 provenance。静态导出不新增整个资料包或原始模型提示词的公开发布。

升级时明确选定上游提交，保留新版本 LICENSE，重新核对 Git blob 并更新 source.json；检查上游方法与本地适配差异，提升适配器或相关 Skill 版本，运行完整测试、回归和构建。历史运行按原快照保留。

## 尚未宣称完成的部分

本次是完整方法收录与真实执行路径接入，不是重写原有提取器：五个视觉维度自动结构化提取、完整动效实测、自动基线视觉模型诊断仍需后续实现。单元测试能证明资料传入、隔离、完整性和证据记录，不能证明模型读完所有参考或达到专业审美水平。真实项目校准继续保留。
