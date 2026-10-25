# Accepted pattern candidates — 2026-10-18

This page records the 0.2 collector boundary. Version 0.3 adds a separate [original-image model guidance workflow](pattern-guidance-review-2026-10-18.md); collector results and shared-pattern approval remain distinct.

Issue #29 now has a bounded evidence collector rather than a contract-only placeholder. This is candidate collection, not complete professional pattern curation. The automatic Foundation pack runs `pattern-library-curator@0.2.0`; absent history or missing professional guidance keeps its result `needs-evidence` and the pack partial. Tokens/components can still be observed and governed. No candidate is inserted into `Foundation.patterns` or granted approval.

## Evidence admission

- Follow the current run's explicit `onboarding.parentRunId` chain, at most 16 records in the same local `runs` directory. Do not scan other projects or infer identity from a repository name or public URL.
- Require both current and historical canonical repository identity, matching project source, active acceptance and passing independent QA with a durable evidence binding. A withdrawn decision, legacy unbound review, changed review context or changed original cannot supply a candidate.
- Match the accepted after-capture's complete repository input contents and source snapshot against the current checkout. This deliberately excludes older implementations, including changed assets or ignored source configuration. There is no inferred partial-component equivalence across source versions yet.
- Recompute the component inventory from current source. Require at least two distinct statically referenced child components and two distinct static consumers, without unresolved component consumer evidence.
- Require two source-bound declared root instances with different IDs and structural DOM paths in the same historical run, URL origin/route/query/hash, configuration and action context. Repeated devices, selector aliases, repeated states on one root and copies from separate runs cannot create reuse.
- Structural identity is captured at the screenshot boundary and checked for stability. Legacy captures are not backfilled. Shadow/detached roots or overlong ancestry remain unknown. This proves declared-root evidence only; child imports are not proof that every child rendered, and matching action plans do not prove all runtime conditions were identical.

The collector bounds run JSON to 8 MiB per file and 64 MiB across preflighted run metadata, the combined metadata/original budget to 128 MiB, each original to 24 MiB, accepted records to 256 originals and 512 capture entries each, and candidate computation to 512 source components. It emits at most 128 candidates and 16 examples per candidate. Limits, missing evidence and excluded history remain recorded; the result is not an exhaustive pattern library.

## Recorded output and review

Each observed candidate records its component source/hash, static dependencies and consumers, token references, original screenshot paths/hashes, source run/state/configuration, root identity, QA binding and judgment hashes. Its explicit guidance gaps cover pattern role, when to use/avoid, exceptions and applicable variants/states. The Skill input hash includes the collected history; provenance also records a separate history digest and the collector implementation. Cached Foundation extraction checks history again and refuses silent reuse after a withdrawal or other history change. Existing plans and approvals are not rewritten.

The Workbench exposes candidates in the existing extraction review, separately from approvable Foundation entries. Source links appear only for already exported records; missing exports are labelled. Historical originals are **not** copied into the current run's export. The exported Skill result is a collection-time evidence record, not a live assertion that the old decision remains active. A future model curator must revalidate the historical run and open its original images before generating usage guidance. It must not treat these metadata references as image inspection.

## Verification and remaining work

Synthetic tests cover repeat compositions and explicit guidance gaps; device/selector/ID/action/origin deduplication; one-off and primitive rejection; incomplete scans; original tampering; withdrawn/foreign/outdated/legacy history; linked/oversized/traversal artifacts; unchanged-source cache invalidation after withdrawal; and preservation of Foundation approval boundaries. Three synthetic release-regression cases cover a candidate, absent acceptance evidence and selector aliases. They do not validate professional judgment.

Chrome checks verify actual structural identities across focus/hover and distinct roots, retaining existing viewport/clipping/state rejection. The synthetic candidate panel passes Chinese/English at desktop/mobile widths, safe text rendering and navigation to an exported source review.

Local validation: 486/486 Node tests, 17/17 deterministic regression cases, production build, actual Chrome component-instance capture checks and the four language/viewport candidate-panel combinations pass. GitHub Actions billing remains deferred; this is not a remote CI pass or professional pattern acceptance.

Project-specific historical case sections are excluded from this public source distribution.
