# Lightweight Alpha

The `happyhands` Skill packages the existing Harness engine, its pinned design methods and six runtime dependencies. It does not include the workbench frontend, React/tldraw, browser binaries or the complete website resource library. It uses the existing run format and source, execution, independent-review and human-judgment gates. Lightweight `start`, `init` and `onboard` store records in `~/.happyhands/runs` by default, outside the product repository. `HAPPYHANDS_RUNS_DIR` selects another state directory; an explicit `--out DIRECTORY` takes precedence. Keep an explicit output outside the target or ignore it deliberately before source-bound execution. The installer never edits Git ignore rules. Generated Spec/config/Capture Plan files also belong outside the target unless deliberately tracked or ignored. The source CLI retains its existing `.harness/runs` default.

## Install

From the product repository, with Node.js 22.15+ and npm installed:

```sh
npx --yes --package=https://github.com/ShuaiMXu/happyhands/releases/download/v0.1.0-alpha.2/happyhands-lite-0.1.0-alpha.2.tgz happyhands install
```

Git, Chrome/Edge and an authenticated coding agent are also needed for the repair loop. The package is distributed as a public GitHub Release asset, so installing it does not require GitHub Packages authentication. The install command downloads the package and npm runtime dependencies; it runs `npm ci --ignore-scripts` using the bundled shrinkwrap. Existing installations and linked destination directories are rejected. For an upgrade, select a separate `--destination PATH`, review it, then switch your agent to the chosen installation; this Alpha does not replace existing drafts or Skills automatically.

The default Codex discovery path is `~/.codex/skills/happyhands` (or under `CODEX_HOME`); `install --agent claude-code` selects the Claude user Skill directory. `--scope project` selects `.agents/skills/happyhands` or `.claude/skills/happyhands` in the current project. Project-local installations must be committed or explicitly ignored before the core can require a clean repair checkout; the installer never edits your Git ignore rules. Only the environment actually validated in the release is claimed as tested. DSH is an external operator, not a registered executor or a replacement for Codex model access.

Ask the selected agent:

```text
Use $happyhands to review the signup error-recovery task in this repository.
Reuse the current preview and existing design system. Reproduce the issue,
capture originals, make only the authorized isolated repair, then show the
matched before/after evidence, checks and independent review. Leave the final
accept/reject decision to me. Do not push, merge or deploy.
```

Use actual product details rather than the sample task. If the agent cannot discover the Skill, give it the installed `SKILL.md` path. Discovery alone is not execution.

## Commands and references

From the product directory:

```sh
node ~/.codex/skills/happyhands/bin/happyhands.mjs doctor
node ~/.codex/skills/happyhands/bin/happyhands.mjs help
node ~/.codex/skills/happyhands/bin/happyhands.mjs resources search --query lime
```

The installed [workflow reference](../skills/happyhands/references/workflow.md) explains `start`, bound capture, model diagnosis, scoped planning/execution, independent review, comparison and the final user decision. `start --config FILE` validates an already-running preview and the actual Git repository without crawling unrelated pages or extracting the whole project. Lightweight capture defaults to `--extract-design-system false` and requires `--bind-evidence true`: it hashes the complete Git input set and binds originals, but does not automatically build a whole-project component/module inventory. The omission is recorded and incremental inference is unavailable. Select actual project rules and references for the task; request `--extract-design-system true` explicitly for a full extraction. Full source hashing currently allows up to 1 GiB total with a 64 MiB per-file cap and refuses larger inputs without partial binding. The full `onboard` and bootstrap flow remain available separately. The installer does not edit product source or launch the workbench.

`resources search` downloads only the Design.md, design-system and component indexes and returns up to eight candidates. `resources select --run DIRECTORY --id ID` fetches the chosen full document; system references can select an indexed `--document PATH`, and local references can use `--file PATH`. Only selected documents are copied to the run. Index/document hashes, original source, available stack/license information and selection time are retained. Check the actual source license and component API before reuse. No resource commands or installers from a retrieved document run automatically.

Project `designSourcePaths` are read and hashed during CLI configuration. Selected external/local references are frozen before diagnosis, contribute to its source binding and the execution plan, and are rechecked during run reads and execution. A missing, changed or incompatible reference remains a failure or explicit limitation, not an approval or a visual pass. Retrieval does not create layout decisions by itself: the Skill must connect the reference to actual content grouping, hierarchy, grid, component APIs and state behavior, then independent review checks those decisions in the rendered product.

## What this Alpha does not establish

The first verified combination is described in the release; there is no blanket cross-agent, Windows or DSH-only acceptance claim. The CLI currently supports whole-viewport comparisons; full-page originals, annotations, redaction and motion evidence need their own complete handling. An original image, an installed Skill or a generated comparison does not establish a repaired product or human acceptance. Broader case work remains tracked in [#7](https://github.com/ShuaiMXu/happyhands/issues/7).

The runtime uses the same local access and model-service behavior as the source Harness. Review the selected source/images before model use and sharing. A working CLI binary is not proof of model authentication. Background Git hooks can change refs and trigger boundary protection; inspect and retain that failure rather than waiving the guard.

## Build a release asset

From a clean source commit with development dependencies installed, run `pnpm lite:build`, then `npm pack BUILT_DIRECTORY --pack-destination OUTPUT_DIRECTORY`. The generated `bundle.json` records the exact source revision, dirty state and hashes of every shipped file; only a clean, tested source build should be released. The original engine lock bytes are preserved as `engine-lock.yaml`, and runtime dependency resolution uses `npm-shrinkwrap.json`, because npm excludes ordinary lockfile names from a packed dependency. No local run records, captures, credentials or private assets are copied by the builder.
