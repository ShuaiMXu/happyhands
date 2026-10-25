---
name: review-product
description: Diagnose and improve one important user task in an existing app, with evidence, a scoped Codex change, and before/after validation.
---

# Review a built product

Use this when a developer has a working app but needs help choosing and verifying the next UX improvement. The product may have been built with vibe coding; do not assume the code is poor because of how it was made.

1. Ask for the app or repository and the most important user task. Infer a narrow task from the product if the developer has not specified one; label that inference.
2. Run the app when possible. Capture the starting commit, page states and desktop/mobile views. Separate what is directly observed from your interpretation.
3. Write an Experience Spec matching `experience.schema.json`. Every finding must cite evidence IDs. Mark missing evidence; do not fabricate screenshots, analytics, users or conversion results.
4. Rank findings by impact, confidence and effort, then explain the top choice in ordinary language. Treat the formula as a decision aid rather than an objective UX score. Allow the developer to choose a different issue.
5. Make one scoped, reversible code change in an isolated branch/worktree. Keep the product goal and working task intact.
6. Run the app again and visit the same states and viewports. Check the task, hierarchy, interaction, accessibility and regressions. If a comparison cannot be made, report the missing step instead of declaring success.
7. Present the change and before/after evidence. Capture accept/reject and the developer's reason in the spec. Propose an expertise or evaluator update only after repeated, reviewed judgments; add a regression example.

Stop before an external deployment unless it has been authorized. A live site may differ from the supplied repository; verify their relationship before claiming that a repository change is live.


## Complete design guidance packages

Creative OS stages pinned, complete OJO, Taste and Impeccable snapshots into new review/execution runs. Before model design work, read the listed original Skill files and each Harness adapter, then the relevant complete references. Existing product UI uses Taste redesign; explicit public-page work can select v2; explicit dial-based work can select the complete v1 and declared layout variance, motion intensity and visual density. Impeccable Audit/Critique are review methods; Polish/Layout/Animate guide only the confirmed implementation. Keep the current stack, approved Foundation, original content and all relevant states. These packages share the existing scope→plan→isolated change→capture→independent QA→human judgment flow. Do not add a parallel CLI/browser session or acceptance store. Presence in a snapshot proves availability, not model use, completed browser checks or human approval.


## HappyHands UI profile

For HappyHands-owned interfaces or explicitly adopting projects, read the complete `happyhands-ui/SKILL.md` in the staged design-guidance bundle. It contains the eleven user-approved copy, Radix color, hierarchy and interaction rules. The bundle hashes and preserves this profile alongside the complete vendor skills; do not infer adoption by an external target project.
