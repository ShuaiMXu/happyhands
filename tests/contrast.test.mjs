import test from 'node:test';
import assert from 'node:assert/strict';
import { auditContrast, contrastRatio, declaredPairs, observedPairs, parseColor, verdictFor } from '../packages/skill-core/contrast.js';

function token(name, value, status = 'approved') {
  return { category: 'color', name, value, source: 'tokens.css', status };
}

// The state colours before and after a real alignment pass, so the audit can be checked against
// values whose ratios are known.
const before = {
  status: 'approved',
  brand: { principles: [], voice: [], assets: [] },
  components: [],
  patterns: [],
  tokens: [
    token('--ff-color-danger-text', '#E5484D'),
    token('--ff-color-danger-surface', '#FCEBEC'),
    token('--ff-color-warning-text', '#D08324'),
    token('--ff-color-warning-surface', '#FBF0E1'),
    token('--ff-color-success-text', '#2E9E6B'),
    token('--ff-color-success-surface', '#E7F5EE')
  ]
};

const after = {
  ...before,
  tokens: [
    token('--ff-color-danger-text', '#B3261E'),
    token('--ff-color-danger-surface', '#FDE7E7'),
    token('--ff-color-warning-text', '#7A4B00'),
    token('--ff-color-warning-surface', '#FFF7E8'),
    token('--ff-color-success-text', '#2F6B2A'),
    token('--ff-color-success-surface', '#EAF6E4')
  ]
};

test('the ratio is computed the way WCAG defines it', () => {
  assert.equal(contrastRatio(parseColor('#ffffff'), parseColor('#000000')), 21);
  assert.equal(contrastRatio(parseColor('#123456'), parseColor('#123456')), 1);
  // Order does not matter: the lighter colour is always the numerator.
  assert.equal(contrastRatio(parseColor('#000000'), parseColor('#ffffff')), 21);
  assert.equal(contrastRatio(parseColor('#FFF'), parseColor('#000')), 21);
});

test('a ratio is placed in a band instead of being given a pass or fail it cannot know', () => {
  assert.equal(verdictFor(2.68), 'fails-every-use');
  assert.equal(verdictFor(3), 'large-text-and-non-text-only');
  assert.equal(verdictFor(4.49), 'large-text-and-non-text-only');
  assert.equal(verdictFor(4.5), 'passes-aa');
});

test('a role with a text and a surface token is a pair the names declare', () => {
  const audit = auditContrast({ foundation: before });
  assert.equal(audit.counts.declared, 3);
  const warning = audit.pairs.find(pair => pair.role === 'warning');
  assert.equal(warning.ratio, 2.68);
  assert.equal(warning.verdict, 'fails-every-use');
  const danger = audit.pairs.find(pair => pair.role === 'danger');
  assert.equal(danger.ratio, 3.4);
  assert.equal(danger.verdict, 'large-text-and-non-text-only');
  const finding = audit.findings.find(item => item.id === 'CONTRAST-BELOW-MINIMUM');
  assert.equal(finding.confidence, 'high');
  assert.deepEqual(finding.resolution.options, ['change-foreground', 'change-background', 'restrict-the-pair']);
});

test('the same audit on the aligned values reports no failure', () => {
  const audit = auditContrast({ foundation: after });
  assert.equal(audit.counts.declared, 3);
  assert.equal(audit.counts.failing, 0);
  assert.equal(audit.counts.bodyOnly, 0);
  assert.deepEqual(audit.findings, []);
  assert.deepEqual(audit.pairs.map(pair => pair.verdict), ['passes-aa', 'passes-aa', 'passes-aa']);
});

test('a declaration that sets text and background together states a pair of its own', () => {
  const files = [
    { path: 'ui/badge.jsx', content: 'const doneBadge = { background: "#DFF9CF", color: "#9ACD32" };' },
    { path: 'ui/card.css', content: '.card {\n  background-color: #FFFFFF;\n  color: #767676;\n}' }
  ];
  const pairs = observedPairs(files);
  assert.equal(pairs.length, 2);
  const badge = pairs.find(pair => pair.foreground.value === '#9acd32');
  assert.equal(badge.origin, 'observed');
  assert.equal(badge.verdict, undefined, 'the verdict is added by the audit, not the scan');
  assert.ok(badge.ratio < 3);
  assert.equal(badge.sources[0], 'ui/badge.jsx:1');
  // A rule split over several lines is still one declaration.
  const card = pairs.find(pair => pair.foreground.value === '#767676');
  assert.equal(card.sources[0], 'ui/card.css:2');
  assert.ok(card.ratio >= 4.5);
});

test('a colour the audit cannot measure is named rather than guessed', () => {
  const foundation = {
    ...before,
    tokens: [
      token('--ff-color-danger-text', 'Existing red used by the workbench'),
      token('--ff-color-danger-surface', '#FCEBEC'),
      token('--ff-color-info-text', '#11223344'),
      token('--ff-color-info-surface', '#FFFFFF')
    ]
  };
  const audit = auditContrast({ foundation });
  assert.deepEqual(audit.unreadable.map(item => item.name), ['--ff-color-danger-text']);
  assert.deepEqual(audit.translucent.map(item => item.name), ['--ff-color-info-text']);
  // Neither pair can be measured, so neither is reported as passing or failing.
  assert.equal(audit.pairs.length, 0);
  assert.deepEqual(audit.findings, []);
});

test('pairs nobody stated are not invented', () => {
  const foundation = {
    ...before,
    tokens: [token('--ff-color-danger-text', '#E5484D'), token('--ff-cool-150', '#F1F0ED')]
  };
  const audit = auditContrast({ foundation });
  assert.equal(declaredPairs(foundation).pairs.length, 0);
  assert.equal(audit.pairs.length, 0);
});
