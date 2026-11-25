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
    const auditReferences = stage === 'audit' && profile.taste === 'public-page' && id === 'web-taste'
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

  const website = plan.surface === 'public-page';
  const primary = website ? ['web-taste', 'upstream/SKILL.md'] : ['local-experience', 'review-product/SKILL.md'];
  const selected = [primary];
  if (topic) {
    const webReference = website && websiteAuditReferences[topic];
    selected.push(webReference ? ['web-taste', webReference] : ['local-experience', 'product-design/' + auditMethods[topic] + '/SKILL.md']);
  }

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

export function formatGuidanceReadingGroup(group, directory, adapter) {
  const paths = entries => entries.map(({path}) => join(directory, ...path.split('/'))).join('\n');
  const sections = [];
  if (group.readOnce?.length) sections.push('Read the Harness adapter on first use of this snapshot:\n' + paths(group.readOnce));
  if (group.mustRead.length) sections.push('Read in full before this stage:\n' + paths(group.mustRead));
  if (group.onDemand.length) sections.push('Open the complete applicable references when the task or evidence needs them:\n' + paths(group.onDemand));
  if (group.embedded.length) sections.push('Harness adapter (complete text included here, no separate read):\n' + paths(group.embedded) + '\n' + adapter);
  return sections.join('\n');
}
