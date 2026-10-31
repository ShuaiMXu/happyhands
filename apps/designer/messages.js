// Interface copy only; imported evidence is retained verbatim.
export const messages = {
"查看原图": ["查看原图", "Open original"],
"已查看的截图": ["已查看的截图", "Screenshots reviewed"],
"搜索页面或设备": ["搜索页面或设备", "Search pages or devices"],
"搜索待复核截图": ["搜索待复核截图", "Search review screenshots"],
"待复核截图": ["待复核截图", "Review screenshots"],
"没有匹配的截图": ["没有匹配的截图", "No matching screenshots"],
"${0} / ${1} 张已确认": ["${0} / ${1} 张已确认", "${0} / ${1} confirmed"],
"设计规范来源（仓库相对路径，每行一项）":["设计规范来源（仓库相对路径，每行一项）", "Design sources (repository-relative paths, one per line)"],
"已收到官网携带的项目与设计来源。确认后才会读取源码和开始采集；不会自动批准设计规范或修改代码。":["已收到官网携带的项目与设计来源。确认后才会读取源码和开始采集；不会自动批准设计规范或修改代码。", "Project and design sources received from the website. Confirm before reading source and capturing pages. This does not approve design rules or edit code."],
"无法接收官网资料，请确认已启动新版本地工作台。":["无法接收官网资料，请确认已启动新版本地工作台。", "Could not receive the website handoff. Start the updated local workbench first."],
"来自官网的本次审阅":["来自官网的本次审阅", "This review started on the website"],
"项目设计来源已绑定到这份运行记录，仍需正常确认规范、修改范围和最终结果。":["项目设计来源已绑定到这份运行记录，仍需正常确认规范、修改范围和最终结果。", "Design sources are bound to this run. Rules, edit scope and the final result still need the usual confirmation."],
"本次结果记录":["本次结果记录", "This result record"],

  'Independent Visual QA found an unresolved regression. Reject or submit new counter-evidence for independent re-review.':['独立复核仍有未解决的问题。可记录拒绝，或提交新反证申请独立重审。','Independent Visual QA found an unresolved regression. Reject or submit new counter-evidence for independent re-review.'],
  '反证对应的原始截图':['反证对应的原始截图','Original screenshot for counter-evidence'],
  '或上传新的 PNG 反证':['或上传新的 PNG 反证','Or upload new PNG counter-evidence'],
  '反证必须是小于 12 MB 的 PNG 图片':['反证必须是小于 12 MB 的 PNG 图片','Counter-evidence must be a PNG under 12 MB'],
  '无法读取反证图片':['无法读取反证图片','Cannot read counter-evidence image'],
  "处理复核问题": ["处理复核问题", "Resolve review findings"],
  "核对未解决的问题：记录拒绝，或提交新的反证申请独立复核。通过后再由你决定是否接受。": ["核对未解决的问题：记录拒绝，或提交新的反证申请独立复核。通过后再由你决定是否接受。", "Review unresolved findings: reject, or submit new counter-evidence for independent review. Decide whether to accept only after it passes."],
  "提交反证重新复核": ["提交反证重新复核", "Request review with counter-evidence"],
  "选择新的补充证据": ["选择新的补充证据", "Select new supporting evidence"],
  "请选择新的补充证据": ["请选择新的补充证据", "Select new supporting evidence"],
  "反证需说明操作方法、实际结果和限制；原失败记录会保留，新复核通过后再由你判断。": ["反证需说明操作方法、实际结果和限制；原失败记录会保留，新复核通过后再由你判断。", "State the method, actual result and limitations. The failed review is retained; decide after a new independent review."],
  "先在页面审阅中保存新的补充证据，再申请重新复核。": ["先在页面审阅中保存新的补充证据，再申请重新复核。", "Save new supporting evidence in page review before requesting another review."],
  "已根据新反证独立复核，原失败记录保留；这不代表人工接受。": ["已根据新反证独立复核，原失败记录保留；这不代表人工接受。", "Independently re-reviewed with new counter-evidence. The original failure is retained; human acceptance is still separate."],
  "查看反证与逐项复核结论": ["查看反证与逐项复核结论", "View counter-evidence and finding resolutions"],
  "resolution-supported": ["问题仍成立", "Still supported"],
  "resolution-refuted": ["已由反证排除", "Refuted by evidence"],
  "resolution-needs-evidence": ["仍需证据", "More evidence needed"],
  "查看反证原图": ["查看反证原图", "Open counter-evidence image"],

  "{0} candidates reviewed: {1} approved and {2} deprecated \u00b7 {3} deferred. The decision considered {4} scanned source files and {5} extraction findings.": ["已审阅 {0} 项候选：{1} 项批准、{2} 项弃用、{3} 项暂不纳入。依据包括 {4} 个源码文件及 {5} 项提取发现。", "{0} candidates reviewed: {1} approved and {2} deprecated · {3} deferred. The decision considered {4} scanned source files and {5} extraction findings."],
  "暂不纳入本轮约束": ["暂不纳入本轮约束", "Defer for this review"],
  "{0} pending · {1} approved · {2} deprecated · {3} deferred": ["{0} 项待决定 · {1} 项批准 · {2} 项弃用 · {3} 项暂不纳入", "{0} pending · {1} approved · {2} deprecated · {3} deferred"],
  "{0} approved · {1} deprecated · {2} deferred": ["{0} 项批准 · {1} 项弃用 · {2} 项暂不纳入", "{0} approved · {1} deprecated · {2} deferred"],
  "审阅记录列表未能加载": ["审阅记录列表未能加载", "Review history could not be loaded"],
  "可继续查看当前案例，或重新读取记录。": ["可继续查看当前案例，或重新读取记录。", "You can view the current case or reload the records."],
  "重新读取记录": ["重新读取记录", "Reload records"],
  "查看加载详情": ["查看加载详情", "Show load details"],

 'Brand declaration comparison':['品牌声明与页面对照','Brand declaration comparison'],
 'Open declaration evidence':['查看声明来源','Open declaration evidence'],
 'brand-assessment-aligned':['所引用页面与声明一致','Aligned in cited evidence'],
 'brand-assessment-conflict':['所引用页面存在差异','Conflict in cited evidence'],
 'brand-assessment-not-visible':['原图中无法核对','Not visible in originals'],
 'brand-assessment-needs-evidence':['需要补充证据','More evidence needed'],
 'brand-assessment-out-of-scope':['不在本次范围','Outside this review scope'],
 'Declared brand intent':['文档中的品牌声明','Declared brand intent'],
 'Product promise':['产品承诺','Product promise'],
 'Target audience':['目标受众','Target audience'],
 'Brand voice':['品牌语气','Brand voice'],
 'Core terminology':['核心术语','Core terminology'],
 'Action language':['操作文案','Action language'],
 'Error language':['错误提示','Error language'],
 'Trust claims':['信任表达','Trust claims'],
 'Prohibited claims':['禁止表述','Prohibited claims'],
 'Visual language':['视觉语言','Visual language'],
 'Brand principles':['品牌原则','Brand principles'],
 'Source declarations are evidence, not approved rules. Differences may belong to different versions or platforms.':['文档声明仅作为证据，尚未批准为规则。差异可能来自版本或平台范围。','Source declarations are evidence, not approved rules. Differences may belong to different versions or platforms.'],
 'Conflicting declarations need review.':['不同声明需核对适用范围。','Conflicting declarations need review.'],
 'Undocumented categories':['尚无明确声明的类别','Undocumented categories'],
 '重新完整审阅':['重新完整审阅','Start a full review'],
 '正在建立完整审阅记录…':['正在建立完整审阅记录…','Creating a full review…'],
 '本轮采集状态':['本轮采集状态','States captured in this review'],
 '未纳入本轮复查':['未纳入本轮复查','Not reviewed in this run'],
 '本轮按已声明的入口依赖采集关联状态。其余页面未复查，不代表没有问题。':['本轮按已声明的入口依赖采集关联状态。其余页面未复查，不代表没有问题。','This run captures states linked through declared entry dependencies. Other pages remain unreviewed, not problem-free.'],
 '源码关联的页面状态':['源码关联的页面状态','Page states linked by source'],
 '可能受影响':['可能受影响','Potentially affected'],
 '影响范围待确认':['影响范围待确认','Impact not established'],
 '依赖关系用于定位可能受影响的页面，不能证明其他页面无需复查。':['依赖关系用于定位可能受影响的页面，不能证明其他页面无需复查。','Dependencies identify potentially affected pages; they do not prove other pages can skip review.'],
 '页面与交互分段原图':['页面与交互分段原图','Page and interaction original parts'],

 '交互分段原图':['交互分段原图','Interaction sequence originals'],

 '页面概览与内部区域':['页面概览与内部区域','Page overview and internal surfaces'],

  '页面概览与内部区域复核':['页面概览与内部区域复核','Page overview and internal surface review'],
  '页面证据 {0}/{1} 已采集':['页面证据 {0}/{1} 已采集','Page evidence {0}/{1} captured'],
  '部分页面或设备缺少页面概览或内部区域证据。请补齐后重新审阅。':['部分页面或设备缺少页面概览或内部区域证据。请补齐后重新审阅。','Some pages or devices lack overview or internal surface evidence. Capture them before reviewing again.'],
  '内部滚动区域原图':['内部滚动区域原图','Internal scroll surface originals'],

"选择此区域全部分段": ["选择此区域全部分段", "Select every segment in this area"],
"scroll-surface": ["内部滚动分段", "Internal scroll segment"],
"内部滚动分段": ["内部滚动分段", "Internal scroll segment"],
"仅记录当前可见范围，不代表整页或组件状态通过。": ["仅记录当前可见范围，不代表整页或组件状态通过。", "Records only the visible interval; it does not approve the whole page or component states."],
"滚动分段未采集成功，请查看失败原因。": ["滚动分段未采集成功，请查看失败原因。", "Scroll segment capture failed; inspect the recorded reason."],
"查看采集位置与最终状态": ["查看采集位置与最终状态", "Capture position and final state evidence"],
"内部滚动区域会列出分段候选。长页面可按设备分次采集；超限不会自动丢弃证据。": ["内部滚动区域会列出分段候选。长页面可按设备分次采集；超限不会自动丢弃证据。", "Internal scroll areas have explicit segment candidates. Long pages can be reviewed per device; limits never silently discard evidence."],
"查看来源、依赖与覆盖缺口": ["查看来源、依赖与覆盖缺口", "Sources, dependencies and coverage gaps"],
"本项判断原因": ["本项判断原因", "Reason for this decision"],
"查看未生效的原始复核": ["查看未生效的原始复核", "Review record not in effect"],
"这份记录未通过当前证据校验，不能作为本轮通过结论。": ["这份记录未通过当前证据校验，不能作为本轮通过结论。", "This record did not pass the current evidence checks and cannot serve as a passing verdict."],
"打开原始截图": ["打开原始截图", "Open original screenshot"],
"专项截图": ["专项截图", "Verification screenshot"],
"本轮审阅结果": ["本轮审阅结果", "Review results"],
"先看复核结论，再查看前后变化与证据。": ["先看复核结论，再查看前后变化与证据。", "Read the verdict, then compare the changes and evidence."],
"查看完整流程记录": ["查看完整流程记录", "Full process record"],
"前后变化": ["前后变化", "Before and after"],
"查看结构检查与执行记录": ["查看结构检查与执行记录", "Structural checks and execution record"],
"查看原始问题、项目背景与修改任务": ["查看原始问题、项目背景与修改任务", "Original findings, project context and change plan"],
"对照页面与设备": ["对照页面与设备", "Compare page and device"],
"存在缺失证据": ["存在缺失证据", "Evidence missing"],
"一次对照一个状态，所有原始截图仍可切换查看。": ["一次对照一个状态，所有原始截图仍可切换查看。", "Compare one state at a time. All original captures remain available."],
"审阅面板": ["审阅面板", "Review panels"],
"问题与复核": ["问题与复核", "Findings and review"],
"选择页面，查看证据，再作判断。": ["选择页面，查看证据，再作判断。", "Choose a page, inspect the evidence, then decide."],
"本次计划内的独立复核已通过，仍需你的最终判断。": ["本次计划内的独立复核已通过，仍需你的最终判断。", "Independent review passed within the planned scope. Your final decision is still needed."],
"复核发现未解决的问题，请查看下方原因。": ["复核发现未解决的问题，请查看下方原因。", "Review found unresolved issues. Read the findings below."],
"当前尚无有效的独立复核结论，请先补齐证据。": ["当前尚无有效的独立复核结论，请先补齐证据。", "No valid independent verdict is available yet. Complete the evidence first."],
"打开原始复核记录": ["打开原始复核记录", "Open original review record"],
"验证范围与限制": ["验证范围与限制", "Scope and limitations"],
"尚未记录人工决定。独立复核通过不等于已经接受。": ["尚未记录人工决定。独立复核通过不等于已经接受。", "No human decision has been recorded. A passing independent review does not mean acceptance."],
"专项验证记录": ["专项验证记录", "Specialist verification records"],
"原始专项记录与截图已保留；只有当前复核引用的记录才计入本轮结论。": ["原始专项记录与截图已保留；只有当前复核引用的记录才计入本轮结论。", "Original specialist records and screenshots are retained. Only records cited by the current review contribute to its verdict."],
"打开专项原始记录": ["打开专项原始记录", "Open original verification record"],
"设计方法与审美设置": ["设计方法与审美设置", "Design methods and preferences"],
"完整 OJO、Taste、Impeccable 已接入。这里选择参考方法，源码修改仍需确认范围和计划。": ["完整 OJO、Taste、Impeccable 已接入。这里选择参考方法，源码修改仍需确认范围和计划。", "Complete OJO, Taste and Impeccable guidance is connected. These options choose the method; source edits still require scope and plan approval."],
"Taste 使用方式": ["Taste 使用方式", "Taste mode"],
"保留现有产品风格": ["保留现有产品风格", "Preserve existing product style"],
"尚无本轮运行报告": ["尚无本轮运行报告", "No report for this run yet"],
"当前是示例或仓库问题记录。连接项目并采集页面后，才能生成本轮证据与复核结果。": ["当前是示例或仓库问题记录。连接项目并采集页面后，才能生成本轮证据与复核结果。", "This is an example or repository issue record. Connect a project and capture its pages to produce current evidence and review results."],
"连接项目开始审阅": ["连接项目开始审阅", "Connect a project to start review"],
"首次页面诊断": ["首次页面诊断", "Initial page diagnosis"],
"诊断范围与限制": ["诊断范围与限制", "Diagnosis scope and limitations"],
"重新运行页面诊断": ["重新运行页面诊断", "Run page diagnosis again"],
"如何补充或更新设计系统": ["如何补充或更新设计系统", "Add or update a design system"],
"按更新后的规范开始新审阅": ["按更新后的规范开始新审阅", "Start a review with updated design rules"],
"先把规范保存到项目中的 DESIGN.md，并更新相关样式 token 或组件代码、提交源码。然后从当前项目发起新一轮审阅，重新采集和提取候选；在这里逐项检查、说明替换理由，再确认并冻结新版本。": ["先把规范保存到项目中的 DESIGN.md，并更新相关样式 token 或组件代码、提交源码。然后从当前项目发起新一轮审阅，重新采集和提取候选；在这里逐项检查、说明替换理由，再确认并冻结新版本。", "Save the rules in the project DESIGN.md, update the relevant style tokens or components, and commit the source. Start a new review to capture pages and extract candidates. Review each item here, explain replacements, then confirm and freeze a new version."],
"旧版与历史证据会保留。外部设计稿链接或图片目前不会自动导入为设计规则，也不会自动批准。仅查看示例或导出记录时，需先连接原项目。": ["旧版与历史证据会保留。外部设计稿链接或图片目前不会自动导入为设计规则，也不会自动批准。仅查看示例或导出记录时，需先连接原项目。", "Previous versions and evidence remain intact. External design links and images are not automatically imported or approved as rules. Connect the original project when viewing an example or exported record."],
"模型已基于本轮原图提出候选，仍需确认范围。": ["模型已基于本轮原图提出候选，仍需确认范围。", "The model proposed candidates from this run’s originals. Confirm the scope before changes."],
"页面诊断缺少证据，不能据此判定页面通过。": ["页面诊断缺少证据，不能据此判定页面通过。", "Page diagnosis needs more evidence; this is not a quality pass."],
"模型诊断未完成；当前仅保留规则候选。": ["模型诊断未完成；当前仅保留规则候选。", "Model diagnosis did not complete; only rule candidates remain."],
"此记录尚未运行模型页面诊断。": ["此记录尚未运行模型页面诊断。", "No model page diagnosis has run for this record."],
"model-diagnosis": ["模型页面诊断", "Model page diagnosis"],
"diagnose": ["页面诊断", "Page diagnosis"],
"原图批次": ["原图批次", "Image batch"],
"应用界面与报告": ["应用界面与报告", "App screens and reports"],
"公开网站艺术方向": ["公开网站艺术方向", "Public-page art direction"],
"布局、动效与密度参数": ["布局、动效与密度参数", "Layout, motion and density dials"],
"本轮设计重点": ["本轮设计重点", "Design focus"],
"细节打磨": ["细节打磨", "Polish"],
"布局与层级": ["布局与层级", "Layout and hierarchy"],
"动效与反馈": ["动效与反馈", "Motion and feedback"],
"布局变化（1–10）": ["布局变化（1–10）", "Layout variation (1–10)"],
"动效强度（1–10）": ["动效强度（1–10）", "Motion intensity (1–10)"],
"页面密度（1–10）": ["页面密度（1–10）", "Visual density (1–10)"],
"留空保留原技能默认值": ["留空保留原技能默认值", "Leave blank to retain upstream defaults"],

"所选页面会补齐各设备的整页原图；已有计划完整保留。确认只建立采集基线，不授权修改源码。": ["所选页面会补齐各设备的整页原图；已有计划完整保留。确认只建立采集基线，不授权修改源码。", "Selected pages include full-page originals on each device; the existing plan is kept in full. Confirmation creates a capture baseline and does not authorize source edits."],
"重新发现页面与交互": ["重新发现页面与交互", "Rediscover pages and interactions"],
"页面与交互计划": ["页面与交互计划", "Pages and interaction plan"],
"补充页面与交互范围": ["补充页面与交互范围", "Expand pages and interactions"],
"计划之外的证据缺口": ["计划之外的证据缺口", "Evidence gaps outside the plan"],
"发现真实页面与控件后，先确认本次采集范围。现有记录保持不变，确认后建立新的基线。": ["发现真实页面与控件后，先确认本次采集范围。现有记录保持不变，确认后建立新的基线。", "Discover real pages and controls, then confirm the capture scope. This creates a fresh baseline and keeps the current record unchanged."],
"发现页面与交互": ["发现页面与交互", "Discover pages and interactions"],
"发现只读取页面，不点击、不提交表单。菜单展开/收起、弹窗打开/关闭、原生表单错误/恢复会作为候选；自定义状态需补充明确计划。": ["发现只读取页面，不点击、不提交表单。菜单展开/收起、弹窗打开/关闭、原生表单错误/恢复会作为候选；自定义状态需补充明确计划。", "Discovery reads pages without clicking or submitting forms. Menu open/close, dialog open/dismiss and native form error/recovery are candidates; custom states require an explicit plan."],
"正在发现或采集，请稍候。": ["正在发现或采集，请稍候。", "Discovering or capturing. Please wait."],
"这里只显示候选范围，不表示已经采集或通过复核。所有选择和确认默认未勾选。": ["这里只显示候选范围，不表示已经采集或通过复核。所有选择和确认默认未勾选。", "These are scope candidates, not captured or approved evidence. All selections and confirmation start unchecked."],
"查看完整动作与预期状态": ["查看完整动作与预期状态", "View all actions and expected states"],
"仅使用合成测试值检查原生校验，不提交表单。": ["仅使用合成测试值检查原生校验，不提交表单。", "Only synthetic values are used for native validation; the form is not submitted."],
"没有可自动规划的状态。请查看缺口，补充路由与明确动作。": ["没有可自动规划的状态。请查看缺口，补充路由与明确动作。", "No states could be planned automatically. Review the gaps and add routes and explicit actions."],
"未发现或无法推断的状态": ["未发现或无法推断的状态", "Undiscovered or unresolved states"],
"高级：补充路由与自定义交互": ["高级：补充路由与自定义交互", "Advanced: add routes and custom interactions"],
"补充状态 JSON": ["补充状态 JSON", "Additional states JSON"],
"可声明未链接的路由、自定义菜单、表单、弹窗、失败与重试状态。使用当前预览地址、唯一选择器和明确预期；新增路由会自动补全整页原图。": ["可声明未链接的路由、自定义菜单、表单、弹窗、失败与重试状态。使用当前预览地址、唯一选择器和明确预期；新增路由会自动补全整页原图。", "Declare unlinked routes, custom menus, forms, dialogs, errors and retries with the current preview origin, unique selectors and explicit expectations. Full-page originals are added for each route."],
"我已核对所选页面、交互动作与测试值，同意建立新基线": ["我已核对所选页面、交互动作与测试值，同意建立新基线", "I checked the selected pages, actions and test values and agree to create a new baseline"],
"确认范围并采集": ["确认范围并采集", "Confirm scope and capture"],
"page": ["整页", "Full page"],
"menu": ["菜单", "Menu"],
"dialog": ["弹窗", "Dialog"],
"form": ["表单错误", "Form error"],
"recovery": ["错误恢复", "Recovery"],
"其他页面路径（可选，每行一个）": ["其他页面路径（可选，每行一个）", "Other page paths (optional, one per line)"],
"可补充导航中没有链接的页面，例如 /settings。": ["可补充导航中没有链接的页面，例如 /settings。", "Add pages absent from navigation, for example /settings."],

"其他诊断建议": ["其他诊断建议", "Other diagnostic suggestions"],
"AI 诊断": ["AI 诊断", "AI diagnosis"],
"选择设计方向": ["选择设计方向", "Choose a design direction"],
"画布与修改细节": ["画布与修改细节", "Canvas and change details"],
"先看修改建议，再决定本轮方向。": ["先看修改建议，再决定本轮方向。", "Review the suggestions and choose a direction."],
"建议来自本轮诊断。先核对依据和修改范围，确认后生成计划，再到画布查看和批注。": ["建议来自本轮诊断。先核对依据和修改范围，确认后生成计划，再到画布查看和批注。", "Suggestions come from this diagnosis. Check the evidence and scope, confirm the plan, then inspect and annotate the canvas."],
"诊断候选仍需核对。确认方向只生成计划，源码执行与最终判断分别需要明确批准。": ["诊断候选仍需核对。确认方向只生成计划，源码执行与最终判断分别需要明确批准。", "Verify diagnostic candidates. Direction confirmation prepares a plan; execution and the final decision require separate approval."],
"查看页面与原始证据": ["查看页面与原始证据", "View the page and original evidence"],
"本轮诊断建议": ["本轮诊断建议", "Suggestions from this diagnosis"],
"{0} 条诊断建议": ["{0} 条诊断建议", "{0} diagnostic suggestions"],
"本轮没有可用诊断建议。请先完成诊断或补充检查范围。": ["本轮没有可用诊断建议。请先完成诊断或补充检查范围。", "No diagnostic suggestions are available. Complete diagnosis or expand the review scope first."],
"待核对的诊断候选": ["待核对的诊断候选", "Diagnostic candidate to verify"],
"现有证据尚不足以给出具体修改建议，请先核对原始诊断。": ["现有证据尚不足以给出具体修改建议，请先核对原始诊断。", "The evidence is insufficient for a specific change suggestion. Check the original diagnosis first."],
"选择此方向": ["选择此方向", "Choose this direction"],
"批注当前截图": ["批注当前截图", "Annotate this screenshot"],
"无法读取记录，请重新读取审阅。": ["无法读取记录，请重新读取审阅。", "The record could not be loaded. Reload the review."],
"示例": ["示例", "Example"],
"基线审阅": ["基线审阅", "Baseline review"],
"尚无运行证据": ["尚无运行证据", "No run evidence yet"],
"等待 Harness 采集": ["等待 Harness 采集", "Waiting for Harness capture"],
"当前项目可以浏览工作区，但还没有可展示的运行证据。": ["当前项目可以浏览工作区，但还没有可展示的运行证据。", "You can browse this project workspace, but it has no run evidence to display yet."],
"先采集界面证据": ["先采集界面证据", "Capture interface evidence first"],
"先执行一次受控修改": ["先执行一次受控修改", "Run one controlled change first"],
"运行 Harness 基线采集后，截图、状态和标注会出现在这里。": ["运行 Harness 基线采集后，截图、状态和标注会出现在这里。", "Screenshots, states, and annotations will appear here after a Harness baseline capture."],
"代码改动只展示 Harness 隔离执行后保存的 diff.patch，不会根据描述伪造差异。": ["代码改动只展示 Harness 隔离执行后保存的 diff.patch，不会根据描述伪造差异。", "Code changes only shows diff.patch evidence saved by an isolated Harness run; it does not invent a diff from a description."],
"你仍然可以切换到其他页面；缺少证据不会锁住工作台导航。": ["你仍然可以切换到其他页面；缺少证据不会锁住工作台导航。", "You can still switch views; missing evidence does not lock the workbench navigation."],
"完成一次采集后，这里会列出页面、状态和视口。": ["完成一次采集后，这里会列出页面、状态和视口。", "Pages, states, and viewports will appear here after a capture."],
"暂无可检查的证据": ["暂无可检查的证据", "No evidence to inspect"],
"Canvas 会在基线采集完成后显示真实界面，而不是占位截图。": ["Canvas 会在基线采集完成后显示真实界面，而不是占位截图。", "Canvas shows the real interface after baseline capture instead of placeholder screenshots."],
"Code diff 会在受控执行完成后显示真实补丁。": ["Code diff 会在受控执行完成后显示真实补丁。", "Code diff shows the real patch after a controlled execution."],
"开始第一次页面审阅": ["开始第一次页面审阅", "Start your first page review"],
"连接本地项目后，工作台会采集真实页面并带你查看首条有证据的问题。": ["连接本地项目后，工作台会采集真实页面并带你查看首条有证据的问题。", "Connect a local project to capture its real pages and review the first evidence-backed issue."],
"连接项目并开始审阅": ["连接项目并开始审阅", "Connect project and start review"],
"代码改动已打开": ["代码改动已打开", "Code changes is open"],
"当前项目还没有导出的截图。完成基线采集后，这里会显示各页面和任务状态。": ["当前项目还没有导出的截图。完成基线采集后，这里会显示各页面和任务状态。", "This project has no exported screenshots yet. Pages and task states will appear here after baseline capture."],
"当前项目还没有可审阅的 diff.patch。完成一次隔离修改后，这里会显示真实代码差异。": ["当前项目还没有可审阅的 diff.patch。完成一次隔离修改后，这里会显示真实代码差异。", "This project has no reviewable diff.patch yet. The real code diff will appear here after an isolated change."],
"查看 AI 复核后决定是否接受，或回到画布继续调整。": ["查看 AI 复核后决定是否接受，或回到画布继续调整。", "Review the AI findings, then accept the result or return to the canvas to adjust it."],
"此报告保留本轮截图与复核证据。打开复核结果，选择接受或继续调整。": ["此报告保留本轮截图与复核证据。打开复核结果，选择接受或继续调整。", "This report preserves screenshots and review evidence. Open the review results to accept or continue adjusting."],
"查看 AI 复核与决定": ["查看 AI 复核与决定", "Review AI findings and decide"],

"当前项目": ["当前项目", "Current project"],
"工作面板": ["工作面板", "Work panel"],
"调整": ["调整", "Adjust"],
"AI 复核": ["AI 复核", "AI review"],
"独立检查": ["独立检查", "Independent check"],
"复核结果": ["复核结果", "Review results"],
"正在检查界面": ["正在检查界面", "Reviewing the interface"],
"让 AI 检查这次修改": ["让 AI 检查这次修改", "Let AI review this change"],
"结合前后截图，查看改动是否符合预期。": ["结合前后截图，查看改动是否符合预期。", "Compare the evidence and see whether the change meets your intent."],
"修改并采集完成后，AI 会检查结果和潜在问题。": ["修改并采集完成后，AI 会检查结果和潜在问题。", "After changes are captured, AI checks the result for potential issues."],
"查看证据与限制": ["查看证据与限制", "Evidence and limitations"],
"Automatic extraction review": ["自动提取审阅", "Automatic extraction review"],
"{0} source files were scanned. Review conflicts and limits before approving any candidate.": ["已扫描 {0} 个源码文件。批准候选项前，请先检查冲突和提取限制。", "{0} source files were scanned. Review conflicts and limits before approving any candidate."],
"Review conflicts and limits before approving any candidate.": ["批准候选项前，请先检查冲突和提取限制。", "Review conflicts and limits before approving any candidate."],
"{0} items need review": ["{0} 项需要复核", "{0} items need review"],
"No extraction conflicts found": ["未发现提取冲突", "No extraction conflicts found"],
"Extraction evidence incomplete": ["提取证据不完整", "Extraction evidence incomplete"],
"Extraction result unavailable. Reload the review or re-extract from the connected project.": ["提取结果无法读取。请重新读取审阅记录，或在已连接的项目中重新提取。", "Extraction result unavailable. Reload the review or re-extract from the connected project."],
"Tokens and themes": ["令牌与主题", "Tokens and themes"],
"Brand assets and voice evidence": ["品牌资产与语气证据", "Brand assets and voice evidence"],
"Components and consumers": ["组件与引用关系", "Components and consumers"],
"Accepted pattern candidates": ["已接受方案中的模式候选", "Accepted pattern candidates"],
"These repeated compositions still need usage guidance and design review before becoming shared patterns.": ["这些重复组合仍需补齐适用条件并完成设计审阅，才能作为共享模式。", "These repeated compositions still need usage guidance and design review before becoming shared patterns."],
"Open source review": ["查看来源审阅", "Open source review"],
"Source review is not exported.": ["来源审阅尚未导出。", "Source review is not exported."],
"Usage guidance draft": ["使用建议草稿", "Usage guidance draft"],
"Add to Foundation review": ["列入规范待审", "Add to Foundation review"],
"Already in Foundation review": ["已列入规范待审", "Already in Foundation review"],
"Staged patterns need explicit decisions and a Foundation version approval before planning.": ["待审模式需要逐项决定，并批准设计基础版本后才能规划修改。", "Staged patterns need explicit decisions and a Foundation version approval before planning."],
"Pattern conditions and dependencies": ["使用条件与依赖", "Pattern conditions and dependencies"],
"Component dependencies": ["组件依赖", "Component dependencies"],
"Token references": ["设计变量引用", "Token references"],
"A staged pattern is unavailable. Reload its source record before approving.": ["待审模式暂不可用，请重新读取来源记录后再批准。", "A staged pattern is unavailable. Reload its source record before approving."],
"Reviewed original": ["本次审阅原图", "Reviewed original"],
"Proposed guidance": ["建议待审阅", "Proposed guidance"],
"Not reusable with current evidence": ["现有证据不支持复用", "Not reusable with current evidence"],
"More evidence needed": ["需要补充证据", "More evidence needed"],
"When to use": ["适用条件", "When to use"],
"When to avoid": ["不适用的情况", "When to avoid"],
"Exceptions": ["例外", "Exceptions"],
"Evidence limits": ["证据限制", "Evidence limits"],
"Model guidance is a proposal. It has not changed the approved design system.": ["这些建议尚未加入规范，已批准的设计系统保持不变。", "Model guidance is a proposal. It has not changed the approved design system."],
"Draft usage guidance": ["整理使用建议", "Draft usage guidance"],
"Reviewing original evidence…": ["正在审阅原始证据…", "Reviewing original evidence…"],
"Pattern guidance is unavailable. Reload the source record.": ["使用建议暂不可用，请重新读取来源记录。", "Pattern guidance is unavailable. Reload the source record."],
"{0} findings": ["{0} 个问题", "{0} findings"],
"Raw result": ["查看原始结果", "Raw result"],
"Resolve these before approval": ["批准前请处理这些问题", "Resolve these before approval"],
"{0} extraction limits": ["{0} 项提取限制", "{0} extraction limits"],
"No value": ["无值", "No value"],
"Unknown source": ["来源未知", "Unknown source"],
"Conflicting values": ["值有冲突", "Conflicting values"],
"Unresolved alias": ["别名未解析", "Unresolved alias"],
"Alias cycle": ["别名循环引用", "Alias cycle"],
"{0} pending · {1} approved · {2} deprecated": ["{0} 项待判断 · {1} 项批准 · {2} 项弃用", "{0} pending · {1} approved · {2} deprecated"],
"{0} approved · {1} deprecated": ["{0} 项批准 · {1} 项弃用", "{0} approved · {1} deprecated"],
"确认设计基础": ["确认设计基础", "Confirm design foundation"],
"系统会根据逐项决定预填版本与审阅记录；你只需检查并确认。": ["系统会根据逐项决定预填版本与审阅记录；你只需检查并确认。", "The workbench prefills the version and review record from your item decisions. Review and confirm it."],
"版本与审阅记录": ["版本与审阅记录", "Version and review record"],
"确认并冻结版本": ["确认并冻结版本", "Confirm and freeze version"],
"Local reviewer": ["本地审阅者", "Local reviewer"],
"{0} candidates reviewed: {1} approved and {2} deprecated. The decision considered {3} scanned source files and {4} extraction findings.": ["已审阅 {0} 个候选项：批准 {1} 项，弃用 {2} 项。判断参考了 {3} 个源码文件和 {4} 个提取问题。", "{0} candidates reviewed: {1} approved and {2} deprecated. The decision considered {3} scanned source files and {4} extraction findings."],
"Complete {0} candidate decisions before confirming this version.": ["还需处理 {0} 个候选项，完成后即可确认版本。", "Complete {0} candidate decisions before confirming this version."],
"All candidates have a decision. Review the suggested record or confirm this version now.": ["所有候选项都已处理。你可以直接确认，也可以展开检查建议记录。", "All candidates have a decision. Review the suggested record or confirm this version now."],
"This exported record is read-only. Open its connected local run to review or approve the foundation.": ["这是一份只读导出记录。请打开仍与本地项目连接的运行，再审阅或批准设计基础。", "This exported record is read-only. Open its connected local run to review or approve the foundation."],
"Foundation decisions are frozen after planning begins.": ["进入修改规划后，设计基础决定已冻结。", "Foundation decisions are frozen after planning begins."],
"正在对照截图，请稍候。": ["正在对照截图，请稍候。", "Comparing screenshots. Please wait."],
"准备好修改后的截图，再开始复核。": ["准备好修改后的截图，再开始复核。", "Capture the changed interface to start a review."],
"正在复核…": ["正在复核…", "Reviewing…"],

"高级：修改范围与执行": ["高级：修改范围与执行", "Advanced: scope and execution"],

"让 AI 独立复核": ["让 AI 独立复核", "Run independent AI review"],
"想继续调整什么？（可选）": ["想继续调整什么？（可选）", "What would you like to adjust? (optional)"],
"接受这版": ["接受这版", "Accept this version"],
"用户查看 AI 复核后选择接受这版。": ["用户查看 AI 复核后选择接受这版。", "The user chose to accept this version after viewing the AI review."],
"继续调整": ["继续调整", "Continue adjusting"],
"修改完成后 AI 会自动复核，也可以手动发起。": ["修改完成后 AI 会自动复核，也可以手动发起。", "AI reviews changes automatically after capture. You can also start a review here."],
"复核限制": ["复核限制", "Review limitations"],
"已记录决定": ["已记录决定", "Recorded decision"],
"高级：人工复核与补充记录": ["高级：人工复核与补充记录", "Advanced: manual review and additional records"],
"AI 复核未完成，可重试": ["AI 复核未完成，可重试", "AI review incomplete; retry available"],
"历史复核详情": ["历史复核详情", "Historical review details"],
"ai-review": ["AI 独立复核", "Independent AI review"],
"review-failed": ["复核未完成", "Review incomplete"],

"修改范围确认理由": ["修改范围确认理由", "Scope confirmation reason"],
"请选择决定": ["请选择决定", "Choose a decision"],
"放大截图": ["放大截图", "Enlarge screenshot"],
"截图预览": ["截图预览", "Screenshot preview"],
"完整显示": ["完整显示", "Fit image"],
"选填": ["选填", "Optional"],
"请说明原因": ["请说明原因", "Explain your reason"],
"人工判断理由": ["人工判断理由", "Human decision reason"],
"请选择决定并填写人工判断理由": ["请选择决定并填写人工判断理由", "Choose a decision and explain your reasoning"],
"经验记录理由": ["经验记录理由", "Reason for the memory record"],

"请确认你未参与本轮修改，并已独立查看证据。": ["请确认你未参与本轮修改，并已独立查看证据。", "Confirm that you did not make these changes and independently inspected the evidence."],
"请选择复核结论": ["请选择复核结论", "Choose a review verdict"],
"请选择已查看的有效截图": ["请选择已查看的有效截图", "Select the valid screenshots you inspected"],
"请填写问题标题": ["请填写问题标题", "Enter an issue title"],
"请填写具体观察": ["请填写具体观察", "Describe what you observed"],
"未通过需要记录问题；通过时不能保留未解决问题。": ["未通过需要记录问题；通过时不能保留未解决问题。", "A failed review needs findings; a passing review cannot contain unresolved findings."],
"请填写复核者姓名": ["请填写复核者姓名", "Enter the reviewer name"],
"请填写复核理由": ["请填写复核理由", "Explain your verdict"],
"请说明复核限制或未覆盖范围": ["请说明复核限制或未覆盖范围", "Describe limitations or areas not reviewed"],
"由未参与修改的复核者填写。批注用于辅助说明，不能代替查看原始截图。": ["由未参与修改的复核者填写。批注用于辅助说明，不能代替查看原始截图。", "To be completed by a reviewer who did not make the changes. Annotations supplement the original screenshots."],
"复核类型": ["复核类型", "Review type"],
"修改后视觉复核": ["修改后视觉复核", "Post-change visual QA"],
"基线视觉审阅": ["基线视觉审阅", "Baseline visual review"],
"复核者姓名": ["复核者姓名", "Reviewer name"],
"逐项确认已查看的截图": ["逐项确认已查看的截图", "Confirm each screenshot you inspected"],
"暂无可用截图，请先采集。": ["暂无可用截图，请先采集。", "No screenshots available. Capture the interface first."],
"复核结论": ["复核结论", "Review verdict"],
"证据不足": ["证据不足", "Insufficient evidence"],
"复核理由": ["复核理由", "Review rationale"],
"复核限制或未覆盖范围": ["复核限制或未覆盖范围", "Limitations or areas not reviewed"],
"添加复核问题": ["添加复核问题", "Add finding"],
"问题标题": ["问题标题", "Finding title"],
"具体观察": ["具体观察", "Observation"],
"影响程度": ["影响程度", "Impact"],
"判断把握": ["判断把握", "Confidence"],
"低": ["低", "Low"],
"中": ["中", "Medium"],
"高": ["高", "High"],
"移除问题": ["移除问题", "Remove finding"],
"我未参与本轮修改，并已独立查看所引用的截图": ["我未参与本轮修改，并已独立查看所引用的截图", "I did not make these changes and independently inspected the cited screenshots"],
"提交独立复核": ["提交独立复核", "Submit independent review"],
"高级：导入复核 JSON": ["高级：导入复核 JSON", "Advanced: import review JSON"],

"请填写批注说明": ["请填写批注说明", "Describe the annotations first"],
"复核附件已保存，请在视觉复核中选择引用。": ["复核附件已保存，请在视觉复核中选择引用。", "Review attachment saved. Select it when importing the visual review."],
"保存为复核附件": ["保存为复核附件", "Save review attachment"],
"引用画布批注": ["引用画布批注", "Cite canvas annotations"],
"查看批注图": ["查看批注图", "View annotation image"],
"在画布中保存批注后，可在这里引用。": ["在画布中保存批注后，可在这里引用。", "Save annotations on the canvas, then cite them here."],

  "本地 · 可编辑草稿": ["本地 · 可编辑草稿", "Local · Editable draft"],
  "HappyHands · 设计审阅工作台": [
    "HappyHands · 设计审阅工作台",
    "HappyHands · Design review workbench"
  ],
  "HappyHands 工作台": [
    "HappyHands 工作台",
    "HappyHands workbench"
  ],
  "HAPPYHANDS / 本地设计审阅": [
    "HAPPYHANDS / 本地设计审阅",
    "HAPPYHANDS / LOCAL DESIGN REVIEW"
  ],
  "HAPPYHANDS / 本地工作台": [
    "HAPPYHANDS / 本地工作台",
    "HAPPYHANDS / LOCAL WORKBENCH"
  ],
  "工作台导航": [
    "工作台导航",
    "Workbench navigation"
  ],
  "工作空间": [
    "工作空间",
    "Workspace"
  ],
  "审阅报告": [
    "审阅报告",
    "Review report"
  ],
  "代码改动": [
    "代码改动",
    "Code changes"
  ],
  "设计方向": [
    "设计方向",
    "Directions"
  ],
  "本地工作台": [
    "本地工作台",
    "Local workbench"
  ],
  "A versioned rubric with all MVP dimensions is required.": [
    "需提供包含全部基础维度的版本化评分标准。",
    "A versioned rubric with all MVP dimensions is required."
  ],
  "Evidence coverage must be at least 80%.": [
    "证据覆盖率至少需要达到 80%。",
    "Evidence coverage must be at least 80%."
  ],
  "The weighted score is not a finite number.": [
    "加权评分不是有效数值。",
    "The weighted score is not a finite number."
  ],
  "Missing dimension: {0}.": [
    "缺少维度：{0}。",
    "Missing dimension: {0}."
  ],
  "{0} needs a score from 0 to 100.": [
    "{0}需要 0 至 100 的评分。",
    "{0} needs a score from 0 to 100."
  ],
  "{0} needs a weight greater than zero.": [
    "{0}需要大于零的权重。",
    "{0} needs a weight greater than zero."
  ],
  "{0} needs a rationale.": [
    "{0}需要说明理由。",
    "{0} needs a rationale."
  ],
  "{0} needs at least one valid evidence reference.": [
    "{0}至少需要一项有效的证据引用。",
    "{0} needs at least one valid evidence reference."
  ],
  "hierarchy": [
    "视觉层级",
    "Hierarchy"
  ],
  "information-architecture": [
    "信息架构",
    "Information architecture"
  ],
  "responsive": [
    "响应式适配",
    "Responsive design"
  ],
  "accessibility": [
    "无障碍",
    "Accessibility"
  ],
  "consistency": [
    "一致性",
    "Consistency"
  ],
  "task-friction": [
    "任务阻力",
    "Task friction"
  ],
  "review-target": [
    "待审阅项",
    "Review target"
  ],
  "stale-candidate": [
    "已过期的候选",
    "Stale candidate"
  ],
  "deprecated": [
    "已弃用",
    "Deprecated"
  ],
  "Creative OS · 设计审阅工作台": [
    "Creative OS · 设计审阅工作台",
    "Creative OS · Design review workbench"
  ],
  "LOCAL WORKBENCH": [
    "本地工作台",
    "LOCAL WORKBENCH"
  ],
  "Review": [
    "审阅导航",
    "Review"
  ],
  "工作台": [
    "工作台",
    "Workbench"
  ],
  "产品路线 ↗": [
    "产品路线 ↗",
    "Roadmap ↗"
  ],
  "CREATIVE OS / 本地设计审阅": [
    "CREATIVE OS / 本地设计审阅",
    "CREATIVE OS / LOCAL DESIGN REVIEW"
  ],
  "让每一次修改，都有据可查。": [
    "让每一次修改，都有据可查。",
    "Evidence for every change."
  ],
  "查看项目证据与设计基础，选择值得解决的问题，再审阅修改结果。": [
    "查看项目证据与设计基础，选择值得解决的问题，再审阅修改结果。",
    "Review project evidence and design foundations, choose a problem, then assess the result."
  ],
  "审阅记录": [
    "审阅记录",
    "Review session"
  ],
  "HappyClaw site / repository review": [
    "HappyClaw / 仓库审阅",
    "HappyClaw site / repository review"
  ],
  "Northstar / fictional walkthrough": [
    "Northstar / 虚构演示",
    "Northstar / fictional walkthrough"
  ],
  "概览快捷操作": [
    "概览快捷操作",
    "Overview shortcuts"
  ],
  "打开审阅画布 ↗": [
    "打开审阅画布 ↗",
    "Open review canvas ↗"
  ],
  "打开审阅画布": [
    "打开审阅画布",
    "Open review canvas"
  ],
  "查看代码改动": [
    "查看代码改动",
    "View code changes"
  ],
  "概览 / 设计基础与审阅记录": [
    "概览 / 设计基础与审阅记录",
    "Overview / Design foundations and reviews"
  ],
  "设计基础": [
    "设计基础",
    "Design foundation"
  ],
  "让修改遵循已有的产品语言": [
    "让修改遵循已有的产品语言",
    "Keep changes consistent with the product"
  ],
  "观察到的规范只是候选。请先批准，再让 agent 复用或扩展。": [
    "观察到的规范只是候选。请先批准，再让智能体复用或扩展。",
    "Observed conventions are candidates. Approve them before the agent reuses or extends them."
  ],
  "审阅进度": [
    "审阅进度",
    "Review progress"
  ],
  "当前进度与下一步": [
    "当前进度与下一步",
    "Progress and next steps"
  ],
  "运行证据": [
    "运行证据",
    "Run evidence"
  ],
  "已采集的界面与检查结果": [
    "已采集的界面与检查结果",
    "Captured screens and check results"
  ],
  "本次本地运行的截图、结构检查与判断记录。结构检查用于确认页面仍可用，不衡量视觉质量。": [
    "本次本地运行的截图、结构检查与判断记录。结构检查用于确认页面仍可用，不衡量视觉质量。",
    "Screenshots, structural checks and decisions from this local run. Structural checks verify usability, not visual quality."
  ],
  "01 / 项目背景": [
    "01 / 项目背景",
    "01 / Project context"
  ],
  "输入": [
    "输入",
    "Input"
  ],
  "产品目标": [
    "产品目标",
    "Product goal"
  ],
  "目标用户": [
    "目标用户",
    "Audience"
  ],
  "关键任务": [
    "关键任务",
    "Key task"
  ],
  "观察证据": [
    "观察证据",
    "Observations"
  ],
  "这里保留已记录的来源与观察；不将人工编写的描述冒充自动分析。": [
    "这里保留已记录的来源与观察；不将人工编写的描述冒充自动分析。",
    "Recorded sources and observations are retained. Authored descriptions are not automated analysis."
  ],
  "02 / 问题与优先级": [
    "02 / 问题与优先级",
    "02 / Findings and priorities"
  ],
  "先解决哪个问题？": [
    "先解决哪个问题？",
    "Which problem comes first?"
  ],
  "排序参考影响、置信度和工作量。执行前请结合真实任务确认。": [
    "排序参考影响、置信度和工作量。执行前请结合真实任务确认。",
    "Ranking uses impact, confidence and effort. Confirm against a real task before acting."
  ],
  "当前问题": [
    "当前问题",
    "Selected finding"
  ],
  "03 / 修改与验证": [
    "03 / 修改与验证",
    "03 / Changes and validation"
  ],
  "人工判断": [
    "人工判断",
    "Human decision"
  ],
  "将判断转成可审阅的修改": [
    "将判断转成可审阅的修改",
    "Turn decisions into reviewable changes"
  ],
  "下载限定范围的修改任务。执行、采集与最终判断仍通过本地 Harness 完成。": [
    "下载限定范围的修改任务。执行、采集与最终判断仍通过本地 Harness 完成。",
    "Download a scoped editing brief. Execute, capture and record the final decision with the local harness."
  ],
  "下载修改任务 ↗": [
    "下载修改任务 ↗",
    "Download editing brief ↗"
  ],
  "查看完整任务": [
    "查看完整任务",
    "View full brief"
  ],
  "评估": [
    "评估",
    "Evaluation"
  ],
  "你的判断": [
    "你的判断",
    "Your decision"
  ],
  "决定": [
    "决定",
    "Decision"
  ],
  "尚未审阅": [
    "尚未审阅",
    "Not reviewed"
  ],
  "接受": [
    "接受",
    "Accept"
  ],
  "拒绝": [
    "拒绝",
    "Reject"
  ],
  "判断理由": [
    "判断理由",
    "Decision rationale"
  ],
  "什么得到了改善，什么仍有问题或不确定？": [
    "什么得到了改善，什么仍有问题或不确定？",
    "What improved, and what remains unresolved or uncertain?"
  ],
  "保存判断": [
    "保存判断",
    "Save decision"
  ],
  "导出体验规格 ↓": [
    "导出体验规格 ↓",
    "Export experience spec ↓"
  ],
  "NEXT IN THE PRODUCT": [
    "后续规划",
    "NEXT IN THE PRODUCT"
  ],
  "From one review to a designer that stays.": [
    "从一次审阅，到持续设计。",
    "From one review to a designer that stays."
  ],
  "Project history, incremental checks after code changes, evaluator versions and regression examples will turn this single review into a continuous design service.": [
    "项目历史、代码修改后的增量检查、评估器版本与回归案例，将支持持续的设计审阅。",
    "Project history, incremental checks after code changes, evaluator versions and regression examples will turn this single review into a continuous design service."
  ],
  "CREATIVE OS / 本地工作台": [
    "CREATIVE OS / 本地工作台",
    "CREATIVE OS / LOCAL WORKBENCH"
  ],
  "先有证据，再作判断。": [
    "先有证据，再作判断。",
    "Evidence before decisions."
  ],
  "Creative OS 工作台": [
    "Creative OS 工作台",
    "Creative OS workbench"
  ],
  "设计审阅工作台": [
    "设计审阅工作台",
    "Design review workbench"
  ],
  "切换审阅记录": [
    "切换审阅记录",
    "Switch review session"
  ],
  "工作台视图": [
    "工作台视图",
    "Workbench views"
  ],
  "概览": [
    "概览",
    "Overview"
  ],
  "画布": [
    "画布",
    "Canvas"
  ],
  "代码": [
    "代码",
    "Code"
  ],
  "本地 · 只读审阅": [
    "本地 · 只读审阅",
    "Local · Read-only"
  ],
  "重新读取": [
    "重新读取",
    "Refresh"
  ],
  "REVIEW SESSION": [
    "审阅记录",
    "REVIEW SESSION"
  ],
  "审阅目录": [
    "审阅目录",
    "Review index"
  ],
  "先看界面，再看证据。": [
    "先看界面，再看证据。",
    "Review the screens, then the evidence."
  ],
  "结构检查不代表视觉质量。": [
    "结构检查不代表视觉质量。",
    "Structural checks do not measure visual quality."
  ],
  "界面对照": [
    "界面对照",
    "Screen comparison"
  ],
  "目录": [
    "目录",
    "Index"
  ],
  "详情": [
    "详情",
    "Details"
  ],
  "选择工具 V": [
    "选择工具 V",
    "Select tool V"
  ],
  "抓手工具 H": [
    "抓手工具 H",
    "Hand tool H"
  ],
  "选择截图（V）": [
    "选择截图（V）",
    "Select screenshots (V)"
  ],
  "拖动画布（H）": [
    "拖动画布（H）",
    "Pan canvas (H)"
  ],
  "选择": [
    "选择",
    "Select"
  ],
  "抓手": [
    "抓手",
    "Hand"
  ],
  "按结构评估筛选（D）": [
    "按结构评估筛选（D）",
    "Filter structural changes (D)"
  ],
  "结构变化": [
    "结构变化",
    "Changes"
  ],
  "缩小": [
    "缩小",
    "Zoom out"
  ],
  "放大": [
    "放大",
    "Zoom in"
  ],
  "适应全部（Shift+F）": [
    "适应全部（Shift+F）",
    "Fit all (Shift+F)"
  ],
  "适应": [
    "适应",
    "Fit"
  ],
  "恢复截图的自动布局": [
    "恢复截图的自动布局",
    "Restore automatic layout"
  ],
  "重置": [
    "重置",
    "Reset"
  ],
  "显示或隐藏画布点阵": [
    "显示或隐藏画布点阵",
    "Toggle canvas grid"
  ],
  "网格": [
    "网格",
    "Grid"
  ],
  "空格拖动 / 中键平移 · Ctrl + 滚轮缩放 · 双击查看原图": [
    "空格拖动 / 中键平移 · Ctrl + 滚轮缩放 · 双击查看原图",
    "Space + drag / middle button to pan · Ctrl + wheel to zoom · Double-click to open"
  ],
  "F 聚焦 · Shift F 全览": [
    "F 聚焦 · Shift F 全览",
    "F to focus · Shift F to fit all"
  ],
  "审阅详情": [
    "审阅详情",
    "Review details"
  ],
  "INSPECT": [
    "检查",
    "INSPECT"
  ],
  "下一步": [
    "下一步",
    "Next step"
  ],
  "查看操作命令": [
    "查看操作命令",
    "View command"
  ],
  "复制命令": [
    "复制命令",
    "Copy command"
  ],
  "证据来自本地导出记录": [
    "证据来自本地导出记录",
    "Evidence from local exports"
  ],
  "关闭 Esc": [
    "关闭 Esc",
    "Close Esc"
  ],
  "打开原始截图 ↗": [
    "打开原始截图 ↗",
    "Open original screenshot ↗"
  ],
  "原始证据保留原文；界面语言可独立切换。": [
    "原始证据保留原文；界面语言可独立切换。",
    "Evidence stays in its original language; interface language can be changed separately."
  ],
  "语言": [
    "语言",
    "Language"
  ],
  "修改前": [
    "修改前",
    "Before"
  ],
  "修改后": [
    "修改后",
    "After"
  ],
  "重新加载截图": [
    "重新加载截图",
    "Reload screenshot"
  ],
  "截图读取失败，证据暂不可用。": [
    "截图读取失败，证据暂不可用。",
    "Screenshot could not be loaded. Evidence is temporarily unavailable."
  ],
  "重放失败": [
    "重放失败",
    "Replay failed"
  ],
  "未提供可用截图，无法进行视觉审阅。": [
    "未提供可用截图，无法进行视觉审阅。",
    "No screenshot is available for visual review."
  ],
  "未到达": [
    "未到达",
    "Not reached"
  ],
  " · 待评估": [
    " · 待评估",
    "· Awaiting evaluation"
  ],
  " · 有结构变化": [
    " · 有结构变化",
    "· Structural changes"
  ],
  " · 结构指标一致": [
    " · 结构指标一致",
    "· Structural metrics unchanged"
  ],
  "修改后 ↗": [
    "修改后 ↗",
    "After ↗"
  ],
  "↖ 修改前": [
    "↖ 修改前",
    "↖ Before"
  ],
  "本次执行的文件": [
    "本次执行的文件",
    "Files from this execution"
  ],
  "代码是原因线索": [
    "代码是原因线索",
    "Code provides context"
  ],
  "这里展示执行时保存的补丁。代码变化不能代替截图复核，也不证明用户任务已经改善。": [
    "这里展示执行时保存的补丁。代码变化不能代替截图复核，也不证明用户任务已经改善。",
    "This is the patch saved during execution. Code changes cannot replace screenshot review or prove that the user task improved."
  ],
  "此 run 没有 agent 执行记录。": [
    "本轮没有智能体执行记录。",
    "This run has no agent execution record."
  ],
  "代码证据": [
    "代码证据",
    "Code evidence"
  ],
  "还没有代码改动": [
    "还没有代码改动",
    "No code changes yet"
  ],
  "这条审阅记录目前只有界面证据。确认要解决的问题并完成一次隔离修改后，真实补丁才会出现在这里。": [
    "这条审阅记录目前只有界面证据。确认要解决的问题并完成一次隔离修改后，真实补丁才会出现在这里。",
    "This review currently contains interface evidence only. The real patch will appear here after the problem scope is confirmed and an isolated change has completed."
  ],
  "界面证据": [
    "界面证据",
    "Interface evidence"
  ],
  "已采集": [
    "已采集",
    "Captured"
  ],
  "问题范围": [
    "问题范围",
    "Problem scope"
  ],
  "待确认": [
    "待确认",
    "Needs confirmation"
  ],
  "源码执行": [
    "源码执行",
    "Source execution"
  ],
  "未开始": [
    "未开始",
    "Not started"
  ],
  "返回审阅报告": [
    "返回审阅报告",
    "Back to review report"
  ],
  "重新读取执行记录": [
    "重新读取执行记录",
    "Refresh execution record"
  ],
  "本次执行": [
    "本次执行",
    "This execution"
  ],
  "补丁已记录，内容为空": [
    "补丁已记录，内容为空",
    "The recorded patch is empty"
  ],
  "已声明的补丁读取失败": [
    "已声明的补丁读取失败",
    "The recorded patch could not be loaded"
  ],
  "此旧记录未保存补丁全文": [
    "此旧记录未保存补丁全文",
    "This older run has no saved patch"
  ],
  "空补丁不证明执行没有新增文件；请结合执行记录核查。": [
    "空补丁不证明执行没有新增文件；请结合执行记录核查。",
    "An empty patch does not rule out new files. Check the execution record."
  ],
  "以下仅展示执行记录中的文件清单，不代表完整代码证据。": [
    "以下仅展示执行记录中的文件清单，不代表完整代码证据。",
    "Only the recorded file list is shown. This is not complete code evidence."
  ],
  "结构评估读取失败；截图仍可审阅，结构变化筛选不可用。": [
    "结构评估读取失败；截图仍可审阅，结构变化筛选不可用。",
    "Structural evaluation could not be loaded. Screenshots remain available; filtering is disabled."
  ],
  "界面对照画布，空格拖动平移，Ctrl 加滚轮缩放": [
    "界面对照画布，空格拖动平移，Ctrl 加滚轮缩放",
    "Screen comparison canvas. Space and drag to pan; Ctrl and wheel to zoom."
  ],
  "选中截图操作": [
    "选中截图操作",
    "Selected screenshot actions"
  ],
  "放大查看": [
    "放大查看",
    "Enlarge"
  ],
  "定位对照": [
    "定位对照",
    "Find counterpart"
  ],
  "证据详情": [
    "证据详情",
    "Evidence details"
  ],
  "把注意力放在界面上": [
    "把注意力放在界面上",
    "Focus on the screens"
  ],
  "选择截图查看状态与检查结果。选择问题，追溯它引用的证据。": [
    "选择截图查看状态与检查结果。选择问题，追溯它引用的证据。",
    "Select a screenshot to inspect its state and checks. Select a finding to trace its evidence."
  ],
  "双击截图可放大查看；前后对照仅在相同状态和配置间配对。": [
    "双击截图可放大查看；前后对照仅在相同状态和配置间配对。",
    "Double-click to enlarge. Before and after captures are paired only for matching states and configurations."
  ],
  "BASELINE / 修改前": [
    "基线 / 修改前",
    "Baseline / Before"
  ],
  "RESULT / 修改后": [
    "结果 / 修改后",
    "Result / After"
  ],
  "配置": [
    "配置",
    "Configuration"
  ],
  "视口": [
    "视口",
    "Viewport"
  ],
  "可达状态": [
    "可达状态",
    "Reachability"
  ],
  "页面地址": [
    "页面地址",
    "Page URL"
  ],
  "放大查看截图 ↗": [
    "放大查看截图 ↗",
    "Enlarge screenshot ↗"
  ],
  "结构检查 · 不代表视觉质量": [
    "结构检查 · 不代表视觉质量",
    "Structural checks · Not visual quality"
  ],
  "通过": [
    "通过",
    "Passed"
  ],
  "未通过": [
    "未通过",
    "Failed"
  ],
  "尚无此状态的结构评估。": [
    "尚无此状态的结构评估。",
    "No structural evaluation for this state yet."
  ],
  "没有问题明确引用这张截图。": [
    "没有问题明确引用这张截图。",
    "No findings explicitly reference this screenshot."
  ],
  "尚未生成诊断证据图。": [
    "尚未生成诊断证据图。",
    "No diagnostic evidence graph yet."
  ],
  "本次执行涉及文件": [
    "本次执行涉及文件",
    "Files changed in this execution"
  ],
  "文件清单属于本次执行，尚无截图与代码行的因果映射。": [
    "文件清单属于本次执行，尚无截图与代码行的因果映射。",
    "These files belong to this execution. No causal mapping to screenshots is available."
  ],
  "证据状态": [
    "证据状态",
    "Evidence status"
  ],
  "待确认": [
    "待确认",
    "Needs confirmation"
  ],
  "排序值": [
    "排序值",
    "Priority"
  ],
  "未提供": [
    "未提供",
    "Not supplied"
  ],
  "引用证据": [
    "引用证据",
    "Referenced evidence"
  ],
  "修改后请在对应状态上观察此问题是否解决。这里不会自动宣称问题已修复。": [
    "修改后请在对应状态上观察此问题是否解决。这里不会自动宣称问题已修复。",
    "After editing, inspect the corresponding state to verify the outcome. A fix is not assumed."
  ],
  "同状态 · 同配置": [
    "同状态 · 同配置",
    "Same state · Same configuration"
  ],
  "画布小地图，点击定位": [
    "画布小地图，点击定位",
    "Canvas minimap; click to navigate"
  ],
  "尚无诊断。可先审阅已有截图，再运行诊断。": [
    "尚无诊断。可先审阅已有截图，再运行诊断。",
    "No diagnosis yet. Review the available screenshots, then run a diagnosis."
  ],
  "已记录结构评估 · 视觉需独立复核": [
    "已记录结构评估 · 视觉需独立复核",
    "Structural evaluation recorded · Visual review required"
  ],
  "结构评估待完成": [
    "结构评估待完成",
    "Structural evaluation pending"
  ],
  "按检查结果、标题与可达性筛选，不是像素差异": [
    "按检查结果、标题与可达性筛选，不是像素差异",
    "Filter by checks, headings and reachability, not pixel differences"
  ],
  "需先运行 evaluate 并导出结果": [
    "需先运行 evaluate 并导出结果",
    "Run evaluate and export the results first"
  ],
  "已恢复自动布局。": [
    "已恢复自动布局。",
    "Automatic layout restored."
  ],
  "此记录没有可展示的截图。请按右侧下一步指引采集并导出证据。": [
    "此记录没有可展示的截图。请按右侧下一步指引采集并导出证据。",
    "No screenshots in this run. Follow the next step to capture and export evidence."
  ],
  "所选状态已不在最新数据中。": [
    "所选状态已不在最新数据中。",
    "The selected state is no longer in the latest data."
  ],
  "已记录": [
    "已记录",
    "Recorded"
  ],
  "需要确认": [
    "需要确认",
    "Needs attention"
  ],
  "待完成": [
    "待完成",
    "Pending"
  ],
  "本轮没有剩余诊断问题。": [
    "本轮没有剩余诊断问题。",
    "No remaining findings in this run."
  ],
  "操作命令已复制。占位项需替换为你的项目信息。": [
    "操作命令已复制。占位项需替换为你的项目信息。",
    "Command copied. Replace placeholders with your project details."
  ],
  "请按 Ctrl+C / ⌘C 复制所选命令。": [
    "请按 Ctrl+C / ⌘C 复制所选命令。",
    "Press Ctrl+C / ⌘C to copy the selected command."
  ],
  "在本地终端完成操作，再导出记录并重新读取。": [
    "在本地终端完成操作，再导出记录并重新读取。",
    "Complete the action in your local terminal, then export and refresh."
  ],
  "截图已就绪。运行诊断，将问题与当前证据关联。": [
    "截图已就绪。运行诊断，将问题与当前证据关联。",
    "Screenshots are ready. Run a diagnosis to connect findings with evidence."
  ],
  "先查看问题引用的截图，再确认本次要解决的问题与范围。": [
    "先查看问题引用的截图，再确认本次要解决的问题与范围。",
    "Inspect the referenced screenshots, then confirm the finding and editing scope."
  ],
  "先启动隔离工作区的预览，再采集相同状态与视口。": [
    "先启动隔离工作区的预览，再采集相同状态与视口。",
    "Start the isolated worktree preview, then capture matching states and viewports."
  ],
  "由独立审阅者检查全部配对截图，记录视觉复核证明。": [
    "由独立审阅者检查全部配对截图，记录视觉复核证明。",
    "Have an independent reviewer inspect every screenshot pair and record a visual review."
  ],
  "依据结构检查和视觉复核，记录接受或拒绝的理由。": [
    "依据结构检查和视觉复核，记录接受或拒绝的理由。",
    "Use structural checks and visual review to record an accept or reject decision."
  ],
  "判断已保留在记录中。下一轮从新的证据开始。": [
    "判断已保留在记录中。下一轮从新的证据开始。",
    "The decision is recorded. Start the next run with fresh evidence."
  ],
  "新页面必须遵循人工批准的设计基础。": [
    "新页面必须遵循人工批准的设计基础。",
    "New screens must follow the approved design foundation."
  ],
  "存在未解决的视觉问题，只能记录拒绝。": [
    "存在未解决的视觉问题，只能记录拒绝。",
    "Unresolved visual issues remain. Only rejection can be recorded."
  ],
  "审阅已采集的项目证据。": [
    "审阅已采集的项目证据。",
    "Review the captured project evidence."
  ],
  "执行改动 / Code diff": [
    "代码改动",
    "Code changes"
  ],
  "刚刚读取 · ": [
    "刚刚读取 · ",
    "Just refreshed · "
  ],
  "已读取最新导出证据，保留画布位置。": [
    "已读取最新导出证据，保留画布位置。",
    "Latest exports loaded. Canvas position preserved."
  ],
  "读取失败，保留上次证据。请重新导出后重试。": [
    "读取失败，保留上次证据。请重新导出后重试。",
    "Refresh failed. Previous evidence is retained. Export again and retry."
  ],
  "未找到请求的审阅记录。请先将它导出到本地工作台。": [
    "未找到请求的审阅记录。请先将它导出到本地工作台。",
    "The requested run was not found. Export it to the local workbench first."
  ],
  "Baseline captured": [
    "采集基线",
    "Baseline captured"
  ],
  "Evidence diagnosed": [
    "诊断证据",
    "Evidence diagnosed"
  ],
  "Finding confirmed by a person": [
    "人工确认问题",
    "Finding confirmed by a person"
  ],
  "Scope planned": [
    "规划范围",
    "Scope planned"
  ],
  "Agent edit executed": [
    "执行修改",
    "Agent edit executed"
  ],
  "Result re-rendered": [
    "重新采集结果",
    "Result re-rendered"
  ],
  "Structural checks run": [
    "结构检查",
    "Structural checks run"
  ],
  "Independent Visual QA": [
    "独立视觉复核",
    "Independent Visual QA"
  ],
  "Human decision": [
    "人工判断",
    "Human decision"
  ],
  "EVALUATED": [
    "已评估",
    "EVALUATED"
  ],
  "AFTER CAPTURED": [
    "已采集修改后界面",
    "AFTER CAPTURED"
  ],
  "EXECUTED": [
    "已执行",
    "EXECUTED"
  ],
  "PLANNED": [
    "已规划",
    "PLANNED"
  ],
  "BASELINE ONLY": [
    "仅有基线",
    "BASELINE ONLY"
  ],
  "replay failed": [
    "重放失败",
    "replay failed"
  ],
  "Not captured": [
    "未采集",
    "Not captured"
  ],
  "No rationale was exported.": [
    "未导出判断理由。",
    "No rationale was exported."
  ],
  "This run is complete. Every stage has a recorded artifact.": [
    "本次审阅已完成，各阶段均有记录。",
    "This run is complete. Every stage has a recorded artifact."
  ],
  "Experience Score withheld — insufficient evidence": [
    "证据不足，暂不评分",
    "Experience Score withheld — insufficient evidence"
  ],
  "No rubric supplied.": [
    "未提供评分标准。",
    "No rubric supplied."
  ],
  "Agent execution": [
    "智能体执行",
    "Agent execution"
  ],
  "retained locally, not published": [
    "保留在本地，未发布",
    "retained locally, not published"
  ],
  "not retained": [
    "未保留",
    "not retained"
  ],
  "page responded, heading present, no horizontal overflow": [
    "页面正常响应、存在标题、无横向溢出",
    "page responded, heading present, no horizontal overflow"
  ],
  "Recorded decision": [
    "已记录的判断",
    "Recorded decision"
  ],
  "no after capture": [
    "未采集修改后界面",
    "no after capture"
  ],
  "no agent execution in this run": [
    "本轮无执行记录",
    "no agent execution in this run"
  ],
  "not evaluated": [
    "未评估",
    "not evaluated"
  ],
  "no human decision yet": [
    "尚无人工判断",
    "no human decision yet"
  ],
  "Complete run. The decision above was recorded by a person against these screenshots, not derived from the structural checks.": [
    "本次审阅已完成。上述判断由人工依据截图记录，不由结构检查推导。",
    "Complete run. The decision above was recorded by a person against these screenshots, not derived from the structural checks."
  ],
  "NOT INVENTORIED": [
    "尚未盘点",
    "NOT INVENTORIED"
  ],
  "0 artifacts": [
    "0 项资料",
    "0 artifacts"
  ],
  "This case has no brand, token, component or pattern inventory yet.": [
    "本项目尚未盘点品牌、样式变量、组件或交互模式。",
    "This case has no brand, token, component or pattern inventory yet."
  ],
  "Brand": [
    "品牌",
    "Brand"
  ],
  "Tokens": [
    "样式变量",
    "Tokens"
  ],
  "Components": [
    "组件",
    "Components"
  ],
  "Patterns": [
    "交互模式",
    "Patterns"
  ],
  "Not documented": [
    "未记录",
    "Not documented"
  ],
  "Repository-based review. The live site currently has different content; exportable before/after artifacts and real user-task validation are still needed.": [
    "基于仓库的审阅。线上内容已有不同；仍需导出前后对照证据并验证真实用户任务。",
    "Repository-based review. The live site currently has different content; exportable before/after artifacts and real user-task validation are still needed."
  ],
  "Fictional walkthrough. This illustrates the workflow; it is not evidence from a real product.": [
    "虚构案例，仅用于演示流程，不是真实产品证据。",
    "Fictional walkthrough. This illustrates the workflow; it is not evidence from a real product."
  ],
  "Priority is an explicit draft calculation: impact × confidence ÷ effort. Confirm it with a real user task before acting.": [
    "优先级按影响 × 置信度 ÷ 工作量估算。执行前请结合真实任务确认。",
    "Priority is an explicit draft calculation: impact × confidence ÷ effort. Confirm it with a real user task before acting."
  ],
  "No finding: this run built the surface for the first time": [
    "本轮为首次构建，尚无诊断问题",
    "No finding: this run built the surface for the first time"
  ],
  "No findings in this run": [
    "本轮暂无诊断问题",
    "No findings in this run"
  ],
  "With nothing rendered there was no evidence to diagnose, so the change was constrained by the approved design foundation.": [
    "首次构建没有现成界面供诊断，修改范围由已批准的设计基础约束。",
    "With nothing rendered there was no evidence to diagnose, so the change was constrained by the approved design foundation."
  ],
  "Run `harness diagnose` to build an evidence graph for this run.": [
    "运行 `harness diagnose`，建立本轮的证据关联。",
    "Run `harness diagnose` to build an evidence graph for this run."
  ],
  "This finding came from a Skill result rather than the Experience Spec, so no scoped brief can be generated from it. Record it in the spec first.": [
    "此问题来自技能结果，尚未写入体验规格。请先补充规格，再生成限定范围的修改任务。",
    "This finding came from a Skill result rather than the Experience Spec, so no scoped brief can be generated from it. Record it in the spec first."
  ],
  "Needs deployment match and user-task validation": [
    "需匹配部署版本并验证用户任务",
    "Needs deployment match and user-task validation"
  ],
  "Ready for human review": [
    "待人工审阅",
    "Ready for human review"
  ],
  "Change not started": [
    "尚未开始修改",
    "Change not started"
  ],
  "Recorded by the harness CLI": [
    "通过本地命令记录判断",
    "Recorded by the harness CLI"
  ],
  "Save judgment": [
    "保存判断",
    "Save judgment"
  ],
  "Agent brief downloaded. Review the real app and confirm the diagnosis before applying an edit.": [
    "修改任务已下载。执行前请审阅真实界面并确认诊断。",
    "Agent brief downloaded. Review the real app and confirm the diagnosis before applying an edit."
  ],
  "Use \"pnpm harness judge\" to record a decision for a harness run.": [
    "请使用“pnpm harness judge”记录本轮判断。",
    "Use \"pnpm harness judge\" to record a decision for a harness run."
  ],
  "Choose accept or reject before saving.": [
    "请先选择接受或拒绝，再保存。",
    "Choose accept or reject before saving."
  ],
  "undated": [
    "日期未记录",
    "undated"
  ],
  "the run diagnosis": [
    "本轮诊断",
    "the run diagnosis"
  ],
  "evaluator": [
    "评估器",
    "evaluator"
  ],
  "unknown": [
    "未知",
    "unknown"
  ],
  "Before": [
    "修改前",
    "Before"
  ],
  "After": [
    "修改后",
    "After"
  ],
  "采集起始界面": [
    "采集起始界面",
    "Capture baseline"
  ],
  "诊断已有证据": [
    "诊断已有证据",
    "Diagnose evidence"
  ],
  "确认值得解决的问题": [
    "确认值得解决的问题",
    "Confirm the finding"
  ],
  "确定修改范围": [
    "确定修改范围",
    "Plan the scope"
  ],
  "开始隔离修改": [
    "开始隔离修改",
    "Execute in isolation"
  ],
  "采集修改后的界面": [
    "采集修改后的界面",
    "Capture the result"
  ],
  "检查结构与可达性": [
    "检查结构与可达性",
    "Evaluate structure"
  ],
  "独立视觉复核": [
    "独立视觉复核",
    "Independent visual review"
  ],
  "等待你的最终判断": [
    "等待你的最终判断",
    "Awaiting your decision"
  ],
  "本次审阅已记录": [
    "本次审阅已记录",
    "Review recorded"
  ],
  "视觉复核未通过": [
    "视觉复核未通过",
    "Visual review failed"
  ],
  "视觉证据待补充": [
    "视觉证据待补充",
    "More visual evidence needed"
  ],
  "问题证据已过期": [
    "问题证据已过期",
    "Finding is stale"
  ],
  "执行未完成": [
    "执行未完成",
    "Execution incomplete"
  ],
  "执行超出允许范围": [
    "执行超出允许范围",
    "Execution exceeded its boundary"
  ],
  "项目接入未完成": [
    "项目接入未完成",
    "Project onboarding incomplete"
  ],
  "记录基线缺失原因": [
    "记录基线缺失原因",
    "Record why the baseline is absent"
  ],
  "批准设计基础": [
    "批准设计基础",
    "Approve design foundation"
  ],
  "规划首个页面": [
    "规划首个页面",
    "Plan the first screen"
  ],
  "‹问题 ID›": [
    "‹问题 ID›",
    "‹finding ID›"
  ],
  "‹预览地址›": [
    "‹预览地址›",
    "‹preview URL›"
  ],
  "‹确认理由›": [
    "‹确认理由›",
    "‹confirmation rationale›"
  ],
  "‹项目仓库路径›": [
    "‹项目仓库路径›",
    "‹repository path›"
  ],
  "‹隔离工作区预览地址›": [
    "‹隔离工作区预览地址›",
    "‹worktree preview URL›"
  ],
  "‹拒绝理由›": [
    "‹拒绝理由›",
    "‹rejection rationale›"
  ],
  "‹判断理由›": [
    "‹判断理由›",
    "‹decision rationale›"
  ],
  "‹缺少基线的原因›": [
    "‹缺少基线的原因›",
    "‹reason for absent baseline›"
  ],
  "‹批准文件.json›": [
    "‹批准文件.json›",
    "‹approval.json›"
  ],
  "accepted": [
    "已接受",
    "accepted"
  ],
  "approved": [
    "已批准",
    "approved"
  ],
  "candidate": [
    "候选",
    "candidate"
  ],
  "observed": [
    "已观察",
    "observed"
  ],
  "pending": [
    "待处理",
    "pending"
  ],
  "accept": [
    "接受",
    "accept"
  ],
  "reject": [
    "拒绝",
    "reject"
  ],
  "supported": [
    "有证据支持",
    "supported"
  ],
  "unsupported": [
    "缺少支持",
    "unsupported"
  ],
  "stale": [
    "已过期",
    "stale"
  ],
  "pass": [
    "通过",
    "pass"
  ],
  "fail": [
    "未通过",
    "fail"
  ],
  "needs-evidence": [
    "需补充证据",
    "needs-evidence"
  ],
  "authored-candidate": [
    "人工提出的候选",
    "authored-candidate"
  ],
  "needs-confirmation": [
    "待确认",
    "needs-confirmation"
  ],
  "confirmed": [
    "已确认",
    "confirmed"
  ],
  "completed": [
    "已完成",
    "completed"
  ],
  "failed": [
    "失败",
    "failed"
  ],
  "pageResponded": [
    "页面正常响应",
    "pageResponded"
  ],
  "hasHeading": [
    "存在标题",
    "hasHeading"
  ],
  "noHorizontalOverflow": [
    "无横向溢出",
    "noHorizontalOverflow"
  ],
  "phone": ["手机", "Phone"],
  "desktop": [
    "桌面",
    "desktop"
  ],
  "mobile": [
    "移动端",
    "mobile"
  ],
  "page": [
    "页面",
    "page"
  ],
  "Next: {0}": [
    "下一步：{0}",
    "Next: {0}"
  ],
  "JUDGED / {0}": [
    "已判断 / {0}",
    "JUDGED / {0}"
  ],
  "VISUAL QA / {0}": [
    "视觉复核 / {0}",
    "VISUAL QA / {0}"
  ],
  "CONFIRMED / {0}": [
    "已确认 / {0}",
    "CONFIRMED / {0}"
  ],
  "State not reached: {0}": [
    "状态未到达：{0}",
    "State not reached: {0}"
  ],
  "{0} screenshot of {1} in {2}": [
    "{1} · {2} · {0}截图",
    "{0} screenshot of {1} in {2}"
  ],
  "Experience Score {0} / 100 · {1}@{2}": [
    "体验评分 {0} / 100 · {1}@{2}",
    "Experience Score {0} / 100 · {1}@{2}"
  ],
  "Evidence coverage {0}%. A score is a heuristic quality signal, not conversion or user research.": [
    "证据覆盖率 {0}%。评分仅供质量判断参考，不代表转化率或用户研究。",
    "Evidence coverage {0}%. A score is a heuristic quality signal, not conversion or user research."
  ],
  "Finding {0}": [
    "问题 {0}",
    "Finding {0}"
  ],
  "branch {0} · log {1}": [
    "分支 {0} · 日志{1}",
    "branch {0} · log {1}"
  ],
  "Skill {0}": [
    "技能 {0}",
    "Skill {0}"
  ],
  "Checks {0}": [
    "检查 {0}",
    "Checks {0}"
  ],
  "failed: {0}": [
    "未通过：{0}",
    "failed: {0}"
  ],
  "Incomplete run: {0}. Structural checks alone cannot show that the user task improved.": [
    "本轮尚未完成：{0}。仅凭结构检查无法证明用户任务得到改善。",
    "Incomplete run: {0}. Structural checks alone cannot show that the user task improved."
  ],
  "{0} artifacts": [
    "{0} 项资料",
    "{0} artifacts"
  ],
  "{0} FINDINGS": [
    "{0} 个问题",
    "{0} FINDINGS"
  ],
  "{0} · PRIORITY {1}": [
    "{0} · 优先级 {1}",
    "{0} · PRIORITY {1}"
  ],
  "Impact {0}/5 · Confidence {1}/5 · Effort {2}/5 · {3} evidence": [
    "影响 {0}/5 · 置信度 {1}/5 · 工作量 {2}/5 · {3} 项证据",
    "Impact {0}/5 · Confidence {1}/5 · Effort {2}/5 · {3} evidence"
  ],
  "Before: {0}": [
    "修改前：{0}",
    "Before: {0}"
  ],
  "After: {0}": [
    "修改后：{0}",
    "After: {0}"
  ],
  "Could not open {0}: {1}": [
    "无法打开 {0}：{1}",
    "Could not open {0}: {1}"
  ],
  "Run {0} / {1} · {2}": [
    "记录 {0} / {1} · {2}",
    "Run {0} / {1} · {2}"
  ],
  "无法读取记录：{0}": [
    "无法读取记录：{0}",
    "Could not load run: {0}"
  ],
  "{0} 分钟前读取 · {1}": [
    "{0} 分钟前读取 · {1}",
    "Refreshed {0} minutes ago · {1}"
  ],
  "此状态未到达：{0}{1}": [
    "此状态未到达：{0}{1}",
    "State not reached: {0}{1}"
  ],
  " · 操作 {0}": [
    " · 操作 {0}",
    "· Action {0}"
  ],
  "{0} 个文件 · {1}": [
    "{0} 个文件 · {1}",
    "{0} files · {1}"
  ],
  "关联问题 · {0}": [
    "关联问题 · {0}",
    "Related findings · {0}"
  ],
  "FINDING / {0}": [
    "问题 / {0}",
    "FINDING / {0}"
  ],
  "诊断问题 · {0}": [
    "诊断问题 · {0}",
    "Findings · {0}"
  ],
  "{0} 个状态 / {1} 张证据卡": [
    "{0} 个状态 / {1} 张证据卡",
    "States: {0} / Evidence cards: {1}"
  ],
  "下一项：{0} · {1}": [
    "下一项：{0} · {1}",
    "Next finding: {0} · {1}"
  ],
  "Evidence: {0}. Status {1}; this is a proposed priority with no behavioural data attached.": [
    "证据：{0}。状态：{1}；该优先级尚无行为数据支持。",
    "Evidence: {0}. Status {1}; this is a proposed priority with no behavioural data attached."
  ],
  "Your {0} decision and reason were saved in this browser. Export the Experience Spec to keep a portable copy.": [
    "你的“{0}”判断及理由已保存在此浏览器中。可导出体验规格以备份。",
    "Your {0} decision and reason were saved in this browser. Export the Experience Spec to keep a portable copy."
  ],
  "From {0}, merging Experience Spec observations with completed Skill results. Priority is impact × confidence ÷ effort; confirm it against a real user task before acting.": [
    "来源：{0}，合并体验规格中的观察与技能结果。优先级为影响 × 置信度 ÷ 工作量；执行前请结合真实任务确认。",
    "From {0}, merging Experience Spec observations with completed Skill results. Priority is impact × confidence ÷ effort; confirm it against a real user task before acting."
  ],
  "Could not read {0}/index.json: {1}. Exported runs are not listed.": [
    "无法读取 {0}/index.json：{1}。未能列出已导出的记录。",
    "Could not read {0}/index.json: {1}. Exported runs are not listed."
  ],
  "captured {0}": [
    "采集自 {0}",
    "captured {0}"
  ],
  "built a surface that had no address when the run started": [
    "构建了启动时尚无预览地址的界面",
    "built a surface that had no address when the run started"
  ],
  "Harness run {0} {1}. A run's decision is recorded with \"pnpm harness judge\"; this page shows what was saved on disk.": [
    "本地记录 {0}，{1}。请通过“pnpm harness judge”记录判断；此页面展示已保存的结果。",
    "Harness run {0} {1}. A run's decision is recorded with \"pnpm harness judge\"; this page shows what was saved on disk."
  ],
  "Start the retained worktree preview, then capture --phase after.": [
    "启动保留的工作区预览，然后运行 capture --phase after。",
    "Start the retained worktree preview, then capture --phase after."
  ],
  "Inspect the repository, then start a new run.": [
    "检查仓库后开始新一轮。",
    "Inspect the repository, then start a new run."
  ],
  "Inspect the retained worktree, then start a new run.": [
    "检查保留的工作区后开始新一轮。",
    "Inspect the retained worktree, then start a new run."
  ],
  "Repair in the retained worktree or start a new run.": [
    "在保留的工作区修复，或开始新一轮。",
    "Repair in the retained worktree or start a new run."
  ],
  "Start a new run with the missing states.": [
    "补充缺失状态后开始新一轮。",
    "Start a new run with the missing states."
  ],
  "Start a new diagnosis or run.": [
    "重新诊断或开始新一轮。",
    "Start a new diagnosis or run."
  ],
  "Fix the preview and start a new run.": [
    "修复预览后开始新一轮。",
    "Fix the preview and start a new run."
  ],
  "Visual QA needs more evidence.": [
    "视觉复核需要更多证据。",
    "Visual QA needs more evidence."
  ],
  "Independent Visual QA found an unresolved regression; only reject is allowed.": [
    "独立视觉复核发现未解决的回归问题，只能拒绝。",
    "Independent Visual QA found an unresolved regression; only reject is allowed."
  ],
  "A run without a baseline has to record why one is absent before it can plan.": [
    "缺少基线时，需先记录原因再规划。",
    "A run without a baseline has to record why one is absent before it can plan."
  ],
  "A person must approve a versioned Design Foundation before page composition.": [
    "页面构建前，需人工批准指定版本的设计基础。",
    "A person must approve a versioned Design Foundation before page composition."
  ],
  "A person must confirm one current finding and the edit scope.": [
    "需人工确认当前问题及修改范围。",
    "A person must confirm one current finding and the edit scope."
  ],
  "The selected finding no longer matches the baseline.": [
    "所选问题已不再匹配当前基线。",
    "The selected finding no longer matches the baseline."
  ],
  "Project onboarding failed.": [
    "项目接入失败。",
    "Project onboarding failed."
  ],
  "capture --run {0} --phase before --url ‹预览地址›": [
    "capture --run {0} --phase before --url ‹预览地址›",
    "capture --run {0} --phase before --url ‹preview URL›"
  ],
  "confirm --run {0} --finding {1} --verdict supported --note ‹确认理由›": [
    "confirm --run {0} --finding {1} --verdict supported --note ‹确认理由›",
    "confirm --run {0} --finding {1} --verdict supported --note ‹confirmation rationale›"
  ],
  "execute --run {0} --repo ‹项目仓库路径› --agent codex": [
    "execute --run {0} --repo ‹项目仓库路径› --agent codex",
    "execute --run {0} --repo ‹repository path› --agent codex"
  ],
  "capture --run {0} --phase after --url ‹隔离工作区预览地址›": [
    "capture --run {0} --phase after --url ‹隔离工作区预览地址›",
    "capture --run {0} --phase after --url ‹worktree preview URL›"
  ],
  "judge --run {0} --decision reject --reason ‹拒绝理由›": [
    "judge --run {0} --decision reject --reason ‹拒绝理由›",
    "judge --run {0} --decision reject --reason ‹rejection rationale›"
  ],
  "judge --run {0} --decision ‹accept/reject› --reason ‹判断理由›": [
    "judge --run {0} --decision ‹accept/reject› --reason ‹判断理由›",
    "judge --run {0} --decision ‹accept/reject› --reason ‹decision rationale›"
  ],
  "baseline --run {0} --reason ‹缺少基线的原因›": [
    "baseline --run {0} --reason ‹缺少基线的原因›",
    "baseline --run {0} --reason ‹reason for absent baseline›"
  ],
  "foundation-approve --run {0} --input ‹批准文件.json›": [
    "foundation-approve --run {0} --input ‹批准文件.json›",
    "foundation-approve --run {0} --input ‹approval.json›"
  ],
  "批注": [
    "批注",
    "Annotate"
  ],
  "局部批注": ["局部批注", "Region comment"],
  "箭头": ["箭头", "Arrow"],
  "拖动框选局部，然后输入批注": ["拖动框选局部，然后输入批注", "Drag to select a region, then write a comment"],
  "写下批注…": ["写下批注…", "Write a comment…"],
  "文字": [
    "文字",
    "Text"
  ],
  "画笔": [
    "画笔",
    "Draw"
  ],
  "撤销": [
    "撤销",
    "Undo"
  ],
  "重做": [
    "重做",
    "Redo"
  ],
  "保存": [
    "保存",
    "Save"
  ],
  "正在保存…": [
    "正在保存…",
    "Saving…"
  ],
  "已保存到本地": [
    "已保存到本地",
    "Saved locally"
  ],
  "修改任务已保存，尚未执行代码修改。": [
    "修改任务已保存，尚未执行代码修改。",
    "Change request saved. No code changes have been executed."
  ],
  "保存失败，请重试；离开前请导出备份。": [
    "保存失败，请重试；离开前请导出备份。",
    "Save failed. Retry or export a backup before leaving."
  ],
  "正在读取画布…": [
    "正在读取画布…",
    "Loading canvas…"
  ],
  "画布读取失败，请重试。": [
    "画布读取失败，请重试。",
    "Canvas could not be loaded. Please retry."
  ],
  "请写下希望调整的内容，再生成修改任务。": [
    "请写下希望调整的内容，再生成修改任务。",
    "Describe the changes before creating a request."
  ],
  "UI 调整画布": [
    "UI 调整画布",
    "UI editing canvas"
  ],
  "从这一屏开始修改": [
    "从这一屏开始修改",
    "Start with this screen"
  ],
  "选中批注工具，拖出箭头并写下修改要求。": [
    "选中批注工具，拖出箭头并写下修改要求。",
    "Select Annotate, draw an arrow and describe your change."
  ],
  "当前界面": [
    "当前界面",
    "Current screen"
  ],
  "查看审阅报告": [
    "查看审阅报告",
    "View review report"
  ],
  "暂无可编辑的截图，请先采集界面。": [
    "暂无可编辑的截图，请先采集界面。",
    "No screenshots available. Capture a screen first."
  ],
  "这次想怎么改？": [
    "这次想怎么改？",
    "What should change?"
  ],
  "选一个局部，告诉 AI 怎么改": ["选一个局部，告诉 AI 怎么改", "Select a region and tell AI what to change"],
  "点击“局部批注”，拖动框选界面中的区域，然后直接输入批注。选区、坐标、原图和当前审阅记录会自动绑定。": ["点击“局部批注”，拖动框选界面中的区域，然后直接输入批注。选区、坐标、原图和当前审阅记录会自动绑定。", "Choose Region comment, drag over part of the interface, then type your comment. The region, coordinates, original image, and current review are linked automatically."],
  "补充整体说明（可选）": ["补充整体说明（可选）", "Overall context (optional)"],
  "局部批注会自动带入。这里补充整体目标或约束。": ["局部批注会自动带入。这里补充整体目标或约束。", "Region comments are included automatically. Add an overall goal or constraint here."],
  "请框选一个局部并写下批注，或补充整体说明。": ["请框选一个局部并写下批注，或补充整体说明。", "Select a region and write a comment, or add overall context."],
  "箭头标位置，文字说明改法。这里只显示当前界面，前后对照留在报告中。": [
    "箭头标位置，文字说明改法。这里只显示当前界面，前后对照留在报告中。",
    "Mark the location with an arrow and describe the change. Before/after comparisons are in the report."
  ],
  "修改要求": [
    "修改要求",
    "Change request"
  ],
  "例如：让主要按钮更醒目，减少首屏文字。": [
    "例如：让主要按钮更醒目，减少首屏文字。",
    "For example: emphasize the primary button and shorten the hero copy."
  ],
  "生成修改任务": [
    "生成修改任务",
    "Create change request"
  ],
  "导出批注图": [
    "导出批注图",
    "Export annotations"
  ],
  "导出画布备份": [
    "导出画布备份",
    "Export canvas backup"
  ],
  "这是界面修改草稿。生成任务不会自动修改项目代码。": [
    "这是界面修改草稿。生成任务不会自动修改项目代码。",
    "This is a UI editing draft. Creating a request does not automatically change project code."
  ],
  "界面调整": ["界面调整", "UI adjustments"],
  "导出与备份": ["导出与备份", "Export and backup"],
  "查看设计基础": ["查看设计基础", "View design foundation"],
  "项目与任务": ["项目与任务", "Project and tasks"],
  "关闭": ["关闭", "Close"],
  "项目配置文件": ["项目配置文件", "Project configuration file"],
  "项目配置记录仓库、预览和启动方式；修改源码沿用当前审阅项目。": ["项目配置记录仓库、预览和启动方式；修改源码沿用当前审阅项目。", "The project configuration records its repository, preview and startup command. Code changes use the current reviewed project."],
  "连接并开始审阅": ["连接并开始审阅", "Connect and start review"],
  "关联当前审阅项目": ["关联当前审阅项目", "Connect current review"],
  "当前审阅": ["当前审阅", "Current review"],
  "确认或判断理由": ["确认或判断理由", "Confirmation or judgment reason"],
  "我已核对证据并确认本轮修改范围": ["我已核对证据并确认本轮修改范围", "I have checked the evidence and confirmed this change scope"],
  "请先确认修改范围": ["请先确认修改范围", "Confirm the change scope first"],
  "确认修改范围": ["确认修改范围", "Confirm change scope"],
  "生成执行计划": ["生成执行计划", "Generate execution plan"],
  "执行源码修改": ["执行源码修改", "Execute code change"],
  "重试采集与检查": ["重试采集与检查", "Retry capture and checks"],
  "独立视觉复核 JSON": ["独立视觉复核 JSON", "Independent visual review JSON"],
  "粘贴独立复核者提供的完整记录": ["粘贴独立复核者提供的完整记录", "Paste the complete attestation from an independent reviewer"],
  "导入视觉复核": ["导入视觉复核", "Import visual review"],
  "记录人工判断": ["记录人工判断", "Record human judgment"],
  "正在执行…": ["正在执行…", "Working…"],
  "任务已提交，可在下方查看进度。": ["任务已提交，可在下方查看进度。", "Task submitted. Progress appears below."],
  "操作失败": ["操作失败", "Operation failed"],
  "失败详情": ["失败详情", "Failure details"],
  "取消任务": ["取消任务", "Cancel task"],
  "打开审阅报告": ["打开审阅报告", "Open review report"],
  "任务读取失败": ["任务读取失败", "Could not load tasks"],
  "操作": ["操作", "Action"],
  "保存修改草稿": ["保存修改草稿", "Save change draft"],
  "生成图片": ["生成图片", "Generate image"],
  "按批注改图": ["按批注改图", "Edit annotated image"],
  "生成 HTML 草稿": ["生成 HTML 草稿", "Generate HTML draft"],
  "生成演示文稿": ["生成演示文稿", "Generate slides"],
  "修改当前项目源码": ["修改当前项目源码", "Modify reviewed project code"],
  "确认并修改源码": ["确认并修改源码", "Confirm and modify code"],
  "开始创作": ["开始创作", "Start creating"],
  "修改在隔离工作区执行，完成后仍需复核与人工判断。": ["修改在隔离工作区执行，完成后仍需复核与人工判断。", "Code changes run in an isolated worktree and still require independent review and human judgment."],
  "创作结果可放回画布；HTML 与演示文稿可单独预览。": ["创作结果可放回画布；HTML 与演示文稿可单独预览。", "Place generated results on the canvas. HTML drafts and slides also have a separate preview."],
  "放到画布": ["放到画布", "Place on canvas"],
  "预览作品": ["预览作品", "Preview artifact"],
  "下载作品": ["下载作品", "Download artifact"],
  "queued": ["排队中", "Queued"],
  "running": ["执行中", "Running"],
  "succeeded": ["已完成", "Succeeded"],
  "failed": ["失败", "Failed"],
  "cancelled": ["已取消", "Cancelled"],
  "interrupted": ["已中断", "Interrupted"],
  "complete": ["完成", "Complete"],
  "generating": ["生成中", "Generating"],
  "rendering": ["渲染中", "Rendering"],
  "capturing": ["采集基线", "Capturing"],
  "diagnosing": ["诊断中", "Diagnosing"],
  "recapturing": ["采集修改结果", "Recapturing"],
  "evaluating": ["检查中", "Evaluating"],
  "executing": ["修改中", "Executing"],
  "source": ["源码修改", "Source"],
  "image": ["图片生成", "Image"],
  "edit-image": ["批注改图", "Edit-image"],
  "html": ["HTML 草稿", "Html"],
  "slides": ["演示文稿", "Slides"],
  "repair": ["自动修复", "Repair"],
  "onboard": ["接入项目", "Onboard"],
  "confirm": ["确认范围", "Confirm"],
  "plan": ["执行计划", "Plan"],
  "execute": ["修改源码", "Execute"],
  "recapture": ["重新采集", "Recapture"],
  "judge": ["人工判断", "Judge"],
  "attest": ["视觉复核", "Attest"],
"项目仓库目录": ["项目仓库目录", "Project repository directory"],
"预览地址": ["预览地址", "Preview URL"],
"项目名称": ["项目名称", "Project name"],
"预览启动程序": ["预览启动程序", "Preview executable"],
"启动参数 JSON": ["启动参数 JSON", "Startup arguments JSON"],
"连接此项目": ["连接此项目", "Connect this project"],
"创建审阅": ["创建审阅", "Create review"],
"已有配置文件": ["已有配置文件", "Existing configuration file"],
"已关联项目": ["已关联项目", "Connected project"],
"尚未关联本地源码": ["尚未关联本地源码", "Local source is not connected yet"],
"项目历史": ["项目历史", "Project history"],
"连接项目": ["连接项目", "Connect project"],
"项目经验候选": ["项目经验候选", "Project memory candidates"],
"本轮变动范围": ["本轮变动范围", "Changes in this review"],
"comparing-source": ["正在核对源码变化", "Comparing source changes"],
"已根据本轮源码变化选择检查项。": ["已根据本轮源码变化选择检查项。", "Checks were selected from the current source changes."],
"上次审阅没有有效的接受记录，本轮使用完整范围。": ["上次审阅没有有效的接受记录，本轮使用完整范围。", "The previous review has no active acceptance. This review uses the full scope."],
"上次审阅属于其他项目，本轮使用完整范围。": ["上次审阅属于其他项目，本轮使用完整范围。", "The previous review belongs to another project. This review uses the full scope."],
"上次审阅缺少完整源码对照，本轮使用完整范围。": ["上次审阅缺少完整源码对照，本轮使用完整范围。", "The previous review has no complete source inventory. This review uses the full scope."],
"当前源码有未提交改动，无法生成可靠的增量范围。": ["当前源码有未提交改动，无法生成可靠的增量范围。", "Commit current source changes before deriving an incremental scope."],
"源码对照无法核验，本轮使用完整范围。": ["源码对照无法核验，本轮使用完整范围。", "The source comparison cannot be verified. This review uses the full scope."],
"源码输入未变化，仍会按配置检查本轮任务。": ["源码输入未变化，仍会按配置检查本轮任务。", "Source inputs are unchanged. The current task will still be reviewed as configured."],
"变动包含尚未映射的文件类型，本轮使用完整范围。": ["变动包含尚未映射的文件类型，本轮使用完整范围。", "Some changed file types have no scope mapping. This review uses the full scope."],
"对照审阅": ["对照审阅", "Baseline review"],
"变动文件": ["变动文件", "Changed files"],
"新增文件": ["新增文件", "Added file"],
"修改文件": ["修改文件", "Modified file"],
"删除文件": ["删除文件", "Deleted file"],
"页面采集仍按配置执行。未采集的页面不代表已复查。": ["页面采集仍按配置执行。未采集的页面不代表已复查。", "Page capture follows the configured plan. Uncaptured pages are not marked reviewed."],
"仅本轮不适用": ["仅本轮不适用", "Exclude for this review"],
"A run exception reason is required, up to 10000 characters.": ["请填写本轮例外理由，最多 10,000 字。", "Enter a reason for this review exception, up to 10,000 characters."],
"Run memory exceptions can only change before execution and before after-capture. Start a new review to change them.": ["修改或采集结果后，请开始新审阅再调整例外。", "Start a new review to change exceptions after execution or result capture."],
"The approved principle changed or is unavailable. Reload project memory.": ["这条已批准原则已变化或不可用，请重新读取项目经验。", "The approved principle changed or is unavailable. Reload project memory."],
"Connect this run to its local project before recording a memory exception.": ["请先连接本地项目，再记录本轮例外。", "Connect the local project before recording a review exception."],
"恢复本轮使用": ["恢复本轮使用", "Use in this review again"],
"本轮已恢复使用": ["本轮已恢复使用", "Restored for this review"],
"本轮例外已记录，请重新生成计划。": ["本轮例外已记录，请重新生成计划。", "The review exception was saved. Generate a new plan before continuing."],
"本轮决定已撤回": ["本轮决定已撤回", "Decision withdrawn"],
"撤回本轮决定": ["撤回本轮决定", "Withdraw this decision"],
"原决定": ["原决定", "Original decision"],
"撤回理由": ["撤回理由", "Withdrawal reason"],
"撤回这次决定": ["撤回这次决定", "Withdraw decision"],
"撤回会停用由这次决定产生的项目经验。原决定和证据会保留；重新判断需要开始新审阅。": ["撤回会停用由这次决定产生的项目经验。原决定和证据会保留；重新判断需要开始新审阅。", "Withdrawal disables project principles derived from this decision. The original decision and evidence remain; start a new review to reassess."],
"决定已撤回，但导出尚未更新。": ["决定已撤回，但导出尚未更新。", "The decision was withdrawn, but its export has not updated."],
"决定已撤回。": ["决定已撤回。", "Decision withdrawn."],
"来源决定已撤回": ["来源决定已撤回", "Source decision withdrawn"],
"source-withdrawn": ["来源决定已撤回", "Source decision withdrawn"],
"重新审阅当前项目": ["重新审阅当前项目", "Review the current project again"],
"原决定已撤回。保留本轮历史，从当前源码重新采集并判断。": ["原决定已撤回。保留本轮历史，从当前源码重新采集并判断。", "The original decision was withdrawn. Preserve this history and collect fresh evidence from current source."],
"The recorded human judgment was withdrawn. Preserve this history and start a new review to reassess the current project.": ["原决定已撤回。保留本轮历史，开始新审阅后重新判断当前项目。", "The recorded human judgment was withdrawn. Preserve this history and start a new review to reassess the current project."],
"诊断时参考的项目经验": ["诊断时参考的项目经验", "Project context saved with this diagnosis"],
"这是本次诊断保存的历史经验，不代表当前页面存在问题，也不替代本轮证据。": ["这是本次诊断保存的历史经验，不代表当前页面存在问题，也不替代本轮证据。", "This historical context was saved with the diagnosis. It does not establish a current issue or replace this review's evidence."],
"来源审阅": ["来源审阅", "Source review"],
"不适用的情况（可选，每行一项）": ["不适用的情况（可选，每行一项）", "Exceptions (optional, one per line)"],
"不适用的情况": ["不适用的情况", "Exceptions"],
"撤回候选": ["撤回候选", "Withdraw candidate"],
"停用原则": ["停用原则", "Retire principle"],
"withdrawn": ["已撤回", "Withdrawn"],
"rejected": ["已拒绝", "Rejected"],
"建议保留的原则": ["建议保留的原则", "Proposed principle"],
"适用范围": ["适用范围", "Applicable context"],
"批准原则": ["批准原则", "Approve principle"],
"拒绝原则": ["拒绝原则", "Reject principle"],
"提出经验候选": ["提出经验候选", "Propose project memory"],
"提取设计与品牌基础": ["提取设计与品牌基础", "Extract design and brand foundation"],
"重新提取设计基础": ["重新提取设计基础", "Extract design foundation again"],
"Extracting design foundation…": ["正在提取设计基础…", "Extracting design foundation…"],
"EXTRACTION FAILED": ["提取失败", "EXTRACTION FAILED"],
"OBSERVED · EXTRACTION FAILED": ["候选 · 提取失败", "OBSERVED · EXTRACTION FAILED"],
"OBSERVED · PARTIAL EXTRACTION": ["候选 · 部分完成", "OBSERVED · PARTIAL EXTRACTION"],
"OBSERVED · AUTO-EXTRACTED": ["候选 · 自动提取", "OBSERVED · AUTO-EXTRACTED"],
"Automatic extraction failed: {0}": ["自动提取失败：{0}", "Automatic extraction failed: {0}"],
"Automatically extracted candidates still need an explicit decision before generation can use them.": ["自动提取的候选仍需逐项确认，才能用于后续生成。", "Automatically extracted candidates still need an explicit decision before generation can use them."],
"No design foundation has been extracted yet.": ["尚未提取设计基础。", "No design foundation has been extracted yet."],
"extracting-foundation": ["提取设计基础", "Extracting foundation"],
"设计基础批准记录 JSON": ["设计基础批准记录 JSON", "Foundation approval record JSON"],
"记录设计基础批准": ["记录设计基础批准", "Record foundation approval"],
"foundation": ["提取设计基础", "Foundation extraction"],
"foundation-approve": ["批准设计基础", "Foundation approval"],
"视觉复核与判断": ["视觉复核与判断", "Visual review and judgment"],
"原始截图已变化，请重新生成。": ["原始截图已变化，请重新生成。", "The source screenshot changed. Generate a new result."],
"基于当前项目重新审阅": ["基于当前项目重新审阅", "Start a fresh project review"],
"已采集基线":["已采集基线","Baseline captured"],
"尚未采集基线":["尚未采集基线","Baseline not captured"],
"已采集修改结果":["已采集修改结果","Changed interface captured"],
"尚未采集修改结果":["尚未采集修改结果","Changed interface not captured"],
"等待人工判断":["等待人工判断","Awaiting human judgment"],
"尚未完成复评":["尚未完成复评","Re-evaluation not complete"],
"这是导出的审阅记录；连接原始运行后才能复核或记录决定。":["这是导出的审阅记录；连接原始运行后才能复核或记录决定。","This is an exported review. Connect the original run to request another review or record a decision."],
"页面审阅": ["页面审阅", "Page review"],
"页面与状态": ["页面与状态", "Pages and states"],
"已采集": ["已采集", "Captured"],
"复核已引用": ["复核已引用", "Cited in review"],
"采集失败或缺少截图": ["采集失败或缺少截图", "Capture failed or missing"],
"已采集 · 未复核": ["已采集 · 未复核", "Captured · not reviewed"],
"路由 {0} · 状态 {1} · 交互 {2}": ["路由 {0} · 状态 {1} · 交互 {2}", "Routes {0} · states {1} · interactions {2}"],
"交互证据：已采集 {0}/{1} · 复核已引用 {2}/{3}": ["交互证据：已采集 {0}/{1} · 复核已引用 {2}/{3}", "Interaction evidence: captured {0}/{1} · cited by review {2}/{3}"],
"部分交互证据未采集成功。打开“项目与任务”查看失败原因并重新采集。": ["部分交互证据未采集成功。打开“项目与任务”查看失败原因并重新采集。", "Some interaction evidence could not be captured. Open Projects and tasks to inspect failures and recapture."],
"交互已采集，但独立复核尚未引用全部证据。已采集不等于已通过。": ["交互已采集，但独立复核尚未引用全部证据。已采集不等于已通过。", "Interactions were captured, but independent review has not cited all evidence. Captured does not mean passed."],
"尚未计划交互状态。菜单、弹窗、表单和错误恢复仍未审阅。": ["尚未计划交互状态。菜单、弹窗、表单和错误恢复仍未审阅。", "No interaction states are planned. Menus, dialogs, forms, and error recovery remain unreviewed."],
"{0} 个证据采集失败。打开“项目与任务”重新采集，失败原因会保留。": ["{0} 个证据采集失败。打开“项目与任务”重新采集，失败原因会保留。", "{0} evidence captures failed. Open Projects and tasks to recapture; failure reasons are preserved."],
"仅统计本次计划内的截图。未列出的页面与交互仍未审阅；视口截图不代表整页。": ["仅统计本次计划内的截图。未列出的页面与交互仍未审阅；视口截图不代表整页。", "Only planned screenshots are counted. Unlisted pages and interactions remain unreviewed; a viewport capture does not cover the entire page."],
"查看完整审阅报告": ["查看完整审阅报告", "Open full review report"],
"实时页面": ["实时页面", "Live page"],
"历史证据": ["历史证据", "Historical evidence"],
"当前仓库与采集提交一致，但运行中的页面构建版本尚未固定。它不会自动重放选中的交互状态。": ["当前仓库与采集提交一致，但运行中的页面构建版本尚未固定。它不会自动重放选中的交互状态。", "The current repository matches the captured commit, but the running page build is not pinned. Selected interaction states are not replayed automatically."],
"当前仓库提交与采集证据不一致。实时页面不能用于解释这份历史证据。": ["当前仓库提交与采集证据不一致。实时页面不能用于解释这份历史证据。", "The current repository commit differs from the captured evidence. Do not use the live page to interpret this historical evidence."],
"当前仓库有未提交修改。实时页面不能归属于已记录的源码版本。": ["当前仓库有未提交修改。实时页面不能归属于已记录的源码版本。", "The current repository has uncommitted changes. The live page cannot be attributed to a recorded source version."],
"启动受管理预览": ["启动受管理预览", "Start managed preview"],
"停止受管理预览": ["停止受管理预览", "Stop managed preview"],
"受管理预览已绑定基线源码与构建响应。": ["受管理预览已绑定基线源码与构建响应。", "The managed preview is bound to the baseline source and entry response."],
"受管理预览的响应已变化，构建指纹失效。请停止并重新启动预览。": ["受管理预览的响应已变化，构建指纹失效。请停止并重新启动预览。", "The managed preview response changed and its build fingerprint is invalid. Stop and restart the preview."],
"受管理预览已经退出。请重新启动后再操作实时页面。": ["受管理预览已经退出。请重新启动后再操作实时页面。", "The managed preview exited. Restart it before using the live page."],
"受管理预览当前无法访问。它不能作为对应源码版本的实时证据。": ["受管理预览当前无法访问。它不能作为对应源码版本的实时证据。", "The managed preview is unavailable and cannot serve as live evidence for the recorded source version."],
"当前预览的源码版本尚未核对。它不代表历史采集，也不会自动重放选中的交互状态。": ["当前预览的源码版本尚未核对。它不代表历史采集，也不会自动重放选中的交互状态。", "The current preview source version is unverified. It is not the historical capture and does not replay selected interaction states automatically."],
"固定截图证据 · 内容来自采集时刻，不是可编辑的设计稿。": ["固定截图证据 · 内容来自采集时刻，不是可编辑的设计稿。", "Fixed screenshot evidence from capture time, not an editable design draft."],
"当前项目实时预览": ["当前项目实时预览", "Current project preview"],
"在新窗口操作完整页面": ["在新窗口操作完整页面", "Open the complete page in a new window"],
"页面可直接滚动与操作；固定证据和覆盖状态需要重新采集后才更新。": ["页面可直接滚动与操作；固定证据和覆盖状态需要重新采集后才更新。", "Scroll and interact with the page. Historical evidence and coverage only update after a new capture."],
"查看修改后": ["查看修改后", "View after"],
"查看修改前": ["查看修改前", "View before"],
"没有可用截图。请补齐采集后再判断。": ["没有可用截图。请补齐采集后再判断。", "No screenshot is available. Complete capture before judgment."],
"本次问题": ["本次问题", "Findings in this review"],
"问题属于本次审阅记录；没有区域定位证据时，不假定它属于当前画面。": ["问题属于本次审阅记录；没有区域定位证据时，不假定它属于当前画面。", "Findings belong to this run. Without location evidence, they are not assumed to refer to the selected region."],
"当前区域关联问题": ["当前区域关联问题", "Findings linked to this region"],
"关联当前区域": ["关联当前区域", "Linked to current region"],
"组件": ["组件", "Component"],
"页面区域": ["页面区域", "Page regions"],
"已确认": ["已确认", "Verified"],
"候选": ["候选", "Candidate"],
"证据直接引用了该状态或截图": ["证据直接引用了该状态或截图", "Evidence directly cites this state or screenshot"],
"组件名称与采集状态名称相同，仍需人工确认": ["组件名称与采集状态名称相同，仍需人工确认", "The component and capture state names match; human confirmation is still required"],
"未定位：现有证据没有明确页面状态或唯一组件来源。": ["未定位：现有证据没有明确页面状态或唯一组件来源。", "Unlocated: the evidence has no explicit page state or unique component source."],
"已核验源码位置": ["已核验源码位置", "Verified source location"],
"DOM 选择器": ["DOM 选择器", "DOM selector"],
"尚未形成有证据的问题。请先完成采集与诊断。": ["尚未形成有证据的问题。请先完成采集与诊断。", "No evidenced findings yet. Complete capture and diagnosis first."],
"查看证据与确认范围": ["查看证据与确认范围", "Review evidence and confirm scope"],
"独立复核": ["独立复核", "Independent review"],
"尚无独立复核结论。已采集不等于已通过。": ["尚无独立复核结论。已采集不等于已通过。", "No independent verdict yet. Captured does not mean passed."],
"源码修改、独立复核和人工判断沿用同一条审阅流程。": ["源码修改、独立复核和人工判断沿用同一条审阅流程。", "Code changes, independent review and human judgment use the same workflow."],
"无法读取页面，请重试。": ["无法读取页面，请重试。", "Could not load the page. Please retry."],
"实验工具": ["实验工具", "Experiments"],
"旧版截图批注与创作": ["旧版截图批注与创作", "Legacy screenshot annotation and creation"],
"实际尺寸": ["实际尺寸", "Actual size"],
"适配宽度": ["适配宽度", "Fit width"],
"打开页面审阅": ["打开页面审阅", "Open page review"],
"选择要对比的设计基础版本":["选择要对比的设计基础版本","Choose a Design Foundation version to compare"],
"版本对比":["版本对比","Version comparison"],
"当前候选":["当前候选","Current candidate"],
"批准这个版本":["批准这个版本","Approve this version"],
"批准会冻结完整快照。开始页面规划后，本轮不能再次修改；新版本需要新的审阅运行。":["批准会冻结完整快照。开始页面规划后，本轮不能再次修改；新版本需要新的审阅运行。","Approval freezes the complete snapshot. After page planning starts, a new version requires a new review run."],
"版本":["版本","Version"],
"审阅人":["审阅人","Reviewer"],
"你的名字或团队":["你的名字或团队","Your name or team"],
"身份":["身份","Reviewer type"],
"个人":["个人","Person"],
"团队":["团队","Team"],
"批准理由":["批准理由","Approval reason"],
"说明这个版本为什么足以约束后续页面生成。":["说明这个版本为什么足以约束后续页面生成。","Explain why this version is ready to constrain page generation."],
"批准并冻结版本":["批准并冻结版本","Approve and freeze version"],
"批准":["批准","Approve"],
"替换":["替换","Replace"],
"弃用":["弃用","Deprecate"],
"Brand assets":["品牌资产","Brand assets"],
"Brand guidance":["品牌指导","Brand guidance"],
"Principles":["原则","Principles"],
"Voice":["语言风格","Voice"],
"Choose a prior version":["选择历史版本","Choose a prior version"],
"Saving approval…":["正在保存批准记录…","Saving approval…"],
"added":["新增","Added"],
"changed":["修改","Changed"],
"removed":["移除","Removed"],
"值":["值","Value"],
"来源":["来源","Source"],
"说明":["说明","Description"],
"变体":["变体","Variants"],
"状态":["状态","States"],
"修复连接后重新审阅":["修复连接后重新审阅","Fix connection and restart review"]
,
"连接当前源码并开启新的基线采集。":["连接当前源码并开启新的基线采集。", "Connect the current source and capture a new baseline."],
"从已采集的页面整理有来源的问题。":["从已采集的页面整理有来源的问题。", "Find traceable issues in captured pages."],
"选择问题并确认范围":["选择问题并确认范围", "Choose an issue and confirm scope"],
"核对问题证据，明确本轮修改建议和理由。":["核对问题证据，明确本轮修改建议和理由。", "Check the evidence and confirm the proposed change and reason."],
"生成本轮修改计划":["生成本轮修改计划", "Create the change plan"],
"只为已确认的问题生成修改任务。":["只为已确认的问题生成修改任务。", "Create a task for the confirmed issue."],
"审阅计划并开始修改":["审阅计划并开始修改", "Review the plan and start changes"],
"核对任务后在隔离工作区执行；随后自动采集、检查和独立复核。":["核对任务后在隔离工作区执行；随后自动采集、检查和独立复核。", "Review the task before isolated execution, then capture, check and independently review the result."],
"采集并检查修改结果":["采集并检查修改结果", "Capture and check the result"],
"重放隔离工作区，再完成结构检查与独立复核。":["重放隔离工作区，再完成结构检查与独立复核。", "Replay the isolated worktree, then run structural checks and independent review."],
"检查已采集结果":["检查已采集结果", "Check captured results"],
"使用匹配证据检查结构与可达性；检查完成后仍需独立复核。":["使用匹配证据检查结构与可达性；检查完成后仍需独立复核。", "Check structure and reachability using matching evidence. Independent review is still required."],
"发起独立视觉复核":["发起独立视觉复核", "Start independent visual review"],
"由新的只读会话检查前后证据，完成后再由你判断。":["由新的只读会话检查前后证据，完成后再由你判断。", "A new read-only session checks before and after evidence. You make the final decision."],
"查看复核并记录决定":["查看复核并记录决定", "Read the review and record a decision"],
"明确选择接受或拒绝，并保存理由。":["明确选择接受或拒绝，并保存理由。", "Choose accept or reject explicitly and save your reason."],
"开始下一轮审阅":["开始下一轮审阅", "Start the next review"],
"先将认可的改动应用到项目，再采集当前源码的新基线。":["先将认可的改动应用到项目，再采集当前源码的新基线。", "Apply approved changes to the project, then capture a new source baseline."],
"保留失败记录，检查预览和配置后重新连接。":["保留失败记录，检查预览和配置后重新连接。", "Keep the failure record. Check the preview and configuration before reconnecting."],
"重新审阅当前源码":["重新审阅当前源码", "Review current source again"],
"当前问题已过期，需要新的证据。":["当前问题已过期，需要新的证据。", "The finding is stale. Capture new evidence."],
"检查改动后重新审阅":["检查改动后重新审阅", "Inspect changes and restart review"],
"先检查保留的工作区和日志，再启动新一轮；不会重复执行失败任务。":["先检查保留的工作区和日志，再启动新一轮；不会重复执行失败任务。", "Inspect the retained worktree and logs before a new review. The failed task will not be executed again."],
"检查源码后重新审阅":["检查源码后重新审阅", "Inspect source and restart review"],
"先检查被修改的项目源码，修复后再采集新基线。":["先检查被修改的项目源码，修复后再采集新基线。", "Inspect and repair the changed project source before capturing a new baseline."],
"补齐证据后重新审阅":["补齐证据后重新审阅", "Complete evidence and restart review"],
"先补齐采集计划中缺失的状态，再开始新一轮。":["先补齐采集计划中缺失的状态，再开始新一轮。", "Add missing states to the capture plan before starting a new review."],
"记录拒绝与整改理由":["记录拒绝与整改理由", "Record rejection and required changes"],
"独立复核存在未解决的问题，本版只能记录拒绝。":["独立复核存在未解决的问题，本版只能记录拒绝。", "Independent review found unresolved issues. This version can only be rejected."],
"说明起始界面为何缺失":["说明起始界面为何缺失", "Explain the missing baseline"],
"记录真实原因后，再审阅并批准设计基础。":["记录真实原因后，再审阅并批准设计基础。", "Record the real reason, then review and approve the design foundation."],
"审阅并批准设计基础":["审阅并批准设计基础", "Review and approve the design foundation"],
"逐项决定候选规则，再由你明确批准版本。":["逐项决定候选规则，再由你明确批准版本。", "Decide each candidate rule, then explicitly approve the version."],
"生成首个页面计划":["生成首个页面计划", "Plan the first page"],
"只使用已批准的设计基础来规划首个页面。":["只使用已批准的设计基础来规划首个页面。", "Plan the first page using the approved design foundation."],
"本阶段下一步":["本阶段下一步", "Next action for this stage"],
"这是历史导出证据。连接原项目后，才能继续当前审阅。":["这是历史导出证据。连接原项目后，才能继续当前审阅。", "This is exported historical evidence. Connect the original project to continue."],
"重新读取当前证据后继续。":["重新读取当前证据后继续。", "Reload current evidence to continue."],
"任务正在进行":["任务正在进行", "Task in progress"],
"连接原项目":["连接原项目", "Connect the original project"],
"重新读取审阅":["重新读取审阅", "Reload review"],
"本轮问题":["本轮问题", "Issue for this round"],
"请选择问题":["请选择问题", "Choose an issue"],
"修改建议与确认理由":["修改建议与确认理由", "Proposed change and confirmation reason"],
"查看完整修改计划":["查看完整修改计划", "Read the complete change plan"],
"正在读取修改计划…":["正在读取修改计划…", "Loading the change plan…"],
"无法读取修改计划，请重新读取审阅。":["无法读取修改计划，请重新读取审阅。", "Cannot load the change plan. Reload the review."],
"我已阅读本轮修改计划，并同意在隔离工作区执行":["我已阅读本轮修改计划，并同意在隔离工作区执行", "I have read the change plan and agree to execution in an isolated worktree"],
"起始界面缺失原因":["起始界面缺失原因", "Reason the baseline is absent"],
"我已检查源码和保留的改动，可以重新采集当前项目":["我已检查源码和保留的改动，可以重新采集当前项目", "I have inspected the source and retained changes and am ready to capture the project again"],
"记录决定":["记录决定", "Record decision"],
"高级操作与任务":["高级操作与任务", "Advanced operations and tasks"],
"设计基础与版本治理":["设计基础与版本治理", "Design foundation and version governance"],
"选择此问题":["选择此问题", "Select this issue"]
,
"整页原图":["整页原图","Original full-page capture"],
"视口截图":["视口截图","Viewport capture"],
"整页与跨区域复核":["整页与跨区域复核","Whole-page and cross-region review"],
"分区批次复核 {0}/{1} 通过":["分区批次复核 {0}/{1} 通过","Regional review batches passed: {0}/{1}"],
"整页原图 {0}/{1} 已采集":["整页原图 {0}/{1} 已采集","Original whole-page captures: {0}/{1}"],
"跨区域结论":["跨区域结论","Cross-region verdict"],
"尚未复核":["尚未复核","Not reviewed"],
"部分页面或设备缺少默认状态的整页原图。请补齐采集计划后重新审阅。":["部分页面或设备缺少默认状态的整页原图。请补齐采集计划后重新审阅。","Default-state whole-page originals are missing for some pages or devices. Complete the plan and restart review."],
"部分交互或页面状态未采集成功，不能作为完整复核通过。":["部分交互或页面状态未采集成功，不能作为完整复核通过。","Some interaction or page states were not captured. Complete QA cannot pass."],
"整页证据超过当前复核容量，跨区域结论仍未完成。":["整页证据超过当前复核容量，跨区域结论仍未完成。","Whole-page evidence exceeds current review capacity. Cross-region review is incomplete."],
"结论只覆盖本次计划内的页面、设备与状态，仍需你的最终判断。":["结论只覆盖本次计划内的页面、设备与状态，仍需你的最终判断。","The verdict covers only planned pages, devices and states. Your final decision is still required."],
"整页截图：已采集 {0}/{1} · 复核已引用 {2}/{3}":["整页截图：已采集 {0}/{1} · 复核已引用 {2}/{3}","Whole-page captures: {0}/{1} captured · {2}/{3} cited in review"]
,
"Some planned after states were not captured. Complete the capture plan and start a new review.":["部分修改后状态未采集成功。请补齐采集计划后重新审阅。","Some planned after states were not captured. Complete the capture plan and start a new review."]
,
"whole-page":["整页总览","Whole-page overview"],
"mobile-menu-closed":["手机菜单关闭","Mobile menu closed"],
"menu-to-features":["从菜单进入特性","Features through the menu"],
"menu-to-screenshots":["从菜单进入截图","Screenshots through the menu"],
"menu-to-quickstart":["从菜单进入快速开始","Quick start through the menu"],
"screenshots-mobile":["产品截图 · 移动端","Screenshots · Mobile"],
"screenshots-mobile-2":["移动端截图 · 群组","Mobile screenshot · Groups"],
"screenshots-mobile-3":["移动端截图 · 监控","Mobile screenshot · Monitor"],
"screenshots-mobile-4":["移动端截图 · 设置","Mobile screenshot · Settings"],
"screenshots-feishu":["产品截图 · 飞书集成","Screenshots · Feishu"],
"screenshots-feishu-end":["飞书截图 · 卡片回复","Feishu screenshot · Card reply"],
"screenshots-web-return":["截图切回 Web 界面","Return to Web screenshots"],
"screenshots-web-2":["Web 截图 · Markdown","Web screenshot · Markdown"],
"screenshots-web-3":["Web 截图 · 图片生成","Web screenshot · Image generation"],
"quickstart-command-end":["快速开始 · 命令末尾","Quick start · Command end"]
,
"先看正常尺寸的桌面与手机整页，再检查操作状态；放大检查仅作为辅助。":["先看正常尺寸的桌面与手机整页，再检查操作状态；放大检查仅作为辅助。", "Review normal-size desktop and mobile pages first, then interactions; zoom checks are supplementary."]
,
"查看设备":["查看设备", "Device"]
,
"查看版本":["查看版本", "Version"]
,
"查看页面状态":["查看页面状态", "Page state"]
,
"采集与覆盖详情":["采集与覆盖详情", "Capture and coverage details"]
,
"当前状态未采集成功。请查看覆盖详情中的原始失败原因。":["当前状态未采集成功。请查看覆盖详情中的原始失败原因。", "This state was not captured. See coverage details for the original failure."]
,
"修改后有 {0} 个状态缺少证据，暂不能完成复核。":["修改后有 {0} 个状态缺少证据，暂不能完成复核。", "{0} after states lack evidence. Review cannot be completed yet."]
,
"修改前有 {0} 个状态未采集成功，原始记录保留在覆盖详情中。":["修改前有 {0} 个状态未采集成功，原始记录保留在覆盖详情中。", "{0} before states were not captured. Original records remain in coverage details."]
,
"查看关联页面与源码":["查看关联页面与源码", "Related pages and source"]
,
"查看完整复核与证据":["查看完整复核与证据", "Full review and evidence"]
,
"先连接原项目":["先连接原项目", "Connect the original project first"]
,
"本地 · 审阅记录":["本地 · 审阅记录", "Local · Review record"]
,
"hero":["Hero", "Hero"]
,
"advantages":["核心优势", "Advantages"]
,
"screenshots":["产品截图", "Screenshots"]
,
"feature-grid":["功能列表", "Feature Grid"]
,
"architecture":["技术架构", "Architecture"]
,
"quickstart":["快速开始", "Quickstart"]
,
"technology":["技术栈", "Technology"]
,
"footer":["页脚", "Footer"]
,
"mobile-menu-open":["手机菜单展开", "Mobile Menu Open"],
"核对问题与建议，确认后生成完整修改计划；此时不会修改代码。":["核对问题与建议，确认后生成完整修改计划；此时不会修改代码。","Check the issue and proposal. Confirming prepares the full plan without changing code."],
"审阅进度":["审阅进度","Review progress"],
"选择问题":["选择问题","Choose an issue"],
"确认修改":["确认修改","Confirm the change"],
"查看结果":["查看结果","View results"],
"选择项目，说明想检查的任务。连接后会采集页面并整理问题；修改代码前会先请你确认计划。":["选择项目，说明想检查的任务。连接后会采集页面并整理问题；修改代码前会先请你确认计划。","Choose a project and describe the task to inspect. We capture pages and organize issues, then ask you to approve the plan before changing code."],
"例如：手机用户打开菜单并找到快速开始":["例如：手机用户打开菜单并找到快速开始","For example: a mobile user opens the menu and finds Quick start"],
"高级：预览与项目信息":["高级：预览与项目信息","Advanced: preview and project details"],
"正在读取项目配置…":["正在读取项目配置…","Reading project settings…"],
"已识别 {0} 项目，将使用项目的 dev 脚本启动本地预览。":["已识别 {0} 项目，将使用项目的 dev 脚本启动本地预览。","Detected {0}. The project dev script will start a local preview."],
"项目依赖尚未安装，请先安装依赖再开始审阅。":["项目依赖尚未安装，请先安装依赖再开始审阅。","Project dependencies are not installed. Install them before starting the review."],
"未能自动识别预览方式，请在高级设置中填写。":["未能自动识别预览方式，请在高级设置中填写。","Preview settings could not be detected. Enter them in advanced settings."],
"无法读取项目配置":["无法读取项目配置","Could not read project settings"],
"正在采集页面并整理问题，请稍候。":["正在采集页面并整理问题，请稍候。","Capturing pages and organizing issues. Please wait."],
"使用配置文件开始审阅":["使用配置文件开始审阅","Start review with a config file"],
"范围确认、计划执行和最终决定统一在当前审阅顶部完成。":["范围确认、计划执行和最终决定统一在当前审阅顶部完成。","Confirm scope, approve execution and record your decision at the top of the current review."],
"返回当前审阅":["返回当前审阅","Return to the current review"],
"本轮尚未形成有来源的问题。补充想检查的任务或页面范围后，再开始审阅。":["本轮尚未形成有来源的问题。补充想检查的任务或页面范围后，再开始审阅。","No evidence-backed issue has been identified. Add the task or page scope and start a new review."],
"补充任务或检查范围":["补充任务或检查范围","Add the task or review scope"],
"查看其余诊断建议":["查看其余诊断建议","View other diagnostic suggestions"],
"待核对的建议，请结合页面证据确认。":["待核对的建议，请结合页面证据确认。","Suggestion to verify. Check it against the page evidence."],
"准备源码修改计划":["准备源码修改计划","Prepare a source change plan"],
"生成计划并审阅":["生成计划并审阅","Prepare and review the plan"],
"先准备完整计划，确认执行后再修改源码、复核并记录决定。":["先准备完整计划，确认执行后再修改源码、复核并记录决定。","Prepare the full plan first. Approve execution before source changes, review and your final decision."],
"项目目录已变化，请重新读取配置后继续。":["项目目录已变化，请重新读取配置后继续。","The project directory changed. Read its settings again before continuing."],
"历史证据没有本地运行记录，连接后会从当前源码开始新的审阅。":["历史证据没有本地运行记录，连接后会从当前源码开始新的审阅。","This historical evidence has no local run. Connecting starts a new review of the current source."]
,
"主内容区域标记需要核对":["主内容区域标记需要核对", "Check the main content landmark"]
,
"核对页面正文的主区域标记。为真正的主要内容保留一个主区域，保持导航、页脚和现有布局，再检查桌面与手机。":["核对页面正文的主区域标记。为真正的主要内容保留一个主区域，保持导航、页脚和现有布局，再检查桌面与手机。", "Check the page's main content landmark. Keep one landmark for the actual main content, preserve navigation, footer and layout, then check desktop and mobile."]
,
"部分文字对比度需要核对":["部分文字对比度需要核对", "Check text contrast"]
,
"按报告定位文字与背景组合。在保留现有品牌的前提下改善可读性，并复查桌面、手机和相关控件状态。":["按报告定位文字与背景组合。在保留现有品牌的前提下改善可读性，并复查桌面、手机和相关控件状态。", "Locate the text/background pairs in the report. Improve readability while preserving the brand, then check desktop, mobile and related control states."]
,
"滚动区域的键盘操作需要核对":["滚动区域的键盘操作需要核对", "Check keyboard access to the scroll region"]
,
"核对报告中的滚动区域是否能获得键盘焦点并滚动。保留现有内容与鼠标操作，补齐键盘操作后重新验证。":["核对报告中的滚动区域是否能获得键盘焦点并滚动。保留现有内容与鼠标操作，补齐键盘操作后重新验证。", "Check whether the reported scroll region can receive keyboard focus and scroll. Preserve its content and pointer behavior, add keyboard access and verify again."]
,
"图片说明可能与相邻文字重复":["图片说明可能与相邻文字重复", "Image descriptions may repeat nearby text"]
,
"核对图片用途和相邻文字，调整重复的图片说明，保留必要信息与现有视觉呈现，再检查读屏顺序。":["核对图片用途和相邻文字，调整重复的图片说明，保留必要信息与现有视觉呈现，再检查读屏顺序。", "Check image purpose and nearby text. Adjust redundant descriptions while keeping necessary information and visuals, then check screen-reader order."]
,
"页面内容区域标记需要核对":["页面内容区域标记需要核对", "Check content region landmarks"]
,
"按报告检查内容所属的页面区域，补齐恰当的区域标记，保持现有布局与内容。":["按报告检查内容所属的页面区域，补齐恰当的区域标记，保持现有布局与内容。", "Check the reported content regions and add appropriate landmarks while preserving layout and content."]
,
"部分控件的点击范围偏小":["部分控件的点击范围偏小", "Some control targets are small"]
,
"核对报告中点击范围偏小的控件，扩大可操作范围，保留原有功能和布局，再检查桌面与手机。":["核对报告中点击范围偏小的控件，扩大可操作范围，保留原有功能和布局，再检查桌面与手机。", "Check the reported small control targets and expand their operable area. Preserve functionality and layout, then check desktop and mobile."]
,
"查看原始诊断":["查看原始诊断", "Original diagnosis"]
,
"请对照页面和原始诊断核对这条建议，可以编辑下面的修改说明。":["请对照页面和原始诊断核对这条建议，可以编辑下面的修改说明。", "Check this suggestion against the page and original diagnosis. You can edit the proposed change below."]
,
"先查看已采集页面，再选择设备和状态。未采集的页面与操作仍需补充。":["先查看已采集页面，再选择设备和状态。未采集的页面与操作仍需补充。", "View the captured page, then choose a device and state. Uncaptured pages and actions still need evidence."]
,
"当前画面的问题位置尚待核对，请展开原始诊断查看依据。":["当前画面的问题位置尚待核对，请展开原始诊断查看依据。", "Issue locations in this view are not confirmed. Open the original diagnosis to inspect the evidence."]
,
"评审规范已更新。此前结论已保留。":["评审规范已更新。此前结论已保留。", "The review criteria were updated. The previous result has been preserved."]
,
"打开此前的复核记录":["打开此前的复核记录", "Open the previous review"]
,
"查看此前的复核记录":["查看此前的复核记录", "Previous review records"],
"一键修复":["一键修复","Fix automatically"],
"自动核实问题并在隔离工作区修改，完成检查与独立复核后，由你审阅最终结果。":["自动核实问题并在隔离工作区修改，完成检查与独立复核后，由你审阅最终结果。","Verify candidates, repair in an isolated worktree, and run checks and independent review. You review the final result."],
"诊断问题":["诊断问题","Diagnose"],
"自动修复":["自动修复","Repair"],
"自动复核":["自动复核","Verify"],
"最终审阅":["最终审阅","Final review"],
"诊断完成，可以开始修复":["诊断完成，可以开始修复","Ready to repair"],
"准备自动修复":["准备自动修复","Preparing repairs"],
"页面诊断已完成，可一键修复。修改后再审阅最终结果。":["页面诊断已完成，可一键修复。修改后再审阅最终结果。","Diagnosis is complete. Repair automatically, then review the final result."],
"参考方法用于诊断和自动修复，最终结果由你审阅。":["参考方法用于诊断和自动修复，最终结果由你审阅。","Reference methods guide diagnosis and automatic repair. You review the final result."],
"建议来自本轮诊断，可选择单项修复，也可一键修复全部问题。完成后再审阅结果。":["建议来自本轮诊断，可选择单项修复，也可一键修复全部问题。完成后再审阅结果。","Repair an individual diagnosis candidate or fix all candidates automatically. Review the result when finished."],
"An isolated preview start command is required before automatic repair. Connect a runnable project preview first.":["请先在“项目与任务”配置可启动的项目预览，再开始修复。","Connect a runnable project preview in Project and tasks before repairing."],
"Model diagnosis is incomplete. Complete diagnosis before requesting repairs.":["页面诊断尚未完成，请先重新运行诊断。","Complete page diagnosis before requesting repairs."],
"Baseline repository changed. Capture a fresh review before repairing.":["项目源码已变化，请重新采集当前版本后修复。","The source changed. Capture its current version before repairing."],
"修复任务已准备":["修复任务已准备","Repair task prepared"],
"自动修复已请求":["自动修复已请求","Automatic repair requested"]
,
"全部截图":["全部截图","All screenshots"],
"问题列表":["问题列表","Issues"],
"定位截图":["定位截图","Find a screenshot"],
"查看选项":["查看选项","View options"],
"诊断摘要":["诊断摘要","Diagnosis summary"],
"修复此问题":["修复此问题","Fix this issue"],
"修复时会核实每条建议；未定位的问题不会自动归入当前截图。":["修复时会核实每条建议；未定位的问题不会自动归入当前截图。","Each candidate is checked before repair. Unlocated issues are not assigned to the current screenshot."],
"提交 PR":["提交 PR","Submit PR"],
"查看 PR":["查看 PR","View PR"],
"采纳修改":["采纳修改","Accept changes"],
"查看前后对比，采纳后可提交 PR，也可继续调整。":["查看前后对比，采纳后可提交 PR，也可继续调整。","Compare before and after. Accept the changes to submit a PR, or request further adjustments."],
"将已采纳的修改提交为草稿 PR，保留最终代码审阅。":["将已采纳的修改提交为草稿 PR，保留最终代码审阅。","Submit accepted changes as a draft PR for final code review."],
"官网设计资源":["官网设计资源","Website design resources"],
"{0} candidates reviewed: {1} approved and {2} deprecated / {3} deferred. The decision considered {4} scanned source files and {5} extraction findings.":["{0} candidates reviewed: {1} approved and {2} deprecated / {3} deferred. The decision considered {4} scanned source files and {5} extraction findings.","{0} candidates reviewed: {1} approved and {2} deprecated / {3} deferred. The decision considered {4} scanned source files and {5} extraction findings."],
"{0} pending / {1} approved / {2} deprecated / {3} deferred":["{0} pending / {1} approved / {2} deprecated / {3} deferred","{0} pending / {1} approved / {2} deprecated / {3} deferred"],
"{0} approved / {1} deprecated / {2} deferred":["{0} approved / {1} deprecated / {2} deferred","{0} approved / {1} deprecated / {2} deferred"],
"{0} pending / {1} approved / {2} deprecated":["{0} pending / {1} approved / {2} deprecated","{0} pending / {1} approved / {2} deprecated"],
"{0} approved / {1} deprecated":["{0} approved / {1} deprecated","{0} approved / {1} deprecated"],
"本地 / 可编辑草稿":["本地 / 可编辑草稿","Local / Editable draft"],
"HappyHands / 设计审阅工作台":["HappyHands / 设计审阅工作台","HappyHands / Design review workbench"],
"Creative OS / 设计审阅工作台":["Creative OS / 设计审阅工作台","Creative OS / Design review workbench"],
"本地 / 只读审阅":["本地 / 只读审阅","Local / Read-only"],
"空格拖动 / 中键平移 / Ctrl + 滚轮缩放 / 双击查看原图":["空格拖动 / 中键平移 / Ctrl + 滚轮缩放 / 双击查看原图","Space + drag / middle button to pan / Ctrl + wheel to zoom / Double-click to open"],
"F 聚焦 / Shift F 全览":["F 聚焦 / Shift F 全览","F to focus / Shift F to fit all"],
" / 待评估":[" / 待评估","· Awaiting evaluation"],
" / 有结构变化":[" / 有结构变化","· Structural changes"],
" / 结构指标一致":[" / 结构指标一致","· Structural metrics unchanged"],
"结构检查 / 不代表视觉质量":["结构检查 / 不代表视觉质量","Structural checks / Not visual quality"],
"同状态 / 同配置":["同状态 / 同配置","Same state / Same configuration"],
"已记录结构评估 / 视觉需独立复核":["已记录结构评估 / 视觉需独立复核","Structural evaluation recorded / Visual review required"],
"刚刚读取 / ":["刚刚读取 / ","Just refreshed / "],
"Experience Score {0} / 100 / {1}@{2}":["Experience Score {0} / 100 / {1}@{2}","Experience Score {0} / 100 / {1}@{2}"],
"branch {0} / log {1}":["branch {0} / log {1}","branch {0} / log {1}"],
"{0} / PRIORITY {1}":["{0} / PRIORITY {1}","{0} / PRIORITY {1}"],
"Impact {0}/5 / Confidence {1}/5 / Effort {2}/5 / {3} evidence":["Impact {0}/5 / Confidence {1}/5 / Effort {2}/5 / {3} evidence","Impact {0}/5 / Confidence {1}/5 / Effort {2}/5 / {3} evidence"],
"Run {0} / {1} / {2}":["Run {0} / {1} / {2}","Run {0} / {1} / {2}"],
"{0} 分钟前读取 / {1}":["{0} 分钟前读取 / {1}","Refreshed {0} minutes ago / {1}"],
" / 操作 {0}":[" / 操作 {0}","· Action {0}"],
"{0} 个文件 / {1}":["{0} 个文件 / {1}","{0} files / {1}"],
"关联问题 / {0}":["关联问题 / {0}","Related findings / {0}"],
"诊断问题 / {0}":["诊断问题 / {0}","Findings / {0}"],
"下一项：{0} / {1}":["下一项：{0} / {1}","Next finding: {0} / {1}"],
"OBSERVED / EXTRACTION FAILED":["OBSERVED / EXTRACTION FAILED","OBSERVED / EXTRACTION FAILED"],
"OBSERVED / PARTIAL EXTRACTION":["OBSERVED / PARTIAL EXTRACTION","OBSERVED / PARTIAL EXTRACTION"],
"OBSERVED / AUTO-EXTRACTED":["OBSERVED / AUTO-EXTRACTED","OBSERVED / AUTO-EXTRACTED"],
"已采集 / 未复核":["已采集 / 未复核","Captured / not reviewed"],
"路由 {0} / 状态 {1} / 交互 {2}":["路由 {0} / 状态 {1} / 交互 {2}","Routes {0} / states {1} / interactions {2}"],
"交互证据：已采集 {0}/{1} / 复核已引用 {2}/{3}":["交互证据：已采集 {0}/{1} / 复核已引用 {2}/{3}","Interaction evidence: captured {0}/{1} / cited by review {2}/{3}"],
"固定截图证据 / 内容来自采集时刻，不是可编辑的设计稿。":["固定截图证据 / 内容来自采集时刻，不是可编辑的设计稿。","Fixed screenshot evidence from capture time, not an editable design draft."],
"整页截图：已采集 {0}/{1} / 复核已引用 {2}/{3}":["整页截图：已采集 {0}/{1} / 复核已引用 {2}/{3}","Whole-page captures: {0}/{1} captured / {2}/{3} cited in review"],
"本地 / 审阅记录":["本地 / 审阅记录","Local / Review record"]
,
"前后截图对照，包含未修改的回归页面。":["前后截图对照，包含未修改的回归页面。", "Before and after, including unchanged regression views."],
"当前截图前后完全相同，作为回归对照。":["当前截图前后完全相同，作为回归对照。", "These screenshots are identical and serve as a regression reference."],
"未录入的诊断建议":["未录入的诊断建议", "Excluded diagnostic suggestions"],
"这些旧建议或规则命中缺少当前录入标准要求的明确依据，不算已确认问题，也不会自动修复。":["这些旧建议或规则命中缺少当前录入标准要求的明确依据，不算已确认问题，也不会自动修复。", "These older suggestions or rule matches lack the evidence required for admission. They are not confirmed defects and will not be repaired automatically."],
"查看原始诊断记录":["查看原始诊断记录", "View the original diagnosis"],
"引用当前截图的问题记录":["引用当前截图的问题记录", "Finding records citing this screenshot"],
"当前截图没有对应的已录入问题，以下是其他页面的问题。":["当前截图没有对应的已录入问题，以下是其他页面的问题。", "No admitted finding is mapped to this screenshot. The following findings concern other pages."],
"证据引用此截图，具体缺陷以判断依据为准":["证据引用此截图，具体缺陷以判断依据为准", "Evidence cites this screenshot; consult the diagnostic basis for the actual defect."],
"依据与错误判断":["依据与错误判断", "Evidence and error assessment"],
"实际观察":["实际观察", "Observed"],
"预期":["预期", "Expected"],
"为何属于错误":["为何属于错误", "Why this is an error"],
"明确要求":["明确要求", "Explicit requirement"],
"参考原则":["参考原则", "Guiding principle"],
"已排除的正常取舍":["已排除的正常取舍", "Alternative explanations checked"],
"证据引用":["证据引用", "Evidence citation"],
"候选关联":["候选关联", "Possible association"]
};

// Preserve older lookup keys while authored UI uses slash separators.
for (const [key, values] of Object.entries(messages)) {
 if(key.includes(" · ")) messages[key.replaceAll(" · "," / ")] ??= values.map(value=>value.replaceAll(" · "," / "));
}

messages['本轮修复']=['本轮修复','Current repair'];

messages['尚无已录入问题']=['尚无已录入问题','No admitted findings yet'];
messages['完成修复后，这里会显示实际保存的代码补丁。']=['完成修复后，这里会显示实际保存的代码补丁。','The saved code patch will appear here after a repair.'];

messages['文件']=['文件','File'];
messages['查看改动文件']=['查看改动文件','Changed file'];
messages['全部文件']=['全部文件','All files'];
messages['{0} 个补丁文件']=['{0} 个补丁文件','{0} patch files'];
