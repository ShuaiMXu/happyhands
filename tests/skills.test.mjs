import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import sample from '../examples/happyclaw-site/experience.json' with { type: 'json' };
import { createRun, loadRun, saveCapture, confirmFinding } from '../packages/harness-core/store.js';
import { executeSkill, loadRegistry } from '../packages/skill-core/runner.js';

const registryRoot = resolve('skills/product-design');

test('foundation extraction excludes test fixtures and unresolved template values', async t => {
 const {repo,directory}=await fixture(t,'scope001');
 await mkdir(join(repo,'tests')); await mkdir(join(repo,'output'));
 await writeFile(join(repo,'tests','example.js'),'const fixture = "--fixture-brand: #ff00ff;";');
 await writeFile(join(repo,'output','capture.html'),'<style>:root { --archived-brand: #f00; }</style>');
 await writeFile(join(repo,'src','dynamic.js'),'const css = `--route-delay: ${delay}ms;`;');
 const result=await executeSkill({id:'foundation-extractor',directory,repo,registryRoot});
 assert.ok(result.proposedUpdates[0].tokens.some(token=>token.name==='--brand'));
 assert.ok(!result.proposedUpdates[0].tokens.some(token=>['--fixture-brand','--archived-brand','--route-delay'].includes(token.name)));
});

