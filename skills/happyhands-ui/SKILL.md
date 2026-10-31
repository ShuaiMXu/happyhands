---
name: happyhands-ui
description: Apply HappyHands UI copy, Radix color, typography and interaction rules when implementing or reviewing HappyHands-owned interfaces, or a target project that has explicitly adopted this profile.
---

# HappyHands UI rules

User-approved profile, 2026-10-23. Read the foundational rules and all additional user-approved review rules below during implementation and independent review. These rules supplement the complete OJO, Taste and Impeccable packages; never truncate or replace their original files. They govern HappyHands-owned UI. A reviewed project's approved design system and third-party component demonstration are separate scopes: do not recolor source screenshots or overwrite an external brand without its adoption of this profile. Record conflicts explicitly. No rule implies approval, automatic installation or permission to merge.

1. **No middle-dot separators.** Do not use “·” to separate UI copy. Prefer distinct layout items, normal sentences or a meaningful label. Preserve verbatim external source text, code syntax and evidence.
2. **No redundant explanation.** Remove descriptions that repeat a title, button or obvious interaction. Keep decision-changing limits and errors beside their control. Put optional implementation details in existing disclosure or documentation, never hide essential instructions.
3. **Audience-appropriate copy.** Review every label for the actual audience and task. Use familiar, precise terms, professional natural wording and a length appropriate to the control. Avoid chatty phrasing, invented terms and redundant text. Review both Chinese and English.
4. **Radix UI Colors.** All owned UI colors must derive from Radix scales through semantic tokens, including dark mode and interaction states. Steps 1–2: backgrounds; 3–5: default/hover/selected surfaces; 6–8: borders; 9–10: solid actions; 11–12: secondary/primary text. Check actual contrast, especially foregrounds on bright scales. Do not mechanically replace a color with the nearest hex and ignore its role. Source: https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale . Original media and external demonstration themes retain their identity.
5. **Optical alignment.** Align text baselines, icon weight, controls and visual centers, checking screenshots rather than bounding boxes alone. For nested rounded surfaces use concentric radii: inner radius approximately max(0, outer radius minus inset), adjusted for visual alignment.
6. **Hairline borders.** Use 0.5px for UI borders and dividing lines. Do not use a border as a substitute for all spacing. Preserve a clearly visible keyboard focus indicator; focus outlines are not decorative borders. SVG icon strokes are not UI borders.
7. **Restrained motion.** Remove nonessential entrance and decoration animations. Necessary state transitions use ease-out and 250ms as the starting point, scoped to explicit properties. Honor reduced motion. Preserve a separately user-approved motion exception only when documented.
8. **At most four text sizes per page; prefer three.** Minimum 12px. Use weight, semantic color, spacing and line-height for hierarchy instead of adding sizes. Count rendered computed sizes at normal desktop and phone dimensions; zoom must remain usable. Third-party samples and original screenshots are not shell typography.
9. **Fewer decisions.** Remove unnecessary confirmation and selection steps. Necessary choices belong where the user intends to choose. Order content by the current task and place the main action with the information required to take it. Preserve real approval and destructive-action boundaries.
10. **Purposeful shape and elevation.** Avoid gratuitous radius, shadows and colored left-edge card stripes. Use a small, role-based radius scale and reserve shadows for floating content where separation needs it; review nested radii together.
11. **No decorative eyebrows.** Remove heading-adjacent small labels and uppercase overlines when they duplicate a title or add only decoration. Keep them only for unique category, scope or critical context. Build hierarchy through type weight, space and composition.

## Acceptance

Review complete pages at normal desktop and phone sizes first, including navigation, empty/error/loading states and interactions. Inspect computed type sizes, color-token roles and focus, then visually check optical alignment and content hierarchy. Keep 200% zoom as a supplemental check; do not introduce arbitrary word breaks to satisfy it. Record screenshots, changed files, source/version, checks and remaining limitations. Static lint and source availability do not constitute visual acceptance. Await the user's requested preview confirmation before merging.


## 2026-10-31 自有界面补充检查

这些是用户对 HappyHands 自有界面的明确要求；第三方只有明确采用后才适用。按完整页面和真实展开状态检查，不把代码模式命中直接判为缺陷。

