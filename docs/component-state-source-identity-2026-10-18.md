# Component state source identity, 2026-10-18

## Defect and correction

The state auditor previously fell back from a missing recorded source to the first matching basename in another directory. Two unrelated `SaveButton` implementations could therefore borrow each other's state words and recovery affordances. An explicit extension also lost its identity before lookup.

The auditor now accepts an exact repository-relative file, or one unique implementation at the same directory/path when a legacy Foundation omits the extension. Missing, ambiguous and duplicate sources remain unbound. Documented-state comparisons survive, but missing source coverage and truncated snapshots keep the handler result `needs-evidence`. This does not change the rubric's required states or turn source words into runtime proof.

Skill version advances from 0.2.0 to 0.3.0; maturity remains `bounded`, and the rubric remains 0.2.0. Historical results are not rewritten.

## Release regression

Corpus 1.2.0 adds six deterministic cases using explicit synthetic source snapshots and component contracts:

- a fully documented control;
- documented and source state gaps;
- a different-directory component with the same name;
- ambiguous extensionless implementations;
- truncated source evidence;
- missing component contracts.

The harness passes the supplied source snapshot to the real handler; it does not scan a live target repository or run target code. Exact findings and statuses are compared by the existing release gate. Two direct source identity tests additionally cover explicit extensions, unique legacy extensionless paths and conflicting implementations.

These tests establish the stated deterministic boundaries, not visual quality, keyboard behaviour, model calibration, human approval or operational maturity. The other core extraction Skills still need their own complete release-case matrices and professional calibration under #29/#28.

## Launch boundary

## Validation

Final frozen-source run: 547 local tests passed, 23 release regression cases passed, production build and diff whitespace checks passed. A direct comparison against main reproduced the previous wrong-directory binding (`admin/SaveButton.jsx`) and unrelated state finding; the corrected audit leaves that source unbound. Initial restricted-environment tests hit Windows temp rename EPERM; the authorized full run was repeated outside that restriction. A first full run overlapped an implementation change and correctly rejected pattern evidence drift; its record is retained. No GitHub Actions pass, new real-product calibration, visual approval or human acceptance is claimed.

## Offline bundle follow-up

The same auditor now uses the shared non-executing template decoder, preserves source coordinates/errors and treats a decoding failure as unavailable evidence. It never falls back to loader or manifest text. Extraction version advances to 0.11.0 and labels state evidence as static text candidates. Two additional release cases, two direct audit cases and a capture-free extraction integration case cover the boundary. No historical extraction is rewritten.

Current input audit (private files remain local):

| Artifact | SHA-256 | Tokens | Tokens with aliases | Motion tokens | Manifest image/font records |
| --- | --- | ---: | ---: | ---: | ---: |
| UI Kit | `24ae1953b4a9397a3b5ebbcabb416bc6fc7c00c0d4f80e7e4a900bffa158e4d3` | 188 | 82 | 8 | 194 |
| Design System | `a225f9411e88efa8ac3396d49d432dfb8bcaa7773edae785ba309726f33c5f4b` | 127 | 26 | 8 | 40 |

Both current source audits now agree with the independently decoded-template state inventory. UI Kit template coordinates begin at container line 387; Design System at line 381. These are source observations, not browser capture, component boundaries/variants, resource authorization, voice rules, approved patterns or runtime state coverage. Both files are inventoried as one inline document; this is not a complete reusable component map.

Project-specific historical case sections are excluded from this public source distribution.
