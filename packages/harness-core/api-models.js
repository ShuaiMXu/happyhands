// Read-only model calls straight to a model API, with no agent CLI installed.
//
// The Harness prompts point at files in the session folder (staged guidance,
// review-context.json, schemas). A CLI agent opens them with its own tools; an
// API model gets one tool, `read_file`, confined to that folder. Screenshots
// are sent as real image content blocks, never as text, which is the token
// leak issue #34 described.
//
// Providers:
//   anthropic           official @anthropic-ai/sdk, Messages API
//   openai-compatible   POST {baseUrl}/chat/completions; covers OpenAI and any
//                       service with that request shape (DeepSeek, Kimi, Qwen,
//                       OpenRouter, a local Ollama, ...)

import {readFile, realpath} from 'node:fs/promises';
import {extname, isAbsolute, join, relative} from 'node:path';

const MAX_TURNS = 40;
const MAX_READ_CHARS = 60000;

const READ_FILE = {
  name: 'read_file',
  description: 'Read a UTF-8 text file from the review session folder. Paths are relative to that folder or absolute inside it. Use offset/limit (1-based line numbers) to read only the section you need. Images are already attached to the conversation and cannot be read here.',
  schema: {
    type: 'object',
    properties: {
      path: {type: 'string', description: 'File path inside the session folder.'},
      offset: {type: 'integer', description: 'First line to return, 1-based. Optional.'},
      limit: {type: 'integer', description: 'Number of lines to return. Optional.'}
    },
    required: ['path'],
    additionalProperties: false
  }
};

const IMAGE_TYPES = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif'};

export async function readSessionFile(root, input) {
  if (!input || typeof input.path !== 'string' || !input.path) return {error: 'path must be a non-empty string.'};
  for (const key of ['offset', 'limit']) {
    if (input[key] !== undefined && (!Number.isInteger(input[key]) || input[key] < 1)) return {error: `${key} must be a positive integer.`};
  }
  if (IMAGE_TYPES[extname(input.path).toLowerCase()]) return {error: 'Images are already attached to this conversation; look at them there.'};
  let file;
  try {
    const base = await realpath(root);
    file = await realpath(isAbsolute(input.path) ? input.path : join(base, input.path));
    const delta = relative(base, file);
    if (delta.startsWith('..') || isAbsolute(delta)) return {error: 'Only files inside the session folder can be read.'};
  } catch {
    return {error: `No such file: ${input.path}`};
  }
  const lines = (await readFile(file, 'utf8')).split('\n');
  const start = (input.offset || 1) - 1;
  const slice = lines.slice(start, input.limit ? start + input.limit : undefined).join('\n');
  const truncated = slice.length > MAX_READ_CHARS;
  return {
    content: (truncated ? slice.slice(0, MAX_READ_CHARS) : slice) +
      (truncated ? `\n[truncated at ${MAX_READ_CHARS} characters; ${lines.length} lines in file. Read further with offset/limit.]` : '')
  };
}

async function imageParts(images) {
  const parts = [];
  for (const path of images) {
    const mediaType = IMAGE_TYPES[extname(path).toLowerCase()];
    if (!mediaType) throw Error(`Unsupported image type: ${path}`);
    parts.push({path, mediaType, data: (await readFile(path)).toString('base64')});
  }
  return parts;
}

const SYSTEM = 'You are a read-only reviewer inside the HappyHands harness. You cannot edit anything. Use read_file to open the files the instructions name, reading only the sections you need. Your final message must be the single JSON object the instructions ask for.';

