# Incremental state capture

Continues [#10](https://github.com/ShuaiMXu/creative-os/issues/10) after source binding (#104) and dependency evidence (#105). Actual state selection now runs in onboarding and recapture, rather than only being described in a report. This does not close the whole Issue or product acceptance.

## Entry contract

Capture states may declare `sourceEntries`, a list of normalized repository-relative module paths. These are the project's declared entry/dependency boundary for the **whole state**, including every route visited by its actions and any global/bootstrap modules that apply. They are not inferred from a region source, a component name, an ID or an import count. An incomplete or incorrect declaration is not runtime proof; inspect the real route/application setup before adding it. Do not add arbitrary entries just to enable pruning.

Example state fragment:

```json
{
  "id": "checkout-error",
  "sourceEntries": ["src/pages/checkout.tsx", "src/app.tsx"],
  "start": {"url": "http://127.0.0.1:4173/checkout"},
  "actions": []
}
```

This is an optional advanced capture contract, not a new onboarding form. Existing plans continue to capture all states. Entries are retained in the actual capture's `plannedState` so a future accepted baseline can prove which declaration, actions, URL and device configuration was used. Historical captures are not rewritten.

## Selection and fallback

Selection requires the existing active accepted decision, independent QA and complete repository input comparison. Both accepted and current module graphs must be present, complete and free of unresolved references. Every configured state must have an unchanged entry contract, actions and devices in the reached accepted capture. Both versions' forward dependency closures are used, preserving removed and newly connected dependencies.

Every changed source must map to at least one state closure. Only supported script/SFC module changes qualify; CSS, assets, JSON/config changes, unknown/new unmapped sources, changed task descriptions, changed state/viewport declarations, missing entry files, graph limits and unknown dependencies retain full capture. Framework package aliases and dynamic routing are not guessed. A stable previously approved plan can subsequently use incremental review; newly approved/expanded plans always establish a full fresh baseline.

When qualified, the workbench captures only selected states with **all their original device configurations and actions**. Excluded states stay unreviewed. The original full configured plan remains unchanged. The effective selection is an immutable, hashed `incremental-capture-plan.json` artifact bound to the run, full plan and verified diff; export validates and preserves it. Missing, modified, unsafe or inconsistent scope artifacts fail closed. Capture state/device pairs must match the frozen scope.

The modification plan pins the artifact reference before execution. Implementation instructions require a new full baseline when the task needs an excluded state or unknown/global dependency. Before and after the recapture's browser work, actual complete repository inputs are compared with the current before capture, and dependency selection is recomputed. Changes affecting excluded or unknown states stop recapture instead of silently widening an unmatched before/after comparison. Source changes during capture retain the existing rejection boundary.

Independent QA receives the frozen selection in its hashed context, verifies it again after model execution and retains an explicit skipped-state limitation. Prompt version advances to `ai-visual-review@10`. Original screenshot, task, Foundation, structural checks, regional/cross-region review and human judgment gates remain. A source-based exclusion never becomes a visual pass. The bilingual report lists selected and unreviewed states and offers **Start a full review**, which creates a new full record without mutating the prior run. The API also accepts `fullReview: true` on refresh/onboarding.

## Verification and remaining work

Tests cover two independent routes and both devices, shared/removed/new dependency paths, unknown/global changes, changed capture contracts, missing old capture evidence, plan partition validation, source path traversal, stable plan approval reuse, explicit full-review recovery, immutable scope/export tampering, plan binding, source changes outside the frozen scope, and independent QA context/limitations. Temporary Git repositories and clearly synthetic screenshots/QA validate engineering behavior; they are not product or human acceptance. Bilingual browser checks exercise both scope labels and the full-review button. Full-suite/regression/build results accompany the PR.

Final verification: 452/452 engineering tests, 14/14 regression cases, both report languages and production build passed. A real Chrome capture against an isolated local two-route fixture retained four baseline state/device observations, then captured only the selected route's two device observations in each current before/after phase. `plannedState.sourceEntries` survived actual browser capture. Report and eight screenshots are under `.harness/verification/incremental-capture-browser/`; this is a browser integration fixture, not a real accepted project review.

Real HappyClaw still has unresolved package/config references and legacy captures without the new entry contract. It therefore correctly retains full capture today. This change does not relabel its prior hypothetical dependency probe as a real accepted incremental change. Next work remains package/bundler dependency resolution or verified explicit runtime/route integration, a real scoped HappyClaw task through independent review, intentional Foundation-update handling and final user judgment. Do not close #10 based only on fixtures or installation.
