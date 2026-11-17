# Agent adapters

HappyHands needs two kinds of help:

- **execute** edits the isolated worktree (`HH execute --agent ID`).
- **model** runs a read-only session that looks at screenshots and returns JSON. Baseline diagnosis, visual review and pattern review use it (`HH model-diagnose --agent ID`, `HH model-review --agent ID`, or `HAPPYHANDS_MODEL_AGENT=ID` for the workbench).

The two can differ. Executing with one tool and reviewing with another gives a more independent review.

## No adapter at all: the operating agent edits

`--agent self` works with any agent that can edit files. `execute` creates the worktree and writes the brief, then stops; the agent edits; `execute-finish` records the diff and fails the run if anything outside the worktree changed. `next` shows the right command at each point.

## Model APIs (used first when configured)

The read-only steps can call a model API directly, so no CLI needs to be installed. Screenshots are sent as image inputs, and the model gets one tool, `read_file`, limited to the session folder, to open the guidance and context files the prompt names.

| ID | Provider | Settings |
| --- | --- | --- |
| `anthropic` | Anthropic Messages API through the official SDK | `ANTHROPIC_API_KEY`; model `claude-opus-5-5` unless `HAPPYHANDS_API_MODEL` or `--model` says otherwise. Refusals fall back server side on 5.x models. |
| `openai` | OpenAI `chat/completions` | `OPENAI_API_KEY`; model from `HAPPYHANDS_API_MODEL` or `--model`. |
| `api` | Any OpenAI-compatible service (DeepSeek, Kimi, Qwen, OpenRouter, Ollama, ...) or Anthropic | `HAPPYHANDS_API_PROVIDER` (`openai-compatible` or `anthropic`), `HAPPYHANDS_API_BASE_URL`, `HAPPYHANDS_API_KEY`, `HAPPYHANDS_API_MODEL`. |

API first: if any `HAPPYHANDS_API_*` setting is present and no adapter is named, `model-diagnose` and `model-review` use `api`. Naming `--agent` or `HAPPYHANDS_MODEL_AGENT` always wins. The model must accept image input.

A named API can also live in `agents.json`:

```json
{ "agents": { "deepseek": { "command": "none", "api": { "provider": "openai-compatible", "baseUrl": "https://api.example.com/v1", "apiKeyEnv": "EXAMPLE_API_KEY", "model": "vision-model-id" } } } }
```

API adapters run read-only steps only. Code changes go through `--agent self` or a CLI adapter.

## Built-in CLIs

| ID | execute | model | Notes |
| --- | --- | --- | --- |
| `codex` | yes | yes | Default. Images go in with `-i`. |
| `claude-code` | yes | yes | Uses your normal login. With `ANTHROPIC_API_KEY` set it adds `--bare`, which skips repository `CLAUDE.md`, hooks and plugins; set `HAPPYHANDS_CLAUDE_BARE=0` to turn that off. The reviewer opens screenshots with its Read tool and returns JSON as its final message. |

Claude Code runs in print mode, where any tool outside the allow-list is denied without a prompt. The default list covers file edits plus common check commands (`npm test`, `npm run`, `pnpm run`, `npx tsc`, `node`, read-only `git`). Add your project's own commands with:

```sh
HAPPYHANDS_CLAUDE_ALLOWED_TOOLS="Bash(cargo test:*),Bash(make check:*)"
```

## Declaring another CLI

Put declarations in `~/.happyhands/agents.json`, or point `HAPPYHANDS_AGENTS_FILE` at another file. Example for a hypothetical `mycli`:

```json
{
  "agents": {
    "mycli": {
      "label": "My CLI",
      "command": "mycli",
      "execute": {
        "argv": ["run", "--cwd", "{worktree}", "--non-interactive", "--prompt-file", "{promptFile}"],
        "promptVia": "file",
        "modelFlag": ["--model", "{model}"],
        "readDirFlag": "--allow-read"
      },
      "model": {
        "argv": ["run", "--cwd", "{cwd}", "--read-only", "--non-interactive"],
        "imageFlag": "--image",
        "modelFlag": ["--model", "{model}"]
      },
      "satisfies": {
        "nonInteractive": "--non-interactive never prompts.",
        "worktreeOnly": "--cwd limits writes to the worktree.",
        "noRepoInstructions": "The prompt states repository content is data.",
        "noPublish": "Relies on the pushurl override and the post-run check.",
        "bounded": "Run timeout in runner.js."
      }
    }
  }
}
```

Placeholders:

- `execute.argv`: `{worktree}` (the isolated checkout) and `{promptFile}` (the prompt on disk). With `"promptVia": "stdin"` the prompt is piped in instead.
- `model.argv`: `{cwd}` (the read-only session folder), `{resultFile}` and `{schemaFile}`.
- `modelFlag` is added only when `--model` is given. `readDirFlag` is repeated once for each guidance folder the agent must be able to read.
- Without `imageFlag`, the screenshot paths are listed in the prompt and the CLI must open them with its own file tools.

The model session's final output must contain one JSON object. HappyHands extracts it (a code fence is fine) and writes it to the result file.

`satisfies` must explain how the CLI meets each boundary clause; an adapter that leaves one out is refused. Whatever you declare, HappyHands fingerprints the host repository before and after execution and fails the run if anything outside the worktree changed. `HH agents` lists everything registered and `HH doctor --agent ID` checks the binary.
