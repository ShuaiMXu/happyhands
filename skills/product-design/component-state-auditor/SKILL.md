---
name: component-state-auditor
description: "Audit documented components against a versioned rubric of the states their class has to be able to express."
---

# Component State Auditor

A surface that renders only its success state is not finished. The states nobody drew are the ones that decide whether a person can keep working: the queue before anything happens, the half-finished run, the failure with no way back.

## Required evidence

- a design foundation with components
- component sources
- `rubric.json` beside this file, which holds the required state sets

## The rubric

`rubric.json` names classes of component and what each class has to be able to express. A class is matched from the component name. The default rubric ships three classes:

- **async-task-item** — a unit of work the product performs over time (a generation, render, upload, export, job). Requires `empty`, `pending`, `in-progress`, `complete`, `needs-review`, `failed`, plus a stated failure reason and a retry. Work that takes time fails, partially succeeds, and produces output a person has to check before trusting it.
- **collection** — a list, table, grid or feed. Requires `empty`, `in-progress`, `complete`, `failed`, plus a stated failure reason. A collection is empty before it is full, and its empty state is the first thing a new user sees.
- **interactive-control** — a button, input, select, toggle or field. Requires `default`, `disabled`, `in-progress`.

The required sets are the judgement of this Skill version, not a universal rule. A project with different classes of component replaces `rubric.json`, and every result records which rubric version produced it.

## Two tiers, kept apart

**Documented.** The states a component declares in the foundation, compared with what its class requires. A data comparison with nothing inferred, so it can be stated plainly: this component documents four states and its class requires six.

**Observed.** State words found in the component's source. This is evidence, never proof. The absence of a word is not the absence of a state, and the presence of one is not a state that works. Report it at low confidence, with the file it came from, for a person to check.

A state the source shows but the foundation does not document is its own result: the implementation moved and the documentation did not.

## Decisions

- Check only the states the component's class needs. A component that matches no class has nothing required of it, and that is reported rather than filled in with a default set.
- Cite the source path and the words found, so a reviewer can confirm or dismiss each one quickly.
- Leave the direction open. A missing state may belong to another component, or the class may be wrong; the audit names the gap and records `add-the-state`, `document-the-state` or `reclassify-the-component` as an unresolved choice.
- Do not add decorative states without a user need.

## Boundary

Source analysis cannot prove that a runtime state is reachable, correct or accessible. Keyboard focus, screen-reader behaviour and visual treatment of each state remain outside this audit.

Match the recorded repository-relative source path exactly. A legacy path without an extension may match one unique implementation at that same path; a same-named file in another directory or an ambiguous extension is not evidence. Missing sources and truncated snapshots keep the result `needs-evidence`, while preserving the documented-state comparison. The release regression corpus covers documented controls, missing states, wrong same-named sources, ambiguous implementations and missing/truncated inputs; it does not establish runtime state quality or operational maturity.

For an offline HTML bundle, scan only its explicit decoded JSON template using the shared source decoder. Preserve template coordinates and the enclosing source identity. Loader code and manifest payloads are not component state or recovery evidence. An unreadable template stays unavailable, with its decoding error; never fall back to scanning the outer bundle. Template text still provides only static candidates, not proof of rendered behaviour.

Return structured evidence, findings, proposed updates and limitations. Use `needs-evidence` when required inputs or professional review are missing. Never invent an Experience Score or promote a project observation into a universal rule.
