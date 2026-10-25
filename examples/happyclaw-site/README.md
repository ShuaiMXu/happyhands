# HappyClaw 审阅示例与版本

历史 `page-review-capture-plan.json` 保留原样，用于对应旧源码的重放。不要把它直接套到当前主分支：组件拆分、源码行号、截图渠道的可访问角色和图片节点已经变化。

`page-review-current-capture-plan.json` 对应已核对的 HappyClaw `2bffa88425c7f0c77b11a7c6b168d1448650b51a`。它保留 24 个状态、36 个设备组合，使用当前源码的精确锚点与稳定区域 ID，截图渠道按 `tab` 操作，图片按实际 `data-shot` 标识定位，命令滚动指向克隆命令的真实 `pre`。菜单打开和关闭分别核对 `aria-expanded` 与菜单可见性。源码改变后，应重新核对这些位置，不自动改写历史记录或放宽来源验证。

接入时在自己的 Project Config 中填写实际仓库、Experience Spec、预览命令与 URL，并将 `capturePlan` 指向当前版本计划。示例文件中的旧仓库路径、项目描述与版本不能替代当前项目事实。构建、预览和采集必须使用同一份源码；当前项目的默认采集 URL 仍为 `http://127.0.0.1:4321/`，更换端口时应同时更新计划中的入口。

实际校准记录见 [HappyClaw 真实 Foundation 校准](../../docs/happyclaw-foundation-calibration-2026-10-18.md)。采集成功仅证明声明状态可达和原图已保存，不代表品牌规范、交互全部状态、专业视觉质量或用户接受均已通过。尤其不能把父区域截图当成所有子组件的实例/变体覆盖。
