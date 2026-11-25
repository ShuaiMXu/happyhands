# HappyHands 工程入口

## Quick Links

- [Design Language](DESIGN.md)
- [Current work](docs/next-steps.md)
- [Architecture](docs/architecture.md)
- [Harness guide](docs/harness.md)

## UI work

先读 DESIGN.md，再读取该次修改涉及的组件、样式和现有设计文档。维护设计文档用工程本地 design-md；实现或审阅 UI 可用工程本地 frontend-design，但项目约定、用户明确决定及批准的 Foundation 优先于通用建议。

只修改用户确认的范围。不因记录设计语言迁移框架、重写旧页面或批准观察值；需要新方向时提出建议，不伪造批准。被审项目的设计规范独立于本工作台壳层，不能复制工作台 token 充当目标品牌。

验证命令来自 package.json：设计文档/skill 校验使用 pnpm design:check，生产构建使用 pnpm build；行为修改再运行相关测试。远端 CI 未执行不得写成通过。不要提交本地 .harness 证据、临时 verification 文件或用户私有素材。

维护 Harness 时，先明确本轮问题和完成条件，完成范围内的修改后再开始最终验证。验证期间保持待验版本稳定，新发现的独立问题记入交接。检查正在运行时等待同一任务完成。若失败，定位原因，修正后重跑受影响的检查。当前版本满足既定要求就交付。扩大到全仓回归应有具体依据，例如项目要求或改动影响了共享路径。

## Evidence-first review

遵守 [问题录入与判断依据](docs/finding-admission-policy.md)。正式问题必须有实际缺陷证据、具体 skill 快照指向和判断链。宽泛建议、未验证猜测与主观偏好不进入问题清单或自动修复。保留原诊断和排除原因，不能把未修改页面的回归对照当作修复成果。
