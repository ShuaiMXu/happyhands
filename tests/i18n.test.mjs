import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLanguage, setLanguage, t, translate } from '../apps/designer/i18n.js';
import { messages } from '../apps/designer/messages.js';
import { stageCommand } from '../apps/designer/canvas/index.js';
import { workflowReason } from '../apps/designer/workflow-copy.js';

test('explicit supported language wins; invalid links fall back to saved preference or Chinese', () => {
  assert.equal(resolveLanguage('en', 'zh'), 'en');
  assert.equal(resolveLanguage('fr', 'en'), 'en');
  assert.equal(resolveLanguage(null, null), 'zh');
});
test('translated UI preserves interpolated source evidence and does not reinterpret its placeholders', () => {
  setLanguage('zh');
  const evidence = 'Before: {1} <script>source</script> 修改前';
  assert.equal(t`Before: ${evidence}`, `修改前：${evidence}`);
  setLanguage('en');
  assert.equal(t`Before: ${evidence}`, `Before: ${evidence}`);
  assert.equal(t('unregistered-source-id'), 'unregistered-source-id');
  setLanguage('zh');
});
test('every translation preserves the complete interpolation contract', () => {
  const slots = value => [...value.matchAll(/\{\d+\}/g)].map(match => match[0]).sort();
  for (const [key, translations] of Object.entries(messages)) {
    assert.equal(translations.length, 2, key);
    for (const translation of translations) {
      assert.ok(translation.trim(), key);
      assert.deepEqual(slots(translation), slots(key), key);
    }
  }
});
test('switching languages keeps executable command structure and diagnostic evidence intact', () => {
  const run = { manifest: { id: 'example', captures: {} } };
  setLanguage('zh');
  const zh = stageCommand(run).command;
  setLanguage('en');
  const en = stageCommand(run).command;
  assert.equal(zh.replace(/‹[^›]+›/g, 'PLACEHOLDER'), en.replace(/‹[^›]+›/g, 'PLACEHOLDER'));
  assert.match(en, /‹preview URL›/);
  setLanguage('zh');
  const state = { stage: 'onboarding-failed', reason: 'ECONNREFUSED' };
  assert.ok(workflowReason(state, { onboarding: { error: 'ECONNREFUSED' } }).endsWith('ECONNREFUSED'));
  assert.equal(translate('pageResponded', [], 'zh'), '页面正常响应');
});
