// Read-only model calls (baseline diagnosis, visual review, pattern review) are
// authored once against one canonical request: the `codex exec` argument shape
// the Harness has always used. This module translates that request for the CLI
// the operator selected, so every call site stays agent-neutral and the Codex
// path stays byte-for-byte what it was.
//
// Select the model CLI with `--agent ID` on model-diagnose/model-review, or with
// HAPPYHANDS_MODEL_AGENT for the workbench. Further CLIs are declared in a JSON
// file (see loadCustomAgents in agents.js) without code changes.

import {readFile, writeFile} from 'node:fs/promises';
import {customAgent, claudeCanRunBare} from './agents.js';
import {runApiModel, builtInApiConfig, declaredApiConfig, defaultModelAgent} from './api-models.js';

export const DEFAULT_MODEL_AGENT = 'codex';
export {defaultModelAgent};

// Flags of the canonical request that carry a value.
const VALUE_FLAGS = new Set(['-C', '-s', '-o', '-i', '--image', '--output-schema', '-m', '-c', '--enable']);

export function parseCanonical(args) {
  if (args[0] !== 'exec') throw Error('Canonical model request must start with exec.');
  const request = {cwd: null, sandbox: 'read-only', resultFile: null, schemaFile: null, images: [], model: null, enable: []};
  for (let index = 1; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--' || flag === '-') break;
    if (!VALUE_FLAGS.has(flag)) continue; // --json, --ephemeral, --skip-git-repo-check: Codex-only switches
    const value = args[++index];
    if (value === undefined) throw Error(`Canonical model request is missing a value for ${flag}.`);
    if (flag === '-C') request.cwd = value;
    else if (flag === '-s') request.sandbox = value;
    else if (flag === '-o') request.resultFile = value;
    else if (flag === '-i' || flag === '--image') request.images.push(value);
    else if (flag === '--output-schema') request.schemaFile = value;
    else if (flag === '-m') request.model = value;
    else if (flag === '--enable') request.enable.push(value);
  }
  return request;
}

// Extract one JSON object from a final assistant message. Models often wrap it
// in a fence or a sentence; anything that is not a single object is rejected
// rather than guessed at.
export function extractJsonObject(text) {
  const trimmed = String(text ?? '').trim();
  const candidates = [trimmed];
  const fence = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fence) candidates.push(fence[1].trim());
  const first = trimmed.indexOf('{'), last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    } catch { /* try the next shape */ }
  }
  throw Error('The model did not return a JSON object as its final message.');
}

async function outputContract(request) {
  const lines = [];
  if (request.images.length) {
    lines.push(`\n\nIMAGE INPUTS. Open every image below with your file/image reading tool before judging. They are binary PNG files: view them as images, never print or paste their bytes as text.\n${request.images.join('\n')}`);
  }
  if (request.schemaFile) {
    lines.push(`\n\nOUTPUT SCHEMA (JSON Schema, follow exactly):\n${await readFile(request.schemaFile, 'utf8')}`);
  }
  if (request.resultFile) {
    lines.push('\n\nFINAL MESSAGE CONTRACT. Your final message must be exactly one JSON object and nothing else: no prose, no code fence.');
  }
  return lines.join('');
}

const claudeCode = {
  id: 'claude-code',
  label: 'Claude Code',
  command: 'claude',
  argv(request) {
    const writable = request.sandbox !== 'read-only';
    return [
      '-p', '--output-format', 'stream-json', '--verbose',
      // dontAsk denies every tool that is not explicitly allowed, so a read-only
      // review cannot edit even if the prompt is subverted.
      '--permission-mode', writable ? 'acceptEdits' : 'dontAsk',
      '--allowed-tools', 'Read', 'Glob', 'Grep', ...(writable ? ['Edit', 'Write'] : []),
      '--disallowed-tools', 'Bash', 'WebFetch', 'WebSearch', ...(writable ? [] : ['Edit', 'Write', 'NotebookEdit']),
      // --bare skips CLAUDE.md, hooks and plugins, but it also refuses OAuth
      // login. Use it only when an API key is available.
      ...(claudeCanRunBare() ? ['--bare'] : []),
      ...(request.model ? ['--model', request.model] : [])
    ];
  },
  imagesInPrompt: true,
  // stream-json emits one event per line; the last `result` event carries the
  // final message and token usage.
  finish(stdoutLines) {
    let result = null;
    for (const line of stdoutLines) {
      try { const event = JSON.parse(line); if (event?.type === 'result') result = event; } catch { /* stderr or partial line */ }
    }
    if (!result) throw Error('Claude Code produced no result event.');
    if (result.is_error || result.subtype !== 'success') throw Error(`Claude Code ended with ${result.subtype || 'an error'}.`);
    const usage = result.usage || {};
    const cached = (usage.cache_read_input_tokens || 0);
    const input = (usage.input_tokens || 0) + cached + (usage.cache_creation_input_tokens || 0);
    return {text: result.result, usage: {input_tokens: input, cached_input_tokens: cached, output_tokens: usage.output_tokens || 0}};
  }
};

