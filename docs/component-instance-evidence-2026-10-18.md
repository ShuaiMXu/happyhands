# 组件实例与截图状态证据

继续推进 #29。已有区域采集可以定位源码文件，但不能据此证明父区域内每个组件、变体和交互状态都已复核。

## 本轮实现

现有 Capture Plan 的 `region` 增加可选 `instance`：实例 id 和明确的变体属性。声明实例时必须填写 `source.component`，且变体名称/属性不能重复。沿用现有来源绑定、动作、双端配置与原始截图，不增加另一条执行流程。

采集器在截图前后核对：唯一根元素、根元素自身的源码 anchor、完整视口可见范围、祖先透明/裁切、中心遮挡、变体属性、焦点/悬停/禁用/选中等 DOM 状态、主要计算样式和位置。前后变化、父容器借用子元素 anchor、变体不符、多个匹配或不可见时，不保存有效实例证据。

设计系统提取结果保留这些具名实例、设备、原图和同选择器终态断言。来源 hash 或实例身份不符的记录不计入实例证据。已有区域截图保持原有含义；新增状态为 `partial-instance-evidence`，继续列出剩余实例、变体和适用交互状态，不自动升级为完整覆盖或视觉 pass。修改 brief 和组件复用 Skill 提醒 AI 主动提出受影响实例的采集需求，仍须走现有范围确认/新基线流程。

示例：

```json
{
  "selector": "#save",
  "source": { "file": "src/components/Button.tsx", "line": 12, "anchor": "data-component=\"Button\"", "component": "Button" },
  "instance": { "id": "save-button", "variants": [{ "name": "tone", "attribute": "data-tone", "value": "primary" }] }
}
```

示例属性必须真实存在并与源码对应，不能为了通过检查注入标记。DOM 属性观察不能证明框架 Props 的运行时绑定；没有可靠绑定时保持缺证据。

## 验证与边界

最终版本：389/389 单元及集成测试、14/14 Skills 回归、生产构建通过。真实 Chrome 检查命令为 `node tests/component-instance-browser.mjs`，结果通过。GitHub CI 付费阻塞按用户要求暂缓，不报告远端通过。

尚需真实产品中适用的实例/变体矩阵、框架消费者映射及独立视觉复核。对复杂裁切、遮罩或过滤效果，中心遮挡与矩形检查不是像素级可见性证明；保留原图供复核，不宣称全组件覆盖。#29 保持开放。


Project-specific historical case sections are excluded from this public source distribution.
