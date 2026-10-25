import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { auditStates, canonicalStates } from '../packages/skill-core/states.js';

const rubric = JSON.parse(await readFile(resolve('skills/product-design/component-state-auditor/rubric.json'), 'utf8'));

test('state evidence binds the recorded source, never a different same-named component', () => {
  const component = { name: 'SaveButton', source: 'src/SaveButton.jsx', states: ['default', 'disabled', 'in-progress'] };
  const other = { path: 'admin/SaveButton.jsx', content: 'failed error retry' };
  const audit = auditStates({ components: [component], files: [other], rubric });
  assert.equal(audit.components[0].sourceFound, false);
  assert.deepEqual(audit.components[0].observedStates, []);
  assert.deepEqual(audit.findings, []);
});

test('extensionless source needs one implementation and explicit extensions never substitute', () => {
  const jsx = { path: 'src/SaveButton.jsx', content: 'default disabled loading' };
  const tsx = { path: 'src/SaveButton.tsx', content: 'failed' };
  const component = { name: 'SaveButton', source: 'src/SaveButton', states: [] };
  const inspect = (source, files) => auditStates({ components: [{ ...component, source }], files, rubric }).components[0];
  assert.equal(inspect(component.source, [jsx]).sourcePath, jsx.path);
  assert.equal(inspect(component.source, [jsx, tsx]).sourceFound, false);
  assert.equal(inspect(jsx.path, [tsx]).sourceFound, false);
  assert.equal(inspect(jsx.path, [tsx, jsx]).sourcePath, jsx.path);
  assert.deepEqual(inspect(jsx.path, [tsx, jsx]).observedStates, ['in-progress', 'disabled', 'default']);
});

test('offline state words and recovery belong to the decoded template, not its loader or resource manifest', () => {
  const component = { name: 'SaveButton', source: 'bundle.html', states: ['default', 'disabled', 'in-progress'] };
  const template = '<body><button disabled>default loading</button></body>';
  const file = { path: component.source, content: '<script>/* pending failed retry reason */</script>\n<script type="__bundler/template">' + JSON.stringify(template) + '</script>\n<script type="__bundler/manifest">{"data":"needs review"}</script>' };
  const audit = auditStates({ components: [component], files: [file], rubric });
  assert.deepEqual(audit.components[0].observedStates, ['in-progress', 'disabled', 'default']);
  assert.equal(audit.components[0].affordances.retry, false);
  assert.equal(audit.components[0].affordances['failure-reason'], false);
  assert.equal(audit.components[0].sourceCoordinates.coordinates, 'decoded-template-lines');
  assert.equal(audit.components[0].sourceCoordinates.containerLine, 2);
  assert.deepEqual(audit.findings, []);
});

test('an unreadable offline template does not fall back to loader state words', () => {
  const component = { name: 'SaveButton', source: 'bundle.html', states: ['default', 'disabled', 'in-progress'] };
  const file = { path: component.source, content: '<script>/* failed retry */</script><script type="__bundler/template">{broken}</script>' };
  const audit = auditStates({ components: [component], files: [file], rubric });
  assert.equal(audit.components[0].sourceFound, false);
  assert.ok(audit.components[0].sourceError);
  assert.deepEqual(audit.components[0].observedStates, []);
  assert.equal(audit.components[0].affordances, null);
  assert.deepEqual(audit.findings, []);
});

// A shot card that documents four states, a list that documents none, a control that documents
// three, and a mark that belongs to no class.
const components = [
  { name: 'ShotCard', source: 'src/components/ShotCard', states: ['pending', 'generating', 'done', 'failed'], variants: [], status: 'approved' },
  { name: 'JobList', source: 'src/components/JobList', states: [], variants: [], status: 'approved' },
  { name: 'RetryButton', source: 'src/components/RetryButton', states: ['default', 'disabled', 'pending'], variants: [], status: 'approved' },
  { name: 'BrandMark', source: 'src/components/BrandMark', states: [], variants: [], status: 'observed' }
];

const files = [
  {
    path: 'src/components/ShotCard.jsx',
    content: [
      'export function ShotCard({ shot }) {',
      '  if (shot.isGenerating) return <Skeleton label="正在生成首帧" />;',
      '  if (shot.failed) return <Failure errorMessage={shot.reason} onRetry={retry} />;',
      '  if (shot.needsCheck) return <ReviewPrompt />;',
      '  return <Done />;',
      '}'
    ].join('\n')
  },
  {
    path: 'src/components/JobList.jsx',
    content: 'export function JobList({ jobs }) { return jobs.map(job => <Row key={job.id} />); }'
  },
  {
    path: 'src/components/RetryButton.jsx',
    content: 'export function RetryButton({ disabled }) { return <button disabled={disabled}>Try again</button>; }'
  },
  { path: 'src/components/BrandMark.jsx', content: 'export const BrandMark = () => <svg />;' }
];