async function fixture(t, id) {
  const root = await mkdtemp(join(tmpdir(), 'pd-skill-test-'));
  t.after(async () => {
    if (!root.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(root, { recursive: true, force: true });
  });
  const repo = join(root, 'repo');
  const runs = join(root, 'runs');
  await mkdir(join(repo, 'src', 'components'), { recursive: true });
  await mkdir(runs);
  await writeFile(join(repo, 'src', 'styles.css'), `:root { --brand: #123456; --radius-card: 4px; --gap: 8px; --paper: #F7F6F3 }\n.a{color:#123456;border-radius:4px;--gap:12px}.b{color:#123456;border-radius:4px}\n@media (prefers-color-scheme: dark) { :root { --paper: #111111 } }`);
  await writeFile(join(repo, 'src', 'components', 'Button.jsx'), 'export const Button = () => null;');
  await writeFile(join(repo, 'src', 'App.jsx'), `import { Button } from './components/Button.jsx'; export const App = () => <><img src="/brand-logo.svg" /><Button /></>;`);
  const run = await createRun({ spec: structuredClone(sample), url: 'http://127.0.0.1:4321/', outputRoot: runs, id });
  return { repo, directory: run.directory };
}

test('registry discovers versioned product-design skills with allow-listed handlers', async () => {
  const skills = await loadRegistry(registryRoot);
  assert.equal(skills.length, 27);
  assert.ok(skills.some(item => item.id === 'foundation-extractor'));
  assert.ok(skills.some(item => item.id === 'fix-planner'));
  assert.ok(skills.some(item => item.id === 'experience-score-calibrator'));
  assert.ok(skills.every(item => item.outputSchema === 'skill-result@0.1'));
  assert.equal(skills.filter(item => item.maturity === 'bounded').length, 18);
  assert.equal(skills.filter(item => item.maturity === 'contract-only').length, 9);
  assert.equal(skills.filter(item => item.maturity === 'operational').length, 0);
  assert.ok(skills.filter(item => item.handler === 'evidenceGate').every(item => item.maturity === 'contract-only'));
});

test('foundation extractor records an observed inventory with values and categories', async t => {
  const { repo, directory } = await fixture(t, 'skill001');
  const result = await executeSkill({ id: 'foundation-extractor', directory, repo, registryRoot });
  assert.equal(result.status, 'complete');
  assert.equal(result.proposedUpdates[0].status, 'observed');
  const tokens = result.proposedUpdates[0].tokens;
  assert.deepEqual(tokens.map(item => item.name).sort(), ['--brand', '--gap', '--paper', '--radius-card']);
  const paper = tokens.find(item => item.name === '--paper');
  assert.deepEqual(paper.themes, { light: '#F7F6F3', dark: '#111111' }, 'declarations inside a dark media block file under themes.dark');
  const brand = tokens.find(item => item.name === '--brand');
  assert.equal(brand.value, '#123456');
  assert.equal(brand.category, 'color');
  assert.equal(brand.status, 'observed');
  const radius = tokens.find(item => item.name === '--radius-card');
  assert.equal(radius.category, 'radius');
  const gap = tokens.find(item => item.name === '--gap');
  assert.deepEqual(gap.value, '8px', 'the most frequent declaration wins');
  assert.deepEqual(gap.variants, ['8px', '12px'], 'every distinct value is kept as an observed variant');
  assert.equal(result.proposedUpdates[0].components[0].name, 'Button');
  const manifest = (await loadRun(directory)).manifest;
  assert.equal(manifest.skills[0].path, 'skills/foundation-extractor.json');
  await assert.rejects(executeSkill({ id: 'foundation-extractor', directory, repo, registryRoot }), /already ran/i);
});

test('visual hierarchy skill refuses to claim a visual result without baseline evidence', async t => {
  const { directory } = await fixture(t, 'skill002');
  const missing = await executeSkill({ id: 'visual-hierarchy-reviewer', directory, registryRoot });
  assert.equal(missing.status, 'needs-evidence');
  assert.equal(missing.findings.length, 0);
});

test('visual hierarchy skill exposes structural review targets without inventing a score', async t => {
  const { directory } = await fixture(t, 'skill003');
  await saveCapture(directory, 'before', {
    at: '2026-09-19T00:00:00.000Z', url: 'http://127.0.0.1:4321/', viewports: {
      desktop: { width: 1280, height: 800, status: 200, screenshot: 'before/desktop.png', dom: { h1: [], actions: [], horizontalOverflow: false } }
    }
  });
  const result = await executeSkill({ id: 'visual-hierarchy-reviewer', directory, registryRoot });
  assert.equal(result.status, 'needs-evidence');
  assert.equal(result.findings[0].id, 'HIERARCHY-H1-DESKTOP');
  assert.equal('score' in result, false);
});

test('task-level skills refuse to run without their required baseline evidence', async t => {
  const { directory } = await fixture(t, 'skill004');
  const result = await executeSkill({ id: 'interaction-reviewer', directory, registryRoot });
  assert.equal(result.status, 'needs-evidence');
  assert.match(result.limitations[0], /baseline browser capture|required inputs|task-level/i);
  assert.equal(result.findings.length, 0);
});

function richView(width, { overflow = false, missingAlt = [], unlabeledInputs = [], controls = [] } = {}) {
  return {
    width, height: 800, status: 200, screenshot: `before/${width}.png`,
    dom: {
      h1: ['Build with confidence'], headings: [{ level: 1, text: 'Build with confidence' }], language: 'en',
      landmarks: { main: 1, navigation: 1 }, images: { count: missingAlt.length, missingAlt }, unlabeledInputs,
      actions: [{ label: 'Start review', href: '/review' }], controls, visibleCopy: ['Build with confidence'], horizontalOverflow: overflow
    }
  };
}

test('responsive reviewer uses matched viewport evidence and reports concrete layout failures', async t => {
  const { directory } = await fixture(t, 'skill005');
  await saveCapture(directory, 'before', { at: '2026-09-20T00:00:00.000Z', url: 'http://127.0.0.1:4321/', viewports: {
    desktop: richView(1280),
    mobile: richView(390, { overflow: true, controls: [{ tag: 'button', label: 'Start review', width: 20, height: 20 }] })
  }});
  const result = await executeSkill({ id: 'responsive-reviewer', directory, registryRoot });
  assert.equal(result.status, 'complete');
  assert.ok(result.findings.some(item => item.id === 'RESPONSIVE-OVERFLOW-MOBILE'));
  assert.ok(result.findings.some(item => item.id === 'RESPONSIVE-TARGET-MOBILE'));
});

test('accessibility reviewer reports DOM-backed barriers without claiming conformance', async t => {
  const { repo, directory } = await fixture(t, 'skill006');
  const view = richView(1280, { missingAlt: ['/hero.png'], unlabeledInputs: [{ tag: 'input', type: 'email', name: 'email' }] });
  view.dom.language = null;
  await saveCapture(directory, 'before', { at: '2026-09-20T00:00:00.000Z', url: 'http://127.0.0.1:4321/', viewports: { desktop: view } });
  const result = await executeSkill({ id: 'accessibility-reviewer', directory, repo, registryRoot });
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.findings.map(item => item.id), ['A11Y-LANG-DESKTOP', 'A11Y-ALT-DESKTOP', 'A11Y-FORM-DESKTOP']);
  assert.match(result.limitations[0], /do not certify/i);
});

