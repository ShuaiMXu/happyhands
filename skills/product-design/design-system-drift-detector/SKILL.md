---
name: design-system-drift-detector
description: "Detect implementation values that diverge from the design foundation as ungoverned values, semantic conflicts or off-scale steps."
---

# Design System Drift Detector

Find where the implementation and the design foundation no longer agree, and say what kind of disagreement it is.

## Required evidence

- a design foundation with tokens
- current repository sources
- changed files when available

## Three mechanisms

Drift is not one thing. Each mechanism needs its own check, because a check built for one is blind to the others.

**Ungoverned value.** A literal that no token represents. Ranked by how many times and how many files it reached, because a value that spread across dozens of files is a token candidate, while one that appears twice is probably a local mistake. Report the count and the distribution; do not treat frequency as approval.

**Semantic conflict.** One semantic slot — danger text, success surface, warning border — carrying more than one value. This is the mechanism a frequency check cannot see: a wrong danger colour used once in a single notice never clears any threshold, and it is exactly what an audit has to surface. Group by role and by property slot, list every value with where it came from, and do not pick a winner.

**Off-scale value.** A value that sits between the steps of a token scale: radius 8 against a 7/9/11 scale, a half-step font size, a 300ms transition against a 130/170/300/600 band. Report the nearest step and the distance. For motion, also report whether snapping to the nearest step would visibly change how the interface moves — snapping a duration is not a rename, it changes behaviour.

## Decisions

- Report exact divergence with its mechanism, count and sources.
- Report the direction as unresolved. A value that already shipped is often the truth and the token file is what has to change; the opposite is just as common. A person decides which side moves and records why.
- Separate a deprecated usage from a legitimate extension by asking for review, never by replacing a value automatically.
- Distinguish registering a value from applying it. Adding a token to the foundation changes the foundation only; the implementation still holds a literal until someone changes it to reference the token.
- Report how much of the implementation already reads tokens, so the next alignment pass has a number to move.

## Boundary

Approved rules must exist before drift can be claimed. With a foundation whose entries are only observed, the same divergences are review targets and the result stays `needs-evidence`.

A static scan cannot follow computed styles, utility classes, runtime theming or a `var(--token)` reference to the value it resolves to. Semantic slots are inferred from nearby keywords, so an unusual naming convention can hide a real conflict.

Return structured evidence, findings, proposed updates and limitations. Use `needs-evidence` when required inputs or professional review are missing. Never invent an Experience Score or promote a project observation into a universal rule.
