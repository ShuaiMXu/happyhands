# Current-source binding for incremental review

Issue: [#10](https://github.com/ShuaiMXu/creative-os/issues/10). This is the source-comparison prerequisite, not completion of incremental route/state selection.

## Behavior

The old planner reused the previous execution's changed-file list. That list describes the previous correction, not the current task. The workbench now derives a fresh comparison inside its queued onboarding job, before creating the new run.

Each eligible capture retains an immutable `before/repository-inputs.json` or `after/repository-inputs.json`: sorted relative filenames, file modes and SHA-256 hashes. It includes tracked and non-ignored inputs, including binary assets and JSON. It does not retain their contents. The inventory is hashed, bound to the capture and its design-system extraction, and validated before export or reuse.

A baseline needs an active accepted judgment, passing independent QA, a complete after inventory, and the same canonical connected repository and project source. A fresh clean current repository is compared by file hash/mode, recording additions, deletions and modifications, both source fingerprints and a diff hash. The new before capture must match the planned current fingerprint. A later source change fails onboarding instead of silently using stale routing.

Known UI file changes select diagnostic Skills and cite exact Foundation source paths. A collapsed report section explains the comparison, links its baseline and lists changed files in the current interface language. Arbitrary filenames remain literal text. This does not approve Foundation observations or any user decision.

## Conservative boundaries

- No capture-plan reduction is implemented here. All configured pages and states are still captured; no unvisited state is marked reviewed. Route/task impact mapping remains open.
- Legacy records without complete inventories, withdrawn judgments, foreign sources, dirty current sources, unsupported file types, missing/tampered evidence, or unchanged source inputs use full review. Old execution lists are never a substitute.
- The full fingerprint requires the actual Git root. Subdirectories are not expanded into a larger reading scope. Symlinks/submodules need an explicit verifier.
- Optional inventories are limited to 10,000 entries and 8 MiB. Existing verification fingerprint limits remain 64 MiB per file and 512 MiB total, with bounded Git output. There is no partial inventory. A strict verification capture that exceeds only the optional entry count still retains its complete metadata fingerprint; incremental reuse stays unavailable.
- Artifact indices are immutable. Existing accepted records are not retroactively rebound. No real product judgment was created or changed for this work.

## Validation

Independent temporary Git repositories exercise accepted dirty-after contents followed by commits, fresh changes versus stale execution lists, binary/JSON changes, additions/deletions, foreign/dirty/withdrawn/legacy baselines, tampering, safe export, and a change during capture while the dirty flag stays true. The onboarding integration test uses a clearly synthetic screenshot and preview adapter and verifies the actual queued comparison, persisted capture binding, selected Skills and unchanged capture count. It makes no product-quality claim.

Bilingual browser checks exercise the report explanation, baseline URL and literal filename rendering. Full suite, regression and build results are recorded with the accompanying PR. Real HappyClaw incremental acceptance, route/state impact selection and intentional Foundation-update treatment remain Issue #10 work.
