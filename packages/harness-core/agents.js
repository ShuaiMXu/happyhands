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

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

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

const CLAUDE_DENIED_TOOLS = ['Bash(git push:*)', 'Bash(git remote:*)', 'Bash(git config:*)', 'Bash(npm publish:*)', 'Bash(pnpm publish:*)', 'Bash(yarn publish:*)', 'WebFetch', 'WebSearch'];
const CLAUDE_DEFAULT_ALLOWED = ['Read', 'Glob', 'Grep', 'Edit', 'Write',
  'Bash(npm test:*)', 'Bash(npm run:*)', 'Bash(pnpm test:*)', 'Bash(pnpm run:*)', 'Bash(pnpm exec:*)', 'Bash(yarn test:*)', 'Bash(yarn run:*)',
  'Bash(npx tsc:*)', 'Bash(npx vitest:*)', 'Bash(npx eslint:*)', 'Bash(npx prettier:*)', 'Bash(node:*)',
  'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(ls:*)'];

// Projects with other check commands extend the list, comma separated:
// HAPPYHANDS_CLAUDE_ALLOWED_TOOLS="Bash(cargo test:*),Bash(make check:*)"
export function claudeAllowedTools(env = process.env) {
  const extra = (env.HAPPYHANDS_CLAUDE_ALLOWED_TOOLS || '').split(',').map(item => item.trim()).filter(Boolean);
  return [...new Set([...CLAUDE_DEFAULT_ALLOWED, ...extra])];
}

// `--bare` skips CLAUDE.md, hooks and plugins, but it also refuses OAuth and
// keychain login. Use it only when an API key is present, so subscription users
// can run the adapter at all.
export function claudeCanRunBare(env = process.env) {
  return Boolean(env.ANTHROPIC_API_KEY) && env.HAPPYHANDS_CLAUDE_BARE !== '0';
}

