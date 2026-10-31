# 工作台逐页组件覆盖

2026-10-31。本轮替换 HappyHands 自有页面的组件实现，不改被审项目、原始截图和 tldraw 内部控件。检查结果与整页视觉验收分开记录。

## 来源与实现

官网来源：`happyhands-site` 提交 `2c4e0a0eb379b4d1225b8cf39b835eb918abf978`，`packages/ui/shadcn` 与 `adaptations.css`。沿用 radix-luma token、12px 普通控件和16px浮层；18px复选框/5px圆角是官网复选框的独立角色，不把小型勾选标记改成普通按钮的12px圆角。

| 组件 | 核心实现 | 替换方式 |
| --- | --- | --- |
| Button / Input / Textarea / Label | `packages/ui/controls.js`、`controls.css` | 官网这些组件本身使用原生元素。DOM 页面统一从共享工厂创建；静态模板使用同一属性/变体适配器。保留原节点、事件和表单语义，不声称所有页面已改写为React。 |
| Fieldset / Legend | 同一共享工厂 | 保留语义分组与禁用逻辑，去掉浏览器默认框线，统一文字和间距。 |
| React 自有控件 | `packages/ui/react-controls.jsx` | 旧画布自有按钮、Label、Textarea直接引用共享组件，受控Select/Checkbox使用Radix回调；不通过DOM桥接接管React的复选状态。 |
| Select | `packages/ui/select.jsx`、`apps/designer/select-control.js` | 实际Radix Select 2.4.1；保留原生模型及input/change事件。弹窗内Portal置于当前Dialog子树。 |
| Checkbox | `packages/ui/checkbox.js` | 实际Radix Checkbox 1.4.1；Indicator与官网一致。DOM表单保留隐藏模型、required、disabled、半选、reset、FormData和业务事件。 |
| Dialog | `packages/ui/dialog.js` | 实际Radix Dialog 1.3.1的Root/Portal/Overlay/Content/Title。已有内容、监听器和showModal/close/cancel调用保留；Radix负责焦点约束、Esc、背景隔离和焦点归还。静态原图弹窗也转换；不再只是美化原生dialog。 |
| 导航 / 折叠 | 共享Button与现有原生details | 导航是路由/操作，不伪装成Tabs；官网也有原生details组合。独立折叠保留语义，不为引入库额外制造Accordion。侧栏箭头按用户要求隐藏。 |

总入口是 `packages/ui/workbench.js`。安装有文档级去重；静态入口与动态插入都经过同一边界。隐藏模型使用明确标记，避免旧CSS让原生控件再次露出。未修改目标网页iframe、截图像素、tldraw自带工具或系统文件选择器。

## 页面与入口

| 页面/区域 | 接入及检查 |
| --- | --- |
| 页面审阅 / 问题列表 | 主入口共享安装；动态界面统一工厂，截图、筛选、问题与主动作保留原流程。 |
| 代码改动 / 真实补丁 | 同一入口；文件选择器为Radix，补丁仍是平面文档。隔离导出案例验证补丁分支。 |
| 代码空态 | 共享Button，不渲染画布工具；返回页面审阅路径保留。 |
| 旧报告链接 | 保留案例并转入当前审阅；最终落地页检查组件，而非截取跳转前中间态。 |
| Foundation与版本治理 | `main.js`、`foundation-review.js`相关自有DOM经过工厂；阶段浏览器检查覆盖bootstrap入口。没有新增批准决定。 |
| 项目与任务 / 连接 / 预览和设计方法 | 共用Radix Dialog与表单组件；只读、重连和高级字段保留。 |
| 人工复核 / JSON导入 / 引用批注 / 项目历史 | 同一组件；搜索、复核类型、勾选、动态问题和轮询保留状态，复核/原图校验边界不变。 |
| 补充采集范围 / 最终决定 / 缺证据处理 | `planning.js`与`review-action.js`使用共享Dialog；不增加新的执行入口。 |
| 原图灯箱 | 静态dialog在业务监听器绑定前转换到同一Dialog；原图路径与图片不改。 |
| 旧画布批注 / 创作面板 | React直接引用共享组件；实际浏览器验证Select与确认Checkbox控制禁用状态，全程没有提交任务。第三方编辑器内部不迁移。 |
| 独立设计方向页 | 同一入口；本地旧记录控件接入，带run参数的兼容跳转保留。 |
| 旧Portal / Web入口 | 同一组件入口处理现有按钮/字段；不是官网独立仓库的重写，也没有借此改旧页面内容。 |
| 根入口 | 现有重定向，无重复组件实现。 |

20个DOM构建模块已改用共享工厂。原有模板/静态HTML使用同一安装器；以后新增字段也需经过这条边界，不要再在页面另建控件样式和菜单行为。

## 验证

- `tests/workbench-components-browser.mjs`：20组检查通过。使用隔离案例、真实Chrome及测试接口，不提交真实诊断/批准/源码修改/PR。覆盖必填、半选、禁用、reset、FormData、长选项、键盘、内外层Esc、焦点约束、焦点归还、取消关闭与重复打开，以及每个入口的遗留控件扫描。
- `tests/review-actions-browser.mjs`：38组阶段/设备检查通过，覆盖只读、重连、Foundation、修复、独立复核、最终判断和测试草稿PR保护路径。它们是确定性测试，不代表产品已被人工接受。
- 实际历史展示数据上的人工表单桌面/手机、浅深色验证：28条引用保留，搜索得到14条手机引用，搜索和切换类型不丢有效选择；复选框实际18px/5px，列表280px/220px且无溢出。
- 实际旧画布桌面/手机：受控选择和勾选正确启用/禁用动作，没有提交任务或改被审项目。
- `tests/project-memory-browser.mjs`：中英文生命周期、撤回、增量范围和不可信文本检查通过。隔离服务器显式预编译React依赖，未放宽原有行为断言。
- 完整单元测试613通过、0失败、1跳过；设计约定检查与构建通过。开发环境保留字体公共路径提示和既有上游打包警告，没有把提示写成远端CI通过。

本文件记录组件实现与交互覆盖。此前原生Harness整页视觉复核仍缺完整内部滚动分段证据，本轮不把上述测试或截图数量冒充该验收通过。没有发布、合并、部署或新增人工接受记录。
