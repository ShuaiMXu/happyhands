# 设计语言去 AI 味：Harness 接入

这里的目标是发现缺少产品依据的设计决定，而非判断页面是否由 AI 编写。文案具体性继续由 content-design-reviewer 负责；视觉层面的构图、字体节奏、装饰语义、产品素材、品牌连续性纳入现有 visual-hierarchy-reviewer，版本升至 0.3.0。

## 与现有流程连接

1. Workbench 接入项目并采集页面后，自动运行 visual-hierarchy-reviewer，记录结构信号及 reviewBrief（关键任务、设计基础、批准记录和统一 rubric）。只有 DOM 时仍是 needs-evidence。
2. 看过截图的审查者沿现有 visual-hierarchy-reviewer attestation 提交结论；候选问题进入原有诊断、用户确认、计划与执行流程。此版本没有新增自动基线模型调用。
3. 修改后重新采集，独立 AI QA 读取同一 rubric，以及该 run 的任务、设计基础和批准记录，检查目标是否实现、有无视觉回退。它不会因既有且范围外的审美机会而否决一个局部修复。
4. 用户继续通过既有判断入口接受或要求调整。规则不会自行修改项目，也不会跳过确认。

命令行仍使用 `pnpm harness skill --run <run-directory> --skill visual-hierarchy-reviewer`。结果中的结构信号不等同于视觉结论。

## 规则与可追溯性

规则唯一正文位于 `skills/product-design/visual-hierarchy-reviewer/rubric.json`。诊断执行对整个 Skill 目录做指纹；AI QA 保存 review-context.json、review-prompt.txt、review-provenance.json 与模型日志，记录 rubric 版本及哈希、提示词与输入哈希、截图哈希。最终审查记录的 reviewer.version 也包含 rubric 哈希。

不设置“AI 味分数”，不禁用通用字体、渐变、卡片或居中布局。每条意见要指出可见元素、任务或品牌冲突、证据和最小修改建议。品牌批准记录缺失时不能假定已经批准；静态截图也不能证明动画或隐藏状态的问题。

研究来源、固定版本、许可链接和未采纳规则见 [sources.md](../skills/product-design/visual-hierarchy-reviewer/references/sources.md)。本地 rubric 保留；OJO 的核心 Skill、九份参考资料及 MIT 许可证已原样收录，经 Harness 适配层用于诊断、设计执行和复核，详见 [OJO 接入](ojo-integration.md)。没有安装第三方执行工具。

## 验证边界

自动测试验证规则确实进入诊断和 AI QA 输入，品牌上下文不丢失，缺图不误判通过，以及证据指纹与重试约束。模型审美判断仍需真实案例校准，不能用单元测试宣称去 AI 味效果已验收。

已存在的独立审查记录保持不变，不会被新版规则静默覆盖；新版复核用于尚未提交视觉审查的新运行。