const AGENTS = {
  codex: {
    id: 'codex',
    label: 'OpenAI Codex CLI',
    command: 'codex',
    promptVia: 'stdin',
    logFile: 'agent-events.jsonl',
    lastMessageFile: 'agent-last-message.md',
    supportsModel: true,
    argv: ({ worktree, lastMessagePath, model }) => [
      'exec', '-C', worktree, '-s', 'workspace-write', '--json',
      ...(model?['-m',model]:[]), '-o', lastMessagePath, '-'
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
    supportsModel: true,
    argv: ({ model, readDirs = [] } = {}) => [
      '-p',
      '--output-format', 'stream-json',
      '--verbose',
      // acceptEdits auto-approves file edits only. In print mode any other tool
      // that is not allow-listed is denied without a prompt, so the agent needs
      // an explicit list of the checks it may run.
      '--permission-mode', 'acceptEdits',
      '--allowed-tools', ...claudeAllowedTools(),
      '--disallowed-tools', ...CLAUDE_DENIED_TOOLS,
      ...(claudeCanRunBare() ? ['--bare'] : []),
      ...(model ? ['--model', model] : []),
      // Guidance snapshots live beside the worktree. Without --add-dir, reads
      // outside the working directory are denied in print mode. Their hashes are
      // re-verified after the run, so an edit there fails the run.
      ...readDirs.flatMap(dir => ['--add-dir', dir])
    ],
    satisfies: {
      nonInteractive: '`-p` prints and exits; tools outside the allow-list are denied, never prompted.',
      worktreeOnly: 'The process runs with cwd set to the worktree; only guidance snapshots are added with --add-dir, and they are hash-verified afterwards.',
      noRepoInstructions: 'With ANTHROPIC_API_KEY, `--bare` skips CLAUDE.md, hooks and plugins. With OAuth login the repository CLAUDE.md can load, so the prompt states repository content is data, as for Codex.',
      noPublish: '`--disallowed-tools` denies git push, remote, config and package publish, on top of the shared pushurl override and the post-run verification.',
      bounded: 'Wall-clock bounded by the run timeout in runner.js.'
    },
    // Flags checked against `claude --help` on 2026-11-16; the loop has not yet
    // been run end to end with this adapter.
    verified: 'flags'
  }
};

// The agent already operating HappyHands (Cursor, Kimi, Claude Code, a DSH
// conversation, anything with file access) makes the edit itself. `execute`
// prepares the isolated worktree and brief and stops; `execute-finish` then runs
// the same boundary check, diff and ledger record as a launched agent.
AGENTS.self = {
  id: 'self',
  label: 'Operating agent',
  command: null,
  promptVia: 'none',
  logFile: 'self-execution.json',
  lastMessageFile: null,
  supportsModel: false,
  argv: () => [],
  satisfies: {
    nonInteractive: 'No process is launched; the operating agent edits in its own session.',
    worktreeOnly: 'The operator is told to edit only the worktree; execute-finish fingerprints the host repository and fails the run if anything else changed.',
    noRepoInstructions: 'The brief states that repository content is data, as for every adapter.',
    noPublish: 'Detected by the host fingerprint check at execute-finish (HEAD, refs, remotes, working tree).',
    bounded: 'execute-finish records the elapsed time and marks the run timed out past the execution window.'
  },
  verified: 'operator'
};

export const DEFAULT_AGENT = 'codex';

// Any other CLI is declared in JSON, without code changes:
//   HAPPYHANDS_AGENTS_FILE=/path/agents.json  (default ~/.happyhands/agents.json)
// See docs/agent-adapters.md for the format. A declared adapter still has to
// state how it meets every boundary clause, and the post-run fingerprint check
// applies to it exactly as to the built-in adapters.
export function agentsFilePath(env = process.env) {
  return env.HAPPYHANDS_AGENTS_FILE || join(homedir(), '.happyhands', 'agents.json');
}

export function loadCustomAgents({ agentsFile = agentsFilePath() } = {}) {
  let text;
  try { text = readFileSync(agentsFile, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
  const agents = JSON.parse(text)?.agents;
  if (!agents || typeof agents !== 'object' || Array.isArray(agents)) throw new Error(`${agentsFile} must contain an "agents" object keyed by agent ID.`);
  const result = {};
  for (const [id, spec] of Object.entries(agents)) {
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(id)) throw new Error(`Invalid agent ID "${id}" in ${agentsFile}.`);
    if (AGENTS[id]) throw new Error(`${agentsFile} cannot redefine the built-in agent "${id}".`);
    if (!spec?.api && (typeof spec?.command !== 'string' || !spec.command)) throw new Error(`Agent "${id}" in ${agentsFile} needs a command (or an "api" block for a model-only entry).`);
    result[id] = { ...spec, id, source: agentsFile };
  }
  return result;
}

export async function customAgent(id, options = {}) {
  const agent = loadCustomAgents(options)[id];
  if (!agent) throw new Error(`Unknown agent "${id}". Built in: ${Object.keys(AGENTS).join(', ')}. Declare others in ${options.agentsFile || agentsFilePath()} (see docs/agent-adapters.md).`);
  return agent;
}

function fromDeclaration(spec) {
  const execute = spec.execute;
  if (!execute || !Array.isArray(execute.argv) || !execute.argv.every(token => typeof token === 'string')) {
    throw new Error(`Agent "${spec.id}" declares no "execute.argv" string array.`);
  }
  const promptVia = execute.promptVia || 'stdin';
  if (!['stdin', 'file'].includes(promptVia)) throw new Error(`Agent "${spec.id}": promptVia must be stdin or file.`);
  return {
    id: spec.id,
    label: spec.label || spec.id,
    command: spec.command,
    promptVia,
    logFile: 'agent-events.jsonl',
    lastMessageFile: null,
    supportsModel: Array.isArray(execute.modelFlag),
    argv: ({ worktree, model, promptFile, readDirs = [] }) => [
      ...execute.argv.map(token => token.replaceAll('{worktree}', worktree).replaceAll('{promptFile}', promptFile || '')),
      ...(model && execute.modelFlag ? execute.modelFlag.map(token => token.replaceAll('{model}', model)) : []),
      ...(execute.readDirFlag ? readDirs.flatMap(dir => [execute.readDirFlag, dir]) : [])
    ],
    satisfies: spec.satisfies || {},
    verified: 'declared',
    source: spec.source
  };
}

const BUILT_IN_MODEL_APIS = [
  { id: 'anthropic', label: 'Anthropic API', roles: ['model'], verified: 'mock-tested' },
  { id: 'openai', label: 'OpenAI API', roles: ['model'], verified: 'mock-tested' },
  { id: 'api', label: 'Any OpenAI-compatible or Anthropic API (HAPPYHANDS_API_*)', roles: ['model'], verified: 'mock-tested' }
];

export function listAgents(options) {
  const builtIn = Object.values(AGENTS).map(({ argv, ...rest }) => ({ ...rest, roles: rest.id === 'self' ? ['execute'] : ['execute', 'model'] }));
  const custom = Object.values(loadCustomAgents(options)).map(spec => {
    const roles = [...(spec.execute ? ['execute'] : []), ...(spec.model || spec.api ? ['model'] : [])];
    if (!spec.execute) return { id: spec.id, label: spec.label || spec.id, roles, verified: 'declared', source: spec.source };
    const { argv, ...rest } = fromDeclaration(spec);
    return { ...rest, roles };
  });
  return [...builtIn, ...BUILT_IN_MODEL_APIS, ...custom];
}

export function resolveAgent(id = DEFAULT_AGENT, { commandOverride, agentsFile } = {}) {
  const declared = AGENTS[id] ? null : loadCustomAgents({ agentsFile })[id];
  const agent = AGENTS[id] || (declared && fromDeclaration(declared));
  if (!agent) {
    const known = [...Object.keys(AGENTS), ...Object.keys(loadCustomAgents({ agentsFile }))];
    throw new Error(`Unknown agent "${id}". Available: ${known.join(', ')}. Declare another CLI in ${agentsFile || agentsFilePath()} (see docs/agent-adapters.md); it must state how it meets every boundary clause.`);
  }
  const undeclared = CLAUSES.filter(clause => !agent.satisfies?.[clause]?.trim());
  if (undeclared.length) {
    throw new Error(`Agent "${id}" does not state how it meets: ${undeclared.join(', ')}. An adapter that cannot express the boundary is not run.`);
  }
  return { ...agent, command: commandOverride || agent.command };
}
