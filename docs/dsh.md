# Use HappyHands from DeepSeek Harness (DSH)

[简体中文](dsh.zh-CN.md)

Use your existing DSH conversation to operate HappyHands from the terminal. The HappyHands workbench is optional. DSH coordinates the task; HappyHands retains the evidence, plan, isolated execution and review record.

## Current support

- DSH can operate the existing HappyHands CLI when its session has access to the checkout, target repository, terminal and required screenshots.
- HappyHands registers `codex` and `claude-code` implementation adapters. There is no `--agent dsh` or `--agent deepseek`. Choose an available registered executor before editing; do not silently substitute one.
- Built-in model diagnosis and screenshot-aware review still need a configured, signed-in Codex CLI. DSH alone does not replace that dependency.
- Edits performed by DSH outside `harness execute` can be recaptured and reviewed, but have no Harness agent-execution record. Do not label them as registered, isolated execution.
- This documents external orchestration, not a validated DSH-only repair and independent acceptance loop.

## Start in the DSH desktop app

1. Open a DSH session with access to your HappyHands checkout and target product. Preserve existing, uncommitted work. Supply a working preview and one user task, such as recovering from a failed form submission.
2. Paste the request below. Inspect the actual CLI and project rules first. Reuse an existing HappyHands checkout; otherwise follow the [installation prerequisites](../README.md#get-started) and install dependencies. You do not need `pnpm workbench`.
3. Capture original evidence and review the finding and scope. An existing explicit repair instruction can supply the scope; a review request alone does not authorize unrelated edits.
4. Use the selected registered executor in the Harness worktree. Preview that worktree, recapture matching states and dimensions, run applicable checks, and obtain independent review. Keep the final human accept/reject decision explicit.

```text
Use HappyHands to review one user task in this product. Read docs/dsh.md,
docs/harness.md, skills/review-product/SKILL.md and the relevant complete
experience-remediation methods in the HappyHands checkout.
Reuse the repository, preview and goal already supplied; ask only for missing inputs.
Inspect the actual CLI first. Reuse one Harness run and its next/status commands;
do not create a second acceptance store.
Reproduce the issue and capture originals before proposing a repair. Preserve
the project's brand, design system and shared components.
Run pnpm harness agents. Tell me which registered implementation executor is
available and let me choose. Never invent --agent dsh or silently switch executors.
After scoped, isolated execution, recapture matching states and obtain independent
review. Retain failures and missing evidence. Let me accept or reject the result.
Do not push, merge, deploy or publish anything as part of this review.
```

## Methods at each stage

| Stage | Method / program | Required result |
| --- | --- | --- |
| Understand and reproduce | `review-product`, project rules, `harness onboard` or `init`/`capture` | One task, source version and original evidence. |
| Diagnose and decide | `experience-remediation` and its assigned complete OJO/Taste/Impeccable references | Current-page details, shared interactions, task flow and layout, then device regression. Distinguish defects, inferences and missing evidence. |
| Plan and edit | Existing confirmation/plan gates and `harness execute` | Scoped decisions, actual shared components and an isolated worktree. Reading a method is not implementation. |
| Check and decide | Matched captures, applicable verification, independent review and human judgment | Before/after evidence, unresolved items and an explicit human decision. A clean command exit is not visual acceptance. |

Use `pnpm harness next --run DIRECTORY` and `pnpm harness status --run DIRECTORY` for the same run. The [Harness guide](harness.md#one-finding-one-run) contains the real command sequence and configuration examples. Replace example directories with actual project paths.

## Optional headless DSH

The locally inspected DSH `0.2.2-rc.1` exposes:

```sh
dsh --help
dsh headless --help
dsh headless --json - < review-request.txt
```

`review-request.txt` contains your task. Run from the intended directory after configuring the DSH command and model route. Each invocation handles one task; use the desktop conversation for scope questions and decisions.

**Desktop sign-in is not automatically headless sign-in.** The inspected headless profile disables the managed credential store by default. It uses the launch environment, the invoking directory's `.env`, then `$DSH_HOME/.env`. A working desktop session does not prove that this command is ready. Follow your DSH version's instructions; do not paste keys into prompts, commit them, or change authentication settings automatically.

DSH's `--json` is a projected event stream, not the HappyHands run ledger. Retain the original `.harness` record. A DSH final event is neither independent QA nor human acceptance. Commands and defaults can differ between DSH versions; check the installed help first.
