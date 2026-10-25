# Creative OS 画布引擎调研

日期：2026-09-30

## 结论

不建议继续把当前 tldraw 画布加工成 Figma 式编辑器。它适合白板和批注，但不是界面设计工具；当前 SDK 在生产环境还需要有效许可证，未授权部署会保留许可提示。

推荐先做 **OpenPencil 嵌入式验证**，把它作为 Creative OS 的页面编辑引擎；评论暂时由 Creative OS 自己存储，并锚定到 OpenPencil 节点。若验证中发现中文渲染、稳定性或 React/Vue 共存成本不可接受，则改用 **Penpot 独立服务 + Creative OS 插件/API**，不采用非官方 iframe 强行嵌入。

## 候选比较

| 方案 | Figma 式界面编辑 | 原生评论 | 可直接嵌入 | AI / 源码联动 | 许可证 | 判断 |
| --- | --- | --- | --- | --- | --- | --- |
| OpenPencil | 强：图层、组件、变量、自动布局、属性面板 | 尚未完成 | 强：Vue SDK 和底层 core | 强：HTML/CSS 导入、JSX/Tailwind 导出、CLI、MCP | MIT | 首选验证 |
| Penpot | 强：成熟的设计、原型、Inspect 和设计令牌 | 强：评论气泡、回复、隐藏/显示 | 弱：完整服务，不是可直接安装的 React 组件 | 强：Open API、插件、Webhook、MCP | MPL-2.0 | 稳定备选，适合作为独立服务 |
| Excalidraw | 弱：更接近手绘白板 | 无成熟的设计审阅评论模型 | 强：官方 React 组件 | 中：可读写场景数据，但缺少真实 UI 图层语义 | MIT | 接入容易，但解决不了核心问题 |
| BlockSuite Edgeless | 中：白板、富文本、Frame | 不属于 Figma 式设计评论 | 中：Web Component | 中：可定制 block，但不是页面设计模型 | 开源 | 更适合文档白板 |
| tldraw（当前） | 弱：白板模型 | 需要自行实现 | 已接入 | 中：快照和形状 API 可用 | 生产需许可证 | 不再扩展为核心设计工具 |

## 为什么首选 OpenPencil 验证

OpenPencil 的文档模型是可查询、可修改的节点树，不只是截图上的绘图层。它能把 HTML、CSS 和 Tailwind 导入为可编辑设计文档，也能导出 JSX、Tailwind、HTML、SVG 和图片。这与 Creative OS 的目标一致：用户选中实际界面节点，AI 获取节点、布局、样式与代码上下文，再修改被审阅项目源码。

它提供 `@open-pencil/vue` 嵌入 SDK，以及 `@open-pencil/core`、场景图、DOM/CSS 导入、CLI 和 MCP 包。当前工作台是 React，因此建议把编辑器做成隔离的 Vue island 或独立前端入口，通过明确的消息协议与工作台通信，避免把两套响应式运行时混在同一组件树中。

主要风险也很清楚：项目仍处于活跃开发阶段；官方路线图仍在补齐中文和其他非拉丁文字可靠性、嵌入示例、API 稳定性与评论功能。评论快捷键目前还未实现。因此不能直接全量替换，必须先通过真实项目验证。

## Penpot 的正确接入方式

Penpot 已经具备最接近 Figma 的完整体验，评论工具可直接在画布上放置气泡，并支持回复、显示和隐藏。它也有设计令牌、Inspect、代码片段、Open API、Webhook、插件和官方 MCP。

Penpot 适合自托管为独立服务，由 Creative OS 创建项目、同步审阅状态并跳转到具体文件；也可以写 Penpot 插件，把“交给 AI 修改源码”“打开审阅报告”等 Creative OS 操作放进 Penpot。官方没有稳定的编辑器嵌入组件，iframe 方案依赖跨域 Cookie 和非正式 CORS 配置，不应作为产品架构。

## 推荐的验证范围

1. 从一个真实被审阅页面提取 HTML/CSS，导入 OpenPencil 为可编辑节点树。
2. 在全屏画布里选中一个按钮、文本或容器，读取节点 ID、层级、尺寸、布局和样式。
3. 用 Creative OS 自己的评论层把评论锚定到节点 ID，并保存矩形坐标作为回退信息。
4. 把节点差异、评论、原始页面和仓库绑定信息发送给现有隔离源码修改流程。
5. 修改完成后重新采集页面，显示真实前后差异并保留人工判断。
6. 验证中文字体、Windows Edge、撤销重做、保存恢复和大页面性能。

只有以上六项全部通过，才删除 tldraw 画布。验证期间现有审阅报告和源码修改流程保持不动。

## 第一轮技术验证结果

已新增隔离入口 `apps/designer/openpencil/`，没有替换当前画布。第一轮已验证：

- CanvasKit 在 Windows Edge 中可以启动，页面节点、选择框、移动和缩放可正常渲染。
- 直接点击页面元素可以取得 OpenPencil 节点 ID、名称、类型和尺寸。
- Creative OS 批注可以绑定到选中节点，并在本地持久化；删除和数量同步正常。
- 页面内容使用英文，工作台外壳使用中文，避免单一界面内中英文混排。
- 生产构建通过；OpenPencil `0.15.1` 发布包的 worker 路径需要一个局部 Vite 兼容补丁。

当前不能正式替换。最终合并审查发现 OpenPencil `0.15.1` 传递依赖的 `expr-eval <=2.0.2` 存在代码执行漏洞，且 npm 尚无公告所称的安全版本；独立入口和运行时依赖已从主线 PR 移除。本文保留为历史评估，未来只有在上游提供可审计的安全依赖链后才重新验证。真实页面 HTML/CSS 导入、中文画布字体、批注转源码任务和保存恢复也仍未闭环。

## 参考资料

- [OpenPencil 项目与 MIT 许可证](https://github.com/open-pencil/open-pencil)
- [OpenPencil Vue SDK](https://openpencil.dev/programmable/sdk/)
- [OpenPencil 路线图与兼容性矩阵](https://openpencil.dev/development/roadmap)
- [Penpot 自托管](https://penpot.app/self-host)
- [Penpot API、插件、Webhook 与 MCP](https://penpot.app/integrations-api)
- [Penpot 评论](https://help.penpot.app/user-guide/account-teams/comments/)
- [Penpot 集成指南](https://help.penpot.app/technical-guide/integration/)
- [Excalidraw React 组件](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/README.md)
- [BlockSuite Edgeless Editor](https://blocksuite.io/components/editors/edgeless-editor)
- [tldraw SDK 许可证](https://tldraw.dev/community/license)
