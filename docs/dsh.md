# Use HappyHands from DeepSeek Harness (DSH)

[简体中文](dsh.zh-CN.md)

Use your existing DSH conversation to operate HappyHands from the terminal. The HappyHands workbench is optional. DSH coordinates the task; HappyHands retains the evidence, plan, isolated execution and review record.

## Current support

- DSH can operate the HappyHands CLI when its session can reach the checkout, the target repository, a terminal and the preview.
- **DSH can make the edit itself.** `HH execute --run RUN --repo REPO --agent self` prepares the isolated worktree and writes the brief; DSH edits only inside that worktree and runs the checks there, then `HH execute-finish --run RUN` applies the same host-repository boundary check, diff capture and ledger record as a launched CLI. That is a registered execution with an execution record, not an untracked side edit. `codex` and `claude-code` remain available when one of them should do the editing.
- **Diagnosis and review must run on a different model than the one editing.** `HH model-diagnose` and `HH model-review` take `--agent claude-code`, or run against an API configured with `HAPPYHANDS_API_*`. A signed-in Codex CLI is no longer required. The model must read images; a text-only endpoint cannot judge screenshots.
- Edits made outside `execute`/`execute-finish` can still be recaptured and reviewed, but they carry no execution record. Do not call them registered, isolated execution.
- This documents external orchestration, not a validated DSH-only acceptance loop. Final accept or reject stays with a person.

## Install the Skill for DSH

DSH reads user skills from `~/.agents/skills` and project skills from `<project>/.agents/skills`. Build the bundle, then install it:

```sh
node scripts/build-lite.mjs --out .harness/lite
node .harness/lite/bin/happyhands.mjs install --agent dsh --scope user
```

Use `--scope project` to install into `<project>/.agents/skills/happyhands` instead. From then on `HH` in [SKILL.md](../skills/happyhands/SKILL.md) means `node ~/.agents/skills/happyhands/bin/happyhands.mjs`.

Inside a HappyHands checkout, prefer that checkout's own `node scripts/harness.mjs` (or `pnpm harness`). An installed bundle is a frozen copy of the version it was built from and will drift from the checkout.

## File access and the terminal

The Harness spawns `git`, `node` and a browser on almost every command. A file sandbox that blocks child processes stops `quickstart`, `capture`, `execute` and the test suite; DSH's `workspace-write` mode does exactly that, and the failure looks like `spawn EPERM`. Run the Harness with unrestricted file access, or from a terminal outside the sandbox. Read-only commands (`next`, `status`, `agents`, `doctor`, `review-costs`) work either way.

## Start in the DSH desktop app

1. Open a DSH session with access to your HappyHands checkout and target product. Preserve existing, uncommitted work. Supply a working preview and one user task, such as recovering from a failed form submission.
2. Paste the request below. Inspect the actual CLI and project rules first. Reuse an existing HappyHands checkout; otherwise follow the [installation prerequisites](../README.md#get-started) and install dependencies. You need neither `pnpm workbench` nor a second copy of the Skill.
3. Capture original evidence and review the finding and scope. An existing explicit repair instruction can supply the scope; a review request alone does not authorize unrelated edits.
4. Use `--agent self` in the Harness worktree, or name another adapter, preview that worktree, recapture matching states and dimensions, run applicable checks, and obtain independent review. Keep the final human accept/reject decision explicit.

```text
Use HappyHands to review one user task in this product. Start from
skills/happyhands/SKILL.md. At pre-audit, inspect the task and original captures,
look up a method for the specific question, then request the audit form.
Reuse the repository, preview and goal already supplied; ask only for missing inputs.
Inspect the actual CLI first. Reuse one Harness run and drive it with `next`;
do not create a second acceptance store.
Reproduce the issue and capture originals before proposing a repair. Preserve
the project's brand, design system and shared components.
Prefer --agent self: edit only inside the worktree execute prepares, run the
project's checks there, and finish with execute-finish so the run keeps its
execution record. Ask me before choosing any other executor.
Diagnose and review on a different model than the one that edits; never review
your own edit in this session.
After scoped, isolated execution, recapture matching states and obtain independent
review. Retain failures and missing evidence. Let me accept or reject the result.
Do not push, merge, deploy or publish anything as part of this review.
```

## Methods at each stage

| Stage | Method / program | Required result |
| --- | --- | --- |
| Understand and reproduce | `review-product`, project rules, `quickstart` or `start` followed by `capture` | One task, source version and original evidence. |
| Diagnose and decide | `experience-remediation` and its assigned web-taste and Impeccable references | Current-page details, shared interactions, task flow and layout, then device regression. Distinguish defects, inferences and missing evidence. |
| Plan and edit | Existing confirmation/plan gates and `harness execute` | Scoped decisions, actual shared components and an isolated worktree. Reading a method is not implementation. |
| Check and decide | Matched captures, applicable verification, independent review and human judgment | Before/after evidence, unresolved items and an explicit human decision. A clean command exit is not visual acceptance. |

Use `HH next --run DIRECTORY` (or `pnpm harness next --run DIRECTORY` inside the checkout) and the same form of `status`. The [Harness guide](harness.md#one-finding-one-run) contains the real command sequence and configuration examples. Replace example directories with actual project paths.

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
