# Issue and PR closeout, 2026-10-18

## Current decision — revised after the user's cleanup instruction

The earlier decision to leave every issue open is superseded. The user explicitly asked to correct outdated issues and close inactive plans. Core open issues are reduced from eleven to five. Archived issues retain their original specifications in collapsible sections and use `not_planned`, not completed; no human Accept or launch readiness is fabricated.

All five active issues retain the complete previous specification under a collapsed historical section. This is backlog cleanup, not a claim that the archived plans were implemented. Reopen the archived issue if its scope is intentionally restarted.

## Website PR

[creative-os-site #1](https://github.com/ShuaiMXu/creative-os-site/pull/1) is CLOSED, not merged. Its head was default main `34c111a64277bbf764ea0c62afb5493f2de8e4b3`; base was the old review snapshot `864ad5a9252fdfa4346847b6327292a445adb272`. Main already contains the hero implementation and 94 later commits beyond that base. No branch/code was deleted and no deployment was performed. This does not certify website launch checks; those are now tracked in site #22.

## Resume point

P0: #7 professional diagnosis → run-specific recommendation → existing governed change/QA/human flow, and #29 Foundation acceptance. P1: #9/#10/#11 after the core product flow. Website acceptance belongs to its own repository.

[Product-chain audit](product-chain-audit-2026-10-18.md) remains the technical status reference. Do not equate post-change Visual QA with initial AI diagnosis or treat perfect sample-site contrast as the entire launch criterion. PR #122 code checks remain 553 passing tests, 28 release regressions and production build; this cleanup is documentation only, not a new test/acceptance run. Paid GitHub Actions remain deferred. Feature development remains paused at the user's request; this cleanup does not complete the launch goal.


Project-specific historical case sections are excluded from this public source distribution.
