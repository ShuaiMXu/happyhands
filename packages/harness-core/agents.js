// Coding agents are interchangeable here, but the promise the Harness makes to
// a developer is not: an isolated worktree, no push, no merge, no deploy, and a
// reviewed repository treated as data rather than instructions. That promise has
// to mean the same thing whichever agent runs, so the boundary is declared once
// and every adapter must state how it meets each clause.
//
// The clauses are enforced twice. Preventively, through the flags an adapter
// declares plus the environment the runner imposes — best effort, since an agent
// with shell access can work around any of it. Detectively, by fingerprinting the
// host repository before and after the run and failing when anything outside the
// worktree moved. Detection does not depend on the agent's cooperation, so it is
// the part the promise actually rests on.

export const BOUNDARY = Object.freeze({
  nonInteractive: 'Runs without waiting for a human prompt or approval.',
  worktreeOnly: 'Writes confined to the run worktree.',
  noRepoInstructions: 'Instruction files inside the reviewed repository are not auto-loaded.',
  noPublish: 'Cannot push, merge or deploy.',
  bounded: 'Turns or wall-clock time are bounded.'
});

const CLAUSES = Object.keys(BOUNDARY);

// Applied to every agent process regardless of adapter. Overriding pushurl makes
// `git push` fail before it reaches a real remote, and child processes inherit
// it, so this holds for a shell the agent spawns as well. An agent that unsets
// the variable or pushes to an explicit URL defeats it — which is why the run is
// also verified afterwards.
export function boundaryEnv(remotes) {
  const env = {};
  let count = 0;
  for (const name of remotes) {
    env[`GIT_CONFIG_KEY_${count}`] = `remote.${name}.pushurl`;
    env[`GIT_CONFIG_VALUE_${count}`] = 'harness-blocked://no-push';
    count += 1;
  }
  env.GIT_CONFIG_COUNT = String(count);
  return env;
}

const AGENTS = {
  codex: {
    id: 'codex',
    label: 'OpenAI Codex CLI',
    command: 'codex',
    promptVia: 'stdin',
    logFile: 'agent-events.jsonl',
    lastMessageFile: 'agent-last-message.md',
    argv: ({ worktree, lastMessagePath }) => [
      'exec', '-C', worktree, '-s', 'workspace-write', '--json',
      '-o', lastMessagePath, '-'
    ],
    satisfies: {
      nonInteractive: '`exec` is the non-interactive subcommand and the prompt arrives on stdin.',
      worktreeOnly: '`-C <worktree>` with `-s workspace-write` limits writes to that directory.',
      noRepoInstructions: 'Not expressible as a flag; the prompt states that repository content is data. Weaker than claude-code here.',
      noPublish: 'Relies on the shared pushurl override and the post-run verification.',
      bounded: 'Wall-clock bounded by the run timeout in runner.js.'
    },
    // The invocation shape predates this registry and shipped working; the binary
    // is not installed here, so the flags were not re-checked against --help.
    verified: 'shipped'
  },

  'claude-code': {
    id: 'claude-code',
    label: 'Claude Code CLI',
    command: 'claude',
    promptVia: 'stdin',
    logFile: 'agent-events.jsonl',
    // No verified flag writes a separate final message, and the streamed result
    // is already in the log. Declaring a file this adapter does not produce
    // would put a missing artifact in the run ledger.
    lastMessageFile: null,
    argv: () => [
      '-p',
      '--output-format', 'stream-json',
      '--verbose',
      '--permission-mode', 'acceptEdits',
      '--bare',
      '--disallowed-tools', 'Bash(git push:*) Bash(git remote:*) Bash(git config:*) WebFetch'
    ],
    satisfies: {
      nonInteractive: '`-p` prints and exits; no approval prompt is shown.',
      worktreeOnly: 'The process runs with cwd set to the worktree and no `--add-dir` is passed.',
      noRepoInstructions: '`--bare` skips CLAUDE.md auto-discovery, hooks and plugin sync, so a reviewed repository cannot instruct the agent through a memory file.',
      noPublish: '`--disallowed-tools` denies git push, remote and config, on top of the shared pushurl override and the post-run verification.',
      bounded: 'Wall-clock bounded by the run timeout in runner.js.'
    },
    // Flags checked against `claude --help` on 2026-09-24; the loop has not yet
    // been run end to end with this adapter.
    verified: 'flags'
  }
};

export const DEFAULT_AGENT = 'codex';

export function listAgents() {
  return Object.values(AGENTS).map(({ argv, ...rest }) => rest);
}

export function resolveAgent(id = DEFAULT_AGENT, { commandOverride } = {}) {
  const agent = AGENTS[id];
  if (!agent) {
    throw new Error(`Unknown agent "${id}". Available: ${Object.keys(AGENTS).join(', ')}. Add an adapter in packages/harness-core/agents.js; it must state how it meets every boundary clause.`);
  }
  const undeclared = CLAUSES.filter(clause => !agent.satisfies?.[clause]?.trim());
  if (undeclared.length) {
    throw new Error(`Agent "${id}" does not state how it meets: ${undeclared.join(', ')}. An adapter that cannot express the boundary is not run.`);
  }
  return { ...agent, command: commandOverride || agent.command };
}
