# 工作台真实跨视图补证（#33 / #88）

本轮修复设计方向第 4 项及以后候选的恢复：选择后进入页面审阅，再返回方向，原先虽然保留 findingId，却把“其他诊断建议”重新折叠。现在根据恢复的选择展开对应分组。完整 Skills、OJO、Taste、Impeccable 未修改。

## 本轮实际证据

以 Creative OS `bc4eb5e` 为 before、PR #88 `0b72ce6` 为 after，分别从 Git 提交导出隔离源码并启动真实工作台。输入是未改写的 HappyClaw 历史 run `d9d0898d`，14 条真实诊断、原始菜单截图与代码差异；没有模拟 API、诊断、执行任务或 QA 结果。

1280×900、390×844，每端每版本 9 张视口原图，共 **18 组成对证据 / 36 张原图**：

- 初始方向、选择最后一项、进入页面审阅并选定手机 / 修改后 / menu-open。
- 从画布返回方向：before 保留选中身份但折叠不可见，after 展开可见。
- 报告及真实前后菜单对照、代码改动、返回同一页面截图、再次返回原方向。
- 另逐一检查四个 query 路由直达与刷新后的 run / view / language，无脚本错误、无页面横向溢出、无写请求；不声称刷新保留内存中的方向选择。

`tests/review-navigation-real-browser.mjs` 产生带 Git 版本、导出文件哈希、每步真实操作、URL、时间及 PNG SHA-256 的 `evidence.json` 和可打开原图的 `comparison.html`。输出目录必须不存在；失败尝试独立保留。验证末尾复查输入 manifest 及全部导出文件未改动，要求每个 before 状态有匹配 after。它针对这条已知回归，要求 before 复现隐藏、after 恢复可见，不是可随意套用的通过率工具。

复现时设置 `REVIEW_NAVIGATION_RUN` 为原始真实 run 目录、`REVIEW_NAVIGATION_EVIDENCE` 为新输出目录、`REVIEW_NAVIGATION_BEFORE` / `REVIEW_NAVIGATION_AFTER` 为完整 Git 提交，再运行 `node tests/review-navigation-real-browser.mjs`。需当前仓库依赖与 Chrome，真实记录须有超过三条诊断及 mobile/after/menu-open 证据。

本机证据：`verification/2026-10-16/multiroute/real-v5/`；前四次工具调试日志保留（诊断读取、归档输出大小、macOS 路径规范化、折叠内容身份读取），不当作产品通过。`fixture-v3` 是独立的 38 项阶段/设备模拟流程回归，不混入真实项目证据。修正了原 PR 回归中的 summary 多匹配与最后焦点 Tab 离开页面的错误断言。

## 验收边界

这是真实工作台的四个 query 路由，不能冒充 HappyClaw 四个业务页面。嵌入项目仍是历史证据；本轮没有修改其源码、复跑其业务操作或新增人工 Accept。视口图不是所有内部滚动区域；未检查浏览器前进/后退、登录态和未声明的异常路径。工作台界面与截取内容分层记录，不能把截图中的历史复核当作本轮复核。

本轮基础验证：361 项测试、14 项 Skills 回归、生产构建、38 项阶段/设备回归及上述真实浏览器验证通过。受限环境首次测试/构建被本机端口或共享缓存权限阻断，正式重跑记录单列。独立复核与合并状态以 #88 最新记录为准；本文件不提前宣布整体 UI 通过。

Project-specific historical case sections are excluded from this public source distribution.