test('IA, interaction and content reviewers return captured evidence while retaining task-level limits', async t => {
  for (const [index, id] of ['information-architecture-reviewer', 'interaction-reviewer', 'content-design-reviewer'].entries()) {
    const { directory } = await fixture(t, `skill10${index}`);
    await saveCapture(directory, 'before', { at: '2026-09-20T00:00:00.000Z', url: 'http://127.0.0.1:4321/', viewports: { desktop: richView(1280) } });
    const result = await executeSkill({ id, directory, registryRoot });
    assert.equal(result.status, 'needs-evidence');
    assert.ok(result.evidence.length >= 2);
    assert.ok(result.limitations.length > 0);
  }
});

test('state auditor leaves unclassified requirements empty and missing source evidence unresolved', async t => {
  const { repo, directory } = await fixture(t, 'skill401');
  const result = await executeSkill({ id: 'component-state-auditor', directory, repo, registryRoot });
  assert.equal(result.status, 'needs-evidence');
  assert.equal(result.evidence[0].rubricVersion, '0.2.0');
  assert.equal(result.evidence[0].componentsWithDeclaredStates, 2);
  assert.equal(result.evidence[0].counts.unclassified, 2);
  assert.ok(result.evidence[0].counts.withSource < result.evidence[0].counts.components);
  // Header and Hero match no class, so the audit says so instead of inventing a required set.
  assert.deepEqual(result.findings.map(item => item.id), ['STATE-UNCLASSIFIED-COMPONENT']);
  assert.ok(result.limitations.some(item => /not proof that the state is missing/i.test(item)));
  assert.ok(result.limitations.some(item => /match no class/i.test(item)));
});

test('contrast auditor measures only pairs something stated', async t => {
  const { repo, directory } = await fixture(t, 'skill501');
  const result = await executeSkill({ id: 'token-contrast-auditor', directory, repo, registryRoot });
  // The sample foundation describes its colours in prose, so none of them can be measured.
  assert.equal(result.status, 'needs-evidence');
  assert.equal(result.evidence[0].counts.declared, 0);
  assert.ok(result.evidence[0].unreadable.length > 0);
  assert.ok(result.limitations.some(item => /pair that something states/i.test(item)));
});

test('drift detector holds its boundary when a foundation has no approved rules', async t => {
  const { repo, directory } = await fixture(t, 'skill301');
  const result = await executeSkill({ id: 'design-system-drift-detector', directory, repo, registryRoot });
  // The sample foundation is observed only, so divergences stay review targets.
  assert.equal(result.status, 'needs-evidence');
  assert.equal(result.evidence[0].approvedTokens, 0);
  assert.ok(result.limitations.some(item => /approved tokens/i.test(item)));
  assert.ok(result.limitations.some(item => /not a direction/i.test(item)));
});

test('brand extractor records observed assets with roles and rendered voice evidence', async t => {
  const { repo, directory } = await fixture(t, 'skill201');
  await saveCapture(directory, 'before', { at: '2026-09-20T00:00:00.000Z', url: 'http://127.0.0.1:4321/', viewports: { desktop: richView(1280) } });
  const result = await executeSkill({ id: 'brand-foundation-extractor', directory, repo, registryRoot });
  assert.equal(result.status, 'complete');
  const update = result.proposedUpdates[0];
  assert.equal(update.status, 'observed');
  assert.equal(update.assets[0].path, '/brand-logo.svg');
  assert.equal(update.assets[0].role, 'logo');
  assert.equal(update.assets[0].format, 'svg');
  const sample = update.voiceEvidence.find(item => item.sample === 'Build with confidence');
  assert.ok(sample, 'the rendered H1 appears as voice evidence');
  assert.equal(sample.source, 'desktop', 'voice evidence cites the state it rendered in');
  assert.ok(result.limitations.some(item => /human review/i.test(item)));
});

