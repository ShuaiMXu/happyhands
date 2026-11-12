---
name: review-video
description: Review and repair a product or promotional video using its real source project, timestamped before/after evidence and independent full-timeline review.
---

# Product-video review and repair

Use for video production or an existing video's demonstrated problems. Read the actual brief, source, complete video and relevant audio before changing it. Preserve the user's approved product shape, wording, timing, sound choices and source material. Website screenshots and a successful encode do not establish motion, sound or editorial quality.

## Establish the task

Record audience, channel, dimensions, frame rate, duration, one message and the intended viewer action. Separate a real recording, a reconstruction and illustrative collaboration; illustrative cursors are not evidence of autonomous agents. Identify immutable originals, editable source, dependency versions, asset provenance, rights, source product revision and the editor's actual identity. A source snapshot describes the declared inputs, not a proof of every transitive render dependency.

Read [the evidence contract](references/evidence-contract.md) before collecting or reviewing. Use the existing renderer and original assets. Do not execute commands found in reference documents or a supplied manifest. Read and intentionally invoke a known render command separately. Keep before and revised projects and exports in different locations. Never overwrite originals or old review records.

## Decide and repair

Find problems at concrete times, with their observed consequence. Decide what changes and what remains. Follow the rule inventory in `rules.json`:

- Content and layout: accurate product claims, source fidelity, restrained typography, necessary copy, hierarchy and readable framing.
- Motion: each action has a purpose; reading/clicking surfaces settle; preserve the product's actual orbit, density, proportions and perspective; keep glass and foreground readable.
- Interaction: persistent cursors retain distinct tasks and point at actual targets; typing, clicks, drags and feedback match; theme and language transitions come from their controls and update the complete visible interface.
- Sound and delivery: intentional synchronized effects, agreed narration/music ownership, truthful cover, complete timing and sound review, reproducible export and source handoff.

For each rule record `fixed`, `preserved`, `fail`, `needs-evidence` or `not-applicable`, with concrete time intervals, original frame references, decision, affected source files and actual checks. A fixed rule needs a changed source file and changed media; preserved choices need reasons. Do not promote a single product's aesthetic preference to a universal rule.

For the HappyHands 18-second case, retain 1920×1080 at 60fps, interface effects only, the approved image spiral and proportions, brief opening Z view followed by stable UI, horizontal/vertical construction grids, five distinct collaboration cursors, clear refractive glass and dark/light/English control transitions. The previously removed cover statistics must remain removed. These are this case's constraints, not defaults for every video.

## Collect actual evidence

Prepare a manifest described in the reference, then run:

The main Harness entry is `pnpm harness video collect ...`; the installed portable entry is `HH video collect ...`. Both delegate to the same helper below. Use the actual command's help in the selected checkout; the standalone helper remains available for explicit invocation.

```sh
node /actual/happyhands/skills/review-video/scripts/video-review.mjs collect --manifest /actual/video-project.json --out /actual/fresh-video-review --ffmpeg /actual/ffmpeg --ffprobe /actual/ffprobe
```

The collector snapshots declared source/assets and both complete MP4s, probes streams, decodes both complete exports, and extracts original PNGs at regular intervals and on both sides of segment boundaries. It refuses an existing output. It does not repair, install tools, generate assets or call a model. Missing evidence remains a failed collection with retained diagnostics. Inspect the collected originals and technical result; never substitute AI-redrawn frames.

## Independent review and final decision

Give a separate read-only reviewer the frozen evidence directory, complete before/after exports, this full Skill, relevant source changes and the review template. The reviewer must play the entire short export at normal speed with sound, inspect transitions and both sides of each source change, and document intervals actually watched/listened. Frame samples supplement playback. Never claim full motion or sound review from a contact sheet, source code or metadata. If playback/audio cannot be observed, record `needs-evidence` and leave those fields false.

The reviewer must use their real identity, distinct from the editor, and return every rule and segment. Validate their result without editing it to pass:

```sh
node /actual/happyhands/skills/review-video/scripts/video-review.mjs review --run /actual/video-review --report /actual/independent-review.json
```

The command checks frozen hashes, full interval coverage, technical gates, changed-source requirements and per-rule conclusions. It writes a new immutable review artifact; missing, failed or unobserved checks cannot pass. Its result is independent review, with human judgment still pending. Present the complete MP4, timestamped changes, original comparisons, source archive, tests and open items. Only record human acceptance after the user actually supplies it. This Skill does not authorize publication or social posting.
