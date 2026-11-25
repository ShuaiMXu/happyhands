import {createHash} from 'node:crypto';
import {join} from 'node:path';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const legacy = new Set(['taste', 'taste-v2']);
const auditMethods = {
  'task-flow': 'interaction-reviewer',
  'hierarchy-content': 'content-design-reviewer',
  'grid-layout': 'visual-hierarchy-reviewer',
  'components-states': 'component-state-auditor',
  'ai-slop': 'visual-hierarchy-reviewer',
  'feedback-recovery': 'error-recovery-reviewer',
  accessibility: 'accessibility-reviewer',
  motion: 'interaction-reviewer',
  responsive: 'responsive-reviewer'
};
const websiteAuditReferences = {
  'hierarchy-content': 'upstream/references/copy.md',
  'grid-layout': 'upstream/references/layout-v4.md',
  motion: 'upstream/references/motion.md'
};
export const AUDIT_READING_TOPICS = Object.freeze(Object.keys(auditMethods));

function auditMethod(surface, topic) {
  const website = surface === 'public-page';
  if (!topic) return website ? ['web-taste', 'upstream/SKILL.md'] : ['local-experience', 'review-product/SKILL.md'];
  if (website && websiteAuditReferences[topic]) return ['web-taste', websiteAuditReferences[topic]];
  return ['local-experience', 'product-design/' + auditMethods[topic] + '/SKILL.md'];
}

function readingGroup({id, reference, inventory, candidates, required, adapter, bundleHash}) {
  const byPath = new Map(inventory.map(file => [file.path, file]));
  const sources = paths => [...new Set(paths)].map(path => {
    const file = byPath.get(path);
    if (!file) throw Error(`Reading plan references an unstaged method: ${id}/${path}`);
    return {path: reference + '/' + path, sha256: file.sha256};
  });
  const mustRead = sources(required);
  return {
    id, reference, bundleHash,
    embedded: adapter ? [{path: reference + '/ADAPTER.md', sha256: sha256(adapter)}] : [],
    mustRead,
    onDemand: sources(candidates.filter(path => !required.includes(path)))
  };
}

export function buildGuidanceReadingPlan({
  design, local, goal, stage, repairImpact = 'unknown', depth = process.env.HAPPYHANDS_GUIDANCE_DEPTH
} = {}) {
  const groups = [];
  const excluded = [];
  const profile = design?.metadata.profile;
  const full = depth === 'full';
  const narrowRepair = repairImpact === 'local' && goal?.kind === 'repair' && ['polish', 'harden'].includes(profile?.intent);
  for (const pack of design?.packs || []) {
    const {id, readFirst, bundleHash} = pack.metadata;
    const candidates = readFirst.filter(path => path !== 'ADAPTER.md');
    if (!candidates.length) {
      excluded.push({id, reason: 'Inactive compatibility profile'});
      continue;
    }
    // Impeccable's selected playbooks and explicit legacy routes retain their
    // complete reading requirements. Only web-taste's complementary reading
    // is deferred on working screens and narrowly scoped, confirmed repairs.
    const requireRoute = full || id !== 'web-taste' || (profile.taste === 'public-page' && !narrowRepair);
    const required = requireRoute ? candidates : candidates.filter(path => path.endsWith('/SKILL.md'));
    const auditReferences = ['audit', 'diagnosis'].includes(stage) && profile.taste === 'public-page' && id === 'web-taste'
      ? Object.values(websiteAuditReferences) : [];
    groups.push(readingGroup({id, reference: design.metadata.reference + '/' + id,
      inventory: pack.documents, candidates: [...candidates, ...auditReferences], required, adapter: pack.adapter, bundleHash}));
  }
  if (design?.uiRules) {
    const reference = design.metadata.reference + '/happyhands-ui';
    groups.push(readingGroup({id: 'happyhands-ui', reference,
      inventory: [{path: 'SKILL.md', sha256: design.metadata.uiRulesHash}], candidates: ['SKILL.md'],
      required: ['SKILL.md'], bundleHash: design.metadata.bundleHash}));
  }
  if (local) {
    const paths = local.files.filter(file => file.path.endsWith('.md')).map(file => file.path);
    const required = stage === 'decision'
      ? ['product-design/fix-planner/SKILL.md', 'product-design/component-reuse-planner/SKILL.md']
      : local.readFirst.map(path => path.slice(local.reference.length + 1));
    groups.push(readingGroup({id: 'local-experience', reference: local.reference, inventory: local.files,
      candidates: paths, required, bundleHash: local.sha256}));
  }
  const compat = profile?.taste === 'dials-v1' || profile?.taste === 'legacy-v2';
  if (design && !compat) {
    for (const id of legacy) excluded.push({id, reason: 'Inactive compatibility profile'});
  }
  return {
    version: 'guidance-reading-plan@1',
    stage: stage || design?.metadata.mode || 'audit',
    surface: profile?.taste || null,
    depth: full ? 'full' : 'focused',
    goal: goal?.kind || null,
    repairImpact,
    groups, excluded
  };
}