test('component inventory records source, exports and static consumers', async t => {
  const { repo, directory } = await fixture(t, 'skill202');
  const result = await executeSkill({ id: 'component-inventory', directory, repo, registryRoot });
  assert.equal(result.status, 'complete');
  const button = result.proposedUpdates[0].components.find(item => item.name === 'Button');
  assert.deepEqual(button.exports, ['Button']);
  assert.deepEqual(button.consumers, ['src/App.jsx']);
  assert.equal(button.status, 'observed');
});

// A task-state capture plan records `{ states: [...] }` instead of named viewports.
// Every browser-evidence skill has to read it, not crash on the missing `viewports`
// key, and skip states that did not render rather than analyse nothing.
function planCapture({ reached = true, overflow = false, dom } = {}) {
  return {
    schemaVersion: '0.1', at: '2026-09-26T00:00:00.000Z', adapter: 'web', channel: 'chrome',
    states: [
      {
        stateId: 'checkout', configurationId: 'desktop', start: { url: 'http://127.0.0.1:4321/' },
        actions: [], width: 1280, height: 800, reached, status: reached ? 200 : null,
        finalUrl: 'http://127.0.0.1:4321/checkout', screenshot: reached ? 'before/checkout--desktop.png' : null,
        dom: reached ? (dom ?? richView(1280, { overflow }).dom) : undefined,
        ...(!reached ? { error: 'Start point returned HTTP 500.', failedAction: 0 } : {})
      },
      {
        stateId: 'checkout', configurationId: 'mobile', start: { url: 'http://127.0.0.1:4321/' },
        actions: [], width: 390, height: 844, reached: true, status: 200,
        finalUrl: 'http://127.0.0.1:4321/checkout', screenshot: 'before/checkout--mobile.png',
        dom: richView(390, { overflow }).dom
      }
    ]
  };
}

test('browser-evidence skills read a task-state capture plan in every skill role', async t => {
  for (const id of [
    'visual-hierarchy-reviewer', 'information-architecture-reviewer', 'interaction-reviewer',
    'content-design-reviewer', 'accessibility-reviewer', 'responsive-reviewer', 'brand-foundation-extractor'
  ]) {
    const { repo, directory } = await fixture(t, `plan${id.length}${id.slice(0, 4)}`);
    await saveCapture(directory, 'before', planCapture());
    const result = await executeSkill({ id, directory, repo, registryRoot });
    assert.ok(result.evidence.length > 0, `${id} must contribute evidence from plan states`);
    assert.ok(result.evidence.every(item => item.viewport === undefined), `${id} must not depend on legacy viewport keys`);
    if (result.findings.length) {
      assert.ok(result.findings.every(item => /CHECKOUT--(DESKTOP|MOBILE)/.test(item.id)), `${id} findings must name the state and configuration`);
    }
  }
});

test('a plan state that did not render is excluded from analysis, not crashed on', async t => {
  const { repo, directory } = await fixture(t, 'planmiss');
  await saveCapture(directory, 'before', planCapture({ reached: false }));
  const hierarchy = await executeSkill({ id: 'visual-hierarchy-reviewer', directory, registryRoot });
  assert.equal(hierarchy.status, 'needs-evidence');
  assert.equal(hierarchy.findings.length, 0, 'an unreached state has no DOM findings');
  // The responsive reviewer still sees the reached mobile configuration, but one
  // configuration alone cannot be compared, so it asks for evidence.
  const responsive = await executeSkill({ id: 'responsive-reviewer', directory, registryRoot });
  assert.equal(responsive.status, 'needs-evidence');
  assert.match(responsive.limitations[0], /baseline browser capture|required inputs|matched/i);
});

