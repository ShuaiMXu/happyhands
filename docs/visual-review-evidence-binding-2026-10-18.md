# Durable independent review evidence

Prerequisite for #29's accepted-pattern curation and #10's accepted baseline reuse. The ordinary review path previously checked producer-supplied screenshot hashes at save time but did not retain them with the review. A subsequent read could trust its `pass` reference after PNG bytes had changed. Specialist verification already had original hashes; this extends durable evidence binding to ordinary independent reviews.

## New records

Every newly saved visual review has an immutable `reviews/<review-name>.binding.json` sidecar and a hashed `evidenceBinding` reference in the manifest. The sidecar binds the exact review JSON bytes, run ID, captured state metadata, relevant project/task/Foundation/confirmation/plan/evaluation context, referenced annotation metadata and original image hashes. Baseline-only hierarchy review binds its baseline phase; later after-capture does not falsely change that baseline observation. QA binds the full comparison. Private repository/worktree locations are not copied into the sidecar.

The record distinguishes `producer-supplied-input-hashes` from `attestation-time-snapshot`. The latter links imported/external attestations to the bytes present when saved; it does not claim to prove what an external reviewer saw. Neither kind proves aesthetic quality, truthful reviewer identity, actual human approval or whole-site coverage. The normal independent review and human decision requirements remain.

Bindings reject unknown/excessive image references, unsafe paths and symlinks. JSON is bounded to 1 MiB for reviews and 8 MiB for bindings, each original to 24 MiB, with at most 10,000 original references. Expected model/annotation hashes are checked before a review becomes current. Missing image bytes can no longer be represented by fixture filenames alone.

## Admission checks

- Accept checks current bound originals, review body and context. Reject remains available if evidence changed, and the prior verdict is retained as history.
- Cached independent QA is validated before reuse; a failed integrity check does not silently trigger or invent a new model verdict.
- Incremental reuse requires a durable bound accepted QA record in addition to source, active judgment and independent QA gates. Legacy evidence without such a binding falls back to full review.
- Export validates active reviews before copying and validates the actual published copy before indexing. Sidecars are exported unchanged. Historical replacement reviews retain their own body/binding without claiming their old context is current.
- Index rebuilding checks evidence and excludes invalid published records instead of re-listing their stale pass label.

These are checks at explicit admission/reuse/export boundaries, not continuous filesystem monitoring or an atomic directory publication guarantee. The bindings are local integrity evidence, not cryptographic signatures against an attacker who can rewrite the entire repository. Existing specialist evidence checks remain active.

## Legacy and product boundary

Historical reviews lacking sidecars are explicitly `legacy-unbound`; no hashes are fabricated or backfilled. Their JSON/reference consistency is checked when read, and existing human decisions are not rewritten. The existing legacy decision path remains available; the stricter bound-history reuse path does not mistake it for new durable evidence. Removing the manifest binding reference while its sidecar remains cannot downgrade a new review to legacy.

## Validation

Tests cover PNG replacement, review/body/binding/context changes, annotation notes and images, reference removal, imported attestation assurance, ordinary/first-render workflows, sanitized export roundtrip, failed cached reuse, rejection availability, legacy migration boundaries, symlink rejection and invalid published record reindexing. Synthetic acceptance/QA fixtures exercise control flow only. Existing metadata-only workflow fixtures now provide actual test bytes before attestation; production validation was not weakened to accommodate absent files.

Final validation: 470/470 tests, 14/14 regression cases and production build passed. No real project source, model verdict, historical acceptance or user decision was changed. The pattern skill remains contract-only; this work establishes trustworthy inputs for its next implementation stage.


Project-specific historical case sections are excluded from this public source distribution.
