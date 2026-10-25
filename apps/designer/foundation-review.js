export function foundationEntries(foundation) {
  if (!foundation) return [];
  return [
    ...(foundation.brand?.assets || []).map(item => ({ ...item, collection: 'assets' })),
    ...(foundation.tokens || []).map(item => ({ ...item, collection: 'tokens' })),
    ...(foundation.components || []).map(item => ({ ...item, collection: 'components' })),
    ...(foundation.patterns || []).map(item => ({ ...item, collection: 'patterns' }))
  ];
}

export function foundationKey(collection, item) {
  return `${collection}:${item.name}`;
}

export function createFoundationDraft(foundation, {preserveDecisions = true} = {}) {
  if (!foundation) return null;
  const draft = structuredClone(foundation);
  draft.status = 'observed';
  draft.brand ||= { principles: [], voice: [], assets: [] };
  // Historical decisions describe an earlier version. A fresh editable draft
  // starts from the current rules; its first action records that baseline.
  if(!preserveDecisions)for(const items of [draft.brand.assets,draft.tokens,draft.components,draft.patterns])for(const item of items||[])if(item.decision){delete item.decision;item.status='observed';}
  return draft;
}

export function foundationDecisionSummary(foundation) {
  const entries = foundationEntries(foundation);
  return {
    total: entries.length,
    approved: entries.filter(item => item.status === 'approved').length,
    deprecated: entries.filter(item => item.status === 'deprecated').length,
    deferred: entries.filter(item => item.status === 'observed' && item.decision?.action === 'deferred' && item.decision.reason?.trim()).length,
    pending: entries.filter(item => (!(['approved', 'deprecated'].includes(item.status) || item.status === 'observed' && item.decision?.action === 'deferred') || (item.evidence || item.decision) && !item.decision?.reason?.trim())).length
  };
}

export async function loadFoundationEvidenceRecords(records, readJson) {
  return Promise.all(records.map(async record => {
    try {
      if (!/^skills\/[a-zA-Z0-9_-]+\.json$/.test(record.path || '')) throw new Error('Invalid path');
      const result = await readJson(record.path);
      if (result?.skill?.id !== record.id || typeof result.status !== 'string'
        || ['findings', 'evidence', 'limitations', 'proposedUpdates'].some(key => result[key] != null && !Array.isArray(result[key]))) {
        throw new Error('Invalid result');
      }
      return result;
    } catch {
      return {
        skill: { id: record.id }, status: 'needs-evidence', unavailable: true,
        findings: [], evidence: [], proposedUpdates: [],
        limitations: ['Extraction result unavailable. Reload the review or re-extract from the connected project.']
      };
    }
  }));
}

export function summarizeFoundationEvidence(results = []) {
  const skills = results.filter(Boolean).map(result => ({
    id: result.skill?.id || 'unknown',
    status: result.status || 'needs-evidence',
    findingCount: result.findings?.length || 0,
    evidenceCount: result.evidence?.length || 0
  }));
  const findings = results.flatMap(result => (result?.findings || []).map(item => ({
    ...item,
    skillId: result.skill?.id || 'unknown'
  })));
  const limitations = results.flatMap(result => (result?.limitations || []).map(message => ({
    skillId: result.skill?.id || 'unknown',
    message
  })));
  const tokenUpdate = results
    .flatMap(result => result?.proposedUpdates || [])
    .find(update => update.type === 'design-foundation');
  const tokenFlags = new Map((tokenUpdate?.tokens || []).flatMap(token => {
    const flags = [];
    if (token.conflicts) flags.push('conflict');
    if (token.unresolvedAliases?.length) flags.push('unresolved-alias');
    if (token.aliasCycle) flags.push('alias-cycle');
    return flags.length ? [[token.name, flags]] : [];
  }));
  const filesScanned = Math.max(0, ...results.flatMap(result => (result?.evidence || []).map(item => Number(item.filesScanned) || 0)));
  const incompleteCount = skills.filter(skill => skill.status !== 'complete').length;
  const patternCandidates=results.filter(result=>result?.skill?.id==='pattern-library-curator')
    .flatMap(result=>result.proposedUpdates||[]).filter(update=>update.type==='pattern-candidates'&&Array.isArray(update.candidates))
    .flatMap(update=>update.candidates).filter(candidate=>candidate?.status==='observed').slice(0,128);
  const brandDeclarations=results.filter(result=>result?.skill?.id==='brand-foundation-extractor').flatMap(result=>result.proposedUpdates||[])
    .filter(update=>update.type==='brand-foundation-candidates'&&update.status==='observed').map(update=>update.declarations).filter(Boolean);
  return { skills, findings, limitations, tokenFlags, filesScanned, incompleteCount, patternCandidates,brandDeclarations };
}

function comparable(entry) {
  const copy = structuredClone(entry);
  delete copy.collection;
  return JSON.stringify(copy);
}

export function diffFoundations(previous, current) {
  const previousEntries = foundationEntries(previous);
  const currentEntries = foundationEntries(current);
  // Scope repeated names by source on both sides, so removing one namesake
  // cannot make the remaining entry look like a replacement of another.
  const repeated = new Set();
  for (const entries of [previousEntries, currentEntries]) {
    const seen = new Set();
    for (const item of entries) {
      const key = foundationKey(item.collection, item);
      if (seen.has(key)) repeated.add(key);
      seen.add(key);
    }
  }
  const index = entries => {
    const occurrences = new Map();
    return new Map(entries.map(item => {
      const nameKey = foundationKey(item.collection, item);
      const scopedKey = repeated.has(nameKey) ? `${nameKey}:${JSON.stringify(item.source || '')}` : nameKey;
      const occurrence = occurrences.get(scopedKey) || 0;
      occurrences.set(scopedKey, occurrence + 1);
      return [`${scopedKey}:${occurrence}`, item];
    }));
  };
  const before = index(previousEntries);
  const after = index(currentEntries);
  const changes = [];
  for (const [key, item] of after) {
    const old = before.get(key);
    changes.push({ key, item, previous: old || null, type: !old ? 'added' : comparable(old) === comparable(item) ? 'unchanged' : item.status === 'deprecated' && old.status !== 'deprecated' ? 'deprecated' : 'changed' });
  }
  for (const [key, item] of before) if (!after.has(key)) changes.push({ key, item, previous: item, type: 'removed' });
  return changes;
}

export function nextFoundationVersion(previousVersion) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(previousVersion || '');
  return match ? `${match[1]}.${Number(match[2]) + 1}.0` : '1.0.0';
}

export function approvalFromDraft({ foundation, version, reviewer, reviewerType = 'human', reason }) {
  const decisions = foundationDecisionSummary(foundation);
  if (decisions.pending) throw new Error(`${decisions.pending} foundation candidates still need an explicit approve, replace, defer or deprecate decision.`);
  const snapshot = structuredClone(foundation);
  snapshot.status = 'approved';
  return {
    schemaVersion: '0.1',
    foundationVersion: version.trim(),
    reviewer: { type: reviewerType, name: reviewer.trim() },
    reason: reason.trim(),
    foundation: snapshot
  };
}