test('responsive reviewer compares configurations within one state, never two different states', async t => {
  const { directory } = await fixture(t, 'planresp');
  const capture = planCapture({ overflow: true });
  capture.states[1].stateId = 'pricing'; // a different task state with only one configuration
  capture.states.push({
    ...capture.states[0], stateId: 'checkout', configurationId: 'mobile',
    screenshot: 'before/checkout--mobile.png', width: 390, height: 844, dom: richView(390).dom
  });
  await saveCapture(directory, 'before', capture);
  const result = await executeSkill({ id: 'responsive-reviewer', directory, registryRoot });
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.findings.map(item => item.id), ['RESPONSIVE-OVERFLOW-CHECKOUT--DESKTOP'], 'only the matched checkout state is compared; pricing alone is not');
});

test('visual QA matches plan states by state and configuration across captures', async t => {
  const { directory } = await fixture(t, 'planqa');
  await saveCapture(directory, 'before', planCapture());
  await confirmFinding(directory, 'F1', 'supported', 'Baseline still supports this finding.');
  await saveCapture(directory, 'after', planCapture());
  const result = await executeSkill({ id: 'visual-qa-evaluator', directory, registryRoot });
  assert.equal(result.status, 'needs-evidence');
  assert.deepEqual(result.evidence.map(item => item.state), ['checkout--desktop', 'checkout--mobile']);
  assert.ok(result.evidence.every(item => item.before && item.after), 'each state pairs its own before and after screenshot');
});

test('foundation extraction preserves dark-only tokens, whitespace sources and unresolved aliases',async t=>{
  const {repo,directory}=await fixture(t,'alias001');
  await writeFile(join(repo,'src','aliases.css'),'@media (prefers-color-scheme: dark) { --dark-only : #101010; }\n:root { --a: var(--b); --b: var(--a); --missing: var(--unknown, red); }\n.button {color:var( --a );}');
  const result=await executeSkill({id:'foundation-extractor',directory,repo,registryRoot});
  const tokens=result.proposedUpdates[0].tokens;
  assert.equal(tokens.find(token=>token.name==='--dark-only').value,'#101010');
  assert.equal(tokens.find(token=>token.name==='--dark-only').source,'src/aliases.css');
  assert.equal(tokens.find(token=>token.name==='--a').aliasCycle,true);
  assert.equal(tokens.find(token=>token.name==='--a').consumers.some(item=>item.line===3),true);
  assert.deepEqual(tokens.find(token=>token.name==='--missing').unresolvedAliases,['--unknown']);
  assert.ok(result.findings.length>=3);
  assert.ok(tokens.every(token=>token.status==='observed'));
  assert.match(result.provenance.implementationHash,/^[a-f0-9]{64}$/);
  assert.equal(result.provenance.skillVersion,'0.9.0');
});

 test('reuse planning cannot complete without its declared finding input',async t=>{
  const {directory}=await fixture(t,'missing1');
  const result=await executeSkill({id:'component-reuse-planner',directory,registryRoot});
  assert.equal(result.status,'needs-evidence');assert.ok(result.evidence[0].missing.includes('finding'));assert.deepEqual(result.proposedUpdates,[]);
 });

