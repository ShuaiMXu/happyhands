# HappyClaw mobile menu acceptance record — 2026-10-10

## Scope

This run addresses HappyClaw finding F3 only: the mobile menu button changed the menu's visibility without identifying the controlled element or exposing its open state. It does not claim a whole-page accessibility or design review.

- Baseline repository: `ShuaiMXu/happyclaw-site`
- Baseline commit: `cf1da7b835d91553cc9f2639358c41dec37bf2a4`
- Fix commit: `d50ea9f`
- Fix PR: [happyclaw-site#4](https://github.com/ShuaiMXu/happyclaw-site/pull/4)
- Harness run: `64bd5fa4`
- Viewport: 390 × 844
- States: `mobile-menu-closed`, `mobile-menu-open`

## Change

The menu button now declares `aria-controls="mobile-menu"` and starts with `aria-expanded="false"`. One `setMenuOpen` path synchronizes the hidden class and `aria-expanded`; clicking a menu item uses the same path to close the menu. Navigation content, targets, dimensions and styling are unchanged.

Harness capture now records `ariaControls` and `ariaExpanded` for visible controls and preserves their before/after values in evaluation output. This closes the evidence gap exposed by the earlier 34-screenshot run `d3cdd345`, whose independent reviewer correctly withheld a pass because screenshots alone could not establish the ARIA state.

## Evidence

Both production builds completed successfully. The focused run reached 2/2 before states and 2/2 after states. Each state returned HTTP 200, retained its H1 and had no horizontal overflow.

| State | Baseline button | Fixed button | Screenshot result |
| --- | --- | --- | --- |
| Closed | no `aria-controls`; no `aria-expanded` | `aria-controls="mobile-menu"`; `aria-expanded="false"` | pixel-identical, SHA-256 `62972f4a…` |
| Open | no `aria-controls`; no `aria-expanded` | `aria-controls="mobile-menu"`; `aria-expanded="true"` | pixel-identical, SHA-256 `7095e59d…` |

A separate browser replay also verified the complete transition: closed → open → select “特性” → closed, including the final `aria-expanded="false"` state.

## Review status

- Deterministic structure and interaction checks: passed.
- Local visual inspection: passed; both before/after image pairs are byte-identical.
- Independent model review: passed after the user explicitly authorized sending the four screenshots and structured page evidence. The fresh read-only Codex session inspected every before/after screenshot, reported no findings and confirmed that the scoped semantic change preserved visual hierarchy, responsive layout and brand continuity.
- Human judgment: accepted. Harness recorded the user's explicit Accept with the matched semantic evidence, pixel-identical screenshots, browser replay and independent QA pass as its rationale; run `64bd5fa4` is complete.

The independent reviewer retained three limits: this focused evidence does not itself prove the menu-item close implementation path, desktop or landscape behavior, keyboard focus, screen-reader announcements or reduced-motion behavior; F1 and F2 also remain outside this fix. The separate browser replay covers the menu-item close transition, while the other limits remain outside the declared scope.

The next real-project case is the already observed QuickStart mobile long-command clipping. Reuse the same focused production-capture workflow under the existing page-review issue instead of opening another parallel issue.
