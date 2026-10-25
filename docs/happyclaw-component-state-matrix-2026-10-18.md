# HappyClaw component applicability and remaining evidence

Source: `ShuaiMXu/happyclaw-site` at `3befc9b5bc6aa8d988e28de1dd820224341dd6a4`, inspected from a clean checkout. Paths below are relative to that repository. The component-inventory Skill separates observed source contracts from rendered evidence and approval.

The current collector in `examples/happyclaw-site/verify-component-instances.mjs` produced 71/71 root-instance captures across all 15 components. Its successful root matching and screenshot hashes do not establish interaction-state completeness or independent visual approval. The page QA run and component-root run are separate evidence sets.

| Component | Source contract and actual use | Current root capture count | Further state evidence to assess |
| --- | --- | ---: | --- |
| BrandMark | `src/components/ui/BrandMark.astro`: compact/hero and showName. Header/Footer use compact with name; Hero uses hero with showName=false. | 6 | These three actual usages are present; unused prop combinations must not be invented as product requirements. Check size behavior around 768px separately. |
| GitHubIcon | `src/components/ui/GitHubIcon.astro`: small/regular. Hero regular; desktop and expanded mobile navigation small. Decorative SVG. | 4 | Host link focus/hover and accessible naming belong to Header/Hero, not a fictitious icon loading state. |
| ScreenshotFigure | `src/components/ui/ScreenshotFigure.astro`: nine data-driven images, captions and original-image links in three channels. | 18 | Original link focus/activation, image load/error evidence and each channel's keyboard selection. Existing lazy-image settling does not prove error recovery. |
| SectionHeading | `src/components/ui/SectionHeading.astro`: title and optional description; six current consumers all supply description. | 12 | Current title/description wrapping and type scale at responsive boundaries. No evidence for unused description-less examples. |
| CapabilityGroup | `src/components/ui/CapabilityGroup.astro`: title and item descriptions; three groups under FeatureGrid. | 6 | Content wrapping and responsive layout. Source has no local disabled/loading/error interaction contract. |
| CommandStep | `src/components/ui/CommandStep.astro`: clone/directory/start commands; copy button and keyboard-scrollable pre region. | 6 | Initial, copying/disabled/busy, success, permission denial/unavailable, timeout and repeat recovery; distinguish real clipboard read-back from mocked rejection. Root defaults do not cover these states. |
| Header | `src/components/Header.astro`: desktop navigation; mobile modal navigation, focus containment, Escape, link close and breakpoint restoration. | 3 | Page menu evidence exists separately. Reconcile each state and method against source; root open/default images alone do not establish keyboard behavior. |
| Hero | `src/components/Hero.astro`: page-only composition with BrandMark and regular GitHubIcon. | 2 | CTA link focus/hover and wrapping; source does not define application loading/error states. |
| FeatureHighlights | `src/components/FeatureHighlights.astro`: SectionHeading and repeated highlight content. | 2 | Responsive grid/content behavior; default only. |
| ScreenshotShowcase | `src/components/ScreenshotShowcase.astro`: web/mobile/feishu tabs, selected/unselected styles, ArrowLeft/ArrowRight/Home/End and tabpanel visibility. | 2 | Root captures are default web. Child figure captures select all channels, but do not substitute for whole-parent selected-channel and focus evidence. |
| FeatureGrid | `src/components/FeatureGrid.astro`: SectionHeading plus three CapabilityGroups. | 2 | Parent layout and repeated-component consistency across widths. |
| Architecture | `src/components/Architecture.astro`: desktop diagram and mobile ordered list, `lg` visibility switch. | 2 | Both captured endpoints exist; assess breakpoint transition and accessible names without claiming all widths. |
| QuickStart | `src/components/QuickStart.astro`: SectionHeading and three CommandSteps. | 2 | Parent layout with command status changes; reuse the actual CommandStep interaction contract. |
| TechStack | `src/components/TechStack.astro`: SectionHeading and named technology list. | 2 | Wrapping and reading order across widths. |
| Footer | `src/components/Footer.astro`: compact BrandMark and footer links. | 2 | Link focus/hover, keyboard order and wrapping. |

Counts total 71. No row implies approved Foundation, complete API testing, physical-device validation or whole-site accessibility compliance. Generic state names are not automatically applicable to every static component. Existing page-plan and specialist evidence must be reconciled by source revision, target, method and original-image binding before marking individual states covered. Missing normal-state evidence remains missing; auxiliary stress checks retain their narrower method boundaries.

Next work is to connect these source-defined state obligations to verified originals and specialist action records, then obtain independent assessment of affected component states. The matrix itself is a source audit and work specification, not completion of #29.

## Optional real interaction capture

The existing collector now accepts `--interactive`. Its default remains the original 71 targets with identical plan structure. The optional plan contains 131 targets: the previous roots plus 60 explicitly asserted focus, hover and channel-selected targets for real CommandStep buttons, screenshot tabs and representative original-image links, Header controls, the Hero GitHub link and all three Footer links. Footer branding is static content, not a focusable link. No target DOM markers or styles are injected.

```sh
node examples/happyclaw-site/verify-component-instances.mjs --repo /path/to/happyclaw-site --url http://127.0.0.1:4499/ --out /path/to/private-evidence --interactive
```

Add `--plan-only` to validate and save `component-plan.json` without launching a browser or creating a run. Both default and expanded plans passed schema/source checks against the clean source revision above; comparison against the earlier 71-target plan proved the entire default plan and expanded prefix unchanged.

The first real expanded run, `d051ab72`, completed 131/131 targets with zero failures. The completed-record checker verified all 131 original hashes, fifteen component root/source mappings and 81 terminal instantaneous assertions against the plan and bound extraction. The source remains clean at the revision above, with snapshot `dad3715bd69b4377b877dbd6427d9a189a323dddb0016fc35b7b2f56805b5c34`. No human judgment or Foundation approval exists. These explicit states have not received a new independent visual assessment. Programmatic focus remains distinct from keyboard traversal; copy pending/result/timeout/recovery and assistive-technology behavior remain separate obligations.

## Completed-record integrity check

```sh
node examples/happyclaw-site/verify-component-evidence.mjs --run /path/to/completed-component-run
```

This read-only check requires a completed summary, capture plan and bound extraction. It checks every expected state/device key, dimensions, actions, source and instance mapping, variant observations, terminal instantaneous assertions and original-image hashes. It preserves the existing extraction/capture-binding checks and reports existing human/Foundation decisions without creating them. A capture count alone is insufficient. It does not declare visual approval or prove a server's deployment identity from a response fingerprint.

The earlier real record `fb56174c` passed: 71 originals, 15 components and 21 terminal assertions. Negative checks in private derived metadata rejected a corrupted original and an invented assertion; the latter was rejected by the existing capture binding before state inspection. The original record remained unchanged and passed again. The expanded `d051ab72` record subsequently passed the same checker with 131 originals and 81 terminal assertions; neither result is visual acceptance.
