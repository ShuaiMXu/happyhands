---
name: fix-planner
description: "Turn a confirmed finding into a scoped, reversible change plan constrained by project evidence and approved design foundations."
---

# Fix Planner

Translate the selected problem into intent, constraints and acceptance criteria.

## Required evidence

- finding evidence
- approved tokens, components and patterns
- working product paths

## Decisions

- Keep one confirmed repair scope per plan; related delegated findings may share a demonstrated root cause.
- Prefer the smallest reversible change
- State acceptance criteria and uncertainty

## Boundary

Repository inspection is still required before naming exact files.

Return structured evidence, findings, proposed updates and limitations. Use `needs-evidence` when required inputs or professional review are missing. Never invent an Experience Score or promote a project observation into a universal rule.


## Task-specific design decision

Read the current Run's complete experience audit, actual user constraints, original screenshots and selected design sources. Separate a user's outcome from an operator's preferred solution. A missing label, table or card is not a defect merely because someone proposed it.

Before implementation, record the reading order and information grouping that answer the user's immediate questions; identify the primary action and what content must be shown, combined or deferred. Explain component relationships, known consumers and actual default/open/selected/focus/error states as applicable. For layout, preserve the adopted container, alignment, columns, gutter and spacing relationships; do not substitute a reference's grid without task-specific justification.

Compare the chosen approach with a lighter change or preserving the existing design. State the expected task benefit, cost, risk and what evidence could refute it. For every selected Design.md or design-system source, identify a real section, the target problem, adoption/rejection, implementation location and verification. Colors, fonts and field counts alone do not constitute adaptation. Keep incomplete discovery explicit and resolve it before editing.

For policy `task-design-review@1`, deliver the decision through `experience --phase decision --input FILE` before `plan`. The confirmed scope and diagnostic record must match. A decision is an operator hypothesis subject to independent challenge, never a new user requirement or human acceptance. If the best supported decision is no change, report that outcome rather than creating work to satisfy the pipeline.

## Execution contract and admission

The bounded handler supplies: A candidate plan from the selected evidence-supported finding and existing constraints.

The professional method still requires: Inspect exact source consumers and record the existing experience decision before implementation. A generated plan is not a verified file patch or acceptance.

Deliver into the current Run's existing experience audit or decision; do not create a competing report. Cite the frozen Skill path and exact rule, original state and source, observed failure, task consequence and the reasoning connecting them. Record preservation/counterevidence. With no demonstrated defect, keep the candidate unadmitted and make no change. `complete` describes this handler's bounded output, not professional review or human acceptance.
