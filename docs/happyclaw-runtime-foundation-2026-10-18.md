# HappyClaw runtime Foundation evidence

The previous page review retained six uncertain phase-specific assessments: state colors/contrast, typography/command interaction and exact shapes/target sizes, each for before and after. This collection adds measured evidence without changing those historical conclusions, approving rules or editing HappyClaw.

## Reproducible collection

```sh
node examples/happyclaw-site/verify-foundation-runtime.mjs --repo /path/to/happyclaw-site --url http://127.0.0.1:4499/ --out /path/to/private-evidence
```

Run versions sequentially. The CLI uses an exclusive per-user temporary clipboard lock; a second invocation fails before browser operations. It does not automatically delete a stale lock: inspect its owning PID first. The lock prevents concurrent instances of this checker, not unrelated user applications from changing the clipboard.

Each run saves the exact method source and hash, samples source/preview identity on both sides of capture, and stores original-image hashes with immutable extraction. Measurements are included in `dom.designSystem.runtimeMeasurements` and the resulting extraction's rendered samples, not promoted to rules. Observed measurement rows distinguish laid-out DOM from elements actually in the viewport. Computed fontFamily is a CSS stack, not proof of the chosen font for every glyph.

Method 0.3 binds the method hash, browser identity and all runtime check results into the capture before immutable extraction. The convenient `runtime-foundation.json` must match that bound payload. UI action history is copied per screenshot; injected clipboard stimuli record their position in that history separately and are not native replay actions. Downstream review groups four default layouts and 32 interaction states correctly. Measurements and copy state must remain unchanged across screenshot boundaries.

```sh
node examples/happyclaw-site/verify-runtime-evidence.mjs --run /path/to/completed-runtime-run
```

This read-only checker verifies image/method hashes, capture/extraction/report agreement, action/stimulus records, review-stage grouping and native/keyboard check coverage. It reports incomplete and violated rules without calling them visually approved. A private derived-report test removed incomplete contrast results: both the separate integrity audit and delivered checker rejected it, while the original remained valid.

Normal 320/390/768/1280px cases record default layout, three selected screenshot channels, native copy success, simulated rejection, simulated pending, actual component timeout after an unresolved simulated promise, and restored-native recovery. Copy state is checked immediately before and after its screenshot. Images visible in the viewport must load before capture. All three actual commands receive native Clipboard API read-back at each size. Focus and DOM Range selection are explicitly programmatic; ArrowRight scrolling uses real keyboard input where the command overflows. No generation, account operation or target source modification is performed.

## Actual records

| Record | Source commit | Primary state images | Native command read-backs | WCAG-tagged check groups |
| --- | --- | ---: | ---: | ---: |
| `6aecf71c` | `3befc9b5bc6aa8d988e28de1dd820224341dd6a4` | 36 | 12 | 20 |
| `6c3baf2c` | `2bffa88425c7f0c77b11a7c6b168d1448650b51a` | 36 | 12 | 20 |

Both are clean, source-scan-matched snapshots. Both completed serially using the same saved method, Chrome 155.0.8059.84 on Windows, scale factor 1 and reduced motion. Capture/extraction bindings, method hashes, all image hashes, 9 states per width, 12 three-command read-backs and 4 programmatic selection checks were separately inspected. Native recovery read-back is also asserted at each width. Neither has human judgment, Foundation approval or visual QA. The previous @15 page review remains unchanged.

Measured observations at all four widths include body text 16px, observed `.button` radii 12px, `.command-step` radii 16px, and observed button heights above 44px. No page-wide overflow was recorded. These statements cover the measured selectors, not every component, font, route or arbitrary width.

Each version reported zero violations in the selected WCAG-tagged axe runs, **and twenty incomplete color-contrast groups**. Groups may repeat selectors across scenarios; they are not twenty unique defects. Examples include the Hero heading/text over complex backgrounds, a secondary action and the clone-command code. Engine versions and original incomplete reasons are retained. These unresolved checks require assessment; zero reported violations is not accessibility compliance or proof that all contrast is sufficient. This collector does not open the mobile menu or retest its role repair, so the older source's normal-state results do not contradict the separately recorded menu defect.

## History and remaining work

The first launch failed because the output parent was absent; directory initialization was fixed and the failed log retained. An initial current-only smoke run `27caddb0` completed. Subsequent method-bound pilots `6343cebe` and `3cf7d370` ran concurrently before clipboard serialization was added; their outputs are retained but are not used as the formal native-clipboard version comparison. A deliberate concurrent invocation was then rejected by the lock before screenshots or clipboard actions. Review of serial method-0.1 records `04e45eeb` / `4749b24f` found missing copy action metadata and runtime result binding; no historical data was patched. Method 0.2 records `b270341d` / `2581254c` repaired action history. The formal method-0.3 records above add bound results, browser/check-engine identity and before/after screenshot geometry checks. Earlier records remain retained as their original method versions.

Next: professional review of the new originals and measurements, resolution of incomplete contrast checks, separate auxiliary root-font evidence where needed, and governed decisions on actual declarations. The 131-component-state record and these runtime observations are separate inputs; neither inherits the other run's visual pass. #29 remains open. Private HTML, assets and screenshots are not distributed by this document.
