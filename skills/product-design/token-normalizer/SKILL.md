---
name: token-normalizer
description: "Map raw visual values and aliases into candidate semantic design tokens without silently changing the product."
---

# Token Normalizer

Turn repeated implementation values into a reviewable semantic token proposal.

## Required evidence

- raw values
- existing token aliases
- usage locations

## Decisions

- Preserve existing semantic names
- Show every proposed merge
- Flag exceptions instead of forcing them

## Boundary

Frequency alone does not determine semantic equivalence.

Return structured evidence, findings, proposed updates and limitations. Use `needs-evidence` when required inputs or professional review are missing. Never invent an Experience Score or promote a project observation into a universal rule.
