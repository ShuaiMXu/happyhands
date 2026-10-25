---
name: component-inventory
description: "Build a component inventory with source paths, variants, composition and known consumers."
---

# Component Inventory

Create the component map needed for reuse decisions and drift analysis.

## Required evidence

- component sources
- exports and imports
- rendered examples when available

## Decisions

- Record source and consumers
- Separate primitives from product patterns
- Mark inferred variants observed

## Boundary

Static imports may miss runtime composition.

Version 0.6.0 resolves explicit tsconfig/jsconfig paths and baseUrl against the recorded source snapshot, including local JSONC extends, referenced projects and nested project scope. Keep configInputs hashes with every resolved alias. This lookup is not proof that a bundler/runtime applies the same mapping. Missing package bases, absolute config paths, overlapping scopes, truncated snapshots, missing targets and ambiguous module candidates remain needs-inspection records. Do not execute target configuration files or silently infer a package config from installed dependencies.

Transitive consumer traversal is bounded to 32 edges per path and 256 modules per component. A consumerGraphTruncated flag means the affected scope is incomplete; inspect or narrow the source scope before proposing a complete review.

Use consumerEvidence file/line references and potentialConsumers paths to inspect affected modules. A transitive path through a barrel is module reachability, not proof that a particular exported component is rendered. Do not label those pages reviewed or add them to a confirmed capture plan automatically. Preserve moduleResolutionIssues for aliases, missing or ambiguous modules and dynamic expressions; absence of a resolved edge is not evidence of no consumers. Type-only declarations and commented examples are not runtime consumers. CommonJS require candidates still need binding inspection.

Return structured evidence, findings, proposed updates and limitations. Use `needs-evidence` when required inputs or professional review are missing. Never invent an Experience Score or promote a project observation into a universal rule.