// Opus/Fable/Sonnet 5.x refusals can be rescued server side; other models run without it.
const FALLBACK_MODELS = new Set(['claude-fable-5-2', 'claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);

async function runAnthropic({config, prompt, images, cwd, signal}) {
  const {default: Anthropic} = await import('@anthropic-ai/sdk');
  const client = new Anthropic({...(config.apiKey ? {apiKey: config.apiKey} : {}), ...(config.baseUrl ? {baseURL: config.baseUrl} : {})});
  const content = [];
  for (const image of await imageParts(images)) {
    content.push({type: 'text', text: `Image: ${image.path}`});
    content.push({type: 'image', source: {type: 'base64', media_type: image.mediaType, data: image.data}});
  }
  content.push({type: 'text', text: prompt});
  const messages = [{role: 'user', content}];
  const usage = {input_tokens: 0, cached_input_tokens: 0, output_tokens: 0};
  const fallback = FALLBACK_MODELS.has(config.model);
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const message = await client.beta.messages.stream({
      model: config.model,
      max_tokens: 64000,
      system: SYSTEM,
      // The tool loop resends the whole conversation; caching keeps the
      // screenshots and prompt from being billed in full on every turn.
      cache_control: {type: 'ephemeral'},
      output_config: {effort: config.effort || 'high'},
      tools: [{name: READ_FILE.name, description: READ_FILE.description, input_schema: READ_FILE.schema, eager_input_streaming: true}],
      messages,
      ...(fallback ? {betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default'} : {})
    }, {signal}).finalMessage();
    const u = message.usage || {};
    usage.input_tokens += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    usage.cached_input_tokens += u.cache_read_input_tokens || 0;
    usage.output_tokens += u.output_tokens || 0;
    if (message.stop_reason === 'refusal') throw Error(`The model declined the review${message.stop_details?.category ? ` (${message.stop_details.category})` : ''}.`);
    if (message.stop_reason === 'max_tokens') throw Error('The model reached its output limit before finishing.');
    messages.push({role: 'assistant', content: message.content});
    if (message.stop_reason === 'pause_turn') continue;
    const calls = message.content.filter(block => block.type === 'tool_use');
    if (message.stop_reason !== 'tool_use' || !calls.length) {
      return {text: message.content.filter(block => block.type === 'text').map(block => block.text).join('\n'), usage};
    }
    const results = [];
    for (const call of calls) {
      // Streamed tool input is not validated by the API; readSessionFile checks every field.
      const result = call.name === READ_FILE.name ? await readSessionFile(cwd, call.input) : {error: `Unknown tool ${call.name}.`};
      results.push({type: 'tool_result', tool_use_id: call.id, content: result.error ?? result.content, ...(result.error ? {is_error: true} : {})});
    }
    messages.push({role: 'user', content: results});
  }
  throw Error(`The model did not finish within ${MAX_TURNS} turns.`);
}

async function runOpenAiCompatible({config, prompt, images, cwd, signal}) {
  if (!config.baseUrl) throw Error('An OpenAI-compatible provider needs a base URL.');
  const content = [];
  for (const image of await imageParts(images)) {
    content.push({type: 'text', text: `Image: ${image.path}`});
    content.push({type: 'image_url', image_url: {url: `data:${image.mediaType};base64,${image.data}`}});
  }
  content.push({type: 'text', text: prompt});
  const messages = [{role: 'system', content: SYSTEM}, {role: 'user', content}];
  const tools = [{type: 'function', function: {name: READ_FILE.name, description: READ_FILE.description, parameters: READ_FILE.schema}}];
  const usage = {input_tokens: 0, cached_input_tokens: 0, output_tokens: 0};
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await fetch(config.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      signal,
      headers: {'content-type': 'application/json', ...(config.apiKey ? {authorization: `Bearer ${config.apiKey}`} : {})},
      body: JSON.stringify({model: config.model, messages, tools})
    });
    const body = await response.text();
    if (!response.ok) throw Error(`Model API returned HTTP ${response.status}: ${body.slice(0, 1000)}`);
    const data = JSON.parse(body);
    const u = data.usage || {};
    usage.input_tokens += u.prompt_tokens || 0;
    usage.cached_input_tokens += u.prompt_tokens_details?.cached_tokens || 0;
    usage.output_tokens += u.completion_tokens || 0;
    const choice = data.choices?.[0];
    if (!choice?.message) throw Error('Model API returned no message.');
    if (choice.finish_reason === 'length') throw Error('The model reached its output limit before finishing.');
    const calls = choice.message.tool_calls || [];
    messages.push(choice.message);
    if (!calls.length) {
      const text = Array.isArray(choice.message.content) ? choice.message.content.map(part => part.text || '').join('\n') : choice.message.content;
      return {text: text || '', usage};
    }
    for (const call of calls) {
      let input = null;
      try { input = JSON.parse(call.function?.arguments || '{}'); } catch { /* reported below */ }
      const result = call.function?.name !== READ_FILE.name ? {error: `Unknown tool ${call.function?.name}.`}
        : input ? await readSessionFile(cwd, input) : {error: 'Tool arguments were not valid JSON.'};
      messages.push({role: 'tool', tool_call_id: call.id, content: result.error ? `Error: ${result.error}` : result.content});
    }
  }
  throw Error(`The model did not finish within ${MAX_TURNS} turns.`);
}

export async function runApiModel(options) {
  if (!options.config?.model) throw Error('Set a model: --model ID, HAPPYHANDS_API_MODEL, or "model" in the agents.json "api" entry.');
  return options.config.provider === 'anthropic' ? runAnthropic(options) : runOpenAiCompatible(options);
}

// Built-in API adapter IDs and how each reads its configuration.
//   --agent anthropic   ANTHROPIC_API_KEY (or the SDK's usual credential chain), model defaults to claude-opus-5-5
//   --agent openai      OPENAI_API_KEY, https://api.openai.com/v1
//   --agent api         HAPPYHANDS_API_PROVIDER (openai-compatible|anthropic), HAPPYHANDS_API_BASE_URL,
//                       HAPPYHANDS_API_KEY, HAPPYHANDS_API_MODEL; for any other service
export function builtInApiConfig(id, env = process.env) {
  const model = env.HAPPYHANDS_API_MODEL;
  if (id === 'anthropic') return {provider: 'anthropic', apiKey: env.HAPPYHANDS_API_KEY || env.ANTHROPIC_API_KEY, baseUrl: env.HAPPYHANDS_API_BASE_URL, model: model || 'claude-opus-5-5'};
  if (id === 'openai') return {provider: 'openai-compatible', apiKey: env.HAPPYHANDS_API_KEY || env.OPENAI_API_KEY, baseUrl: env.HAPPYHANDS_API_BASE_URL || 'https://api.openai.com/v1', model};
  if (id === 'api') {
    const provider = env.HAPPYHANDS_API_PROVIDER === 'anthropic' ? 'anthropic' : 'openai-compatible';
    return provider === 'anthropic' ? builtInApiConfig('anthropic', env) : {provider, apiKey: env.HAPPYHANDS_API_KEY, baseUrl: env.HAPPYHANDS_API_BASE_URL, model};
  }
  return null;
}

// A declared agent with an "api" block: {"provider", "baseUrl", "apiKeyEnv", "model", "effort"}.
export function declaredApiConfig(spec, env = process.env) {
  const api = spec.api;
  if (!api || typeof api !== 'object') return null;
  const provider = api.provider === 'anthropic' ? 'anthropic' : 'openai-compatible';
  return {provider, baseUrl: api.baseUrl, apiKey: api.apiKeyEnv ? env[api.apiKeyEnv] : undefined, model: api.model, effort: api.effort};
}

// API first: when an API is configured for HappyHands and no adapter is named,
// the read-only model steps use it instead of a CLI.
export function defaultModelAgent(env = process.env) {
  if (env.HAPPYHANDS_MODEL_AGENT) return env.HAPPYHANDS_MODEL_AGENT;
  if (env.HAPPYHANDS_API_PROVIDER || env.HAPPYHANDS_API_MODEL || env.HAPPYHANDS_API_BASE_URL) return 'api';
  return 'codex';
}
