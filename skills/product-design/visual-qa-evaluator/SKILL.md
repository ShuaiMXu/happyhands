---
name: visual-qa-evaluator
description: "Compare matched before and after renders for task clarity and visual regressions after a product change."
---

# Visual QA Evaluator

Prepare an independent visual decision from matched evidence.

## Required evidence

- same-state desktop and mobile captures
- critical task
- declared design intent

## Decisions

- Compare hierarchy, grouping, contrast and reading order
- Report regressions separately
- State uncertainty rather than inventing a score

## Boundary

The deterministic handler only prepares matched artifacts; screenshot-aware review is required.

Return structured evidence, findings, proposed updates and limitations. Use `needs-evidence` when required inputs or professional review are missing. Never invent an Experience Score or promote a project observation into a universal rule.

## Design language continuity

Read [the shared design-language rubric](../visual-hierarchy-reviewer/rubric.json). Apply it to the confirmed change and introduced regressions, preserving supplied brand choices. Put the visible element, task/brand conflict and minimal remedy in each finding's observation. Existing out-of-scope opportunities belong in limitations, not automatic failure of a narrow fix. The Workbench's independent AI review receives this same versioned rubric and foundation context.

## Bundled OJO methodology

Use the [Harness OJO adapter](../../vendor/ojo/ADAPTER.md), then its linked original Skill and relevant references. The runtime records a verified guidance snapshot in this result; design execution and independent QA receive the same pinned source with mode-specific reading routes. Preserve the existing evidence and approval boundaries.
