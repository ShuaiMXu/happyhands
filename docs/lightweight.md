# Lightweight Skill — v1.0.0

[v1.0.0](https://github.com/ShuaiMXu/happyhands/releases/tag/v1.0.0) is the regular release of the lightweight local Skill: source-bound page review and isolated repair, selected design references, and a separate video review/repair workflow. The release includes a clean-source manifest and archive checksums. Its public archive passed a fresh independent-directory installation on Windows; earlier real-product cases retain their original scope. The historical [Alpha.4 release](https://github.com/ShuaiMXu/happyhands/releases/tag/v0.1.0-alpha.4) remains available. Version numbers do not establish new-user, cross-model or all-platform acceptance. See the [remaining work](remaining-work-2026-11-12.zh-CN.md).

The `happyhands` Skill packages the existing Harness engine, its pinned design methods and six runtime dependencies. It does not include the workbench frontend, React/tldraw, browser binaries or the complete website resource library. It uses the existing run format and source, execution, independent-review and human-judgment gates. Lightweight `start`, `init` and `onboard` store records in `~/.happyhands/runs` by default, outside the product repository. `HAPPYHANDS_RUNS_DIR` selects another state directory; an explicit `--out DIRECTORY` takes precedence. Keep an explicit output outside the target or ignore it deliberately before source-bound execution. The installer never edits Git ignore rules. Generated Spec/config/Capture Plan files also belong outside the target unless deliberately tracked or ignored. The source CLI retains its existing `.harness/runs` default.

Use the published v1.0.0 command below. See its release notes for public archive verification and the exact clean source revision.

## Install

From the product repository, with Node.js 22.15+ and npm installed:

```sh
npx --yes --package=https://github.com/ShuaiMXu/happyhands/releases/download/v1.0.0/happyhands-lite-1.0.0.tgz happyhands install
```

Git, Chrome/Edge and an authenticated coding agent are also needed for the repair loop. The package is distributed as a public GitHub Release asset, so installing it does not require GitHub Packages authentication. The install command downloads the package and npm runtime dependencies; it runs `npm ci --ignore-scripts` using the bundled shrinkwrap. Existing installations and linked destination directories are rejected. For an upgrade, select a separate `--destination PATH`, review it, then switch your agent to the chosen installation; existing drafts and Skills are not replaced automatically.

The existing real-case validation uses macOS, Node.js 22.19, Chrome and Codex CLI 0.167.0 with `gpt-6-astra`. The public Alpha.4 archive also passed a fresh independent-directory installation using Node.js 22.23.3, including portable video help and actual fixed-version GitHub reference retrieval. Those are historical prerelease observations. The v1.0.0 release separately identifies its clean source, checksums, public Windows cold install and Ubuntu/Windows engineering checks. The older local Codex CLI 0.141.0 rejected that model configuration. `doctor` reports installed executables, and optional `--repo` / `--url` checks cover source cleanliness, directly declared Vite/Astro dependencies and the exact HTTP entry. `doctor` does not verify browser launch or model authentication; check them before starting a repair. Full real-product Windows/Ubuntu, complete Claude-only and DSH-only workflows and real new-user onboarding remain unverified; engineering CI and archive installation are narrower checks.

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
node ~/.codex/skills/happyhands/bin/happyhands.mjs doctor --repo /actual/product --url http://127.0.0.1:3000/
node ~/.codex/skills/happyhands/bin/happyhands.mjs help
node ~/.codex/skills/happyhands/bin/happyhands.mjs resources search --query lime
```

The installed [workflow reference](../skills/happyhands/references/workflow.md) explains `start`, bound capture, model diagnosis, scoped planning/execution, independent review, comparison and the final user decision. `start --config FILE` validates an already-running preview and the actual Git repository without crawling unrelated pages or extracting the whole project. Lightweight capture defaults to `--extract-design-system false` and requires `--bind-evidence true`: it hashes the complete Git input set and binds originals, but does not automatically build a whole-project component/module inventory. The omission is recorded and incremental inference is unavailable. Select actual project rules and references for the task; request `--extract-design-system true` explicitly for a full extraction. Full source hashing currently allows up to 1 GiB total with a 64 MiB per-file cap and refuses larger inputs without partial binding. The full `onboard` and bootstrap flow remain available separately. The installer does not edit product source or launch the workbench.

`resources search` downloads only the Design.md, design-system and component indexes and returns up to eight candidates. `resources select --run DIRECTORY --id ID` fetches the chosen full document; system references can select an indexed `--document PATH`, and local references can use `--file PATH`. Use `resources select --run DIRECTORY --url HTTPS_RAW_DOCUMENT` for a selected Markdown, CSS or JSON document; GitHub `blob` URLs are resolved to their raw document. HTML viewers and redirects are rejected. Each selected text is limited to 512 KiB, with 1 MiB total per run. Only selected documents are copied to the run. Index/document hashes, original source, available stack/license information and selection time are retained. Check the actual source license and component API before reuse. URLs and retrieved documents are reference data; their commands and installers never run automatically.

Project `designSourcePaths` are read and hashed during CLI configuration. Selected external/local references are frozen before diagnosis, contribute to its source binding and the execution plan, and are rechecked during run reads and execution. A missing, changed or incompatible reference remains a failure or explicit limitation, not an approval or a visual pass. Retrieval does not create layout decisions by itself: the Skill must connect the reference to actual content grouping, hierarchy, grid, component APIs and state behavior, then independent review checks those decisions in the rendered product.

## Product-video review

Explicit video tasks use the bundled [video workflow](../skills/review-video/SKILL.md), rather than the still-page capture loop. Keep the existing renderer, original assets and approved brief. Read its manifest contract and provide real before/after exports, source files, provenance and a complete timeline, outside the product repository. FFmpeg and FFprobe must be available or passed as explicit executable paths; they are not bundled or installed automatically.

```sh
node /actual/skill/bin/happyhands.mjs video collect --manifest /actual/video-project.json --out /actual/fresh-video-review --ffmpeg /actual/ffmpeg --ffprobe /actual/ffprobe
node /actual/skill/bin/happyhands.mjs video review --run /actual/fresh-video-review --report /actual/independent-review.json
```

Collection freezes source/media and methods, decodes complete exports and extracts original frames. It does not establish visual or audio quality. A separate reviewer must watch and listen to both complete timelines and report every rule and segment against the frozen digest. Missing playback, listening or evidence remains `needs-evidence`; failed checks cannot pass. Even an independent pass leaves `humanJudgment:"pending"` until the user supplies their decision. This workflow does not publish a video or authorize deployment.

## Scope and remaining validation

The first verified combination is described in the release; there is no blanket cross-agent, Windows or DSH-only acceptance claim. The CLI currently supports whole-viewport comparisons; full-page originals, annotations, redaction and motion evidence need their own complete handling. An original image, an installed Skill or a generated comparison does not establish a repaired product or human acceptance. Broader case work remains tracked in [#7](https://github.com/ShuaiMXu/happyhands/issues/7).

The runtime uses the same local access and model-service behavior as the source Harness. Review the selected source/images before model use and sharing. A working CLI binary is not proof of model authentication. Background Git hooks can change refs and trigger boundary protection; inspect and retain that failure rather than waiving the guard.

## Build a release asset

From a clean source commit with development dependencies installed, run `pnpm lite:build`, then `npm pack BUILT_DIRECTORY --pack-destination OUTPUT_DIRECTORY`. The generated `bundle.json` records the exact source revision, dirty state and hashes of every shipped file; only a clean, tested source build should be released. The original engine lock bytes are preserved as `engine-lock.yaml`, and runtime dependency resolution uses `npm-shrinkwrap.json`, because npm excludes ordinary lockfile names from a packed dependency. The builder includes Git-tracked engine and Skill files from its release inputs. Untracked and ignored local files are excluded.

## Continue a repair

For another code correction after an immutable attempt, choose a clean checkout of the same Git repository and run its actual preview. Commit intended isolated edits before using that checkout as the next source. The config must retain the same project and user task. Run the installed CLI with:

```sh
node /actual/skill/bin/happyhands.mjs continue --run /actual/previous-run --config /actual/next-project.json --reason "Correct the error state identified by independent review"
```

The command creates a child Run outside the target by default, increments the three-attempt budget, freezes a local predecessor summary and copies chosen reference texts. Repeating the command for the same source/config returns the same child. Changed project design paths are read from the next checkout. The selected source and preview remain the operator's explicit inputs; the command does not commit or apply retained drafts.

Capture fresh originals and diagnose the child, then confirm its current finding, plan, execute, capture after, evaluate and obtain independent review. Each child's screenshots, confirmation, execution, QA and final judgment start empty. Its execution brief includes the hash-checked prior review as historical context. Prior pass or human acceptance never supplies the child's acceptance. Accepted reviews start new tasks with `start`; a withdrawn acceptance may be reassessed as a continuation. A third unsuccessful attempt requires reviewing the unresolved evidence and narrowing the next task.
