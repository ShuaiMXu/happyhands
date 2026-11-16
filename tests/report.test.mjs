import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildRunReport, escapeHtml} from '../packages/harness-core/report.js';

// 1x1 transparent PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'hh-report-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const spec = JSON.parse(await readFile(new URL('../examples/happyclaw-site/experience.json', import.meta.url), 'utf8'));
  await writeFile(join(root, 'experience.json'), JSON.stringify(spec, null, 2));
  await mkdir(join(root, 'before'));
  await mkdir(join(root, 'after'));
  await writeFile(join(root, 'before', 'page--phone.png'), PNG);
  await writeFile(join(root, 'after', 'page--phone.png'), PNG);
  await writeFile(join(root, 'diagnosis.json'), JSON.stringify({
    schemaVersion: '0.1',
    generatedAt: new Date().toISOString(),
    evaluatorVersion: 'diagnosis-core@0.2.0',
    evidence: [],
    findings: [{
      id: 'check-contrast-1',
      title: 'Text contrast 1.66:1 on a.btn',
      rootKey: 'contrast a.btn page--phone',
      evidenceRefs: ['x'],
      sources: [{type: 'deterministic-check', id: 'deterministic-checks@1'}],
      verificationStatus: 'review-target',
      impact: 4,
      confidence: 5,
      effort: 2,
      priority: 10,
      proposal: '<script>alert(1)</script> raise the ratio to 4.5:1'
    }],
    priorityOverrides: [],
    experienceScore: {status: 'not-scored', missing: []}
  }, null, 2));
  await writeFile(join(root, 'run.json'), JSON.stringify({
    version: '0.1',
    id: 'report-test',
    mode: 'review',
    url: 'http://127.0.0.1:4321/',
    createdAt: new Date().toISOString(),
    confirmation: {findingId: 'check-contrast-1', verdict: 'supported', note: 'seen in the phone capture', at: new Date().toISOString()},
    captures: {
      before: {schemaVersion: '0.1', states: [{stateId: 'page', configurationId: 'phone', width: 390, height: 844, reached: true, screenshot: 'before/page--phone.png', dom: {horizontalOverflow: false}}]},
      after: {schemaVersion: '0.1', states: [{stateId: 'page', configurationId: 'phone', width: 390, height: 844, reached: true, screenshot: 'after/page--phone.png', dom: {horizontalOverflow: false}}]}
    },
    diagnosis: {path: 'diagnosis.json', hash: 'a'.repeat(64)},
    execution: {agent: {id: 'self'}, exitCode: 0, diffStat: 'index.html | 4 ++--', changedFiles: ['index.html'], boundaryBreaches: []},
    evaluation: {kind: 'comparison'}
  }, null, 2));
  return root;
}

test('escapeHtml neutralises markup from run content', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});

test('the report is one self-contained file with gates, findings and inline screenshots', async t => {
  const directory = await fixture(t);
  const result = await buildRunReport({directory});
  assert.equal(result.path, join(directory, 'report.html'));
  assert.equal(result.findings, 1);
  assert.equal(result.images, 2);
  const html = await readFile(result.path, 'utf8');
  assert.match(html, /data:image\/png;base64/);
  assert.match(html, /check-contrast-1/);
  assert.match(html, /Human judgment/);
  assert.match(html, /pending/, 'an unjudged run must say so rather than imply acceptance');
  assert.match(html, /index\.html/, 'the changed file is part of the ledger');
  assert.doesNotMatch(html, /<script>alert/, 'finding text must be escaped');
  assert.match(html, /&lt;script&gt;alert/, 'the escaped text is still readable');
  assert.doesNotMatch(html, /src="http/, 'no remote asset may be required to read the report');
});

test('a report can be written outside the run directory', async t => {
  const directory = await fixture(t);
  const target = join(directory, 'public', 'run.html');
  await mkdir(join(directory, 'public'));
  const result = await buildRunReport({directory, outputPath: target});
  assert.equal(result.path, target);
  assert.match(await readFile(target, 'utf8'), /report-test/);
});
