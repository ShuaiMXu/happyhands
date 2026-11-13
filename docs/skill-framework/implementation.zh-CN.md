# Skill 框架实施与演进

本次实现不更改固定厂商原文、不删除旧 ID、不重写旧 Run。历史审阅清单及其哈希仍指向 8fcaf63；下列内容描述新增的运行时行为。

## 默认选择和能力边界

`packages/skill-core/method-policy.js` 是可执行选择策略 `task-scoped-methods@1`。diagnose、foundation、plan、review、learn 有独立选集。默认选择只允许有专用处理器且非 contract-only 的能力；即使误把 evidenceGate 标成 bounded，也不会自动入选。显式调用保留原有证据不足结果，不冒充分析完成。

每次 Skill 结果新增 capability：provider、defaultEligible、handler、deliverable 和 professionalJudgment。`bounded-handler` 只说明存在有界处理器；`complete` 不表示专业审阅或人工接受。IA、交互、内容、层级、规划、视觉 QA 六份契约说明自动检查范围与仍需的任务判断，并递增 manifest 版本。

体验审阅的完整方法快照保持可用，默认 first-read 从 18 项收敛到 6 项（产品审阅入口、IA、交互、层级、内容、可访问性）。Foundation、规划、学习、占位异常恢复与回归契约按需读取。新的诊断调用复用一个源码快照，避免每个处理器读取不同瞬间的仓库；品牌/模式方法仍按其需要包含设计文档。已完成结果不重跑，历史证据规则保持不变。

## 合并与归档

- 产品审阅入口复用 happyhands 的共享工作流，不另建 onboarding、审批或接受记录。
- IA/交互/文案/层级/一致性将线索汇入同一个 experience audit；fix/reuse 汇入同一个 experience decision。各自结果仍保留，不能合并掉争议或证据来源。
- 专项实现 intent 支持 polish、layout、animate、harden、distill、typeset、clarify、adapt、onboard、optimize、extract。选择已有 profile 的 intent 即可，例如 `designGuidance: {taste: "app-screen", intent: "typeset"}`；不新增一套 CLI。
- 默认先读选定专项，再 Polish 收尾。审阅仍是只读 Audit/Critique；不能由一个实现 intent 授权编辑。
- 旧 Taste、具体风格/素材/发布方法退出默认要求；仅显式任务按适用性读取。完整固定原文、许可证、适配器和显式兼容路线保留。
- 视频的 HappyHands 18 秒约束移至独立案例引用，不再混入每次视频任务的默认要求。

## 自进化使用现有发布机制

1. 在实际 Run 保留失败、误报、拒绝、原图、任务和具体方法引用；未知项不伪装成缺陷。提出项目局部候选，不因一次偏好升级成通用规则。
2. 改写实际契约/实现；保留失败样例和不应被修改的反例，补受影响回归。反例必须和失败样例不同。人工审阅它们是否真的覆盖该次改写，字段齐全不代表覆盖正确。
3. 执行现有 `pnpm regression`，用真实报告安排独立复核。已有发布流程仍核验报告与当前代码、案例、契约哈希，并重新执行回归；不能自己填写 passed。
4. 对已有 active release 的改动，发布时必须提供 evolution JSON。也可用 `--baseline VERSION` 指定一个已存的首次比较基线；有 active 时必须与它一致。没有历史基线的第一次发布只记录 baseline-only，不宣称发生了经证明的学习。
5. 继续使用 `pnpm expertise publish --version VERSION --report FILE --reviewer NAME --reason TEXT --change CHANGE.json`。记录必须覆盖所有变更契约的 old/new hash，新增/删除的一侧为 null；实现或入口/适配器变化另用 `$implementation`。失败样例、保留反例及受影响案例都必须在本次实际报告中通过。旧/新方法哈希、理由、反例及报告 evidenceHash 一并冻结。
6. 发布只生成不可变 release，不改变 active。负责人审阅后沿用现有 activate；失败沿用 rollback 和原有审计链。旧 release 仍可回滚。候选不可自动晋升，也不能覆盖失败历史。

记录形状（示意值不能作为实际发布数据）：

```json
{
  "baselineVersion": "1.0.0",
  "evidenceHash": "ACTUAL_CURRENT_REPORT_HASH",
  "changes": [{
    "id": "content-design-reviewer",
    "beforeHash": "ACTUAL_BASELINE_CONTRACT_HASH",
    "afterHash": "ACTUAL_CURRENT_CONTRACT_HASH",
    "reason": "收紧模糊标签启发式的准入边界",
    "observedFailure": "正确的 Continue 被当成缺陷",
    "preserveBehavior": "保留任务语义明确的 Continue",
    "failureCases": ["ACTUAL_FAILURE_CASE_ID"],
    "preserveCases": ["ACTUAL_DISTINCT_PRESERVE_CASE_ID"],
    "affectedCases": ["ACTUAL_RELATED_CASE_ID"]
  }]
}
```

发布证据覆盖除 product-design 契约之外的五份自有协议、实现与入口、厂商 source.json/适配器和锁文件；固定厂商内容仍由其 inventory 哈希检查。记录统一标记 qualityClaim: not-established：合成回归能阻止已知回归，不能证明模型审美改善。要声称真实任务质量改善，仍必须展示现有 Run 的真实前后原图、独立 QA 和人类最终判断。

## 检查范围

本次测试覆盖默认退出、显式兼容、错误 maturity、专项引用存在性、哈希/案例缺失与篡改、反例重用、发布不自动激活，以及已有体验审阅/诊断/发布链。测试中的 reviewer 是明确标注的合成身份，不是实际发布批准。

九个 contract-only 能力的专用分析器仍未实现，不能因这次治理改造声称补齐它们。宿主个人 Skill 安装目录不在产品默认路线内，本次不改动个人安装。
