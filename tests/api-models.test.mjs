import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readSessionFile, runApiModel, defaultModelAgent} from '../packages/harness-core/api-models.js';
import {adaptModelLauncher} from '../packages/harness-core/model-adapters.js';

// 1x1 transparent PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

async function session(t) {
  const cwd = await mkdtemp(join(tmpdir(), 'hh-api-'));
  t.after(() => rm(cwd, {recursive: true, force: true}));
  await mkdir(join(cwd, 'before'));
  await writeFile(join(cwd, 'before/desktop.png'), PNG);
  await writeFile(join(cwd, 'review-context.json'), '{"task":"sign up"}\nline two\nline three');
  return cwd;
}

async function mockServer(t, handler) {
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({url: request.url, headers: request.headers, body: body ? JSON.parse(body) : null});
    handler(requests.length, request, response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return {url: `http://127.0.0.1:${server.address().port}`, requests};
}

const sse = (response, events) => {
  response.writeHead(200, {'content-type': 'text/event-stream'});
  for (const event of events) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  response.end();
};

test('read_file stays inside the session folder, supports sections and refuses images', async t => {
  const cwd = await session(t);
  assert.equal((await readSessionFile(cwd, {path: 'review-context.json', offset: 2, limit: 1})).content, 'line two');
  assert.match((await readSessionFile(cwd, {path: '../outside.txt'})).error, /No such file|inside the session/);
  assert.match((await readSessionFile(cwd, {path: join(tmpdir(), 'x.txt')})).error, /No such file|inside the session/);
  assert.match((await readSessionFile(cwd, {path: 'before/desktop.png'})).error, /already attached/);
  assert.match((await readSessionFile(cwd, {path: 'review-context.json', offset: 0})).error, /positive integer/);
});

test('API first: a configured HappyHands API is the default model adapter, an explicit choice wins', () => {
  assert.equal(defaultModelAgent({}), 'codex');
  assert.equal(defaultModelAgent({HAPPYHANDS_API_MODEL: 'm'}), 'api');
  assert.equal(defaultModelAgent({HAPPYHANDS_API_MODEL: 'm', HAPPYHANDS_MODEL_AGENT: 'claude-code'}), 'claude-code');
});

test('read_file pages the selected lines without losing newlines or splitting Unicode characters', async t => {
  const cwd = await session(t);
  const selected = 'x'.repeat(59999) + '🌐' + '\r\n' + '模型'.repeat(31000) + '\r';
  const path = 'context.txt';
  await writeFile(join(cwd, path), 'ignored\n' + selected + '\nignore this too');
  const query = {path, offset: 2, limit: 2};
  const first = await readSessionFile(cwd, query);
  assert.deepEqual(first.next, {...query, cursor: 59999});
  const second = await readSessionFile(cwd, first.next);
  assert.ok(second.content.startsWith('🌐\r\n'));
  const last = await readSessionFile(cwd, second.next);
  assert.equal(last.next, null);
  assert.equal(first.content + second.content + last.content, selected);
  for (const cursor of [-1, 0.5, '1', 60000, selected.length + 1]) {
    assert.match((await readSessionFile(cwd, {...query, cursor})).error, /cursor/);
  }
});

test('OpenAI-compatible provider: image parts, read_file tool loop and summed usage', async t => {
  const cwd = await session(t);
  const server = await mockServer(t, (count, _request, response) => {
    response.writeHead(200, {'content-type': 'application/json'});
    response.end(JSON.stringify(count === 1
      ? {choices: [{finish_reason: 'tool_calls', message: {role: 'assistant', content: null, tool_calls: [{id: 'c1', type: 'function', function: {name: 'read_file', arguments: '{"path":"review-context.json","limit":1}'}}]}}], usage: {prompt_tokens: 100, completion_tokens: 5, prompt_tokens_details: {cached_tokens: 0}}}
      : {choices: [{finish_reason: 'stop', message: {role: 'assistant', content: '{"verdict":"pass"}'}}], usage: {prompt_tokens: 120, completion_tokens: 9, prompt_tokens_details: {cached_tokens: 100}}}));
  });
  const result = await runApiModel({config: {provider: 'openai-compatible', baseUrl: server.url + '/v1', apiKey: 'test-key', model: 'some-vision-model', visionModels:['some-vision-model']}, prompt: 'Review it.', images: [join(cwd, 'before/desktop.png')], cwd});
  assert.equal(result.text, '{"verdict":"pass"}');
  assert.deepEqual(result.usage, {input_tokens: 220, cached_input_tokens: 100, output_tokens: 14});
  const [first, second] = server.requests;
  assert.equal(first.url, '/v1/chat/completions');
  assert.equal(first.headers.authorization, 'Bearer test-key');
  const parts = first.body.messages[1].content;
  assert.ok(parts.some(part => part.type === 'image_url' && part.image_url.url.startsWith('data:image/png;base64,')));
  assert.ok(!JSON.stringify(parts.filter(part => part.type === 'text')).includes(PNG.toString('base64')), 'image bytes never travel as text');
  assert.deepEqual(second.body.messages.at(-1), {role: 'tool', tool_call_id: 'c1', content: '{"task":"sign up"}'});
});

test('Anthropic provider uses the official SDK: image blocks, caching, fallbacks and the tool loop', async t => {
  const cwd = await session(t);
  const firstPage = 'a'.repeat(60000);
  await writeFile(join(cwd, 'review-context.json'), firstPage + 'tail');
  const usage = {input_tokens: 10, output_tokens: 1, cache_read_input_tokens: 90, cache_creation_input_tokens: 0};
  const start = {type: 'message_start', message: {id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage}};
  const server = await mockServer(t, (count, _request, response) => sse(response, count === 1 ? [
    start,
    {type: 'content_block_start', index: 0, content_block: {type: 'tool_use', id: 'toolu_1', name: 'read_file', input: {}}},
    {type: 'content_block_delta', index: 0, delta: {type: 'input_json_delta', partial_json: '{"path":"review-context.json","limit":1}'}},
    {type: 'content_block_stop', index: 0},
    {type: 'message_delta', delta: {stop_reason: 'tool_use', stop_sequence: null}, usage: {output_tokens: 7}},
    {type: 'message_stop'}
  ] : [
    start,
    {type: 'content_block_start', index: 0, content_block: {type: 'text', text: ''}},
    {type: 'content_block_delta', index: 0, delta: {type: 'text_delta', text: '```json\n{"verdict":"fail"}\n```'}},
    {type: 'content_block_stop', index: 0},
    {type: 'message_delta', delta: {stop_reason: 'end_turn', stop_sequence: null}, usage: {output_tokens: 4}},
    {type: 'message_stop'}
  ]));
  const result = await runApiModel({config: {provider: 'anthropic', baseUrl: server.url, apiKey: 'test-key', model: 'claude-opus-5-5', visionModels:['claude-opus-5-5']}, prompt: 'Review it.', images: [join(cwd, 'before/desktop.png')], cwd});
  assert.match(result.text, /"verdict":"fail"/);
  assert.deepEqual(result.usage, {input_tokens: 200, cached_input_tokens: 180, output_tokens: 11});
  const [first, second] = server.requests;
  assert.match(first.url, /^\/v1\/messages/);
  assert.equal(first.headers.authorization, 'Bearer test-key');
  assert.match(first.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.equal(first.body.model, 'claude-opus-5-5');
  assert.equal(first.body.fallbacks, 'default');
  assert.deepEqual(first.body.cache_control, {type: 'ephemeral'});
  assert.equal(first.body.stream, true);
  assert.ok(first.body.messages[0].content.some(block => block.type === 'image' && block.source.type === 'base64' && block.source.media_type === 'image/png'));
  const toolResult = second.body.messages.at(-1).content[0];
  assert.equal(toolResult.tool_use_id, 'toolu_1');
  const {content, next} = JSON.parse(toolResult.content);
  assert.equal(content, firstPage);
  assert.deepEqual(next, {path: 'review-context.json', limit: 1, cursor: 60000});
  assert.deepEqual(await readSessionFile(cwd, next), {content: 'tail', next: null});
});

test('the canonical review request runs over an API end to end and writes the result file', async t => {
  const cwd = await session(t);
  const server = await mockServer(t, (_count, _request, response) => {
    response.writeHead(200, {'content-type': 'application/json'});
    response.end(JSON.stringify({choices: [{finish_reason: 'stop', message: {role: 'assistant', content: 'Done: {"verdict":"pass"}'}}], usage: {prompt_tokens: 50, completion_tokens: 3}}));
  });
  const saved = {...process.env};
  t.after(() => { for (const key of ['HAPPYHANDS_API_PROVIDER', 'HAPPYHANDS_API_BASE_URL', 'HAPPYHANDS_API_KEY', 'HAPPYHANDS_API_MODEL', 'HAPPYHANDS_API_VISION_MODELS']) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } });
  Object.assign(process.env, {HAPPYHANDS_API_PROVIDER: 'openai-compatible', HAPPYHANDS_API_BASE_URL: server.url, HAPPYHANDS_API_KEY: 'k', HAPPYHANDS_API_MODEL: 'vision-1', HAPPYHANDS_API_VISION_MODELS:'vision-1'});
  const forwarded = [];
  const neverLaunched = async () => { throw Error('no CLI should be launched'); };
  const launch = adaptModelLauncher(neverLaunched);
  await launch('codex', ['exec', '-C', cwd, '-s', 'read-only', '--json', '-o', join(cwd, 'review-result.json'), '-i', join(cwd, 'before/desktop.png'), '--', '-'], {input: 'PROMPT', onOutput: chunk => forwarded.push(chunk)});
  assert.deepEqual(JSON.parse(await readFile(join(cwd, 'review-result.json'), 'utf8')), {verdict: 'pass'});
  assert.deepEqual(JSON.parse(forwarded.join('')), {type: 'turn.completed', usage: {input_tokens: 50, cached_input_tokens: 0, output_tokens: 3}});
  assert.equal(server.requests[0].body.model, 'vision-1');
  await assert.rejects(
    launch('codex', ['exec', '-m', 'vision-1-other', '-i', join(cwd,'unread.png'), '--', '-']),
    {code:'MODEL_VISION_NOT_READY'}
  );
  assert.equal(server.requests.length,1);
  await assert.rejects(launch('codex', ['exec', '-C', cwd, '-s', 'workspace-write', '-'], {input: ''}), /read-only model steps only/);
});
