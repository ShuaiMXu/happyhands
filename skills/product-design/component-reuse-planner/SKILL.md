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

## Component lineage

- For each touched instance, cite the shared source, its token or variant, its concrete consumers, and the affected states. Check the same component across resource and product pages when it appears on both.
- Treat alternate themes as token or variant inputs to the shared implementation. Keep original isolated third-party examples intact.
- For a new family, explain the distinct semantics or behavior, what existing APIs cannot express, and where it will be reused. Add source inspection and real state replay to the verification plan.

## Boundary

Name similarity alone does not prove component equivalence.

Return structured evidence, findings, proposed updates and limitations. Use `needs-evidence` when required inputs or professional review are missing. Never invent an Experience Score or promote a project observation into a universal rule.
