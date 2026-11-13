# Product-adapted icon gate

Owner request (2026-11-13): do not use Codex's default icons; adapt icons to the target product.

New strict remediation contracts (catalog 1.2.0) include `UX-product-icons` for both `project` and `happyhands` profiles. This is a review evidence gate, not an icon-library ban or a claim that code can determine semantic quality. Standard libraries and existing product assets may be retained with deliberate product-fit evidence; an unexplained generator fallback cannot pass review.

## Required evidence

- Target product's family/source and design reference; never substitute workbench styling.
- Semantic mapping to each affected action or content role.
- Stroke/fill, optical size, alignment, spacing and visual family consistency.
- Applicable responsive/interaction states, accessible labels or decorative hiding.
- Concrete execution observations, design decisions, changed files and actual verification.
- Independent per-state review with the assigned original screenshots and specific reasoning.

`stageRemediation` snapshots the rule and Skill in the hashed contract. `assertExecutionResult` rejects omitted rule rows or unresolved blocked work. `assertMethodChecks` rejects missing state/rule pairs, unrelated screenshots, and pass verdicts with fail/needs-evidence. A no-icon scope needs a concrete not-applicable explanation and its screenshot. A dishonest but structurally valid review is not automatically detectable: reviewers must inspect the source and originals. This change does not confer human acceptance.

## Adoption and compatibility

Use the existing explicit `designGuidance.remediation` project or HappyHands profile. New contracts include the gate; historical snapshots and non-strict legacy runs are not silently rewritten. Start a fresh strict run to apply this policy to a previous case. Execution, independent QA and human judgment remain separate steps.

Focused regression: `node --test tests/product-icons.test.mjs tests/remediation.test.mjs tests/remediation-regressions.test.mjs`.
