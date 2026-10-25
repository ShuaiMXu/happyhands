---
name: component-reuse-planner
description: "Decide whether a proposed change should reuse, extend or introduce a component using the governed project inventory."
---

# Component Reuse Planner

Reduce component drift while preserving legitimate variants.

## Required evidence

- selected finding
- component inventory
- approved and deprecated states

## Decisions

- Prefer approved components
- Treat observed components as candidates
- Propose a new component only when existing semantics do not fit
- For a changed shared component, identify its concrete consumers and applicable variants/states. Use source-bound root instance capture evidence where available; a parent screenshot does not certify descendants. Propose missing captures through the existing scoped plan confirmation instead of inventing coverage or adding markers solely to pass a check.

## Boundary

Name similarity alone does not prove component equivalence.

Return structured evidence, findings, proposed updates and limitations. Use `needs-evidence` when required inputs or professional review are missing. Never invent an Experience Score or promote a project observation into a universal rule.
