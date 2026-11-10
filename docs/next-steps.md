# Alpha roadmap

The local workbench supports planned page/device/state capture, model-assisted diagnosis, project design-source review, scoped implementation in isolated Git worktrees, before/after evidence and independent review. A human accepts or rejects each change.

Current priorities:
- Deliver [the lightweight UI and product-experience loop (#7)](https://github.com/ShuaiMXu/happyhands/issues/7) before [the promotional-video workflow (#8)](https://github.com/ShuaiMXu/happyhands/issues/8). Implement one bounded slice at a time; retain partial and failed validation rather than closing a whole issue on documentation alone.
- The bilingual README/Star chart and [DSH orchestration guide](dsh.md) are merged. DSH's local headless attempt stopped on missing model credentials; a dedicated DSH executor and a DSH-only review loop remain unverified.
- The `harness compare` command exports matching, bound viewport evidence without altering original pixels. Automated fixture checks cover pixel preservation and rejection paths; a real product improvement case is still required. The lightweight Alpha implementation now packages the same engine and complete methods, supports cold installation, selected source/reference snapshots and read-only model commands without the workbench. Its actual supported environment, failures and case validation are reported in the release. #7 still needs the remaining real-case, design-reference/layout and human-acceptance criteria; installation is not issue completion. Each delivery must use the existing run and acceptance gates. An installed Skill or a generated comparison is not proof of a repaired product.
- Validate onboarding with new users on their own products.
- Complete professional calibration of design-system and reusable-pattern governance.
- Validate incremental review and release/rollback workflows against real changes.
- Complete end-to-end validation of the Claude Code implementation adapter.
- Keep unknown dependencies, missing evidence and unreviewed states explicit.

This public roadmap contains no private project histories or unpublished acceptance records. Unrelated historical work is not presented as completed product acceptance.
