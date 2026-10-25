# HappyClaw contrast evidence triage

This is read-only triage of the validated method-0.3 runtime records `6aecf71c` and `6c3baf2c`. It does not recapture UI, measure contrast, change page styles or upgrade historical conclusions.

```sh
node examples/happyclaw-site/triage-runtime-contrast.mjs --run /path/to/current-run --run /path/to/baseline-run
```

Each input passes the existing runtime integrity checker first. The output retains a report hash, source revision and every original target, viewport, state, outcome and reason. Generated Astro attributes are normalized only for grouping; original targets remain on each occurrence. Repeated input run IDs are rejected. Reported violations, when present, remain distinct from incomplete evidence.

## Observed result

Across both records, forty incomplete check groups contain 400 element occurrences. The triage produces 32 selector-pattern/reason categories: 19 visibility-review, 3 gradient-review and 10 unresolved-evidence. These are not 32 confirmed UI defects or 400 unique elements; a selector can appear in multiple categories and states. All remain needs-evidence in these inputs.

- Hero `h1` has a gradient-background uncertainty.
- Hero descriptive text, a secondary action, command code and several desktop architecture SVG labels carry obstruction/overlap uncertainty in recorded states.
- Some SVG labels and navigation targets have other unresolved reasons; no value is inferred for them.

The associated screenshots were captured **before** axe execution. They are useful navigation references, not proof that a target was unobstructed at check time. The triage labels that relationship explicitly. An axe obstruction reason is a visibility concern to inspect, not automatic proof that the product has a visible layout defect; scroll position, sticky navigation and intended scroll clipping still require exact-state review.

## Required next action

Review normal-state geometry and visible content first. If an element is partly covered, overlapped or clipped, keep that visibility issue and missing contrast evidence. Do not add an alternate measurement that calculates through the obstruction or silently treats it as irrelevant.

Any future screenshot-backed measurement must first establish unobstructed visibility in the exact normal capture state and couple measurement with capture in the same execution boundary, preferably the same Node evaluation. If that evidence cannot be established, retain needs-evidence. Gradient readability and other unsupported cases remain separate professional-review items. No Foundation or accessibility approval is created by this grouping.

Validation: the priority regression confirms that a mixed gradient/occlusion reason remains a visibility-review item. Both actual records were revalidated and grouped without changing their original files. No new browser run was needed or claimed.
