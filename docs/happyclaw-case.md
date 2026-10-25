# HappyClaw site — first repository review

Target: [ShuaiMXu/happyclaw-site](https://github.com/ShuaiMXu/happyclaw-site), baseline `cf1da7b`. The live [happyclaw.cc](https://happyclaw.cc/) homepage currently contains a different, newer-looking message than this repository's `main`; the developer asked us to use this repository as the source for the first case. A repository change must not be described as a live-site change.

## User task

An evaluating team lands on the homepage, understands why HappyClaw helps them, and chooses between online trial and private deployment.

## Evidence and priority

The repository hero led with the product name and technical category. Its actions were an anchor to Quick Start and a GitHub link; the product UI appeared later in the page. This made the first screen weak at communicating a concrete team outcome or offering an immediate trial. See `examples/happyclaw-site/experience.json` for evidence IDs and the draft ranking. Impact and confidence are judgments, not measured user data.

## Scoped change

The [draft PR #1](https://github.com/ShuaiMXu/happyclaw-site/pull/1) on `codex/hero-outcome-first` changes the Hero and page metadata. It leads with the team outcome, keeps self-hosting and channel support as reasons to believe, makes the public trial the primary action, preserves GitHub and deployment paths, and brings an existing product screenshot into the first screen. No product capability or pricing claim was added.

## Review so far

The Harness compared baseline `cf1da7b` with PR commit `17314f0` at identical 1280×800 and 390×844 viewports. Both built/previews returned HTTP 200, had an H1 and no horizontal overflow. The baseline first-screen actions were Quick Start and GitHub. The changed version has the outcome-led heading, online trial and open-source/deployment alternatives; the workspace preview appears on desktop and begins in the first mobile screen. Screenshots were visually checked in both sizes. The run remains in `.harness/runs/06dabc2c/` on the local machine with `judgment: null`; the change came from the existing draft PR, not the Harness Codex runner. This is a directional design review, not a user test, analytics result or live deployment verification.
