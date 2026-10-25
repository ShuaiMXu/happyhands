---
name: design-md
description: Create or update a repo's DESIGN.md — a living design-language contract for AI agents and humans — plus a portable frontend-design skill. Classifies the repo first (document an existing design language, merge with existing design docs, or propose a new direction with user approval) so it never overwrites a project's current design. Use when setting up design docs for a frontend project. Triggers on "add a DESIGN.md", "document our design language", "set up design docs", "create a design system doc", "bootstrap design".
license: MIT
metadata:
  version: "1.0.0"
---

# Design Language Doc (DESIGN.md)

You are creating this repository's design-language contract: a root `DESIGN.md` that tells agents and humans exactly how UI is built here, plus a portable `frontend-design` craft skill. The doc is **downstream of the code** — you describe the design language that exists, or propose one with user approval. You never invent a design language and present it as fact, and you never restyle existing UI to match a doc.

## Goal

1. Root `DESIGN.md` — the repo's design language, written from evidence, citing real files and tokens
2. `.agents/skills/frontend-design/SKILL.md` — portable craft doctrine (typography, surfaces, motion) that applies to any repo
3. A link from `AGENTS.md` so agents find the design language within one hop

## Reference templates

| File | Used for |
|------|----------|
| `references/design-md-template.md` | `DESIGN.md` skeleton, filled from evidence |
| `references/skill-frontend-design.md` | `.agents/skills/frontend-design/SKILL.md` (create verbatim) |

## Phase 0: Audit, then classify (before writing anything)

Gather evidence. Every claim in `DESIGN.md` must trace back to something you saw here:

- [ ] `package.json`: framework, UI libraries (react/vue/svelte, tailwind, shadcn, radix/base-ui, motion/framer-motion, lucide, fonts packages)
- [ ] Token layer: `globals.css` / `tailwind.config.*` / theme files — CSS variables, `@theme` blocks, custom utilities (shadows, radii, animations)
- [ ] Fonts: how they're loaded (`next/font`, `@font-face`, link tags), which families, which roles
- [ ] Component system: `components/ui/`, shared primitives, variant patterns (cva, variants props)
- [ ] Motion: keyframes, transition utilities, motion-library usage, `prefers-reduced-motion` handling
- [ ] The 3–5 most polished surfaces in the app — these define the *actual* design language, whatever the tokens claim
- [ ] Existing design docs: `DESIGN.md`, `docs/design*`, brand guidelines, Figma links in READMEs, design-related Cursor rules or agent docs

Then classify the repo into exactly one mode:

### Mode A — Document (established design language, no design doc)

The repo has consistent tokens, deliberate font choices, a component system, recurring motifs. Your job is **extraction**: write `DESIGN.md` describing what exists, citing the files that prove it. Nothing about the actual design changes. Where the codebase is internally inconsistent, document the dominant/most-recent pattern and note the deviation — do not resolve it by fiat.

### Mode B — Merge (design docs already exist)

A `DESIGN.md`, brand guide, or design-related rules already exist. **Merge, never regenerate**: preserve every unique local rule, deduplicate against the template structure, keep one source of truth, and leave pointers behind if you consolidate scattered docs. If existing docs contradict the code, flag the contradiction to the user instead of silently picking a side.

### Mode C — Propose (greenfield, no coherent design language)

No established language exists. Choosing an aesthetic direction is a **user-owned decision**, not an evidence question. Write a one-page proposal to `docs/plans/design-language.md` (or `PLAN.md` if the repo has no `docs/plans/`) covering: aesthetic direction and tone, font pairing (display + body), color approach and the accent budget, elevation strategy, motion approach. Offer 2–3 distinct directions if the product context supports them. **Stop and get user approval before writing `DESIGN.md`.** After approval, write the full doc from the approved proposal.

## Deliverables

```
DESIGN.md                              # root design-language contract (living document)
.agents/
  skills/
    frontend-design/SKILL.md           # portable craft doctrine (references/skill-frontend-design.md)
docs/
  plans/
    design-language.md                 # Mode C only: the approved proposal
```

Plus one edit: add `- [Design Language](DESIGN.md)` to the Quick Links in `AGENTS.md` (create the section if the repo has an `AGENTS.md` without it; skip if there is no `AGENTS.md`).

## Process (in order)

1. **Phase 0** audit and classification (checklist above)
2. Mode C only: write the proposal, present it, and **wait for approval**
3. Write `DESIGN.md` using `references/design-md-template.md` as structure — filled from evidence (Modes A/B) or the approved proposal (Mode C)
4. Create `.agents/skills/frontend-design/SKILL.md` verbatim from `references/skill-frontend-design.md` (stripping the template preamble), unless the repo already has an equivalent craft skill — then skip it
5. Link `DESIGN.md` from `AGENTS.md` Quick Links
6. Run the **verification pass** below
7. Report: mode chosen and why, files created, contradictions found between docs and code, rules preserved from pre-existing docs

## Writing rules for DESIGN.md

- **Cite real files.** Every token, utility, font, and component pattern named in the doc must link to the file that defines it
- **Name the budgets.** Great design languages are mostly restraint — make limits explicit ("one accent pairing per view", "at most one display-font moment per page"), because agents follow budgets better than vibes
- **Include the one-liner.** A blockquote near the top that compresses the whole language into one paragraph an agent can carry to another surface
- **End with a per-page checklist** of verifiable items, phrased so an agent can self-review against them
- **Sizes over adjectives.** "`rounded-3xl` cards, `rounded-full` CTAs" beats "generously rounded"
- Semantic tokens over hardcoded values everywhere the repo's token system reaches; name the sanctioned exceptions explicitly

## Constraints

- **Never restyle existing components to match `DESIGN.md`.** The doc describes or proposes; it does not authorize a refactor. If the user wants the UI brought in line with the doc, that is a separate, explicit task
- In Modes A and B, do not "improve" the design language while documenting it — record improvement ideas at the end under a clearly-marked "Open questions" section instead
- Do not copy another product's design language (fonts, palettes, motifs) into `DESIGN.md` unless verified in THIS repo or approved in the Mode C proposal
- Prefer an accurate short doc over an impressive long one — an agent that trusts a wrong design doc produces confidently wrong UI
- Match the repo's markdown tone and formatting

## Verification pass (required before finishing)

- [ ] Every file path referenced in `DESIGN.md` resolves to an existing file
- [ ] Every token, utility class, and font named in the doc exists in the codebase (grep for it)
- [ ] Modes A/B: no rule in the doc contradicts what the most polished surfaces actually do
- [ ] Mode B: every unique rule from the pre-existing docs survived the merge (diff them)
- [ ] Mode C: the doc matches the approved proposal; the proposal file exists in `docs/plans/`
- [ ] The `AGENTS.md` link resolves
- [ ] The checklist at the end of `DESIGN.md` contains only items an agent can verify from code

## Done when

- An agent building UI in this repo can answer "what fonts, what tokens, what radii, what shadows, what motion?" from `DESIGN.md` alone, one hop from `AGENTS.md`
- The user's existing design decisions are intact — nothing was overwritten, and any new direction was explicitly approved
- The portable `frontend-design` craft skill is installed
- Every doc statement is evidence-backed (or approval-backed) and the verification pass is clean
