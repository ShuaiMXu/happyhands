# #29 — Foundation evidence and component governance

This increment connects extraction to per-item governance. It does not close #29, approve a Foundation, certify every component state, or promote a bounded Skill to operational. All original Skill packages and maturity metadata are unchanged.

## What now survives the workflow

- Candidate tokens retain declarations, conditional contexts, aliases, unresolved references, conflicts and consumers. Component candidates retain exports, consumers, declared Props, literal variant candidates, slots, relative-import composition edges, responsive rules and a rendered-evidence gap record.
- These remain `evidence.status: observed` inside the versioned Foundation. Human rule fields and per-item decisions are separate. The same observations flow into reuse planning and independent review; immutable capture/extraction files still carry their hashes.
- Approve, replace and deprecate require an item reason for new evidence-bearing candidates. Replacement retains previous values. The server rejects missing/modified evidence, unrecorded replacement, mismatched decision/status and a replacement missing its original values. Legacy snapshots without the new fields remain readable.
- Source changes between capture and inventory, during inventory, or against a cached extraction result require a fresh run. A partial source scan cannot report a completed extraction. Token identity is case-sensitive.
- A verified region reference records its selector, source anchor, source hash, configuration and original screenshot. It does **not** certify every nested component or applicable interaction. `renderedCoverage.status` stays `needs-evidence` until that missing verification is supplied; unmapped screenshots are never automatically assigned to all components.

An offline HTML file can be up to 32 MiB, within a 64 MiB total scan budget. Explicit smaller `maxBytes` limits still win. Skipped oversized inputs retain omission records. The extractor understands this case's explicit `__bundler/template` JSON string (decoded limit 8 MiB), without executing the loader. Inline CSS uses PostCSS; decoded-template coordinates remain separate from the original container line. Original bytes remain the source hash input.

Embedded image/font inventory exports metadata only: resource identity, format, encoded size and reference name. It does not export blobs, assume licenses, confirm dimensions or infer that every resource is used. A monolithic offline document is one `inline-document`, not an invented shared component library. Runtime composition, theme objects, alias imports/re-exports and inherited APIs remain outside this bounded parser.

## Real cases and retained gaps

HappyClaw source `c42a4c0` (same tree as published main `2bffa88`) was captured at 1440×900 and 390×844 through `captureWithDesignSystem` → inventory → export. The source inventory contains 37 tokens, 15 component files, 12 asset references and 20 copy samples. The plan covers the whole page and 13 directly source-mapped component regions: 28 successful captures. `ScreenshotFigure` and `GithubIcon` have no direct component mapping; parent/whole-page screenshots do not silently fill those gaps. No interaction-state pass or human approval is inferred from these normal-layout captures.

Validation artifacts are stored locally under `verification/2026-10-15/foundation-governance/`: capture plans, immutable exported runs, source/extraction bindings, UI captures, and separate draft-only browser checks. The draft checks intercept the writable-state response and block approval requests; they are UI fixtures, not human decisions. Normal desktop/mobile layouts and Chinese/English presentation are checked; 200% is not the primary test and no physical-device claim is made.

## Remaining #29 acceptance

## Independent-review correction

The first independent review found that token themes/variants/category/usage could change through the API while keeping an approve action. All rule fields now use one shared definition across server comparison, replacement history and UI restoration. Regression checks cover each bypass, a valid replacement and restoring a draft without keeping newly added fields. The original failed review is retained; merging requires a fresh review of the corrected head.

A second review found a duplicate-entry bypass of the first-match lookup. Evidence-bearing collections now require one-to-one candidate matching: every original item occurs exactly once, with no appended/omitted entries or duplicate evidence identity. Tests cover copied tokens both with and without evidence, same-length duplication, omissions and valid replacement. Neither failed review is overwritten.

The third review reproduced stale UI action state after a replacement changed `source`, another item triggered a redraw, and the user restored the original rule. The separate source-keyed action cache is removed; `item.decision.action` is the single action state. A real browser fixture now covers that exact cross-item sequence. Self-review also tightened mixed legacy/new collections: unchanged manual rules remain compatible, but every modification needs a replacement record. Choosing approve or deprecate after editing restores the original rule fields.

The fourth review found historical replacement `previous` values leaking into a later version’s editable draft. Read-only history retains its decisions; a fresh editable draft clears historical decisions and leaves their current rule values intact, so its first action records the new version’s baseline. The cross-version regression saves a new version after replacing and restoring a draft, and confirms both the retained value and unchanged historical snapshot.


Project-specific historical case sections are excluded from this public source distribution.
