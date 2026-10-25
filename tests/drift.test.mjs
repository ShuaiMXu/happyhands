import test from 'node:test';
import assert from 'node:assert/strict';
import { detectDrift, normalizeColor, toMilliseconds } from '../packages/skill-core/drift.js';

// The fixture reproduces the shape of a real alignment pass: a token file that no longer matches
// what shipped, one semantic slot holding three values, a widely spread unregistered neutral,
// a radius scale the pages never used, and transitions written by hand.
const foundation = {
  status: 'approved',
  tokens: [
    { category: 'color', name: '--ff-color-danger-text', value: '#E5484D', source: 'tokens.css', status: 'approved' },
    { category: 'color', name: '--ff-color-danger-surface', value: '#FCEBEC', source: 'tokens.css', status: 'approved' },
    { category: 'color', name: '--ff-color-success-text', value: '#2E9E6B', source: 'tokens.css', status: 'approved' },
    { category: 'color', name: '--ff-cool-150', value: '#F1F0ED', source: 'tokens.css', status: 'approved' },
    { category: 'radius', name: '--ff-radius-xs', value: '7px', source: 'tokens.css', status: 'approved' },
    { category: 'radius', name: '--ff-radius-sm', value: '9px', source: 'tokens.css', status: 'approved' },
    { category: 'radius', name: '--ff-radius-md', value: '11px', source: 'tokens.css', status: 'approved' },
    { category: 'radius', name: '--ff-radius-xl', value: '18px', source: 'tokens.css', status: 'approved' },
    { category: 'type', name: '--ff-text-meta', value: '12px', source: 'tokens.css', status: 'approved' },
    { category: 'type', name: '--ff-text-body', value: '14px', source: 'tokens.css', status: 'approved' },
    { category: 'motion', name: '--ff-dur-instant', value: '130ms', source: 'tokens.css', status: 'approved' },
    { category: 'motion', name: '--ff-dur-fast', value: '170ms', source: 'tokens.css', status: 'approved' },
    { category: 'motion', name: '--ff-dur-slow', value: '600ms', source: 'tokens.css', status: 'approved' }
  ],
  brand: { principles: [], voice: [], assets: [] },
  components: [],
  patterns: []
};

const files = [
  {
    path: 'ui_kits/app/expert.jsx',
    content: [
      'const failText = { color: "#B3261E" };',
      'const failSurface = { background: "#FDE7E7", borderRadius: 12 };',
      'const noticeDangerCopy = { color: "#7A1F1A" };',
      'const doneBadge = { background: "#DFF9CF", color: "#2F6B2A" };',
      'const successSurface = { background: "#EAF6E4" };',
      'const shell = { background: "#ECEAE6", borderRadius: 16, transition: "all .3s ease" };',
      'const meta = { fontSize: 13.5 };'
    ].join('\n')
  },
  {
    path: 'ui_kits/app/sidebar.jsx',
    content: [
      'const rail = { background: "#ECEAE6", borderRadius: 8 };',
      'const item = { background: "var(--neutral-150)", transition: "background .15s ease" };'
    ].join('\n')
  },
  {
    path: 'ui_kits/app/home.jsx',
    content: [
      'const hero = { background: "#ECEAE6", borderRadius: 10 };',
      'const card = { borderRadius: 12, transition: "transform .3s ease" };',
      '.card:hover { border-radius: 12px; transition: box-shadow 0.3s ease; }'
    ].join('\n')
  }
];

test('value normalisation is stable across the shapes a codebase actually uses', () => {
  assert.equal(normalizeColor('#ABC'), '#aabbcc');
  assert.equal(normalizeColor('#B3261E'), '#b3261e');
  assert.equal(toMilliseconds('.3', 's'), 300);
  assert.equal(toMilliseconds('150', 'ms'), 150);
});

test('an unregistered value is nominated with its spread, not just its count', () => {
  const drift = detectDrift({ files, foundation });
  const ungoverned = drift.findings.find(item => item.id === 'DRIFT-UNGOVERNED-VALUE');
  assert.ok(ungoverned, 'expected an ungoverned-value finding');
  const neutral = ungoverned.evidence.find(item => item.value === '#eceae6');
  assert.equal(neutral.count, 3);
  assert.equal(neutral.fileCount, 3);
  assert.equal(drift.nominations.some(item => item.value === '#eceae6'), true);
});

