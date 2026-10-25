---
name: change-impact-mapper
description: "Map a code change to affected routes, components, design foundations and critical user tasks."
---

# Change Impact Mapper

Limit incremental review to the product states a change can affect.

## Required evidence

- Git diff
- dependency graph
- routes, components and tasks

## Decisions

- Trace changed artifacts to consumers
- State uncertain reachability
- Return affected review targets

## Boundary

Textual diff alone may miss runtime configuration effects.

Return structured evidence, findings, proposed updates and limitations. Use `needs-evidence` when required inputs or professional review are missing. Never invent an Experience Score or promote a project observation into a universal rule.
