import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { promisify } from 'node:util';
import sample from '../examples/happyclaw-site/experience.json' with { type: 'json' };
import { BOUNDARY, boundaryEnv, listAgents, resolveAgent } from '../packages/harness-core/agents.js';
import { describeBreach, executeWithAgent, repositoryFingerprint } from '../packages/harness-core/runner.js';
import { confirmFinding, createRun, saveCapture, savePlan, saveOnboarding } from '../packages/harness-core/store.js';
import { workflowState } from '../packages/harness-core/workflow.js';

const execFileAsync = promisify(execFile);

async function temporaryRepo(t) {
  const root = await mkdtemp(join(tmpdir(), 'pd-agents-test-'));
  t.after(async () => {
    if (!root.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(root, { recursive: true, force: true });
  });
  const git = (...args) => execFileAsync('git', args, { cwd: root, windowsHide: true });
  await git('init', '-q', '.');
  await git('config', 'user.email', 'harness@test');
  await git('config', 'user.name', 'Harness Test');
  await git('remote', 'add', 'origin', 'https://example.invalid/repo.git');
  await writeFile(join(root, 'a.txt'), 'one');
  await git('add', '-A');
  await git('commit', '-qm', 'init');
  return { root, git };
}

test('every registered adapter states how it meets each boundary clause', () => {
  const agents = listAgents();
  assert.ok(agents.length >= 2, 'at least Codex and Claude Code are registered');
  for (const agent of agents) {
    for (const clause of Object.keys(BOUNDARY)) {
      assert.ok(agent.satisfies?.[clause]?.trim(), `${agent.id} must state how it meets ${clause}`);
    }
    assert.ok(agent.command, `${agent.id} needs a command`);
    assert.ok(agent.verified, `${agent.id} must record how far it has been verified`);
  }
});

test('an unknown agent, or one that cannot express the boundary, is refused', () => {
  assert.throws(() => resolveAgent('deepseek'), /Unknown agent "deepseek"/);
  assert.throws(() => resolveAgent('deepseek'), /must state how it meets every boundary clause/);
  const resolved = resolveAgent('claude-code', { commandOverride: '/custom/claude' });
  assert.equal(resolved.command, '/custom/claude', 'the binary may be relocated');
  assert.equal(resolved.id, 'claude-code', 'but the adapter identity and flags are not');
});

test('the Claude Code adapter runs headless, without repository instructions, and without publish tools', () => {
  const argv = resolveAgent('claude-code').argv({ worktree: '/w', lastMessagePath: '/w/last.md' });
  assert.ok(argv.includes('-p'), 'headless');
  assert.ok(argv.includes('--bare'), 'a reviewed repository must not instruct the agent through CLAUDE.md');
  assert.equal(argv[argv.indexOf('--permission-mode') + 1], 'acceptEdits');
  const denied = argv[argv.indexOf('--disallowed-tools') + 1];
  for (const tool of ['Bash(git push:*)', 'Bash(git remote:*)']) {
    assert.ok(denied.includes(tool), `${tool} must be denied`);
  }
});

test('the push override makes git push fail before it reaches the remote', async t => {
  const { root } = await temporaryRepo(t);
  const env = { ...process.env, ...boundaryEnv(['origin']) };
  assert.equal(env.GIT_CONFIG_COUNT, '1');
  assert.equal(env.GIT_CONFIG_KEY_0, 'remote.origin.pushurl');

  await assert.rejects(
    execFileAsync('git', ['push', 'origin', 'HEAD'], { cwd: root, env, windowsHide: true }),
    error => {
      // The point is that the real host is never contacted.
      assert.doesNotMatch(String(error.stderr), /example\.invalid/, 'the real remote must not be reached');
      return true;
    }
  );

  // A child process of the agent inherits it, so a shell the agent spawns is
  // covered too.
  await assert.rejects(
    execFileAsync(process.execPath, ['-e', "require('child_process').execFileSync('git',['push','origin','HEAD'],{cwd:process.cwd(),stdio:'pipe'})"], { cwd: root, env, windowsHide: true }),
    /.*/
  );
});

test('a host repository moved by the agent is detected and blocks the run', async t => {
  const { root, git } = await temporaryRepo(t);
  const branch = 'pd/run00001';
  const fingerprint = () => repositoryFingerprint(root);

  const before = await fingerprint();
  assert.deepEqual(describeBreach(before, before, branch), [], 'an untouched repository reports nothing');

  // The run's own branch is expected and must not read as a breach.
  await git('branch', branch);
  assert.deepEqual(describeBreach(before, await fingerprint(), branch), []);

  // An agent that commits into the host repository moves HEAD.
  await writeFile(join(root, 'a.txt'), 'two');
  await git('commit', '-qam', 'agent touched the host repo');
  const moved = describeBreach(before, await fingerprint(), branch);
  assert.ok(moved.some(item => /HEAD moved/.test(item)), `expected a HEAD breach, got ${JSON.stringify(moved)}`);

  // And one that repoints a remote.
  await git('remote', 'set-url', 'origin', 'https://elsewhere.invalid/repo.git');
  const repointed = describeBreach(before, await fingerprint(), branch);
  assert.ok(repointed.some(item => /remote was added, removed or repointed/.test(item)));

  const state = workflowState({
    captures: { before: {}, after: null }, diagnosis: {}, confirmation: { verdict: 'supported' }, plan: {},
    execution: { exitCode: 0, boundaryBreaches: repointed }, evaluation: null, judgment: null, visualReviews: []
  });
  assert.equal(state.stage, 'boundary-breached');
  assert.ok(state.blocked, 'a clean exit code must not let a breached run continue');
});

test('an agent that edits host-repo files without committing them is still detected', async t => {
  const { root } = await temporaryRepo(t);
  const branch = 'pd/run00002';
  const before = await repositoryFingerprint(root);

  // The run starts from a verified-clean tree, so any working-tree change
  // afterwards — committed or not — broke the worktree-only promise.
  await writeFile(join(root, 'a.txt'), 'silently rewritten');
  const breaches = describeBreach(before, await repositoryFingerprint(root), branch);
  assert.ok(
    breaches.some(item => /working-tree files/.test(item)),
    `an uncommitted host-repo edit must be a breach, got ${JSON.stringify(breaches)}`
  );
});

test('an adapter never claims an artifact it does not write', () => {
  for (const agent of listAgents()) {
    if (!agent.lastMessageFile) continue;
    const argv = resolveAgent(agent.id).argv({ worktree: '/w', lastMessagePath: '/w/last.md' });
    assert.ok(
      argv.includes('/w/last.md'),
      `${agent.id} declares lastMessageFile but its argv never writes it, so the run ledger would name a missing artifact`
    );
  }
});

// A planned run against a real host repository, ready for executeWithAgent.
// The run directory lives outside the repository on purpose: the executor
// verifies the host tree is clean, and a runs folder inside it would be dirt.
async function plannedRun(t, id) {
  const { root, git } = await temporaryRepo(t);
  const runs = await mkdtemp(join(tmpdir(), 'pd-agents-runs-'));
  t.after(async () => {
    if (!runs.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(runs, { recursive: true, force: true });
  });
  const run = await createRun({ spec: structuredClone(sample), url: 'http://127.0.0.1:4321/', outputRoot: runs, id });
  await saveCapture(run.directory, 'before', {
    at: '2026-09-27T00:00:00.000Z', url: 'http://127.0.0.1:4321/',
    viewports: { desktop: { width: 1280, height: 800, status: 200, screenshot: 'before/desktop.png', dom: { h1: ['HappyClaw'], actions: [], horizontalOverflow: false } } }
  });
  await saveOnboarding(run.directory, { repository: { root, commit: (await git('rev-parse', 'HEAD')).stdout.trim() } });
  await confirmFinding(run.directory, 'F1', 'supported', 'Baseline still supports this finding.');
  await savePlan(run.directory, 'F1');
  return { root, git, run };
}

test('a missing agent binary rolls the isolation artifacts back so the run stays retryable', async t => {
  const { root, git, run } = await plannedRun(t, 'exec0001');
  await assert.rejects(
    executeWithAgent({ directory: run.directory, repo: root, agent: 'codex', commandOverride: 'definitely-not-a-real-agent-binary' }),
    /definitely-not-a-real-agent-binary|ENOENT|spawn/i
  );
  const worktrees = (await execFileAsync('git', ['worktree', 'list'], { cwd: root })).stdout;
  assert.ok(!worktrees.includes('worktree'), `the failed execution must not leave a worktree behind, got: ${worktrees}`);
  assert.equal((await execFileAsync('git', ['branch', '--list', 'pd/*'], { cwd: root })).stdout.trim(), '', 'the run branch must be deleted with it');

  // And a retry is not blocked by leftover isolation state.
  await assert.rejects(
    executeWithAgent({ directory: run.directory, repo: root, agent: 'codex', commandOverride: 'git' }),
    /exited \d+/
  );
});

test('an agent that ran and failed keeps its worktree and records the execution', async t => {
  const { root, run } = await plannedRun(t, 'exec0002');
  // `git` with the codex adapter's flags exits non-zero immediately, which is the
  // "agent ran, failed, retain the evidence" path.
  const failure = await executeWithAgent({ directory: run.directory, repo: root, agent: 'codex', commandOverride: 'git' }).then(
    () => { throw new Error('expected the fake agent to fail'); },
    error => error
  );
  assert.match(failure.message, /exited \d+.*retained for inspection/s);
  const worktrees = (await execFileAsync('git', ['worktree', 'list'], { cwd: root })).stdout.replaceAll('\\', '/');
  assert.ok(worktrees.includes(join(run.directory, 'worktree').replaceAll('\\', '/')), 'the worktree is retained for inspection');
  const manifest = JSON.parse(await readFile(join(run.directory, 'run.json'), 'utf8'));
  assert.equal(manifest.execution.exitCode, 1);
  assert.equal(manifest.execution.designGuidance.mode,'implementation');
  assert.equal(manifest.execution.designGuidancePacks.mode,'implementation');
  assert.deepEqual(manifest.execution.designGuidancePacks.packs.map(pack=>pack.id),['taste','impeccable','taste-v2']);
  assert.equal(manifest.execution.designGuidanceIntegrity.status,'verified');
  const guidance=manifest.execution.designGuidance;
  const original=(await readFile(new URL('../skills/vendor/ojo/upstream/SKILL.md',import.meta.url),'utf8')).replaceAll('\r\n','\n');
  assert.equal(await readFile(join(run.directory,guidance.reference,'upstream/SKILL.md'),'utf8'),original);
  const prompt=await readFile(join(run.directory,'execution-prompt.txt'),'utf8');
  assert.ok(prompt.includes(guidance.bundleHash));
  assert.ok(prompt.includes(manifest.execution.designGuidancePacks.bundleHash));
  assert.ok(manifest.execution.changedFiles.every(file=>!file.startsWith('design-guidance/')));
  const {createHash}=await import('node:crypto');
  assert.equal(manifest.execution.promptHash,createHash('sha256').update(prompt).digest('hex'));
  assert.ok(manifest.execution.changedFiles.every(file=>!file.startsWith('ojo-guidance/')),'guidance must not pollute the target project diff');
  assert.deepEqual(manifest.execution.boundaryBreaches, [], 'the fake agent never left its worktree');
  // A second execution of the same run is refused, immutable as designed.
  await assert.rejects(
    executeWithAgent({ directory: run.directory, repo: root, agent: 'codex', commandOverride: 'git' }),
    /already has an execution/i
  );
});

test('isolated package-less JavaScript does not inherit a host ESM package', async t => {
 const {root,run}=await plannedRun(t,'node0001');
 await writeFile(join(run.directory,'..','package.json'),'{"type":"module"}');
 await assert.rejects(executeWithAgent({directory:run.directory,repo:root,commandOverride:'git'}),/exited/);
 const worktree=join(run.directory,'worktree');
 await writeFile(join(worktree,'check.js'),'const assert = require("node:assert/strict"); assert.ok(true); console.log("commonjs");');
 assert.equal((await execFileAsync(process.execPath,['check.js'],{cwd:worktree})).stdout.trim(),'commonjs');
 await writeFile(join(worktree,'package.json'),'{"type":"module"}');
 await writeFile(join(worktree,'check.js'),'import assert from "node:assert/strict"; assert.ok(true); console.log("target-esm");');
 assert.equal((await execFileAsync(process.execPath,['check.js'],{cwd:worktree})).stdout.trim(),'target-esm');
});

 test('execution rejects a committed change after the reviewed baseline before creating a worktree', async t => {
  const {root,git,run}=await plannedRun(t,'stale001');
  await writeFile(join(root,'a.txt'),'new revision');await git('commit','-qam','new revision');
  await assert.rejects(executeWithAgent({directory:run.directory,repo:root,commandOverride:'never-start-this-agent'}),/Baseline repository revision changed/);
  assert.equal((await git('branch','--list','pd/*')).stdout.trim(),'');
 });
 test('legacy execution without repository identity requires a fresh review',async t=>{
  const {root,run}=await plannedRun(t,'legacy01');await saveOnboarding(run.directory,{});
  await assert.rejects(executeWithAgent({directory:run.directory,repo:root,commandOverride:'never-start-this-agent'}),/identity is missing/);
 });