test('state words are mapped to canonical states, and unknown words are kept as unmapped', () => {
  const mapped = canonicalStates(['generating', 'done', '待核对'], rubric.vocabulary);
  assert.deepEqual(mapped.states.sort(), ['complete', 'in-progress']);
  assert.deepEqual(mapped.unmapped, ['待核对']);
});

test('the documented tier states plainly which required states a component never declared', () => {
  const audit = auditStates({ components, files, rubric });
  const finding = audit.findings.find(item => item.id === 'STATE-UNDOCUMENTED');
  assert.equal(finding.confidence, 'high');
  assert.equal(finding.tier, 'documented');
  const shot = finding.evidence.find(item => item.name === 'ShotCard');
  assert.equal(shot.class, 'async-task-item');
  assert.deepEqual(shot.undocumented.sort(), ['empty', 'needs-review']);
  const control = finding.evidence.find(item => item.name === 'RetryButton');
  assert.deepEqual(control.undocumented, ['in-progress']);
});

test('a state the source shows but the foundation never documented is its own result', () => {
  const audit = auditStates({ components, files, rubric });
  const drift = audit.findings.find(item => item.id === 'STATE-UNDECLARED-IN-FOUNDATION');
  const shot = drift.evidence.find(item => item.name === 'ShotCard');
  // needsCheck is in the component, not in the foundation entry.
  assert.ok(shot.undeclared.includes('needs-review'));
});

test('only the state with no evidence anywhere is reported as absent', () => {
  const audit = auditStates({ components, files, rubric });
  const absent = audit.findings.find(item => item.id === 'STATE-NO-EVIDENCE-IN-SOURCE');
  assert.equal(absent.confidence, 'low');
  const shot = absent.evidence.find(item => item.name === 'ShotCard');
  // pending, in-progress, complete and failed are declared; needs-review is in the source.
  assert.deepEqual(shot.absent, ['empty']);
});

test('a failure with no way back is reported separately from a missing state', () => {
  const audit = auditStates({ components, files, rubric });
  const recovery = audit.findings.find(item => item.id === 'STATE-NO-RECOVERY-PATH');
  const list = recovery.evidence.find(item => item.name === 'JobList');
  assert.deepEqual(list.missing, ['failure-reason']);
  // The shot card states its reason and offers a retry, including one for a whole batch.
  assert.equal(recovery.evidence.some(item => item.name === 'ShotCard'), false);
  const shot = audit.components.find(item => item.name === 'ShotCard');
  assert.equal(shot.affordances['failure-reason'], true);
  assert.equal(shot.affordances.retry, true);
  assert.equal(shot.affordances['progress-copy'], true);
});

test('a component that matches no class has nothing required of it, and that is said out loud', () => {
  const audit = auditStates({ components, files, rubric });
  const unclassified = audit.findings.find(item => item.id === 'STATE-UNCLASSIFIED-COMPONENT');
  assert.deepEqual(unclassified.evidence.map(item => item.name), ['BrandMark']);
  assert.equal(audit.components.find(item => item.name === 'BrandMark').requiredStates, undefined);
});

test('a compound name is classified by its head noun, not by rubric order', () => {
  const audit = auditStates({ components, files, rubric });
  // "JobList" contains job and list. It is a list.
  assert.equal(audit.components.find(item => item.name === 'JobList').class, 'collection');
  assert.equal(audit.components.find(item => item.name === 'ShotCard').class, 'async-task-item');
  assert.equal(audit.components.find(item => item.name === 'RetryButton').class, 'interactive-control');
});

test('the audit records its rubric version and leaves each gap unresolved', () => {
  const audit = auditStates({ components, files, rubric });
  assert.equal(audit.rubricVersion, rubric.version);
  assert.equal(audit.counts.components, 4);
  assert.equal(audit.counts.classified, 3);
  for (const finding of audit.findings) {
    assert.equal(finding.resolution.status, 'unresolved');
    assert.deepEqual(finding.resolution.options, ['add-the-state', 'document-the-state', 'reclassify-the-component']);
  }
});

test('a component whose source is missing is audited on its documentation alone', () => {
  const audit = auditStates({ components, files: [], rubric });
  const shot = audit.components.find(item => item.name === 'ShotCard');
  assert.equal(shot.sourceFound, false);
  assert.deepEqual(shot.observedStates, []);
  assert.equal(shot.affordances, null);
  assert.equal(audit.findings.some(item => item.id === 'STATE-NO-EVIDENCE-IN-SOURCE'), false);
});
