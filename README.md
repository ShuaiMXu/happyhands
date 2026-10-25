<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/happyhands-logo-paper.png">
    <img src="public/brand/happyhands-logo-ink.png" alt="HappyHands" width="340">
  </picture>
</p>

<h3 align="center">Give every UI change a reason.</h3>

<p align="center">A local design review workbench for products built with coding agents.</p>

<p align="center">
  <a href="https://happyhands.cc"><img alt="Website" src="https://img.shields.io/badge/website-happyhands.cc-202020?style=flat"></a>
  <a href="docs/next-steps.md"><img alt="Local Web Alpha" src="https://img.shields.io/badge/status-Local_Web_Alpha-F79B60?style=flat"></a>
  <a href="docs/harness.md"><img alt="Harness guide" src="https://img.shields.io/badge/docs-Harness_guide-202020?style=flat"></a>
</p>

<p align="center">
  <a href="#get-started">Get started</a> / <a href="#how-it-works">How it works</a> / <a href="https://happyhands.cc">Website</a> / <a href="README.zh-CN.md">简体中文</a>
</p>

HappyHands helps you find interface problems, decide what to change, and check the result. It brings screenshots, your product's design rules, agent code changes, and review decisions into one local workbench.

## Get started

You need Git, Node.js **22.15+**, pnpm **11.19**, and Chrome or Edge. Configure and sign in to **Codex CLI** for model diagnosis and visual review. This source distribution provides the local workbench and Harness.

```sh
git clone https://github.com/ShuaiMXu/happyhands.git
cd happyhands
pnpm install --frozen-lockfile
pnpm workbench
```

Open **http://127.0.0.1:4190/apps/designer/** and connect the product you want to review. Bring a working preview and a specific task, for example:

```text
Repository: /path/to/your-product
Preview: http://localhost:3000
User task: Sign up and create the first project
Design sources: DESIGN.md, src/styles/tokens.css, src/components
```

Check the proposed pages, devices and interaction states before capture. For configuration and command-line use, follow the [Harness guide](docs/harness.md). The [public website](https://happyhands.cc) provides guidance and design resources; the repository workflow runs locally.

## How it works

1. Capture the selected pages and interaction states on desktop and phone.
2. Inspect findings alongside their screenshots and source references. Review the product's existing design rules and approve constraints where required.
3. Confirm one problem and a scoped plan. The coding agent implements it in an isolated Git worktree.
4. Compare the result with the original evidence. Run the relevant checks and independent review, then record your own accept or reject decision.

The Harness keeps the evidence and stage history together. A passing model review does not accept the change for you. New pages follow a [Foundation-first workflow](docs/harness.md), with approved design rules before implementation.

### Built for checking the work

- Switch between captured pages, devices, versions and interaction states. Open the original evidence when you need the detail.
- Ground proposed changes in the product's own tokens, components and brand sources. Keep observations separate from approved rules.
- Retain the plan, code differences, failed checks and earlier review attempts so a later decision can be traced back to its evidence.

See the [HappyClaw review record](docs/counter-evidence-review-2026-10-21.md) for a documented example where counter-evidence led to an independent re-review without erasing the original failure.

## Use your coding agent

| Tool | Current role |
| --- | --- |
| Codex CLI | Model diagnosis and screenshot-aware review; also an implementation adapter. |
| Claude Code | Implementation adapter for confirmed tasks. Configure it before execution; complete end-to-end validation remains open. |
| Cursor, Kimi Code, WorkBuddy | Can guide and operate the Harness when the tool has local browser, terminal and repository access. They do not have dedicated implementation adapters here. |

Run `pnpm harness agents` to inspect registered executors. Agent-specific behavior and limits are described in the [adapter documentation](docs/architecture.md#agent-adapters-and-the-permission-boundary).

## Current scope

HappyHands is a **Local Web Alpha**. Coverage follows the capture plan and completed checks; unseen pages and untested interactions remain unreviewed. Professional calibration, real-user acceptance and other gaps are tracked in the [backlog](docs/next-steps.md).

Run records stay under `.harness/`. Model-assisted steps send selected source context and images to the configured model service through the CLI. Worktrees and repository checks are workflow safeguards, not a security sandbox. Review shared exports for sensitive material. See [data and execution details](docs/local-workbench.md).

<details>
<summary>Development and repository guide</summary>

```sh
pnpm dev             # Local development on port 4173
pnpm design:check    # Design documentation and integration contracts
pnpm test           # Engineering tests
pnpm regression     # Versioned release cases
pnpm build          # Contract checks and production build
pnpm harness skills # Registered methods and their maturity
```

The workbench UI lives in `apps/designer/`. Local service code is in `packages/workbench/`; capture, execution and run storage are in `packages/harness-core/`. The current public website is maintained in [happyhands-site](https://github.com/ShuaiMXu/happyhands-site). A static build of this repository does not provide the writable local service.

Before contributing, read [AGENTS.md](AGENTS.md), [DESIGN.md](DESIGN.md) and the [architecture](docs/architecture.md). Preserve approval boundaries, source provenance and complete upstream skills. Report the checks you actually ran; do not commit credentials, private captures or local run records.

</details>

## Project links

[Website](https://happyhands.cc) / [Harness guide](docs/harness.md) / [Roadmap](docs/next-steps.md) / [Issues](https://github.com/ShuaiMXu/happyhands/issues)

The public website repository's activity:

[![Website stars](https://img.shields.io/github/stars/ShuaiMXu/happyhands-site?style=flat&label=Website%20stars)](https://github.com/ShuaiMXu/happyhands-site/stargazers)
[![Website forks](https://img.shields.io/github/forks/ShuaiMXu/happyhands-site?style=flat&label=Website%20forks)](https://github.com/ShuaiMXu/happyhands-site/forks)
[Star history](https://www.star-history.com/?repos=ShuaiMXu%2Fhappyhands-site&type=date)

Original HappyHands source is licensed under MIT. Bundled third-party code and dependencies retain their own licenses, including tldraw’s separate production-use requirements. See [third-party notices](THIRD_PARTY_NOTICES.md).
