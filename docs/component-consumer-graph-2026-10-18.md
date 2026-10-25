# 组件引用与影响链

继续 #29。旧实现用正则寻找 import/from/require 文本，可能把注释或字符串示例当成引用，也只能找到直接消费者。

本轮使用已锁定的 TypeScript 解析器读取 JS/TS 模块、Astro frontmatter 和 HTML/Vue/Svelte script 内容。保留来源文件、行号、引用形式和解析目标，不执行目标代码。注释、字符串示例、type-only import/export 不计入运行时模块引用。相对路径只在当前源码快照内解析，支持明确文件、扩展名、目录 index 和 JS 指向 TS 源文件；缺失、多个候选、别名/外部依赖和动态表达式保留为未解析记录。

直接引用存入 consumerEvidence；潜在消费者存入 potentialConsumers，包含一条可复查的路径。循环去重，最多 32 层和 256 个潜在模块，超限显式标记 consumerGraphTruncated。经由中间导出模块的路径只证明模块依赖，不能证明特定导出被渲染。CommonJS require 仍需核对绑定。不会根据路径自动扩大人工确认的采集范围，也不会将关联页面标记已审阅。

提取版本与 component-inventory Skill 升至 0.5.0。引用路径、未解析项和截断状态进入提取产物、修改 brief 和新旧 diff；历史产物不重写。原生 HTML 的 script 引用候选保留。修正一项测试夹具，将裸 Astro import 放回真实 frontmatter，而非容忍无效源码。

## 真实核对

HappyClaw `2bffa88425c7f0c77b11a7c6b168d1448650b51a`，只读扫描：

- BrandMark：Footer、Header、Hero，均为第 2 行引用；可追至首页。
- GitHubIcon：Header、Hero，均为第 3 行引用；可追至首页。
- ScreenshotFigure：ScreenshotShowcase 第 3 行引用；可追至首页。

与实际源码逐项核对一致。外部包和验证脚本动态加载保留未解析状态；不冒充整个仓库无未知依赖。报告留在本地 `.harness/verification/happyclaw-components/consumer-graph.json`。

## 剩余范围

最终验证：396/396 单元及集成测试、14/14 Skills 回归、生产构建通过。涵盖正向路径、注释/类型误报、缺失/歧义、动态表达式、循环与深度超限。远端 CI 按用户要求暂缓，不声明远端执行通过。

该轮 0.5.0 尚缺项目别名配置。后续 0.6.0 已补齐快照内 tsconfig/jsconfig 别名与局部继承/项目引用，详见 [别名解析记录](component-path-aliases-2026-10-18.md)。包配置/构建器集成、逐符号 re-export、框架运行时 Props/slot 绑定、动态组合、真实路由与状态影响仍需继续实现或明确复核。模块图不是运行时组件树，现有 28 张实例证据和人工治理要求不变。#29 保持开放。