1. 标签和斜体只保留有实际语义的用途。
2. 自有界面不采用 Instrument Serif、Space Grotesk、Bricolage Grotesque 作为装饰字体。
3. 等宽字体仅用于代码、终端和需要逐字符对齐的数据。
4. 清理不必要的分割线、多层阴影、半透明叠色和带框容器。
5. 图表只保留支持当前判断的刻度、网格、图例和数据。
6. 文案使用清楚、专业的自然语言，不过度口语化、不造词。
7. 移除装饰性的代码面包屑、章节编号和标题眉标；保留真正的路径或操作进度语义。
8. 不用紫色渐变装饰工作台。
9. 不用全大写小标题制造层级。
10. 不用中圆点分隔自有 UI 文案。
11. 正文不塞装饰 Emoji，不堆无用说明。
12. Hero 不用过大字号压过任务；工作台没有新增 Hero 的必要。
13. 删除重复说明，保留会改变操作决定的限制和错误。
14. 嵌套圆角按内边距形成同心关系。
15. 控件和分隔线使用一致的 0.5px 边线；键盘焦点与图标笔画另行验证。
16. 不添加滚动装饰动效，状态过渡收敛并支持 reduced motion。
17. 每页最多四档字号，最小 12px。
18. 不在卡片左侧增加装饰性彩色竖线。
19. 下拉箭头使用统一的线性图标，大小、笔画与对齐一致。
20. 必须实际展开下拉菜单检查。自有工作台使用同一设计系统的菜单面板，覆盖长选项、键盘、焦点、关闭和禁用态；不能只美化按钮而仍弹出风格失配的系统菜单。

问题录入仍须遵守 `docs/finding-admission-policy.md`：具体条款加实际证据和错误判断，参考原则不自动产生整改任务。

21. **Inspect the implementation before recommending a library.** Record manifest/config/import evidence for the actual rendered surface: native DOM, custom components, shadcn, Radix or another library. A dependency alone does not prove use on that page. Missing shadcn is not a defect and never authorizes a framework migration; put any reuse recommendation outside confirmed findings.
22. **Keep adjacent controls visually distinct.** Check menus, adjacent rows, nested surfaces and active states while open, focused and hovered. Avoid touching/overlapping rounded backgrounds, doubled outlines and stuck-together control groups. Use a consistent internal gap or a single intentional shared group treatment. For inset surfaces use inner radius = max(0, outer radius − inset), then verify the rendered result. On another project's UI, admit this only when the overlap obscures hierarchy, targets or content, or violates its adopted contract; do not enforce a house-style gap by preference.

23. **Do not collapse by default without a task reason.** Common view actions, capture status, filters and necessary decision context must be visible in the normal flow. Use disclosure only for long raw evidence, history, debugging or infrequent operations. Check the expanded layout at desktop and phone widths; never turn a compact row into a wall of text or a layout jump. Prefer a short visible summary with a direct action to an unnecessary accordion.
24. **Reuse the actual adopted component system.** When aligning an owned page with another owned surface, inspect that surface's component sources, wrapper configuration and styles, not only colors or root dependencies. Reuse its established interaction primitives (for example shadcn/Radix Select) and document any adapter. Do not claim a hand-written menu is the same component library because it resembles it.

25. **Do not mix arbitrary large and small radii.** Components of the same role and hierarchy must use the same semantic radius token in default, hover, selected, disabled and open states. Do not mix pill buttons, tiny-radius inputs and unrelated card corners within the same interface. HappyHands uses 12px for standalone controls and 16px for panels; inset layers derive their radius from outer radius minus inset. Preserve true circles only for semantic circular shapes such as avatars, status dots and radio controls. Any third-party finding still requires an adopted contract or an observable defect; a radius preference alone is not sufficient.

26. **Avoid repeated shells and nested containers.** Owned task views should have one clear reading/work area. Do not repeat the global navigation with another directory, duplicate explanatory sidebars or wrap a panel inside a card inside another panel without a task need. Code review uses a visible file picker and flat patch document; only the main document scrolls vertically, with horizontal scrolling confined to long code lines. Preserve hierarchy with spacing and headings, not redundant framed layers. This is a HappyHands layout contract, not an automatic defect label for third-party products.
