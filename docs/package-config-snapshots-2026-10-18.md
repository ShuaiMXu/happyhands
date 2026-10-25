# Installed package configuration snapshots

Continues #29 dependency provenance and #10 incremental source binding. This resolves declared JSON package config inheritance; it does not execute or resolve arbitrary package runtime code.

The bounded source scan now follows package `extends` declarations in tsconfig/jsconfig: named/scoped packages, explicit JSON subpaths, `package.json`'s `tsconfig` field and default `tsconfig.json`. Declared JSON inheritance chains are retained, including relative bases within the package. The pinned TypeScript parser still reads only an in-memory snapshot. It cannot access the host filesystem, network, package scripts, JS config execution or arbitrary runtime modules.

Only explicit package metadata and referenced config inputs are read. Their paths and hashes join extraction/module-graph evidence and the existing capture snapshot digest. Node module directories are not recursively scanned. Package discovery has a 256-directory-lookup budget, the existing 128-config traversal bound, and existing file/byte limits. Missing, unsupported, unsafe, inaccessible or limited configurations do not produce partial alias guesses. Missing/unsafe package inputs mark the snapshot incomplete. References that escape the repository or traverse package junctions/symlinks are not loaded, even when a link points elsewhere within the repository. Those package-manager layouts remain an explicit integration gap.

Compiler configuration scope, alias ordering and provenance continue to use the pinned compiler's virtual filesystem. A rejected package entry cannot use already-scanned unrelated files as an alternative config. Absolute/escaping package entry metadata and executable config targets remain unsupported. Package metadata is data, never a command; `$schema` and package scripts are not fetched or executed.

## Ignored inputs and incremental scope

Installed configs are commonly excluded from Git. The complete Git input fingerprint therefore does not by itself bind their current contents. Incremental selection now compares both versions' installed config-input hashes and pins their digest into its scope artifact. Missing hashes or any installed config change require full scope.

The actual before extraction must match that digest before diagnosis/planning succeeds. Planning-to-capture drift is rejected even when Git's commit, dirty flag and content fingerprint stay unchanged. Execution validates the current installed inputs before worktree/agent startup and again before the agent is launched; recapture checks them before and after browser work, including when no tracked files changed. Existing selected records without installed inputs remain compatible with the empty dependency digest; historical artifacts are not retroactively rebound.

Dependency metadata stays available to module/config resolution, but is excluded from product token, literal-style, asset, state and contrast observations. A package description that resembles a CSS declaration or contains a logo path is not evidence that the project uses that design. Extraction and foundation-extractor advance to 0.8.0; component-inventory advances to 0.7.0, retaining bounded maturity. No observation or dependency resolution is promoted to approved Foundation or a visual acceptance.

## Verification

Tests cover package/root/scoped/subpath configs, local inheritance, JSONC alias evidence and input hashes, ignored input changes, missing packages, links, unsafe/absolute/traversing/executable references, read/lookup bounds, scope drift between planning and capture, and rejection before an agent worktree is created. Temporary Git/onboarding/QA fixtures are explicitly synthetic and create no real product acceptance.

Final checks: 459/459 engineering tests, 14/14 fixed regression cases and production build passed. The last scope integration test verifies that package-only drift leaves Git's full fingerprint unchanged, blocks execution before any worktree exists, and fails onboarding when it happens between planning and capture. Dependency metadata masquerading as CSS or a logo is excluded from Foundation/brand observations. An expected old foundation-extractor version assertion was updated with the explicit version bump before the final passing full run.

Read-only HappyClaw probe: clean commit `2bffa88425c7f0c77b11a7c6b168d1448650b51a`, 32 scanned files including `node_modules/astro/package.json`, `astro/tsconfigs/strict.json` and `base.json`. The missing package-config diagnostic is resolved. BrandMark, GitHubIcon and ScreenshotFigure retain their prior consumer paths and each reaches `src/pages/index.astro`. Complete repository fingerprint and source snapshot are unchanged before/after the probe. The earlier local-only 29-file probe remains at its original input boundary; the new report is `.harness/verification/happyclaw-components/package-config-inputs.json`.

Eighteen unknown build-tool/verification-script references remain (external imports and dynamic module expressions). They are not silently treated as resolved. Real HappyClaw incremental acceptance, route entry contracts, bundler/runtime integration and intentional Foundation updates remain outstanding; #29/#10 stay open. This probe changes no target source, capture, model verdict or human judgment.
