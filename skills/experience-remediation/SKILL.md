---
name: experience-remediation
description: Execute evidence-backed UI and UX remediation using project layout contracts, shared components and complete OJO/Taste/Impeccable methods, then supply per-rule evidence for independent acceptance.
---

# Experience remediation

Use for a confirmed experience repair, including AI slop and inconsistent shared components. The task, adopted project rules and approved Foundation take precedence over generic examples. This Skill never authorizes unrelated redesign, publication or a human acceptance decision.

## Diagnose

Read the complete assigned method documents. Start with the current page and its actual working viewport. First review the recurring AI slop and UI details: dropdown arrows/checkmarks, selected/focus states, gaps, boundaries, radii, redundant navigation and unnecessary copy. Then inspect shared components, task flow and current-page hierarchy/grid. Phone and other viewport checks come last as regression coverage; they never replace current-page remediation. For every contract rule and supplied state, return an explicit result with original screenshot references. Distinguish a visible violation from a preference, missing evidence and a genuine non-applicable rule. Never label an unchecked state not-applicable. Follow the existing finding-admission policy when proposing a repair.

## Mandatory order

Current-page AI slop and detail review → shared-component correction and current-page interactions → task/hierarchy/layout validation → cross-device regression. Inspect historical project issues before introducing new aesthetic preferences. Group findings and verification in this order, even if captures were collected together. Do not declare success because a mobile overflow was fixed while current-page control defects remain.

## Decide and implement

1. Reproduce the issue and identify the user task it interrupts. State what to preserve.
2. Inspect the actual design sources, shared component and all known consumers. A package dependency does not establish actual use.
3. Record a concrete decision: content order, grouping, primary action, copy retained/removed, widths, spacing, responsive reflow and state behavior. Use existing tokens and primitives. Resolve a shared cause before patching instances.
4. For grids, inspect the adopted container width, columns, gutter, outer margins, alignment and breakpoints. Record actual source references and the chosen values/reflow in the result. Preserve intended reading order and nested alignment; never impose OJO's 12-column/8pt examples on a different approved grid. Missing layout evidence must be stated, not invented.
5. Use OJO component-recipe for applicable control states and layout patterns; visual-tokens for spacing and alignment; icon-guidelines for arrows and indicators; motion-system for feedback and reduced motion. Read relevant complete references. Use Impeccable Polish, adding Layout/Animate only when appropriate, with Taste's task-specific composition guidance. Keep all original packages intact.
6. Check default, hover, pressed, selected, open, focus, disabled and relevant loading/error/success states. Do not invent asynchronous states for static content. For dropdowns check long labels, chevrons, checkmarks, item gaps, menu boundaries, scrolling, keyboard selection, Escape and focus return.
7. Write the structured execution result required by the Harness. Every rule and delegated issue must have one result; fixed items name actual changed files. Preserved and false-positive decisions require evidence and a reason. Blocked items stay visible. Reading a method is not completion.

## Page structure and original-image review

`UX-page-structure` requires explicit grid, spacing, alignment, component-usage and responsive-state review for each assigned original. Mark supported defects on the original capture with normalized bounds linked to the finding ID. Keep annotations as a derived overlay; never alter or replace original evidence. Use actual target-product layout sources, not mandatory universal 8px spacing or arbitrary column counts. Missing/unobserved dimensions remain needs-evidence and block pass. Follow the structured `structureChecks`/`annotations` protocol in [page structure review](../../docs/page-structure-review.md).

## Product icon hard gate

`UX-product-icons` is required for every newly staged strict project/HappyHands remediation contract. “Codex default icon” means an unexamined generator fallback, not a maintained blacklist of icon libraries. First decide whether an icon is necessary. Omit or remove unnecessary decoration; text-only/no-icon output is valid, and no icon may be added just to satisfy this gate. For necessary icons, preserve already suitable existing choices with evidence rather than forcing redesign. Never reuse default glyphs just because they compile. Establish the target product's icon family and source, map icons to its actions and vocabulary, and inspect stroke/fill, optical size, spacing, states and accessibility. Existing assets or a standard library are acceptable only when deliberately fitted to this product; custom drawing is not required for familiar functional symbols. Do not copy the HappyHands shell's icon language into third-party products.

Execution must record concrete source/adoption evidence in `observed`, the product-specific adaptation in `decision`, affected source files and actual checks in `verification`. Independent review must cite each assigned state's original and explain the observed semantic and visual fit in its `reason`, not repeat the executor's claim. Missing evidence stays blocked/needs-evidence. A no-icon scope, including deliberate removal of unnecessary icons, may use not-applicable with a concrete necessity explanation. No automatic claim of originality, correct semantics or human approval is made by this protocol. Old run snapshots remain unchanged; new runs without strict remediation are not covered by this gate.

## HappyHands homepage Hero

When the bound profile includes `surface: homepage-hero`, apply the two Hero rules to the actual HappyHands portal homepage states. Treat the existing cover spiral as the approved motion exception. Keep the archive covers, orbit, center clearance, and existing content and actions. Check perspective, opening tilt, pointer response and scroll exit using timed frames and actual browser evidence. Examine the glass header while covers pass behind it. The central glass mark has one silhouette with the highlight clipped inside it. Check both themes and desktop and phone. Reduced motion freezes the covers, WebGL failure uses the cover fallback, and the offscreen animation stops. Record unobserved motion as needs-evidence; the bound `hero-motion` specialist check is required for a passing review.

## Independent acceptance

The reviewer does not edit. Inspect originals and supplied verification records, not only the executor's account. Check every rule on every assigned state, including layout/grid relationships and shared consumers. A pass requires complete coverage with no unresolved failures or missing evidence. Record limitations and exceptions; never infer unseen interaction behavior from screenshots. Preserve existing source/hash, visual QA and human-judgment gates.

The optional `harness compare` export presents eligible viewport originals at 1:1 with provenance. Reviewers must still inspect the original images, task and actual interaction evidence. An exported image cannot turn a failed or missing review into a pass. Missing capture-time binding requires fresh capture, not retrofitted hashes or edited records; a DSH final event is likewise not independent acceptance.

## Evolving these methods

Keep project preferences scoped to that project. New general rules require an accepted real case, applicability and exceptions, a regression example and an independently reviewed version. Never rewrite historical contracts when updating this Skill.
