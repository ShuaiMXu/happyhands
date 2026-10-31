<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/happyhands-logo-paper.png">
    <img src="public/brand/happyhands-logo-ink.png" alt="HappyHands" width="340">
  </picture>
</p>

<h3 align="center">Give every UI change a reason.</h3>

<p align="center">A local workbench to find UI problems, repair them with coding agents, and review the result.</p>

<p align="center">
  <a href="https://happyhands.cc"><img alt="Website" src="https://img.shields.io/badge/website-happyhands.cc-202020?style=flat"></a>
  <a href="docs/next-steps.md"><img alt="Local Web Alpha" src="https://img.shields.io/badge/status-Local_Web_Alpha-F79B60?style=flat"></a>
  <a href="docs/harness.md"><img alt="Harness guide" src="https://img.shields.io/badge/docs-Harness_guide-202020?style=flat"></a>
</p>

<p align="center">
  <a href="#get-started">Get started</a> / <a href="#how-it-works">How it works</a> / <a href="https://happyhands.cc">Website</a> / <a href="README.zh-CN.md">简体中文</a>
</p>

HappyHands brings UI diagnosis, agent-assisted repairs and before/after review into one local workbench. Inspect pages and interaction states, start a scoped repair, then decide whether to accept the result and submit a draft pull request.

## Product demo

37-second product demo.

https://github.com/user-attachments/assets/19607c8f-3fb4-4db5-826e-ff664980dbce

## Get started

You need Git, Node.js **22.15+**, pnpm **11.19**, and an installed Chrome or Edge for browser capture. This source distribution provides the local workbench and Harness. Configure and sign in to **Codex CLI** to use the workbench’s built-in model diagnosis and visual review; implementation CLI setup depends on the executor you choose. See [Use your coding agent](#use-your-coding-agent) for the distinction.

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

1. **Inspect the pages.** Connect your repository and preview, check the capture scope, then view desktop and phone screenshots with their issues. Switch devices, versions and interaction states without leaving the review. Click a screenshot to enlarge it in place.
2. **Start a repair.** Select **Fix automatically**. The workbench checks the diagnosed issues against current source, prepares the scope and plan, and runs the coding agent in an isolated Git worktree. It then captures the result and runs applicable checks and independent visual review. Missing evidence and failed checks remain visible.
3. **Review the result.** Compare before and after, then accept or reject the change. Acceptance reasons are optional; rejection and counter-evidence requests require a reason. An accepted, verified repair can be submitted as a **draft PR** through a separate action. The workbench does not merge or deploy it.

One repair action delegates the intermediate scope and planning steps; it does not accept the result for you. New interfaces without a baseline still require explicit [Foundation approval](docs/harness.md) before implementation.

### What supports a finding

A reported defect needs a reproducible observation, an explanation of what is wrong, and a reference to the relevant skill snapshot. The Harness checks the cited section, line and quotation. General design advice and aesthetic preferences do not enter the automatic repair list on their own.

Repairs follow the reviewed product's own design sources. The HappyHands UI profile applies to the workbench and to projects that have explicitly adopted it. Original screenshots, earlier failures and excluded suggestions remain in the record. See the [finding admission policy](docs/finding-admission-policy.md).

The [HappyClaw review record](docs/counter-evidence-review-2026-10-21.md) shows how new counter-evidence led to an independent re-review while retaining the original failure. It documents that case's review path, not a whole-product acceptance or production deployment.

### Design resources

The [website](https://happyhands.cc) provides Design.md references, design systems, components and Theme Studio. Use them to choose a direction, preview a theme and prepare design files for your project. They are optional inputs to the review; browsing a reference does not approve it as your project's design system.

## Use your coding agent

HappyHands supports working with any AI CLI as part of an open coding-agent workflow. An external agent can operate the Harness with the necessary local terminal, repository and browser access, and changes made outside the Harness can be captured and reviewed. Direct execution through `harness execute` requires a registered adapter; the current default is Codex. This does not mean every CLI has built-in integration or that every feature has been validated with every CLI.

| Tool | Current role |
| --- | --- |
| Codex CLI | Built-in model diagnosis and screenshot-aware review; also the default implementation adapter. Its execution path has shipped, but this is not full-loop validation of every feature. |
| Claude Code | Implementation adapter for confirmed tasks. Configure it before execution; complete end-to-end validation remains open. |
| Cursor, Kimi Code, WorkBuddy | Can guide and operate the Harness when the tool has local browser, terminal and repository access. They do not have dedicated implementation adapters here. |

Run `pnpm harness agents` to inspect registered executors. Select one with `harness execute --agent ID`; `--command PATH` only changes that adapter’s binary location, not its CLI protocol. Other CLIs need an adapter for direct execution. External changes have no Harness agent-execution record and must be identified separately during review. Agent-specific behavior and limits are described in the [adapter documentation](docs/architecture.md#agent-adapters-and-the-permission-boundary).

## Current scope

HappyHands is a **free Local Web Alpha**. External model and CLI services may require their own accounts, subscriptions or usage fees. Coverage follows the capture plan and completed checks; unseen pages and untested interactions remain unreviewed. Professional calibration, real-user acceptance and other gaps are tracked in the [backlog](docs/next-steps.md).

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

Follow the core project:

[![Stars](https://img.shields.io/github/stars/ShuaiMXu/happyhands?style=flat&label=Stars)](https://github.com/ShuaiMXu/happyhands/stargazers)
[![Forks](https://img.shields.io/github/forks/ShuaiMXu/happyhands?style=flat&label=Forks)](https://github.com/ShuaiMXu/happyhands/forks)
[Star history](https://www.star-history.com/?repos=ShuaiMXu%2Fhappyhands&type=date)

Original HappyHands source is licensed under MIT. Bundled third-party code and dependencies retain their own licenses, including tldraw’s separate production-use requirements. See [third-party notices](THIRD_PARTY_NOTICES.md).
