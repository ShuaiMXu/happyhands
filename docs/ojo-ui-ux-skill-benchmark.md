# OJO App UI/UX Skill benchmark

Source reviewed: [OJO `app-ui-ux-best-practices`](https://github.com/touchine-ojo/OJO-Design-Skills/tree/main/skills/app-ui-ux-best-practices), 2026-09-27.

This note records architectural lessons for Product Designer. The full pinned OJO Skill and references are now vendored under `skills/vendor/ojo/upstream/` with their MIT license; see [runtime integration](ojo-integration.md). A checklist or a bundled method still does not validate our Skills.

## Product boundary

OJO is strongest before and during design generation: it selects a visual direction, derives tokens, specifies components and motion, and applies a final quality checklist. Product Designer starts from an existing, coded product and owns the post-build loop:

`observe -> extract -> diagnose -> prioritize -> change -> render -> re-evaluate -> learn`

We should use the same depth of design reasoning while retaining evidence, reversibility, project history and human judgment as first-class product objects.

## Ideas to adopt

### Evidence-derived visual register

Record observable project traits on five independent axes:

- energy: quiet to loud
- finish: raw to polished
- density: sparse to dense
- weight: light to heavy
- seriousness: playful to solemn

Each value needs repository, rendered-product, brand or human evidence. Adjectives such as “premium” or “clean” remain unapproved until translated into observable decisions. The register becomes part of the versioned Brand Foundation and constrains later recommendations.

### Utility and brand-experience modes

Classify the product or surface before reviewing it:

- utility mode prioritizes predictability, task speed, familiar interaction and cognitive economy;
- brand-experience mode allows stronger visual authorship when emotional differentiation is part of the product value.

This is review context, not a universal style prescription. A project may contain both modes on different surfaces.

### Couple visual language to product structure

Visual direction cannot be reduced to palette and radius. It also affects navigation shell, information density, content hierarchy, imagery, motion and page composition. Recommendations that change those structures must identify the affected critical task and enter the normal change-impact and re-evaluation loop.

### Govern the complete component state model

The foundation should account for relevant default, hover, active, focus, disabled, loading, success and error states. Product Designer already has a versioned state rubric; OJO reinforces that state coverage belongs in component governance rather than a finishing checklist.

### Treat imagery and motion as governed systems

Meaningful imagery needs subject, source, crop, alternative text and fallback behavior. Motion needs a declared purpose such as feedback, guidance, continuity or brand expression. Both should be extracted when present and reviewed against the approved project foundation.

### Add an explicit anti-pattern and quality-gate layer

Anti-patterns should describe failure modes and evidence, not ban fashionable colors or styles globally. The quality gate should detect unjustified defaults, placeholder imagery, inconsistent icon language, missing states, weak contrast, arbitrary motion and visual decisions that conflict with the approved register.

## Mapping to our Skill architecture

| OJO capability | Product Designer owner | Required change |
| --- | --- | --- |
| product/design track selection | Brand Foundation + review context | Add `surfaceMode` with evidence and allow mixed projects |
| visual register | `brand-foundation-extractor` | Extract candidates for the five axes; require human approval |
| visual tokens | `foundation-extractor`, `token-normalizer` | Add semantic roles, aliases, provenance and confidence |
| component recipes and states | `component-inventory`, `component-state-auditor` | Preserve variants, consumers and complete relevant states |
| information architecture coupling | `information-architecture-reviewer`, `change-impact-mapper` | Connect visual changes to routes, navigation and critical tasks |
| imagery rules | `brand-foundation-extractor`, visual QA | Inventory asset purpose, source and fallback behavior |
| motion system | new bounded extractor/reviewer | Inventory motion and test purpose, reduced-motion behavior and consistency |
| design audit | diagnosis Skills + `visual-qa-evaluator` | Run evidence-backed checks before and after each change |
| anti-patterns | versioned expertise pack | Store scoped rules with exceptions and regression cases |

## Implementation order

1. Extend the Design and Brand Foundation contract with visual register, surface mode, asset rules and provenance.
2. Upgrade extraction Skills to produce observed facts and review candidates separately.
3. Implement `token-normalizer` and `pattern-library-curator`; keep both contract-only until their handlers exist.
4. Add motion inventory and review contracts after the foundation schema is stable.
5. Route findings through the existing Expert Loop and require matched before/after evidence.
6. Use user-provided real cases to calibrate evaluators and promote only proven Skills to operational.

## Decisions we should not inherit

- Do not require direction selection during diagnosis of an existing product.
- Do not force Tailwind as the component representation; the harness must remain framework-neutral.
- Do not turn aesthetic preferences into global prohibitions.
- Do not use named products as styles to copy. References can explain a design tradition, while the approved project foundation remains authoritative.
- Do not claim conversion improvement without behavioral data.

The immediate engineering target remains Issue #29: a traceable Design and Brand Foundation that later review, generation and monitoring Skills can share.
