# Experience remediation validation — 2026-11-03

## Scope and result

The opt-in operational chain was exercised with real Codex execution and a separate GPT-6 Astra visual review on a controlled static Chinese project-summary fixture. This is not production-site acceptance. No human acceptance, merge or deployment was recorded.

The executor accounted for all 29 adopted rules and the confirmed issue. Independent QA ultimately returned `pass`, with 29 primary-state rule checks and no findings. The first QA returned `needs-evidence` for responsive reflow; its result remains in history. An evidence retry supplied three actual supplemental originals and the reviewer inspected all three. Supplemental images do not constitute an additional per-device rule matrix.

The baseline model retained uncertainty about broader component consumers. The validation operator confirmed the concrete visible spacing/overflow issue from measured evidence; no blanket baseline approval was manufactured.

## Observed changes

Current-page remediation came first: remove a redundant uppercase eyebrow, restore 24px card spacing and equal flexible columns, and keep the title, three Chinese summaries, font, colors and fine borders. Responsive reflow was the final regression step.

| Viewport | Observed result |
|---|---|
| 1280px desktop | Three approximately 341.33px columns, 24px gaps, within the 1072px content area; the previous grid exceeded that area by 16px |
| 390px phone | One 358px column, 16px outer padding, document width 390px; before the change document width was 1112px |
| 800px intermediate | Two 364px columns, 24px gaps, document width 800px; only an after capture was collected at this width |

Browser originals and DOM measurements were collected from the actual isolated worktree. Some browser JPEG originals were converted to PNG without changing dimensions for the capture interface. The fixture contains no controls or scripts: dropdown, keyboard interaction, screen-reader and motion behavior were not validated and are not claimed.

## Engineering checks

- 634 tests passed, with zero failures, skips or cancellations.
- Production build passed; existing bundler `use client` warnings remain.
- The own Skill passed the Skill validator, and the diff passed whitespace checks.
- Real execution used temporary Codex CLI 0.166.0 with `gpt-6-astra`. The installed 0.141.0 CLI rejected that model as requiring a newer CLI. Global installation and model configuration were not changed.
- Tests ran with global/system Git configuration disabled for their process. Machine-specific Git hooks otherwise mutated test repositories; no product boundary checks were weakened.

Real execution exposed and corrected ambiguous workflow-phase IDs, inconsistent incomplete-diagnosis output guidance, missing design-source/DOM context in QA, and an intent-to-add entry left behind after report removal. The pilot's reserved report index entry was cleared without changing source bytes; final automated runner tests verify the corrected cleanup for successful and malformed reports, plus protection of a pre-existing tracked reserved path.

Private captures and agent logs remain outside the repository. Reports are executor claims; exact coverage and hash binding do not establish infallible design judgment.

## Follow-up work

1. Run this chain against an approved real product task, including repeated shared-component consumers and actual dropdown open/selected/focus/keyboard states.
2. Add a workbench view for rule decisions, evidence gaps and remediation history; the current release supplies persisted contracts and reports.
3. Put every required device/state in the Capture Plan when full per-device rule coverage is needed; use native capture-time specialist evidence for richer interaction checks.
4. Configure a supported CLI/model in the normal execution environment; the successful pilot used a temporary launcher.
5. Extend owned methods through reviewed, accepted cases and regression tests. Automatic feedback-to-rule generalization is not implemented.
