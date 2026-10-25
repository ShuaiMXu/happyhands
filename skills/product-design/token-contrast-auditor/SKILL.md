---
name: token-contrast-auditor
description: "Compute WCAG contrast for colour pairs the token names or the source state, and report which fail."
---

# Token Contrast Auditor

Whether a colour pair is legible is arithmetic, not taste. A team that darkens its danger colour is arguing about how it looks; the ratio against the surface it sits on is a number, and WCAG says what that number has to be.

## Required evidence

- a design foundation with colour tokens
- component and stylesheet sources, when pairs stated in code are also to be measured

## Which pairs are measured

Only pairs that something states:

- **Declared.** A role that has both a text token and a surface token — danger text on danger surface, success text on success surface. The names say these are used together.
- **Observed.** A declaration that sets a text colour and a background together, in a CSS rule or a style object. It states a pairing whatever the token names say.

A pair nobody expressed is not invented. Measuring every colour against every other produces a long list of failures that describe combinations the product never renders.

## Thresholds

WCAG 2.2 AA asks for 4.5:1 for normal text and 3:1 for large text and non-text contrast. A token pair does not carry the size or weight of the text it will hold, so the result reports which band a pair falls in rather than pretending to know:

- below 3:1 — fails every use
- 3:1 to 4.5:1 — carries large text or non-text only, and whether that is what it carries has to be checked in the interface
- 4.5:1 and above — passes AA

## Decisions

- Report the ratio, both values and where the pair came from, so the result can be checked by hand.
- Leave the fix open. Darkening the foreground, lightening the surface and restricting the pair to large text are all valid answers, and which one is right depends on the rest of the system.
- Skip a colour with an alpha channel and say so. What it renders as depends on what is behind it, and a ratio computed against the wrong backdrop is worse than no ratio.

## Boundary

Contrast is necessary, not sufficient. A pair that passes can still be illegible over a photograph, behind a gradient, or at a weight the ratio does not describe. Passing this audit is not an accessibility certification, and failing it is not always a defect — a disabled control is meant to recede.

Return structured evidence, findings, proposed updates and limitations. Use `needs-evidence` when required inputs or professional review are missing. Never invent an Experience Score or promote a project observation into a universal rule.
