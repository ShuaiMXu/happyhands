---
name: consistency-auditor
description: Audit a product for visual and component inconsistencies when source code and a project Design Foundation are available.
---

# Consistency Auditor

Identify inconsistent implementations that increase user confusion or maintenance cost. Treat static frequency as a signal for review, not proof of a UX defect.

- Compare implementation values with `approved` Foundation entries.
- Cite every file and value used as evidence.
- Separate deliberate variants from unexplained duplication.
- Prefer consolidation into an existing approved token or component; propose a new artifact only when the existing system cannot express the need.
- State confidence and uncertainty. Do not convert an arbitrary threshold into an Experience Score.

The deterministic handler currently detects repeated literal colors and border-radius values. Component equivalence, visual context and intentional exceptions require later analysis.
