---
name: skill-regression-evaluator
description: "Evaluate a skill version against its regression cases and report first divergences."
---

# Skill Regression Evaluator

Prevent an expertise update from silently breaking previously accepted behavior.

## Required evidence

- skill version
- regression inputs
- expected outcomes

## Decisions

- Run cases reproducibly
- Report pass, fail and skipped
- Block publication on unexplained failures

## Boundary

Passing a finite regression set does not prove universal quality.

Return structured evidence, findings, proposed updates and limitations. Use `needs-evidence` when required inputs or professional review are missing. Never invent an Experience Score or promote a project observation into a universal rule.
