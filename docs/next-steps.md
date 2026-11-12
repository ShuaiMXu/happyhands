# Alpha roadmap

The local workbench supports planned page/device/state capture, model-assisted diagnosis, project design-source review, scoped implementation in isolated Git worktrees, before/after evidence and independent review. A human accepts or rejects each change.

Current priorities:
- The [integration review](integration-review-2026-11-12.md) maps the core and website PRs to issues #7, #8 and #14, separates completed engineering work from remaining product acceptance, and defines the Alpha.3 source/package boundary.
- The [engineering reassessment](engineering-reassessment-2026-11-11.md) records confirmed defects, remaining hypotheses, intended outcomes and maintenance constraints. Merged [#17](https://github.com/ShuaiMXu/happyhands/pull/17) adds shared diagnosis, optional preflight and a clean-source continuation entry. Full design-value and cross-model evaluation remain pending.
- Deliver [the lightweight UI and product-experience loop (#7)](https://github.com/ShuaiMXu/happyhands/issues/7) before [the promotional-video workflow (#8)](https://github.com/ShuaiMXu/happyhands/issues/8). Implement one bounded slice at a time; retain partial and failed validation rather than closing a whole issue on documentation alone.
- The bilingual README/Star chart and [DSH orchestration guide](dsh.md) are merged. DSH's local headless attempt stopped on missing model credentials; a dedicated DSH executor and a DSH-only review loop remain unverified.
- [Lightweight Alpha.2](https://github.com/ShuaiMXu/happyhands/releases/tag/v0.1.0-alpha.2) is published. Its public package cold installation and first source-bound HappyHands setup repair passed independent review and explicit user acceptance. The three repairs cover language synchronization, current validation errors and keyboard access. Matching original comparisons, scoped code changes and prior failures are retained; this is not a whole-site redesign or blanket cross-agent acceptance.
- The `harness compare` command preserves matching original viewport pixels. Continue the remaining criteria in issue #7: an external Design.md layout/hierarchy case, other distinct product cases, new-user validation, additional execution environments and motion sharing. Each case still needs the existing evidence and user-judgment gates; an installed Skill or generated comparison is not proof of a repaired product.
- Update the website’s bilingual setup entry and prompts for the lightweight install, keeping source checkout and the workbench as optional paths. The current website setup copy still describes the earlier source/workbench flow.
- Validate the new preflight and immutable successor-run handoff on new users' actual products. #17's source tests cover direct Vite/Astro dependency checks, the exact HTTP entry, capture failures, streamed execution logs and fresh child-run gates. Broader framework detection, automatic failure artifacts and long-review progress remain follow-ups; these tests do not prove model access or preview build identity. See the [release follow-up](https://github.com/ShuaiMXu/happyhands/issues/7#issuecomment-6767157639) for the original reports.
- Validate onboarding with new users on their own products.
- Complete professional calibration of design-system and reusable-pattern governance.
- Validate incremental review and release/rollback workflows against real changes.
- Complete end-to-end validation of the Claude Code implementation adapter.
- Keep unknown dependencies, missing evidence and unreviewed states explicit.

This public roadmap contains no private project histories or unpublished acceptance records. Unrelated historical work is not presented as completed product acceptance.
