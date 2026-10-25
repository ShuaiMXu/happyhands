# Spacing and contextual information

The report uses the existing workbench shell and Foundation. Spacing should express relationships: label, value and action belong together; distinct tasks need separation. Closed support sections are operable rows, not empty content cards. Repeated components should follow the project's spacing scale; dense tables and spacious editorial pages need different treatments. A pixel mismatch alone is not a usability finding.

## What to show

| Placement | Content | Boundary |
| --- | --- | --- |
| Visible at the decision | Current result, next action, blocker, missing evidence and limits that change what can safely be concluded | Never hide pending human approval or turn scoped QA into an overall product pass. |
| Beside the control | Required input format, meaningful consequences, current errors and recovery | Do not make a tooltip the only way to discover required information. |
| Labeled disclosure | Optional explanation, source paths/hashes, raw request errors, detailed logs and historical evidence | Preserve the complete original, link and source language. Support keyboard, touch and meaningful labels. Specialist workflows can expose technical detail by default. |
| Omit from the default reading path | Repeated orientation text, implementation narration unrelated to a user decision, decorative empty cards | Relocate useful material instead of deleting audit evidence. |

The report now keeps the repository/live mismatch visible, moves the language explanation into project/evidence context, gives a history-list failure its own recovery message and technical disclosure, and reduces padding on closed Foundation/context rows. This does not change existing judgments, execution authorization or the full skill packages. Retry rereads history in place and preserves the current record, expanded evidence and unsaved inputs; it does not reload the page, write judgments or execute changes.

## Harness integration

`visual-hierarchy-reviewer` 0.4.0 retains all prior instructions and adds two screenshot-aware checks to the existing shared rubric 0.2.0: `spacing-relationships` and `contextual-information`. The baseline Skill and independent QA already read and hash this rubric. New runs receive the updated contract; historical provenance and reviews are unchanged. No new deterministic spacing score, auto-finding handler, Foundation approval or operational maturity is introduced. OJO, Taste and Impeccable originals are untouched.

Review normal desktop and mobile first. Check default, expanded, error and recovery states where applicable. Preserve natural labels; do not force wrapping or hide required content to fit a spacing number. Treat static captures as layout evidence, not proof of unseen keyboard, tooltip or asynchronous behavior.

## Verification boundary

Browser checks use the actual workbench at 1280px and its responsive page inside a 390 × 844 CSS px iframe. The iframe is a temporary local verification wrapper, not device emulation or a new product view. Main `d9d900f` provides the before comparison. A malformed local history index is an explicit synthetic error fixture; the actual retry clears the warning once the fixture is removed. An existing immutable HappyClaw export `05fd2161` is replayed without modifying its screenshots or human decision. No fresh HappyClaw target capture, mobile hardware certification or new Foundation approval is claimed.

Validation: 553 full tests, 55 focused integration/translation tests, 28 release regressions, design contract and production build passed. Independent initial review found a dynamic-error language-switch regression, corrected by retaining the raw error and translating the UI wrapper on language changes. The source error remains verbatim. Actual browser switching confirmed the fix; keyboard disclosure and failed/successful history retries preserved the selected case, open context and an unsaved synthetic rationale without saving a judgment. Reviewer sandbox/PNPM failures remain in the local audit rather than being reported as check passes.

Final recovery review also required reconciling entries removed from a refreshed history index. Refresh now removes absent non-current exports from both pickers, while retaining the loaded review and its draft. A retained current record does not approve it or rewrite its original evidence.