export function buildAuditStepReadingPlan(plan, step = 'inspect', topic) {
  if (plan.stage !== 'audit' || !['app-screen', 'public-page'].includes(plan.surface)) {
    throw Error('An audit step requires an audit plan with an app-screen or public-page surface.');
  }
  if (!['inspect', 'method', 'record'].includes(step)) throw Error('Unknown audit step: ' + step);
  if (topic !== undefined && (step !== 'method' || !AUDIT_READING_TOPICS.includes(topic))) {
    throw Error('Select one recognized audit topic with the method step.');
  }
  const scoped = {version: 'guidance-reading-plan@1', stage: 'audit', surface: plan.surface, depth: 'focused',
    step, topic: topic ?? null, groups: [], excluded: []};
  if (step !== 'method') return scoped;

  const selected = [auditMethod(plan.surface)];
  if (topic) selected.push(auditMethod(plan.surface, topic));

  for (const [id, path] of selected) {
    const original = plan.groups.find(group => group.id === id);
    const file = original && [...original.mustRead, ...original.onDemand].find(item => item.path === original.reference + '/' + path);
    if (!file) throw Error('Audit method is missing from the staged reading plan: ' + id + '/' + path);
    let group = scoped.groups.find(entry => entry.id === id);
    if (!group) {
      // The same adapter guards every use of a pinned source. Refer to it by hash
      // so a second question need not embed or re-read the full adapter.
      group = {...original, readOnce: original.embedded, embedded: [], mustRead: [], onDemand: []};
      scoped.groups.push(group);
    }
    group.mustRead.push(file);
  }
  return scoped;
}

export function buildDiagnosisReadingPlan({design, local, audit, originalRefs, ownedUi = false, depth} = {}) {
  const plan = buildGuidanceReadingPlan({design, stage: 'diagnosis', goal: audit?.task?.goal, depth});
  if (['dials-v1', 'legacy-v2'].includes(plan.surface)) return plan;

  // Nine dimension checks are required even for a healthy page. Only an issue
  // linked to an assigned original can nominate a specialist for this batch.
  const originals = originalRefs == null ? null : new Set(originalRefs);
  const priority = {high: 0, medium: 1, low: 2};
  const issues = (audit?.issues || []).filter(issue => AUDIT_READING_TOPICS.includes(issue.topic)
    && (!originals || issue.screenshotRefs.some(ref => originals.has(ref))));
  const initial = [auditMethod(plan.surface)];
  const selectedTopics = [];
  for (const issue of issues.sort((a, b) => priority[a.priority] - priority[b.priority])) {
    const method = auditMethod(plan.surface, issue.topic);
    if (initial.some(([id, path]) => id === method[0] && path === method[1])) continue;
    initial.push(method);
    selectedTopics.push(issue.topic);
    if (selectedTopics.length === 2) break;
  }

  // Keep all baseline specialists discoverable for issues missed in the
  // pre-audit, including older audits that do not associate issues with topics.
  const localCandidates = ['review-product/SKILL.md', ...AUDIT_READING_TOPICS.map(topic => auditMethod('app-screen', topic)[1])];
  const localGroup = readingGroup({id: 'local-experience', reference: local.reference, inventory: local.files,
    candidates: localCandidates, required: [], bundleHash: local.sha256});
  const groups = [];
  for (const group of [...plan.groups, localGroup]) {
    if (group.id === 'happyhands-ui' && !ownedUi && plan.depth !== 'full') continue;
    const all = [...group.mustRead, ...group.onDemand];
    const files = new Map(all.map(file => [file.path, file]));
    const required = new Set(plan.depth === 'full' ? group.mustRead.map(file => file.path) : []);
    for (const [id, path] of initial) {
      if (group.id !== id) continue;
      const stagedPath = group.reference + '/' + path;
      if (!files.has(stagedPath)) throw Error('Diagnosis method missing from the staged reading plan: ' + stagedPath);
      required.add(stagedPath);
    }
    groups.push({...group, readOnce: group.embedded, embedded: [],
      mustRead: [...required].map(path => files.get(path)), onDemand: all.filter(file => !required.has(file.path))});
  }
  return {...plan, groups, selectedTopics};
}

export function formatGuidanceReadingGroup(group, directory, adapter) {
  const paths = entries => entries.map(({path}) => join(directory, ...path.split('/'))).join('\n');
  const sections = [];
  if (group.readOnce?.length) sections.push('Read the Harness adapter on first use of this snapshot:\n' + paths(group.readOnce));
  if (group.mustRead.length) sections.push('Read in full before this stage:\n' + paths(group.mustRead));
  if (group.onDemand.length) sections.push('Open the complete applicable references when the task or evidence needs them:\n' + paths(group.onDemand));
  if (group.embedded.length) sections.push('Harness adapter (complete text included here, no separate read):\n' + paths(group.embedded) + '\n' + adapter);
  return sections.join('\n');
}
