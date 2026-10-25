# Design-language research and adoption

Reviewed 2026-09-29. The local rubric is an independently written Harness adaptation. OJO’s complete original Skill, nine references and MIT license are now bundled separately in `skills/vendor/ojo/upstream/`; no upstream executable or installation script is included. Pinned links identify the source; runtime uses the verified local OJO snapshot without network fetches. Updating a rule requires a rubric version change, counterexample review and regression checks.

| Source | Fixed revision / license | Useful method | Deliberately excluded |
| --- | --- | --- | --- |
| [Impeccable critique](https://github.com/pbakaus/impeccable/blob/114ea1d3838fca73b253af45f873b9c4f5f213c8/skill/reference/critique.md) | `114ea1d3838fca73b253af45f873b9c4f5f213c8`, [Apache-2.0](https://github.com/pbakaus/impeccable/blob/114ea1d3838fca73b253af45f873b9c4f5f213c8/LICENSE) | Assess product specificity and holistic hierarchy; keep deterministic signals separate from visual judgment. | Upstream CLI/browser injection, aggregate aesthetic scores and mandatory orchestration. Harness retains its existing evidence and confirmation gates. |
| [OJO UI/UX skill](https://github.com/touchine-ojo/OJO-Design-Skills/blob/fbd2c2d158e5ebda8930f4bc63ed635a8500d31f/skills/app-ui-ux-best-practices/SKILL.md) | `fbd2c2d158e5ebda8930f4bc63ed635a8500d31f`, [MIT](https://github.com/touchine-ojo/OJO-Design-Skills/blob/fbd2c2d158e5ebda8930f4bc63ed635a8500d31f/LICENSE) | Derive visual choices from audience, brand and purpose; a utility product can benefit from established conventions. | Original text is retained, with the Harness adapter resolving direction menus, external-tool assumptions, framework prescriptions and categorical style bans against the actual approved task. |
| [Krirox anti-ai-slop](https://github.com/Krirox/anti-ai-slop-skills/blob/b7515139a58dd3076588a3981d3d6f8d4e5bb064/SKILL.md) | `b7515139a58dd3076588a3981d3d6f8d4e5bb064`; license not established by repository license API | Comparison only: covers visual, content and interaction symptoms. | Not bundled or adapted. Reject authorship claims, universal gradient/font/layout bans, numerical slop thresholds and novelty for its own sake. |

## Calibration examples

- A gradient competes with a deployment CTA: inspect the actual contrast, reading order and task impact. A branded gradient that preserves legibility is not a finding.
- Equal cards hide the difference between a required setup step and optional integrations: propose clearer grouping. Equal cards comparing peer plans are legitimate.
- An unlabeled dashboard metric: ask for its source or propose an explicit demo label. Do not infer fraud from a screenshot or replace it with invented realistic numbers.
- A still image with no error message: request the failed-state capture if relevant; do not claim the error state is missing.
- A contrast-only change on a playful site: verify the requested fix and introduced regressions; do not fail it because the reviewer prefers monochrome minimalism.

## Limits

These sources offer design heuristics, not a validated detector of AI authorship. Unit tests establish evidence plumbing and guardrails, not professional visual quality. Real screenshot-aware reviewed cases remain necessary before promoting the skills from bounded to operational.


## Complete upstream packages (2026-10-14)

The earlier Impeccable table records the rubric research version; its CLI was not incorporated then. New Harness runs now also stage the complete official Impeccable package at `2f98774f86bc05563876643db37e6c37c322850f` (Apache-2.0, including NOTICE.md), and all 14 Taste skills at `a60a36dc2bb3bb77ccf17f2f62041f5ca8a458b9` (MIT). Every original skill, reference, script and resource is retained with a Git blob identity and SHA-256 under `skills/vendor/impeccable` / `skills/vendor/taste`. Scripts are preserved without automatic execution. The two Harness adapters govern stage/tool/scope differences and preserve the complete upstream design methods. Default existing-product review uses Taste redesign plus Impeccable Audit/Critique; implementation uses Polish and the declared Layout/Animate focus. Current Taste v2 is for public pages and has no numeric dials; the full original v1 supports an explicit dial profile. See `docs/taste-impeccable-integration.md`.
