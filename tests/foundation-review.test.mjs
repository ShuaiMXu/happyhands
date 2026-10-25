import test from 'node:test';
import assert from 'node:assert/strict';
import { approvalFromDraft, createFoundationDraft, diffFoundations, foundationDecisionSummary, nextFoundationVersion, summarizeFoundationEvidence, loadFoundationEvidenceRecords } from '../apps/designer/foundation-review.js';

test('pattern review candidates stay separate from approvable Foundation entries',()=>{
  const candidate={name:'Panel',source:'components/Panel.jsx',status:'observed',examples:[]};
  const summary=summarizeFoundationEvidence([{skill:{id:'pattern-library-curator'},status:'needs-evidence',findings:[],evidence:[],limitations:['Usage guidance missing.'],proposedUpdates:[{type:'pattern-candidates',candidates:[candidate,{...candidate,status:'approved'}]}]}]);
  assert.deepEqual(summary.patternCandidates,[candidate]);assert.equal(summary.incompleteCount,1);
});

const observed = {
  status: 'observed',
  brand: { principles: ['Clear state'], voice: ['Direct'], assets: [{ name: 'Mark', source: 'logo.svg', status: 'observed' }] },
  tokens: [{ category: 'color', name: 'Accent', value: '#123456', source: 'tokens.css', status: 'observed' }],
  components: [{ name: 'Button', source: 'Button.tsx', variants: ['primary'], states: ['default'], status: 'observed' }],
  patterns: []
};

test('a review draft turns observations into explicit decisions without mutating evidence', () => {
  const draft = createFoundationDraft(observed);
  assert.equal(draft.tokens[0].status, 'observed');
  assert.equal(draft.brand.assets[0].status, 'observed');
  assert.equal(observed.tokens[0].status, 'observed');
  assert.deepEqual(foundationDecisionSummary(draft), { total: 3, approved: 0, deprecated: 0, deferred: 0, pending: 3 });
  assert.throws(() => approvalFromDraft({ foundation: draft, version: '1.0.0', reviewer: 'Product design', reason: 'Reviewed against the shipped interface.' }), /3 foundation candidates/);
  draft.tokens[0].status = 'approved';
  draft.brand.assets[0].status = 'deprecated';
  draft.components[0].status = 'deprecated';
  const approval = approvalFromDraft({ foundation: draft, version: '1.0.0', reviewer: 'Product design', reason: 'Reviewed against the shipped interface.' });
  assert.equal(approval.foundation.status, 'approved');
  assert.equal(approval.foundation.components[0].status, 'deprecated');
  assert.equal(observed.brand.assets[0].status, 'observed');
});

test('extraction evidence keeps conflicts and limitations available for review', () => {
  const evidence = summarizeFoundationEvidence([{
    skill: { id: 'foundation-extractor' },
    status: 'needs-evidence',
    evidence: [{ filesScanned: 12 }],
    findings: [{ id: 'TOKEN-REVIEW-1', title: 'Accent conflicts' }],
    limitations: ['Static scan only.'],
    proposedUpdates: [{ type: 'design-foundation', tokens: [{ name: '--accent', conflicts: true, unresolvedAliases: ['--missing'], aliasCycle: false }] }]
  }]);
  assert.equal(evidence.filesScanned, 12);
  assert.equal(evidence.incompleteCount, 1);
  assert.equal(evidence.skills[0].findingCount, 1);
  assert.equal(evidence.findings[0].skillId, 'foundation-extractor');
  assert.equal(evidence.limitations[0].message, 'Static scan only.');
  assert.deepEqual(evidence.tokenFlags.get('--accent'), ['conflict', 'unresolved-alias']);
});

test('missing or mismatched extraction results remain visible evidence gaps', async () => {
  const records = [
    { id: 'foundation-extractor', path: 'skills/foundation-extractor.json' },
    { id: 'component-inventory', path: 'skills/component-inventory.json' },
    { id: 'brand-foundation-extractor', path: '../outside.json' }
  ];
  const paths = [];
  const results = await loadFoundationEvidenceRecords(records, async path => {
    paths.push(path);
    if (path.includes('foundation-extractor')) throw new Error('404');
    return { skill: { id: 'wrong-skill' }, status: 'complete' };
  });
  assert.equal(paths.length, 2);
  const summary = summarizeFoundationEvidence(results);
  assert.equal(summary.skills.length, 3);
  assert.equal(summary.incompleteCount, 3);
  assert.equal(summary.limitations.length, 3);
  assert.equal(summary.findings.length, 0);
});

test('valid completed extraction stays complete but malformed result arrays do not', async () => {
  const record = { id: 'foundation-extractor', path: 'skills/foundation-extractor.json' };
  const valid = { skill: { id: record.id }, status: 'complete', findings: [], evidence: [] };
  const results = await loadFoundationEvidenceRecords([record], async () => valid);
  assert.equal(summarizeFoundationEvidence(results).incompleteCount, 0);
  const malformed = await loadFoundationEvidenceRecords([record], async () => ({ ...valid, findings: {} }));
  assert.equal(summarizeFoundationEvidence(malformed).incompleteCount, 1);
});

test('version comparison distinguishes replacements, deprecations, additions and removals', () => {
  const before = createFoundationDraft(observed);
  const after = structuredClone(before);
  after.tokens[0].value = '#654321';
  after.components[0].status = 'deprecated';
  after.patterns.push({ name: 'Inline recovery', source: 'patterns.md', description: 'Retry in place', status: 'approved' });
  after.brand.assets = [];
  const types = diffFoundations(before, after).filter(item => item.type !== 'unchanged').map(item => item.type).sort();
  assert.deepEqual(types, ['added', 'changed', 'deprecated', 'removed']);
});

test('the suggested version advances the minor release of the latest approved snapshot', () => {
  assert.equal(nextFoundationVersion('2.3.7'), '2.4.0');
  assert.equal(nextFoundationVersion(null), '1.0.0');
});

test('same-named components keep their source identity when reordered, changed or removed', () => {
  const before = { components: [
    { name: 'Panel', source: 'src/Panel.tsx', status: 'observed' },
    { name: 'Panel', source: 'admin/Panel.tsx', status: 'observed' }
  ] };
  const reordered = { components: [...before.components].reverse() };
  assert.deepEqual(diffFoundations(before, reordered).map(item => item.type), ['unchanged', 'unchanged']);
  const after = { components: [{ ...before.components[1], status: 'deprecated' }] };
  const changes = diffFoundations(before, after);
  assert.equal(changes.length, 2);
  assert.equal(changes.find(item => item.type === 'deprecated').previous.source, 'admin/Panel.tsx');
  assert.equal(changes.find(item => item.type === 'removed').item.source, 'src/Panel.tsx');
});

test('repeated assets are preserved and a unique item source move remains a change', () => {
  const before = { brand: { assets: [
    { name: 'Logo', source: 'light.svg' }, { name: 'Logo', source: 'dark.svg' }
  ] }, tokens: [{ name: 'Accent', source: 'old.css', value: '#fff' }] };
  const after = structuredClone(before);
  after.brand.assets[1].source = 'dark-new.svg';
  after.tokens[0].source = 'new.css';
  const changes = diffFoundations(before, after);
  assert.equal(changes.filter(item => item.item.collection === 'assets').length, 3);
  assert.equal(changes.find(item => item.item.collection === 'tokens').type, 'changed');
});
