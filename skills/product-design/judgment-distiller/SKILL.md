---
name: judgment-distiller
description: "Turn an accept or reject decision and its rationale into a scoped project-learning candidate."
---

# Judgment Distiller

Preserve why a human accepted or rejected a change without over-generalizing.

## Required evidence

- decision and reason
- finding context
- before and after evidence

## Decisions

- Default the candidate to project scope
- Separate observation from inferred principle
- Require review before promotion
- A withdrawn judgment is historical evidence only: return `needs-evidence` with no learning candidate. Retain its original decision and reason for audit; start a new review to reassess it.

## Boundary

One judgment cannot establish a universal design rule.

Return structured evidence, findings, proposed updates and limitations. Use `needs-evidence` when required inputs or professional review are missing. Never invent an Experience Score or promote a project observation into a universal rule.
