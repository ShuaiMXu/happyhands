# Integration review — 2026-11-12

This record reconciles the open core and website pull requests with the three open product issues. An integrated source release does not establish a new model-quality result or close the broader product experiments.

## Pull requests

| Change | Review and integration decision |
| --- | --- |
| [Core #17](https://github.com/ShuaiMXu/happyhands/pull/17) | Merged engineering repairs: original-capture protection, execution/publication gates, shared diagnosis, optional preflight, clean-source continuation and tracked-only packaging. |
| [Core #16](https://github.com/ShuaiMXu/happyhands/pull/16) | Merged daily README chart updates. Data is validated before writing, collection failure retains assets, unchanged daily data avoids duplicate commits, and publication targets only the three assets on the default branch. Scheduling still needs a working GitHub Actions account. |
| [Core #15](https://github.com/ShuaiMXu/happyhands/pull/15) | Merged the evaluation protocol, separate preliminary observations and opt-in homepage-Hero rules. Browser imports stay free of server filesystem dependencies. Hero QA rejects wrong routes, missing/newly reachable configurations, absent motion observations and static/reused frame evidence. Actual motion-case acceptance remains separate. |
| [Website #74](https://github.com/ShuaiMXu/happyhands-site/pull/74) | Merged and deployed the local stars endpoint, preserving [#75](https://github.com/ShuaiMXu/happyhands-site/pull/75)'s glass repair. Production reads GitHub; dev/preview can reuse its bounded cache with a direct fallback. Live production checks matched revision `d8ab9c3a`, with both languages, desktop/phone, offline/no-JavaScript fallback, resource navigation and glass checked. |

## Issue disposition

| Issue | Verified basis | Remaining acceptance | Decision |
| --- | --- | --- | --- |
| [#7 — Lightweight UI and product-experience loop](https://github.com/ShuaiMXu/happyhands/issues/7) | Alpha.2 contains one explicitly accepted HappyHands setup task covering language, current errors and keyboard access. #17 adds tested engineering recovery and integrity protection; Alpha.3 packages the integrated engine. | External Design.md layout/hierarchy and actual shared-consumer cases; distinct products and new users; website setup copy alignment; additional environments; redacted/motion sharing. Source tests and package installation do not satisfy these product criteria. | Keep open as the delivery umbrella. Preserve completed evidence and track the remaining cases separately from the release. |
| [#14 — Model-independent product value](https://github.com/ShuaiMXu/happyhands/issues/14) | #15 defines same-model controls, complete-run evidence, separate engineering/design judgments and preliminary local observations. The functional website and portfolio trials are not a complete Harness comparison. | Fixed-source real-product pairs with and without Harness, actual complete-run records, blind human judgment, stronger available baseline and repeat/ablation results. | Keep open as the evaluation owner. Merging its protocol does not complete the experiment or establish cross-model superiority. |
| [#8 — Promotional-video production and review](https://github.com/ShuaiMXu/happyhands/issues/8) | The issue records project choices and a detailed acceptance checklist. A web remediation Skill is not a time-based video review or export workflow. | Executable video-specific guidance, timestamped rule decisions, full timeline and audio review, a real before/after case, verified MP4/cover/editable source and provenance. | Keep open, after the lightweight cases. Do not turn a previous MP4 export or a documentation checklist into acceptance. |
| [#18 — Restore hosted Actions](https://github.com/ShuaiMXu/happyhands/issues/18) | Multiple current core and website check annotations confirm an account billing lock before job startup. Local validation and Vercel use separate execution paths. | Account owner restores runner access, then actual core Ubuntu/Windows, website and manual/scheduled star-update runs are inspected. | Track the infrastructure block independently; no code workaround, extra credential or false hosted pass. |

The website had no open standalone issues at this review. Core issues #7, #8 and #14 have different deliverables and are not duplicates; combining or closing them would hide unfulfilled acceptance criteria. This review does not delete historical branches, local worktrees or private evidence.

Resource selection already supports local `.md`/`.json`/`.css` files and the website's indexed references, including complete selected snapshots and hashes. It does not import arbitrary remote user URLs: remote retrieval is restricted to the website. The broader source-support checkbox in #7 therefore stays open. An unchecked umbrella criterion can contain implemented work without having completed all its acceptance cases.

The homepage-Hero profile is an explicitly adopted task constraint. Its evidence gates do not establish that the website's current main already ships WebGL motion or a compatible specialist producer. That actual motion implementation and matched real-case acceptance must be reviewed separately; an old reduced-motion browser smoke test cannot supply the required dynamic proof.

## Version and validation boundaries

Alpha.3 is an engineering integration prerelease. Its public archive must be built from the clean integrated commit, include its source revision and per-file hashes, and pass a cold installation outside an existing Skill directory. The bilingual README and lightweight guide must reference that archive, rather than documenting new commands while installing Alpha.2.

Record local test/build/package evidence in the release and pull request. Hosted checks blocked before startup by GitHub's account billing lock remain unexecuted. Restoring billing or credentials is an account action, not a code fix. New Windows, physical-device, DSH-only, model-quality and commercial validation remain unverified unless separately demonstrated.

Local integration validation passed 706 engineering tests, 28 regression cases, the production build and a real Chrome development-module import check. A clean Alpha.3 candidate installed into an independent Skill directory and exposed `doctor` and `continue`; model/browser-use status remained explicitly unverified. The old retry-browser fixture was repaired to include its actual fonts/theme and real temporary-directory permissions. Its canonical canvas audit-history checks and retained report-component checks passed in Chinese and English at desktop and phone widths. No product route was changed to satisfy that test.
