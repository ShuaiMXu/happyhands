import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseCanonical, extractJsonObject, adaptModelLauncher} from '../packages/harness-core/model-adapters.js';
import {listAgents, resolveAgent, claudeAllowedTools} from '../packages/harness-core/agents.js';
import {nextCliCommand} from '../packages/harness-core/next-command.js';

async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), 'hh-adapters-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  return directory;
}

const canonical = cwd => ['exec', '-C', cwd, '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '--json', '-o', join(cwd, 'result.json'), '-i', join(cwd, 'before/a.png'), '-m', 'some-model', '--', '-'];
const defaultModel = cwd => canonical(cwd).filter((_,index,args)=>index!==args.indexOf('-m')&&index!==args.indexOf('-m')+1);

test('canonical model requests are parsed into an agent-neutral shape', () => {
  const request = parseCanonical(canonical('/s'));
  assert.equal(request.cwd, '/s');
  assert.equal(request.sandbox, 'read-only');
  assert.equal(request.resultFile, join('/s', 'result.json'));
  assert.deepEqual(request.images, [join('/s', 'before/a.png')]);
  assert.equal(request.model, 'some-model');
});

test('final JSON is extracted from plain, fenced or wrapped replies and anything else is refused', () => {
  assert.deepEqual(extractJsonObject('{"a":1}'), {a: 1});
  assert.deepEqual(extractJsonObject('Here:\n```json\n{"a":2}\n```'), {a: 2});
  assert.deepEqual(extractJsonObject('Result {"a":3} done'), {a: 3});
  assert.throws(() => extractJsonObject('[1,2]'), /JSON object/);
  assert.throws(() => extractJsonObject('no json'), /JSON object/);
});

test('Codex pins the inspected default and rejects a model with text-only metadata', async () => {
  const calls=[];
  const launch=adaptModelLauncher((...args)=>calls.push(args),'codex',{inspectCodex:async(_command,_cwd,model)=>({
    model:model||'fixture-default',modalities:model?['text']:['text','image']
  })});
  const args=defaultModel('/s');
  await launch('codex',args,{input:'review'});
  assert.deepEqual(calls,[['codex',[...args.slice(0,-2),'-m','fixture-default','--','-'],{input:'review'}]]);
  await assert.rejects(launch('codex',canonical('/s')), {code:'MODEL_VISION_NOT_READY'});
  assert.equal(calls.length,1);
});

test('Claude Code read-only review: dontAsk, images in the prompt, result file and Codex-shaped usage', async t => {
  const cwd = await temporary(t);
  const calls = [], forwarded = [];
  const generate = async (command, argv, options) => {
    calls.push({command, argv, options});
    options.onOutput('warning on stderr\n');
    options.onOutput(JSON.stringify({type: 'result', subtype: 'success', is_error: false, result: '```json\n{"verdict":"pass"}\n```', usage: {input_tokens: 10, cache_read_input_tokens: 90, cache_creation_input_tokens: 0, output_tokens: 5}}) + '\n');
  };
  const launch = adaptModelLauncher(generate, 'claude-code');
  const declared=process.env.HAPPYHANDS_CLI_VISION_MODELS;
  process.env.HAPPYHANDS_CLI_VISION_MODELS='some-model';
  t.after(()=>{if(declared===undefined)delete process.env.HAPPYHANDS_CLI_VISION_MODELS;else process.env.HAPPYHANDS_CLI_VISION_MODELS=declared;});
  await launch('codex', canonical(cwd), {input: 'PROMPT', onOutput: chunk => forwarded.push(chunk)});
  const [call] = calls;
  assert.equal(call.command, 'claude');
  assert.ok(call.argv.includes('-p'));
  assert.equal(call.argv[call.argv.indexOf('--permission-mode') + 1], 'dontAsk');
  assert.ok(call.argv.includes('--disallowed-tools') && call.argv.includes('Bash') && call.argv.includes('Edit'));
  assert.equal(call.argv[call.argv.indexOf('--model') + 1], 'some-model');
  assert.ok(!call.argv.includes('-i'), 'Codex image flags are not passed to Claude Code');
  assert.ok(call.options.input.startsWith('PROMPT'));
  assert.ok(call.options.input.includes(join(cwd, 'before/a.png')));
  assert.match(call.options.input, /never print or paste their bytes/);
  assert.deepEqual(JSON.parse(await readFile(join(cwd, 'result.json'), 'utf8')), {verdict: 'pass'});
  const usage = JSON.parse(forwarded.join('').trim());
  assert.deepEqual(usage, {type: 'turn.completed', usage: {input_tokens: 100, cached_input_tokens: 90, output_tokens: 5}});
});

test('Claude Code adds --bare only with an API key, because bare mode refuses OAuth login', async t => {
  const cwd = await temporary(t);
  const seen = [];
  const generate = async (_c, argv, options) => { seen.push(argv); options.onOutput(JSON.stringify({type: 'result', subtype: 'success', result: '{}', usage: {}}) + '\n'); };
  const saved = process.env.ANTHROPIC_API_KEY;
  const savedDefault=process.env.HAPPYHANDS_CLAUDE_VISION_MODEL;
  process.env.HAPPYHANDS_CLAUDE_VISION_MODEL='fixture-claude';
  t.after(()=>{if(savedDefault===undefined)delete process.env.HAPPYHANDS_CLAUDE_VISION_MODEL;else process.env.HAPPYHANDS_CLAUDE_VISION_MODEL=savedDefault;});
  t.after(() => { if (saved === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved; });
  delete process.env.ANTHROPIC_API_KEY;
  await adaptModelLauncher(generate, 'claude-code')('codex', defaultModel(cwd), {input: ''});
  process.env.ANTHROPIC_API_KEY = 'test-key';
  await adaptModelLauncher(generate, 'claude-code')('codex', defaultModel(cwd), {input: ''});
  assert.ok(!seen[0].includes('--bare'));
  assert.ok(seen[1].includes('--bare'));
  assert.equal(seen[1][seen[1].indexOf('--model')+1],'fixture-claude');
  const execution = resolveAgent('claude-code').argv({model: 'm', readDirs: ['/guidance']});
  assert.ok(execution.includes('--bare'));
});

test('Claude Code execution can run project checks, cannot publish, and can read guidance snapshots', () => {
  const argv = resolveAgent('claude-code').argv({model: 'm', readDirs: ['/guidance']});
  const allowed = argv.slice(argv.indexOf('--allowed-tools') + 1, argv.indexOf('--disallowed-tools'));
  assert.ok(allowed.includes('Bash(npm test:*)') && allowed.includes('Edit'));
  assert.ok(argv.includes('Bash(git push:*)') && argv.includes('Bash(npm publish:*)'));
  assert.deepEqual(argv.slice(argv.indexOf('--add-dir'), argv.indexOf('--add-dir') + 2), ['--add-dir', '/guidance']);
  assert.ok(claudeAllowedTools({HAPPYHANDS_CLAUDE_ALLOWED_TOOLS: 'Bash(cargo test:*)'}).includes('Bash(cargo test:*)'));
});

test('a CLI declared in agents.json executes, reviews and must state every boundary clause', async t => {
  const directory = await temporary(t);
  const agentsFile = join(directory, 'agents.json');
  const satisfies = {nonInteractive: 'a', worktreeOnly: 'b', noRepoInstructions: 'c', noPublish: 'd', bounded: 'e'};
  await writeFile(agentsFile, JSON.stringify({agents: {
    mycli: {command: 'mycli', execute: {argv: ['run', '--cwd', '{worktree}', '--prompt-file', '{promptFile}'], promptVia: 'file', modelFlag: ['--model', '{model}']}, model: {argv: ['ask', '--cwd', '{cwd}'], imageFlag: '--image', defaultModel:'some-model', visionModels:['some-model'], modelFlag:['--model','{model}']}, satisfies},
    partial: {command: 'partial', execute: {argv: []}, satisfies: {nonInteractive: 'a'}}
  }}));
  assert.ok(listAgents({agentsFile}).some(agent => agent.id === 'mycli' && agent.verified === 'declared'));
  const agent = resolveAgent('mycli', {agentsFile});
  assert.equal(agent.promptVia, 'file');
  assert.deepEqual(agent.argv({worktree: '/w', promptFile: '/p.txt', model: 'x'}), ['run', '--cwd', '/w', '--prompt-file', '/p.txt', '--model', 'x']);
  assert.throws(() => resolveAgent('partial', {agentsFile}), /does not state how it meets/);
  assert.throws(() => resolveAgent('missing', {agentsFile}), /Unknown agent/);

  const cwd = await temporary(t);
  const calls = [];
  const generate = async (command, argv, options) => { calls.push({command, argv}); options.onOutput('thinking...\n{"verdict":"fail"}\n'); };
  await adaptModelLauncher(generate, 'mycli', {agentsFile})('codex', defaultModel(cwd), {input: 'P'});
  assert.equal(calls[0].command, 'mycli');
  assert.deepEqual(calls[0].argv, ['ask', '--cwd', cwd, '--image', join(cwd, 'before/a.png'), '--model','some-model']);
  assert.deepEqual(JSON.parse(await readFile(join(cwd, 'result.json'), 'utf8')), {verdict: 'fail'});
});

test('Codex-only features fail clearly on other adapters instead of silently degrading', async t => {
  const cwd = await temporary(t);
  const launch = adaptModelLauncher(async () => {}, 'claude-code');
  await assert.rejects(launch('codex', ['exec', '-C', cwd, '-s', 'workspace-write', '--enable', 'image_generation', '-'], {input: ''}), /use --agent codex/);
});

test('next returns runnable CLI commands that exist, with the ledger values filled in', async () => {
  const source = await readFile(new URL('../scripts/harness.mjs', import.meta.url), 'utf8');
  const commands = new Set([...source.matchAll(/^\s*\['([a-z-]+)', '[^']*'\],?$/gm)].map(match => match[1]));
  assert.ok(commands.has('execute') && commands.has('model-review'));
  const manifest = {onboarding: {repository: {root: '/repo'}}, confirmation: {findingId: 'F2'}, execution: {worktree: '/run/worktree'}};
  const stages = ['needs-baseline', 'needs-experience-audit', 'needs-diagnosis', 'awaiting-confirmation', 'needs-design-decision', 'needs-plan', 'needs-first-render-plan', 'needs-execution', 'needs-after-capture', 'needs-structural-evaluation', 'needs-specialist-verification', 'needs-visual-qa', 'awaiting-judgment', 'visual-qa-failed', 'needs-absent-baseline', 'needs-foundation-approval'];
  for (const stage of stages) {
    const cli = nextCliCommand({stage}, manifest, '/run');
    assert.ok(cli.steps.length, stage);
    for (const step of [...cli.steps, ...(cli.alternatives || [])]) {
      assert.ok(commands.has(step.argv[0]), `${stage}: ${step.argv[0]} is a CLI command`);
      assert.deepEqual(step.argv.slice(1, 3), ['--run', '/run']);
      for (const token of step.argv) if (/^[A-Z][A-Z_]+$/.test(token)) assert.ok(step.needs[token], `${stage}: ${token} is explained`);
    }
  }
  assert.deepEqual(nextCliCommand({stage: 'needs-execution'}, manifest, '/run').steps[0].argv.slice(3, 5), ['--repo', '/repo']);
  const auditStage = {stage: 'needs-experience-audit'};
  assert.equal(nextCliCommand(auditStage, manifest, '/run').steps[0].argv.at(-1), 'SURFACE');
  const publicSite = {...manifest, onboarding: {...manifest.onboarding, config: {designGuidance: {taste: 'public-page'}}}};
  const nextAudit = nextCliCommand(auditStage, publicSite, '/run');
  assert.deepEqual(nextAudit.steps.map(item => item.argv), [
    ...['inspect', 'method', 'record'].map(name => ['experience', '--run', '/run', '--phase', 'context', '--step', name, '--surface', 'public-page']),
    ['experience', '--run', '/run', '--phase', 'audit', '--input', 'AUDIT_JSON']
  ]);
  assert.match(nextAudit.before, /--topic TOPIC/);
  for (const item of nextAudit.steps.slice(0, 3)) assert.deepEqual(item.needs, {});
  assert.deepEqual(nextCliCommand({stage: 'needs-design-decision'}, manifest, '/run').steps.map(step=>step.argv), [
    ['experience', '--run', '/run', '--phase', 'context'],
    ['experience', '--run', '/run', '--phase', 'decision', '--input', 'DECISION_JSON']
  ]);
  assert.deepEqual(nextCliCommand({stage: 'needs-plan'}, manifest, '/run').steps[0].argv.slice(3), ['--finding', 'F2']);
  assert.equal(nextCliCommand({stage: 'awaiting-judgment'}, manifest, '/run').actor, 'user');
  assert.equal(nextCliCommand({stage: 'needs-specialist-verification'}, manifest, '/run').steps[0].argv[0], 'verify');
  const specialist = {stage:'needs-specialist-verification'};
  assert.deepEqual(nextCliCommand(specialist,{onboarding:{config:{configPath:'/project.json'}}},'/run').steps[0].argv,
    ['verify','--run','/run','--config','/project.json']);
  assert.deepEqual(nextCliCommand(specialist,{onboarding:{config:{configPath:'/project.json',start:{command:'node'}}}},'/run').steps[0].argv,
    ['verify','--run','/run','--managed','true']);
});