function customModelAdapter(agent) {
  const spec = agent.model;
  if (!spec || !Array.isArray(spec.argv)) throw Error(`Agent "${agent.id}" declares no read-only "model" invocation.`);
  return {
    id: agent.id,
    label: agent.label || agent.id,
    command: agent.command,
    argv(request) {
      const fill = token => token
        .replaceAll('{cwd}', request.cwd || '')
        .replaceAll('{resultFile}', request.resultFile || '')
        .replaceAll('{schemaFile}', request.schemaFile || '');
      const argv = spec.argv.map(fill);
      if (spec.imageFlag) for (const image of request.images) argv.push(spec.imageFlag, image);
      if (request.model && Array.isArray(spec.modelFlag)) argv.push(...spec.modelFlag.map(token => token.replaceAll('{model}', request.model)));
      return argv;
    },
    imagesInPrompt: !spec.imageFlag,
    finish(stdoutLines) {
      return {text: stdoutLines.join('\n'), usage: null};
    }
  };
}

export function resolveModelAdapter(id = defaultModelAgent(), {agentsFile} = {}) {
  const api = builtInApiConfig(id);
  if (api) return {id, label: `${id} API`, api};
  if (id === 'codex') return {id: 'codex', label: 'Codex', command: process.env.WORKBENCH_CODEX || 'codex', passthrough: true};
  if (id === 'claude-code') return {...claudeCode, command: process.env.HAPPYHANDS_CLAUDE || claudeCode.command};
  return {resolveCustom: true, id, agentsFile};
}

async function adapterFor(id, options) {
  const adapter = resolveModelAdapter(id, options);
  if (!adapter.resolveCustom) return adapter;
  const spec = await customAgent(id, options);
  const api = declaredApiConfig(spec);
  if (api) return {id, label: spec.label || `${id} API`, api};
  return customModelAdapter(spec);
}

// Wrap a process launcher (`runLocal` or a test double) so that canonical
// requests run through the selected adapter. The wrapped function keeps the
// launcher's signature, so call sites do not change.
export function adaptModelLauncher(generate, id = defaultModelAgent(), options = {}) {
  if (id === 'codex') return generate;
  return async (_command, args, launchOptions = {}) => {
    const adapter = await adapterFor(id, options);
    if (adapter.passthrough) return generate(adapter.command, args, launchOptions);
    const request = parseCanonical(args);
    if (adapter.api) return runApiRequest(adapter, request, launchOptions);
    if (request.enable.length) throw Error(`${adapter.label} cannot run Codex feature "${request.enable.join(', ')}"; use --agent codex for this step.`);
    const input = String(launchOptions.input ?? '') + (adapter.imagesInPrompt === false ? await outputContract({...request, images: []}) : await outputContract(request));
    let tail = '';
    const lines = [];
    const onOutput = chunk => {
      tail += String(chunk);
      const parts = tail.split('\n');
      tail = parts.pop();
      lines.push(...parts);
    };
    await generate(adapter.command, adapter.argv(request), {...launchOptions, cwd: request.cwd || launchOptions.cwd, input, onOutput});
    if (tail) lines.push(tail);
    const {text, usage} = adapter.finish(lines);
    // Cost accounting reads Codex `turn.completed` usage events; emit the
    // translated usage in that shape so budgets keep working.
    if (usage) launchOptions.onOutput?.(JSON.stringify({type: 'turn.completed', usage}) + '\n');
    else launchOptions.onOutput?.(lines.join('\n') + '\n');
    if (request.resultFile) await writeFile(request.resultFile, JSON.stringify(extractJsonObject(text), null, 2));
    return text;
  };
}

async function runApiRequest(adapter, request, launchOptions) {
  if (request.enable.length || request.sandbox !== 'read-only') throw Error(`${adapter.label} runs read-only model steps only; use --agent codex for "${request.enable.join(', ') || request.sandbox}".`);
  const config = {...adapter.api, ...(request.model ? {model: request.model} : {})};
  const prompt = String(launchOptions.input ?? '') + await outputContract({...request, images: []}) +
    (request.images.length ? '\n\nThe screenshots are attached to this conversation as image inputs, each labelled with its path.' : '');
  const {text, usage} = await runApiModel({config, prompt, images: request.images, cwd: request.cwd || launchOptions.cwd, signal: launchOptions.signal});
  launchOptions.onOutput?.(JSON.stringify({type: 'turn.completed', usage}) + '\n');
  if (request.resultFile) await writeFile(request.resultFile, JSON.stringify(extractJsonObject(text), null, 2));
  return text;
}
