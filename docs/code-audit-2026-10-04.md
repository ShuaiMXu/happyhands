# 代码扫描：实际能力与待办重排

范围：本地 integration/page-review-foundation，b174b85；包含未合并 PR，不能等同于 main 已上线。本轮读取应用入口、工作台服务、Harness 状态机/诊断/评估、Skill 执行与提取、版本发布、项目记忆及增量计划；不是逐文件安全审计。未修改业务代码，未重跑全部测试。

## 优先处理

1. 自动整页 QA 容量不匹配（packages/workbench/ai-review.js:14-15）。8 区域 × 2 设备 × 前后 = 32 张，当前超过 24 就抛错。应做分批独立复核与汇总，不能只删截图或提高上限后宣称完整分析。
2. 增量 Skill 路由漏检（packages/harness-core/incremental.js:19-27）。所有路径拼为多行后用无 multiline 的 `$` 匹配扩展名。实际复现：['src/a.css','src/b.txt'] 只得到 accessibility/responsive；仅 ['src/a.css'] 才得到 contrast/drift/hierarchy。应逐文件匹配并覆盖顺序变化测试。
3. Expertise 激活没有影响运行（packages/skill-core/releases.js:47-56；packages/skill-core/runner.js:14；packages/workbench/service.js:88）。active.json 仅写入，没有执行路径消费；运行仍读取当前 registry，release 只记录 hashes，没有可执行旧版快照。当前 rollback 是指针审计，不能称实际能力回滚。
4. 默认诊断不是完整模型视觉诊断（packages/workbench/service.js:85-95；packages/skill-core/handlers.js；packages/skill-core/runner.js）。默认执行四个 JS handler，视觉层级读 DOM，模型新会话用于 after QA。真实案例外部模型记录不等同于默认接入链自动模型诊断。需明确结构检查/静态候选/模型判断的来源。

## 实现不完整的能力

5. 增量只选 Skills，仍完整 capture(config)，没有状态子集或组件到路由映射（service.js:103-113）。也只拿父 run 已记录 changedFiles，未比较当前 repo 与基线的新 diff；不能作为任意新修改的增量影响分析。
6. 项目记忆可提案、审核、列出，但未见诊断/执行 brief 消费已批准记忆；撤销也没有实现，review 文件 wx 只允许一次（packages/workbench/memory.js；service.js:255-260）。
7. Foundation 有 CSS 声明、alias/冲突保留和人工冻结；componentInventory 主要按 components/ui 目录及正则扫描 exports/imports，没有可靠 props/variants/slots/composition graph。品牌主要是资源引用和最多20个文案样本，不能当完整品牌策略（handlers.js:325-392）。
8. 页面审阅一次读取 state，不主动跟随后台任务更新；live URL 不绑定版本，不重放所选状态，问题没有区域过滤/可靠源码定位（apps/designer/page-review/index.js）。部分限制已诚实显示，但仍属于未接通能力。
9. 官网只有一个静态页面，仍导入 designer/style.css；没有独立 how-it-works/pricing/case 页面或 Review 表单（apps/web/index.html；vite.config.js）。Portal 是代理说明和 token 演示，不是项目管理 dashboard。

## 已存在的基础

真实 run 存储/契约、人工范围闸门、隔离执行、前后捕获、结构评估、独立 QA 记录、判断保存、只读导出回放、Foundation 审批、Skill 来源哈希、OJO 固定指导快照已存在。应优先补调用链和真实性，不按 issue 标题重复开发。

## 建议次序

先修增量漏检和整页 QA 批次；再接默认模型诊断与区域证据；随后做真实可执行发布快照/回滚、记忆消费和实际 Git diff 增量路由；最后完善 Foundation 提取、管理面与官网。保持独立人工验收。
