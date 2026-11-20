import {createHash} from 'node:crypto';
import {join} from 'node:path';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const legacy = new Set(['taste', 'taste-v2']);

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
  design, ojo, local, goal, stage, repairImpact = 'unknown', implementationRefs = [], depth = process.env.HAPPYHANDS_GUIDANCE_DEPTH
} = {}) {
  const groups = [];
  const excluded = [];
  const profile = design?.metadata.profile;
  const full = depth === 'full';
  const narrowRepair = repairImpact === 'local' && goal?.kind === 'repair' && ['polish', 'harden'].includes(profile?.intent);
  if (ojo) {
    // The OJO adapter requires the entry and anti-patterns. Audit and any
    // execution-contract recipes remain required in their respective stages.
    const candidates = ojo.documents.filter(file => file.path.endsWith('.md')).map(file => file.path);
    const required = [...ojo.metadata.readFirst.filter(path => path !== 'ADAPTER.md'), ...implementationRefs];
    groups.push(readingGroup({id: ojo.metadata.id, reference: ojo.metadata.reference,
      inventory: ojo.documents, candidates, required, adapter: ojo.adapter,
      bundleHash: ojo.metadata.bundleHash}));
  }
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
    groups.push(readingGroup({id, reference: design.metadata.reference + '/' + id,
      inventory: pack.documents, candidates, required, adapter: pack.adapter, bundleHash}));
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
    stage: stage || design?.metadata.mode || ojo?.metadata.mode || 'audit',
    surface: profile?.taste || null,
    depth: full ? 'full' : 'focused',
    goal: goal?.kind || null,
    repairImpact,
    groups, excluded
  };
}

export function formatGuidanceReadingGroup(group, directory, adapter) {
  const paths = entries => entries.map(({path}) => join(directory, ...path.split('/'))).join('\n');
  const sections = [];
  if (group.mustRead.length) sections.push('Read in full before this stage:\n' + paths(group.mustRead));
  if (group.onDemand.length) sections.push('Open the complete applicable references when the task or evidence needs them:\n' + paths(group.onDemand));
  if (group.embedded.length) sections.push('Harness adapter (complete text included here, no separate read):\n' + paths(group.embedded) + '\n' + adapter);
  return sections.join('\n');
}