test('retry preserves the missing-evidence artifact and exports both attempts', async t => {
 const {directory}=await fixture(t,'retry001');
 await executeSkill({id:'visual-hierarchy-reviewer',directory,registryRoot});
 const old=await readFile(join(directory,'skills/visual-hierarchy-reviewer.json'),'utf8');
 await saveCapture(directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png',dom:{h1:[],actions:[]}}}});
 const result=await executeSkill({id:'visual-hierarchy-reviewer',directory,registryRoot,retry:true});
 assert.ok(result.findings.length);const run=await loadRun(directory);
 assert.equal(run.manifest.skillAttempts.length,1);assert.notEqual(run.manifest.skills[0].path,run.manifest.skillAttempts[0].path);
 assert.equal(await readFile(join(directory,'skills/visual-hierarchy-reviewer.json'),'utf8'),old);
 const {exportRun}=await import('../packages/harness-core/export.js');
 const output=join(directory,'export');await exportRun({directory,outputRoot:output});
 assert.equal(await readFile(join(output,run.manifest.id,run.manifest.skillAttempts[0].path),'utf8'),old);
 await confirmFinding(directory,'F1','supported','Reviewed');
 await assert.rejects(executeSkill({id:'visual-hierarchy-reviewer',directory,registryRoot,retry:true}),/before confirmation/);
});
test('source edits change provenance while retries cannot replace a completed extraction',async t=>{
 const {directory,repo}=await fixture(t,'hash0001');const first=await executeSkill({id:'foundation-extractor',directory,repo,registryRoot});
 await writeFile(join(repo,'extra.css'),':root { --new: #abcdef; }');
 const parent=join(directory,'..');const next=await createRun({spec:structuredClone(sample),url:'http://localhost:4321',outputRoot:parent,id:'hash0002'});
 const second=await executeSkill({id:'foundation-extractor',directory:next.directory,repo,registryRoot});
 assert.notEqual(first.provenance.sourceHash,second.provenance.sourceHash);assert.notEqual(first.provenance.inputHash,second.provenance.inputHash);
 await assert.rejects(executeSkill({id:'foundation-extractor',directory,repo,registryRoot,retry:true}),/incomplete result/);
});

test('design language review carries brand context and rubric without inventing visual defects', async t => {
  const { directory } = await fixture(t, 'language1');
  await saveCapture(directory, 'before', {viewports:{desktop:{screenshot:'before/desktop.png',dom:{h1:['Product'],actions:[]}}}});
  const result=await executeSkill({id:'visual-hierarchy-reviewer',directory,registryRoot});
  const run=await loadRun(directory);
  assert.equal(result.status,'needs-evidence');
  assert.deepEqual(result.findings,[]);
  assert.equal(result.reviewBrief.criticalTask,run.spec.project.task);
  assert.deepEqual(result.reviewBrief.designFoundation,run.spec.designFoundation || null);
  assert.equal(result.reviewBrief.foundationApproval,null);
  assert.equal(result.reviewBrief.rubric.id,'design-language-review');
  assert.equal(result.designGuidance.mode,'review');
  assert.deepEqual(result.provenance.designGuidance,result.designGuidance);
  assert.equal(result.designGuidancePacks.mode,'review');
  assert.deepEqual(result.provenance.designGuidancePacks,result.designGuidancePacks);
  assert.match(result.guidanceApplication,/available-only/);
  assert.ok((await readFile(join(directory,result.designGuidance.reference,'upstream/SKILL.md'),'utf8')).includes('Style Register Derivation'));
  assert.ok(result.reviewBrief.rubric.checks.every(check=>check.counterexample));
  assert.ok(result.provenance.contractHash);
});

test('consistency audit reports and excludes vendored and generated palettes', async t => {
 const {repo,directory}=await fixture(t,'scope-colors');
 for(const folder of ['vendor','generated','public/_next']) {
   await mkdir(join(repo,folder),{recursive:true});
   await writeFile(join(repo,folder,'palette.css'),Array.from({length:8},(_,i)=>`.x${i}{color:#abcdef;background:#abcdef;border-radius:${i}px}`).join('\n'));
 }
 const result=await executeSkill({id:'consistency-auditor',directory,repo,registryRoot});
 assert.equal(result.evidence[0].excludedSources.length,3);
 assert.ok(!result.findings.some(f=>f.id==='CONSISTENCY-COLOR-SPRAWL'));
});

test('foundation extraction preserves empty CSS custom property values', async t => {
 const {repo,directory}=await fixture(t,'empty-token');
 await writeFile(join(repo,'empty.css'),':root { --optional: ; } .dark { --optional: ; }');
 const result=await executeSkill({id:'foundation-extractor',directory,repo,registryRoot});
 const token=result.proposedUpdates[0].tokens.find(item=>item.name==='--optional');
 assert.equal(token.value,'');
 assert.equal(token.category,'other');
});