test('a semantic slot holding several values is reported even when one of them appears once', () => {
  const drift = detectDrift({ files, foundation });
  const conflict = drift.findings.find(item => item.id === 'DRIFT-SEMANTIC-CONFLICT');
  assert.ok(conflict, 'expected a semantic-conflict finding');
  const dangerText = conflict.evidence.find(item => item.role === 'danger' && item.slot === 'text');
  const values = dangerText.values.map(item => item.value).sort();
  // The token value, the value that shipped, and a one-off in a notice all sit in one slot.
  assert.deepEqual(values, ['#7a1f1a', '#b3261e', '#e5484d']);
  const once = dangerText.values.find(item => item.value === '#7a1f1a');
  assert.equal(once.count, 1);
  assert.ok(once.sources[0].includes('expert.jsx'));
  // Two surfaces for one success state, on two lines that both read as "success".
  const successSurface = conflict.evidence.find(item => item.role === 'success' && item.slot === 'surface');
  assert.deepEqual(successSurface.values.map(item => item.value).sort(), ['#dff9cf', '#eaf6e4']);
  // The text colour on the same line as a background is read as text, not as another surface.
  const successText = conflict.evidence.find(item => item.role === 'success' && item.slot === 'text');
  assert.deepEqual(successText.values.map(item => item.value).sort(), ['#2e9e6b', '#2f6b2a']);
});

test('off-scale values report the nearest step, and a motion snap reports that it changes behaviour', () => {
  const drift = detectDrift({ files, foundation });
  const offScale = drift.findings.find(item => item.id === 'DRIFT-OFF-SCALE-VALUE');
  assert.ok(offScale, 'expected an off-scale finding');
  const radius = offScale.evidence.filter(item => item.kind === 'radius');
  assert.deepEqual(radius.map(item => item.value).sort((a, b) => a - b), [8, 10, 12, 16]);
  assert.equal(radius.find(item => item.value === 8).nearestStep, 7);
  assert.equal(radius.find(item => item.value === 16).nearestStep, 18);
  const halfStep = offScale.evidence.find(item => item.kind === 'type' && item.value === 13.5);
  assert.equal(halfStep.nearestStep, 14);
  assert.equal(halfStep.delta, 0.5);
  const motion = offScale.evidence.filter(item => item.kind === 'motion');
  const snapped = motion.find(item => item.value === 300);
  assert.equal(snapped.nearestStep, 170);
  assert.equal(snapped.changesBehaviour, true);
  // 150ms sits exactly between 130 and 170. The tie is reported rather than silently resolved.
  const small = motion.find(item => item.value === 150);
  assert.deepEqual(small.ambiguousBetween, [130, 170]);
  assert.equal(small.changesBehaviour, false);
  assert.equal(snapped.ambiguousBetween, null);
});

test('every finding leaves the direction of the fix to a person', () => {
  const drift = detectDrift({ files, foundation });
  assert.ok(drift.findings.length >= 3);
  for (const finding of drift.findings) {
    assert.equal(finding.resolution.status, 'unresolved');
    assert.deepEqual(finding.resolution.options, ['change-implementation', 'change-token']);
    assert.equal(finding.resolution.decidedBy, 'human');
  }
});

test('governed references are counted so an alignment pass has a number to move', () => {
  const drift = detectDrift({ files, foundation });
  assert.equal(drift.usage.governedReferences, 1);
  assert.ok(drift.usage.literalValues > 10);
});

test('a scale with no approved tokens is skipped instead of guessed', () => {
  const drift = detectDrift({ files, foundation: { ...foundation, tokens: foundation.tokens.filter(item => item.category !== 'motion') } });
  assert.ok(drift.skippedScales.includes('motion'));
  const offScale = drift.findings.find(item => item.id === 'DRIFT-OFF-SCALE-VALUE');
  assert.equal(offScale.evidence.some(item => item.kind === 'motion'), false);
});
