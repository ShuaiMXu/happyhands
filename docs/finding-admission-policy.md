# 问题录入与判断依据

用户决定，2026-10-31。适用于 Harness 诊断、实现和独立复核。此规则优先于通用设计 skill 的审美建议。

## 录入门槛

只录入明确的功能错误、可验证的无障碍问题、实际布局破损，或违反该项目已明确采用的设计约定的问题。必须说明实际观察、预期、差异、影响、复现方法和已排除的正常设计取舍。只有截图裁切、数字阈值、静态模式命中或模型高置信度都不充分。

缺少证据、仅属偏好或潜在优化的内容，不进入正式问题列表，不进入一键修复。可以在内部保留排除原因；不得把“未录入”表述为全站无问题。

## Skill 指向

每条问题引用实际使用的不可变 skill 快照路径、具体章节、行号和原文，并写明如何从该原则判断到当前错误。标明该条款是明确要求还是参考原则。宽泛原则本身不是缺陷证据；仍须有独立的功能、交互、测量或项目约定依据。

HappyHands 自有界面的用户规则不得自动应用到第三方项目。项目没有明确采用的字体、颜色、信息密度和组件偏好，不能作为修改理由。

## 判断记录

每条正式问题必须含 findingBasis：policyVersion、kind=defect、category、observed、expected、whyWrong、reproduction、alternativesChecked、skillRefs。category 仅允许 functional、accessibility、layout-break、explicit-contract。skillRefs 每项含 path、section、line、quote、application、authority（requirement 或 principle）。explicit-contract 还必须给出 projectContract；不使用虚构章节或不存在的引用。

## 复核边界

引用某张截图只说明它是诊断证据，不等于确认该页面有缺陷。未修改的页面作为回归对照，不能算修复成果。前后画面不同不等于改善；结构检查通过不等于视觉通过；模型通过不等于人工采纳。每个修复必须排除误报，说明改动收益和代价。不能为了显得工作量更多而改动合理的原设计。

## 本轮纠正

模型连接页的下一步说明与列表放松属于可选方案，用户认为原版更好，已从 riba 候选提交中撤回。MCP 页面源码与桌面、手机两组前后 PNG 完全一致，属于回归对照。原诊断和复核历史保留，不重写为已经确认的问题。
