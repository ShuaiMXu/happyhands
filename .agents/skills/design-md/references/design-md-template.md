# Template: DESIGN.md

Use this skeleton for the target repo's root `DESIGN.md`. Fill every section from Phase 0 evidence (Modes A/B) or the approved proposal (Mode C), and delete sections that do not apply — a repo with no dark mode or no motion system should not have empty sections pretending otherwise.

Structural rules that make the doc work for agents:

- The **one-liner blockquote** is mandatory: one paragraph that compresses the whole language, portable to any surface
- Every named token, utility, font, and component must **link to the defining file**
- State **budgets** as numbers ("one accent pairing per view"), not adjectives
- The closing **checklist** must contain only items verifiable from code

---

```md
# Design Language — "<name the language>"

<2–4 sentences capturing the personality: canvas, surfaces, type voices,
color posture, signature motifs. Written so a designer would nod and an
agent could act.>

> One-liner for handing to another surface:
> <One dense paragraph: fonts and their roles, canvas + sheet/surface
> structure with exact classes, hero/content patterns, component recipes,
> the accent budget, and the hard "nevers".>

The canonical implementation is <the most polished surface, linked>.
Reusable primitives live in <link>; shared tokens and utilities are in <link>.

---

## 1. Foundations

### Fonts

<One subsection per typeface: family, how it is loaded (link the file),
the role it carries, and where it is banned. If there is a display/accent
face, state its per-view budget explicitly.>

### Color

<The token table: role → token. State the accent budget ("exactly one
<accent> pairing per view") and the hardcoded-color policy, naming the
sanctioned exceptions (e.g. shadow values, artwork assets).>

| Role | Token |
| --- | --- |
| Page canvas | `<token>` |
| Surfaces | `<token>` |
| Primary text | `<token>` |
| Secondary text | `<token>` |
| Primary action | `<token>` |
| The accent | `<token>` |

### Elevation

<Borders vs shadows policy. If the repo has a shadow utility, name it,
show its definition, and forbid re-inlining it. Note dark-mode overrides.>

---

## 2. Surfaces & rounding

<The radius scale as a table: radius → use. Note the concentric-radius
rule for nesting. Then one recipe block per signature surface (sheet,
card, panel) with real classes.>

| Radius | Use for |
| --- | --- |
| `<class>` | <use> |

---

## 3. Typography patterns

<A table of element → exact classes for the recurring text roles (hero
title, subtitle, card title, body, labels, badges, CTA labels). Note
casing policy, tracking policy, and tabular-nums policy. Include the
copy voice in 1–2 sentences with example CTA labels.>

| Element | Classes |
| --- | --- |
| <element> | `<classes>` |

---

## 4. Layout & spacing

<Viewport structure, container widths, grid patterns, and the in-surface
rhythm (real margin/gap classes in order). Call out what whitespace is
doing semantically, not just how much there is.>

---

## 5. Components & motifs

<One bullet per recurring component or motif: badges, CTAs, lists,
icons, artwork/decoration. Each with exact classes and which primitive
to use (link it). Name the icon set and its size/stroke rules.>

---

## 6. Motion

<Entrance, hover, press, and loading patterns with real utility or
keyframe names (linked). State the interruptibility rule, the
`prefers-reduced-motion` policy, and the "never `transition-all`" rule
if the repo follows it.>

---

## 7. Checklist (per page)

- [ ] <verifiable structural rule, e.g. "exactly one `<sheet classes>` sheet">
- [ ] <token rule, e.g. "no hardcoded colors outside <exceptions>">
- [ ] <accent budget rule>
- [ ] <type rules: faces, casing, tracking, tabular-nums>
- [ ] <component recipes followed: CTAs, badges, lists>
- [ ] <motion rules: entrance utility, press scale, reduced-motion>

---

## Open questions

<Modes A/B only, optional: inconsistencies found while documenting, and
improvement ideas deliberately NOT folded into the rules above. Delete
if empty.>
```
