# Related issue triage · 2026-11-16

Read issue bodies and comments for #7, #14, #26, #34, plus recent PR descriptions #25/#27–#33. GitHub search exposes seven issue entries; unrelated Windows locking (#23), Actions (#18) and video (#8) remain separate. No issue was closed or edited by this review.

| Item | Responsibility | Current evidence / next boundary |
|---|---|---|
| #7 | Product umbrella: useful, source-bound design and experience changes | Keep feature availability, engineering checks, real case benefit and human acceptance separate. Do not duplicate every child checklist. |
| #26 | Task → design decision → actual experience | Merged #28 implements immutable audit/decision and five-dimensional QA. The new @2 goal/comparison gate is implemented locally; real authorized task comparison remains pending. Domaroo stays paused. |
| #34 | Review cost and repeated work | Native preflight/reference conversion, same-run recovery and cumulative review accounting/budget are implemented locally; external adapters, GUI controls and real cost comparison remain pending. A cached token is still repeated input. |
| #14 | Does Harness add value over direct execution? | Equal-input A/B and human comparison remain unverified. Record quality, cost, retries and intervention together. Do not infer value from more rules/tests. |

Merged #30 already narrowed default method routing and reuses diagnosis source snapshots. Do not restore mandatory all-method reads. #31 already fixes handoff/structure references and specialist settings, so inspect those contracts before changing identifiers. Draft #29 implements rendered source-bound annotations; this patch leaves that area alone.

Recommended sequence:

1. Before spending: validate complete native plan, adapter/image delivery, schema/reference contracts; report cost scope.
2. Define original user outcome and allowed design changes in audit/decision. A repair-only task is allowed to preserve appearance.
3. Deliver one bounded candidate; compare benefits/tradeoffs against actual baseline. This is early feedback, not final complete-task acceptance or permission to omit required consumers.
4. Final independent coverage plus separate outcomes and human decision; reuse only currently valid bound evidence and results.
5. Run the equal-input quality-and-cost evaluation for #14 before making strategic superiority claims.

The isolated patch accompanying this note implements only the bounded subset listed in review-outcomes-and-cost.md. None of these issues is fully resolved by the patch.

Current local implementation and exact limits are documented in review-outcomes-and-cost.md. These changes remain unpublished and do not complete the real-product or human-comparison acceptance criteria.
