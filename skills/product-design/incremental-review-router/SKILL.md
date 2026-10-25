---
name: incremental-review-router
description: "Select the smallest sufficient set of review skills and product states for a project change."
---

# Incremental Review Router

Avoid rerunning a full audit when only part of the product changed.

## Required evidence

- impact map
- project history
- available skills and evidence

## Decisions

- Route by affected task and artifact
- Include regression-sensitive history
- Explain every selected skill

## Boundary

Routing quality depends on a reliable impact map.

Return structured evidence, findings, proposed updates and limitations. Use `needs-evidence` when required inputs or professional review are missing. Never invent an Experience Score or promote a project observation into a universal rule.
