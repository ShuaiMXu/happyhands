---
name: foundation-extractor
description: Inventory an existing product's design tokens and component sources when establishing or updating its Design Foundation.
---

# Foundation Extractor

Build a traceable inventory from the repository before proposing rules. Distinguish what exists from what is approved.

- Cite the source path for every extracted artifact.
- Mark discoveries `observed`; never promote them to `approved` automatically.
- Preserve aliases and semantic token names when present. Treat raw literal values as inventory candidates.
- Report duplicate or ambiguous artifacts for review instead of silently merging them.
- Return `needs-evidence` when the repository or relevant source files are unavailable.

The deterministic handler inventories CSS custom properties with their declared values: each token records its most frequent value, an inferred category (color, radius, type, space, shadow, motion — name first, value shape second) and, when a name resolves to several values, the full set as observed variants. Component files in component/UI directories complete the inventory. Every entry is promotable into the Experience Spec token shape without re-typing, and stays observed until a person approves it. Brand intent, component semantics, variants and states still require human or model-assisted review.

JS/TS theme/token/palette declarations, static object exports in theme files and Tailwind default-export `theme` objects are parsed from the source snapshot without execution. Literal values, static property access, spreads, relative named imports and explicit re-exports retain original file/line references. Object paths namespace candidates so unrelated palettes are not silently merged. Explicit primitive/semantic/component object keys supply observed layer labels; missing labels remain unclassified. Dynamic expressions, unsupported module resolution, syntax errors and extraction budgets produce missing-evidence diagnostics. These observations do not prove runtime values, theme activation, complete consumers or rendered component coverage.
