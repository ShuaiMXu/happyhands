# Pattern usage guidance — 0.3.0 / method v1

The local Workbench now offers **Draft usage guidance** for a source-bound pattern candidate. It drafts usage, avoidance, exception and evidence-limit text from revalidated original images and source. The result is always a separate `proposal-only` record. It does not add a shared pattern, replace a deterministic Skill result, rewrite a plan, approve Foundation, pass visual QA or record human acceptance.

## Flow

1. Open the connected run's Foundation extraction review and expand its accepted-pattern candidates. The button is available while the local Foundation is editable. The model uses the saved review context; unsaved browser edits are retained.
2. The local job re-collects the explicit same-project accepted history. Canonical repository identity, complete current repository/source snapshots, active acceptance, bound passing QA and original hashes must still match. A missing current candidate stops before model generation.
3. Stage original PNGs, the complete pattern Skill guide, current/accepted task context, the saved Foundation and bounded root/direct-child source files. The model receives actual `--image` attachments in a read-only ephemeral Codex session with repository instruction loading disabled. `--output-schema` constrains its response; local validation applies stricter limits and citation requirements.
4. Require every supplied image/source reference, prohibit unknown token references and scores, and distinguish `propose`, `not-reusable` and `needs-evidence`. Only `propose` may contain usage rules; it requires nonempty usage, avoidance and exception text. Evidence limits are mandatory. Structural checks cannot establish professional quality or prove model attention to every image.
5. Recheck the source, accepted decisions, original images, saved Foundation/context, model inputs, Skill and implementation snapshot before registering the result. The model cannot silently promote stale evidence. Cancellation observed before publication or invalid output stops registration; already committed historical records are retained.
6. Save immutable original copies, the input manifest, guidance, reviewer/method metadata and hashes under `pattern-reviews/`. The Workbench shows the draft, its status and links to the exact reviewed originals. Chinese and English drafts are selected separately. No automatic governance admission is provided yet.

The model method uses the configured local Codex CLI. Its method version and implementation hash are not a provider-attested model revision. There is no claim of professional calibration or an operational Skill.

## Integrity, retries and export

The evidence digest binds the language, selected candidate, tasks, canonical-repository identity digest, complete repository/source fingerprints, saved Foundation, source-file hashes, original hashes, Skill text, output schema and current package JavaScript/lockfile implementation snapshot. Each attempt also gets a unique immutable identity. An unregistered failed attempt is not a cache entry and does not block a fresh job. Equivalent concurrent requests register one proposal; cache reuse first revalidates current history and sealed evidence.

Source-file contents, prompt, Skill copy, CLI event log and job directory stay private. Static export includes the proposal, the input manifest (including saved Foundation and source hashes) and reviewed original copies. Export validates originals before and after copying and never overwrites differing existing pattern artifacts, including linked files. Reindex excludes altered records. The proposal remains a collection-time archive when a later decision is withdrawn; withdrawal prevents new/cached generation and does not erase that historical record. This archive is not sufficient authority to admit a pattern into current Foundation.

Limits: 12 unique original images, 24 MiB per original and 128 MiB total; 24 source modules, 64 KiB per module and 512 KiB source context; 1 MiB input/context manifests; 64 KiB model output; 24 entries per guidance list. Oversized input fails explicitly rather than dropping evidence. Parent-chain and candidate collector bounds still apply. CLI process limits and the local job cancellation mechanism remain in force. No atomic publication of the entire export directory or cryptographic protection against rewriting the entire local store is claimed.

## Validation and remaining work

Synthetic tests exercise original/source delivery, strict schema and references, whitespace-only guidance, contradictory verdicts, unknown tokens/scores, linked inputs, source/original/Foundation drift, acceptance withdrawal, cancellation, immutable export, protected linked destinations, tampered cached originals, honest needs-evidence results, unregistered retry and concurrent deduplication. Real Chrome runs the browser → API → queued model fixture → sealed originals → export → reload flow in both languages and viewport sizes, including language-specific cache reuse and original-image access.

Local verification: 510/510 Node tests, 17/17 deterministic regression cases, production build, Chinese/English × desktop/mobile API/job/export/reload checks, original-image links, language-specific draft selection and long-text layout pass. The installed Codex CLI help confirms `--image`, `read-only` and `--output-schema` support; no real model invocation is substituted for the explicitly labelled fixtures.


Project-specific historical case sections are excluded from this public source distribution.
