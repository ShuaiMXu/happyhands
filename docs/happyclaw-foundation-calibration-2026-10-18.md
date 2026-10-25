# HappyClaw 当前主分支的 Foundation 校准

本轮使用独立克隆的 HappyClaw `2bffa88425c7f0c77b11a7c6b168d1448650b51a`，锁定安装和生产构建通过，采集生产预览。基线采集时目标仓库干净；随后发现的真实菜单语义问题在独立分支修复。没有沿用旧工作副本、补造用户批准或把结构盘点称为专业视觉通过。

## 真实发现

历史示例计划不再对应当前组件：Hero 等源码行号漂移，位置型 section 选择器缺少明确身份，截图渠道已采用 `tab` 角色，图片已重构为带 `data-shot` 的 figure，命令滚动区域也已进入 `CommandStep`。这些是计划与源码的实际不匹配，不是当前页面必然出现同样的 UI 缺陷。

新增 `examples/happyclaw-site/page-review-current-capture-plan.json`，保留全部 24 个状态、36 个设备组合。每个来源锚点重新核对当前源码；区域使用稳定 ID，截图按真实数据标识定位。菜单关闭按钮在打开后改名为“关闭菜单”，对应操作已经更新，并为开关增加实际展开属性与可见性终态断言。原历史计划保留原字节，不破坏旧版本重放。

## 尝试与证据

- `happyclaw-foundation-calibration-20261018`：确认计划过期后停止，保留两张实际原图及 SHA-256、停止原因。没有完成 capture 或接受记录。
- `happyclaw-foundation-calibration-20261018-v2`：真实采集 35/36，菜单关闭步骤因可访问名称变化失败，原失败保留。来源快照为 `4a4fa87dcfc2d50b4c2a0d5829de1acd65dec5cffb966268785ddce101bcc56a`，32 个来源文件，未截断，源码干净且与采集绑定。
- v2 实际输出 37 个 token、15 个组件、25 个资产候选；patterns 为 0，盘点为 partial，未批准 Foundation、未写入人工接受。

新的菜单终态完整复跑记录为 `happyclaw-foundation-calibration-20261018-v3`：36/36 状态成功，36 张实际原图，菜单开关的属性与可见性终态均通过；同一干净提交与上述来源快照再次匹配。该结果来自完整新采集，没有把前一轮的 35 项与补图相加。最终计划 SHA-256 为 `ec571764f740a3c1184677071be89621d8455efff10dc32d7860a3d7b748e020`。候选数量仍为 37 token、15 component、25 asset、0 pattern，Foundation 仍为 partial，judgment 为 null。

计划通过现有 schema、全部来源精确行锚点（基线和修复提交）及 24 状态身份/顺序、36 设备组合核对；历史计划的 Git blob 未变。现有 capture-state 测试 12/12 通过。以上不声称重新运行全部工程测试或远端付费 CI。

## 实际菜单缺陷与修复

基线菜单打开态的 axe 结果包含 `aria-allowed-role`：原生 `header` 被动态赋予 `dialog`。既有仅按 WCAG 标签筛选的检查未覆盖该规则。先在基线新增显式规则断言，实际复现失败；再将容器改为带 `banner` 的普通元素，打开时切换到 `dialog`，关闭时恢复 `banner`。样式、布局、资源和文案没有变化。

修复提交为 `1e7b1fb747960e0510dacbb1b27541598c202fab`，已随 [HappyClaw PR #10](https://github.com/ShuaiMXu/happyclaw-site/pull/10) 合并为 `3befc9b5bc6aa8d988e28de1dd820224341dd6a4`，两者代码树一致。生产构建通过；真实 Chrome 在 320/390px 检查菜单角色、焦点循环、Escape、锚点导航、窗口尺寸变化、页面交互与滚动恢复。另完成 320/390/768/1280px 的页面、渠道切换、剪贴板成功/失败、键盘操作和共享组件对齐检查。用于读取导航几何的测试改为稳定 `.site-header` 选择器，原有几何断言保留。

v3 已通过正常诊断与计划接口记录实际规则问题，范围仅限上述菜单修复；没有写入人工 Accept。修改后同样完成 36/36 状态，但专项证据绑定因基线没有采集时保存的 `verificationOriginalHashes` 而拒绝，未进入独立模型 QA。旧图不能事后补造采集时哈希，因此另建固定基线预览和新记录 `happyclaw-menu-role-20261018-v4`，两阶段均通过原有采集边界绑定完整源码、预览响应及原图。

v4 前后各 36/36 成功，72 张主原图、两张专项图、源码/预览及导出均通过持久绑定核对。首次跨区域 QA 因 Skill 范围原图漏交接返回 needs-evidence；Harness PR #117 修复后，完整新独立 QA 的七个区域和跨区域会话均 pass、零 finding，4/4 概览上下文完整。历史拒绝、首次 needs-evidence、来源提交与原图保留。最终会话实际输入和边界见[范围原图交接记录](qa-skill-scope-originals-2026-10-18.md)。这是已确认菜单修复的真实闭环，未写人工判断，未批准 Foundation，也没有重写旧采集的品牌声明。

## 尚未通过的验收

当前 `DESIGN.md` 确实包含颜色、字体、布局、组件、例外与设计方法说明，完整文档已进入版本化提取；本例采集时的 0.9.0 提取器只识别原有精确标题/标签，因此其不可变结构化声明数为 0、类别全部保留缺失。PR #116 的新解析器已在只读来源核对中识别七条视觉声明，但不回填本例或宣称它们已逐条进入本次 QA；详见[设计章节声明提取](design-document-declarations-2026-10-18.md)。不能从旧结果推断产品没有设计规范，也不能将文档中偶然出现的文字自动批准为品牌原则。

Project-specific historical case sections are excluded from this public source distribution.
