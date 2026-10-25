import test from 'node:test';
import assert from 'node:assert/strict';
import { themeTokens } from '../packages/skill-core/theme-tokens.js';
import { runHandler } from '../packages/skill-core/handlers.js';
import { buildDesignSystemExtraction, designSystemBrief } from '../packages/skill-core/design-system.js';
import { observedFoundationFrom } from '../packages/skill-core/foundation-inventory.js';

const source = (path, content) => ({ path, content });
test('static theme objects preserve aliases, layers, origin and typed literals across relative re-exports', () => {
  const result = themeTokens([
    source('src/palette.ts', 'export const palette = { ink: "#111", space: 8 } as const;'),
    source('src/index.ts', 'export { palette as colors } from "./palette.js";'),
    source('src/theme.ts', `import { colors } from './index';
      export const theme = {
        primitive: { ...colors },
        semantic: { foreground: colors.ink },
        components: { card: { radius: '10px' } },
        fontFamily: ['Inter', 'sans-serif']
      } satisfies Record<string, unknown>;`),
  ]);
  assert.deepEqual(result.issues, []);
  const foreground = result.tokens.find(token => token.name === 'src/theme.ts#theme.semantic.foreground');
  assert.equal(foreground.value, '#111');
  assert.deepEqual(foreground.origin, { file: 'src/palette.ts', line: 1 });
  assert.equal(foreground.layer, 'semantic');
  assert.ok(foreground.references.includes('src/palette.ts#palette.ink'));
  assert.ok(foreground.references.includes('src/index.ts#export:colors.ink'));
  assert.equal(result.tokens.find(token => token.name.endsWith('components.card.radius')).layer, 'component');
  assert.equal(result.tokens.find(token => token.name.endsWith('primitive.space')).layer, 'primitive');
  assert.ok(result.tokens.every(token => token.status === 'observed'));
});

test('dynamic spread cannot leave overwritten values looking resolved; explicit later values remain observed', () => {
  const result = themeTokens([source('theme.js', `const theme = { color: '#000', ...getTheme(), radius: '4px', bad: (() => { throw Error('must never run') })() };`)]);
  assert.deepEqual(result.tokens.map(token => token.name), ['theme.js#theme.radius']);
  assert.equal(result.issues.length, 2);
  assert.ok(result.issues.every(issue => /CallExpression/.test(issue.reason)));
});

test('cycles, mutable bindings, unresolved imports and malformed theme syntax are explicit missing evidence', () => {
  for (const content of [
    'const theme = { color: theme.color };',
    'let ink = "red"; const theme = { color: ink };',
    'import { colors } from "external-package"; const theme = { color: colors.ink };',
    'const theme = { color: ;',
  ]) {
    const result = themeTokens([source('theme.ts', content)]);
    assert.ok(result.issues.length, content);
    assert.equal(result.tokens.length, 0, content);
  }
});

test('default theme and Tailwind exports are supported without extracting unrelated config fields', () => {
  const result = themeTokens([
    source('theme.mjs', 'export default { colors: { ink: "#111" } };'),
    source('tailwind.config.ts', 'export default { content: ["./src/**"], theme: { extend: { colors: { brand: "#123456" } } } };'),
    source('unrelated.ts', 'const business = { price: 100 };'),
  ]);
  assert.deepEqual(result.issues, []);
  assert.equal(result.tokens.length, 2);
  assert.ok(result.tokens.some(token => token.name === 'tailwind.config.ts#default.theme.extend.colors.brand'));
  assert.ok(!result.tokens.some(token => /content|price/.test(token.name)));
});

test('static extraction budget is bounded and reports incomplete evidence', () => {
  const result = themeTokens([source('theme.ts', 'const theme = { ink: "#111" };')], { maxSteps: 1 });
  assert.equal(result.tokens.length, 0);
  assert.match(result.issues[0].reason, /budget/);
});

test('Foundation emits object values with source evidence and fails closed on runtime theme values', async () => {
  const snapshot = { truncated: false, files: [
    source('src/theme.ts', 'export const theme = { semantic: { foreground: "#111" }, computed: loadTheme() };'),
  ] };
  const result = await runHandler('foundationExtractor', { repo: '.', sourceSnapshot: snapshot });
  assert.equal(result.status, 'needs-evidence');
  assert.equal(result.evidence[0].themeIssues.length, 1);
  const token = result.proposedUpdates[0].tokens[0];
  assert.equal(token.value, '#111');
  assert.equal(token.category, 'color');
  assert.equal(token.status, 'observed');
  const extraction = buildDesignSystemExtraction({ snapshot, foundation: result, capture: { states: [] }, phase: 'before' });
  assert.equal(extraction.status, 'partial');
  assert.match(designSystemBrief(extraction), /Unsupported static value: CallExpression/);
  const saved = observedFoundationFrom(null, [{ ...result, skill: { id: 'foundation-extractor' } }], extraction);
  assert.deepEqual(saved.tokens[0].evidence.details.origin, token.origin);
  assert.equal(saved.tokens[0].evidence.details.layer, 'semantic');
  assert.equal(saved.tokens[0].status, 'observed');
});

test('theme-file exported objects retain numeric arrays and do not self-reference', () => {
  const result = themeTokens([source('theme-presets.ts', 'export const presets = { weights: [400, 700], radius: -1 };')]);
  assert.equal(result.tokens[0].value, '[400,700]');
  assert.equal(result.tokens[1].value, '-1');
  assert.ok(result.tokens.every(token => !token.references.includes(token.name)));
});

test('broken imported source and source-size limit are not complete inventories', () => {
  const files = [source('theme.ts', 'import { ink } from "./data"; const theme = { color: ink };'), source('data.ts', 'export const ink = "#111"; const broken = ;')];
  assert.ok(themeTokens(files).issues.some(issue => /syntax errors/.test(issue.reason)));
  assert.ok(themeTokens(files, { maxSourceBytes: 1 }).issues.some(issue => /budget/.test(issue.reason)));
});

test('Tailwind CommonJS objects are read statically while require calls stay unresolved', () => {
  const result = themeTokens([source('tailwind.config.cjs', 'module.exports = { theme: { colors: { ink: "#111", brand: require("brand") } } };')]);
  assert.equal(result.tokens.length, 1);
  assert.equal(result.tokens[0].value, '#111');
  assert.match(result.issues[0].reason, /CallExpression/);
});

test('literal dots in keys cannot collide with nested token paths', () => {
  const result = themeTokens([source('theme.ts', 'const theme = { "a.b": "#111", a: { b: "#222" } };')]);
  assert.equal(new Set(result.tokens.map(token => token.name)).size, 2);
  assert.ok(result.tokens.some(token => token.name.endsWith('a%2Eb')));
  assert.ok(result.tokens.some(token => token.name.endsWith('a.b')));
});
