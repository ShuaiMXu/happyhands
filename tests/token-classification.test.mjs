import test from 'node:test';
import assert from 'node:assert/strict';
import { runHandler } from '../packages/skill-core/handlers.js';

test('foundation preserves property categories despite component and colour-role prefixes', async () => {
  const examples = [
    ['--border-width', '1px', 'space'],
    ['--border-radius', '10px', 'radius'],
    ['--text-shadow', '0 1px 2px #000', 'shadow'],
    ['--text-font-size', '16px', 'type'],
    ['--background-transition-duration', '200ms', 'motion'],
    ['--ring-offset-width', '2px', 'space'],
    ['--shadow-color', '#000', 'color'],
    ['--font-color', '#222', 'color'],
    ['--border', '#ddd', 'color'],
    ['--foreground', '#111', 'color'],
  ];
  const result = await runHandler('foundationExtractor', {
    repo: '.', sourceSnapshot: { truncated: false, files: [{ path: 'src/theme.css',
      content: `:root { ${examples.map(([name, value]) => `${name}: ${value};`).join('\n')} }` }] },
  });
  assert.equal(result.status, 'complete');
  const tokens = result.proposedUpdates[0].tokens;
  for (const [name, value, category] of examples) {
    const token = tokens.find(item => item.name === name);
    assert.equal(token.category, category, name);
    assert.equal(token.value, value);
    assert.equal(token.status, 'observed');
    assert.equal(token.declarations[0].file, 'src/theme.css');
  }
});
