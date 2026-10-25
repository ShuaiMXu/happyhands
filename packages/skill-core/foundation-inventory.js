import { readFile } from 'node:fs/promises';
import { executeSkill } from './runner.js';
import { sourceFiles } from './scan.js';
import { loadRun, runFilePath, saveFoundationInventory } from '../harness-core/store.js';
import {designSystemContext,snapshotHash,evidenceHash} from './design-system.js';
import {extractDesignSystem} from '../harness-core/design-system.js';

export const FOUNDATION_SKILL_IDS = [
  'foundation-extractor',
  'brand-foundation-extractor',
  'component-inventory',
  'pattern-library-curator'
];

const blankFoundation = () => ({
  status: 'observed',
  brand: { principles: [], voice: [], assets: [], voiceEvidence: [] },
  tokens: [],
  components: [],
  patterns: []
});

function updateOf(result, type) {
  return result?.proposedUpdates?.find(update => update.type === type) || null;
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))];
}

function mergeEntries(existing, observed, keyOf = item => item.name) {
  const merged = structuredClone(existing || []);
  const keys = new Set(merged.map(item => String(keyOf(item))));
  for (const item of observed) {
    const key = String(keyOf(item));
    if (!keys.has(key)) { merged.push(item); keys.add(key); }
    else {const index=merged.findIndex(entry=>String(keyOf(entry))===key);if(merged[index].status==='observed'&&!merged[index].decision)merged[index]=item;}
  }
  return merged;
}

function observedTokens(result) {
  return (updateOf(result, 'design-foundation')?.tokens || []).map(token => ({
    evidence: {schemaVersion:'0.1',status:'observed',details:structuredClone(token)},
    category: token.category,
    name: token.name,
    value: token.value,
    source: token.source,
    status: 'observed',
    ...(token.variants?.length ? { variants: uniqueStrings(token.variants) } : {}),
    ...(token.themes && Object.values(token.themes).every(Boolean) ? { themes: token.themes } : {})
  }));
}

function observedComponents(results) {
  const candidates = [
    ...(updateOf(results.get('component-inventory'), 'component-inventory')?.components || []),
    ...(updateOf(results.get('foundation-extractor'), 'design-foundation')?.components || [])
  ];
  const seen = new Set();
  return candidates.flatMap(component => {
    const key = `${component.name}:${component.source}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      evidence: {schemaVersion:'0.1',status:'observed',details:structuredClone(component)},
      name: component.name,
      source: component.source,
      variants: [],
      states: [],
      status: 'observed'
    }];
  });
}

function observedAssets(result) {
  return (updateOf(result, 'brand-foundation-candidates')?.assets || []).map(asset => ({
    evidence: {schemaVersion:'0.1',status:'observed',details:structuredClone(asset)},
    name: asset.name,
    description: `${asset.role || 'asset'} observed in the reviewed repository`,
    source: asset.sources?.[0] || asset.path,
    status: 'observed',
    ...(asset.role ? { role: asset.role } : {}),
    ...(asset.format ? { format: asset.format } : {})
  }));
}

export function observedFoundationFrom(existing, resultEntries, extraction = null) {
  const foundation = existing ? structuredClone(existing) : blankFoundation();
  // An approved foundation is immutable. The caller still records extraction
  // artifacts, but does not turn new observations into approved constraints.
  if (foundation.status === 'approved') return foundation;
  const results = resultEntries instanceof Map ? resultEntries : new Map(resultEntries.map(result => [result.skill.id, result]));
  const brand = updateOf(results.get('brand-foundation-extractor'), 'brand-foundation-candidates');
  foundation.status = 'observed';
  foundation.brand ||= { principles: [], voice: [], assets: [] };
  foundation.brand.principles ||= [];
  foundation.brand.voice ||= [];
  foundation.brand.assets = mergeEntries(foundation.brand.assets, observedAssets(results.get('brand-foundation-extractor')), item => `${item.name}:${item.source}`);
  const voiceEvidence = [...(foundation.brand.voiceEvidence || []), ...(brand?.voiceEvidence || [])];
  const voiceKeys = new Set();
  foundation.brand.voiceEvidence = voiceEvidence.filter(item => {
    const key = `${item.sample}:${item.source}`;
    if (!item.sample || !item.source || voiceKeys.has(key)) return false;
    voiceKeys.add(key); return true;
  });
  foundation.tokens = mergeEntries(foundation.tokens, observedTokens(results.get('foundation-extractor')));
  foundation.components = mergeEntries(foundation.components, observedComponents(results), item => `${item.name}:${item.source}`);
  if(extraction)for(const item of [...foundation.tokens,...foundation.components,...foundation.brand.assets])if(item.evidence&&item.status==='observed')item.evidence.provenance={source:extraction.source,artifact:extraction.artifact,extractorVersion:extraction.extractorVersion||'0.1',captureHash:extraction.captureHash};
  if(extraction)for(const item of foundation.components){
    const observed=extraction.components.find(component=>component.source===item.source&&component.name===item.name);
    if(observed&&item.status==='observed')item.evidence={schemaVersion:'0.1',status:'observed',details:structuredClone(observed),provenance:{source:extraction.source,artifact:extraction.artifact,extractorVersion:extraction.extractorVersion||'0.1',captureHash:extraction.captureHash}};
  }
  foundation.patterns ||= [];
  return foundation;
}

async function previousResult(run, id) {
  const record = run.manifest.skills.find(item => item.id === id);
  return record ? JSON.parse(await readFile(runFilePath(run.directory, record.path), 'utf8')) : null;
}

export async function extractFoundationInventory({ directory, repo, registryRoot, onProgress, retryIncomplete = false, signal } = {}) {
  const startedAt = new Date().toISOString();
  try {
    signal?.throwIfAborted();
    const snapshot = await sourceFiles(repo,{includeDesignDocs:true});
    const priorExtraction=(await designSystemContext(await loadRun(directory))).before;
    if(priorExtraction&&priorExtraction.source.snapshotHash!==snapshotHash(snapshot))throw Error('Source no longer matches Foundation capture; start a fresh capture.');
    signal?.throwIfAborted();
    const results = [];
    for (const id of FOUNDATION_SKILL_IDS) {
      signal?.throwIfAborted();
      await onProgress?.(id);
      const run = await loadRun(directory);
      const previous = await previousResult(run, id);
      // Pattern history can be withdrawn independently of source files. Never
      // silently reuse a previously collected history assessment as live proof.
      if(previous&&id==='pattern-library-curator'){
        const {acceptedPatternHistory}=await import('../harness-core/pattern-history.js');
        const history=await acceptedPatternHistory(run,repo,snapshot);
        if(previous.provenance?.patternHistoryHash!==evidenceHash(JSON.stringify(history)))throw Error('Pattern history changed; start a fresh review before reusing candidates.');
      }
      if(previous&&previous.provenance?.sourceHash!==evidenceHash(JSON.stringify(snapshot.files)))throw Error('Cached Foundation evidence belongs to different source inputs; start a new run.');
      results.push(previous && (!retryIncomplete || previous.status === 'complete')
        ? previous
        : await executeSkill({ id, directory, repo, registryRoot, sourceSnapshot: snapshot, retry: Boolean(previous) }));
      signal?.throwIfAborted();
    }
    const run = await loadRun(directory);
    if(run.manifest.captures.before&&!run.manifest.designSystemExtractions?.before&&!run.manifest.plan&&!run.manifest.execution&&!run.manifest.captures.after)await extractDesignSystem({directory,repo,phase:'before',signal});
    if(snapshotHash(snapshot)!==snapshotHash(await sourceFiles(repo,{includeDesignDocs:true})))throw Error('Source changed during Foundation inventory; start a fresh capture.');
    const foundation = observedFoundationFrom(run.spec.designFoundation, results, (await designSystemContext(await loadRun(directory))).before);
    const statuses = results.map(result => ({ id: result.skill.id, version: result.skill.version, status: result.status }));
    const status = statuses.every(item => item.status === 'complete') ? 'complete' : 'partial';
    const counts = {
      assets: foundation.brand.assets.length,
      tokens: foundation.tokens.length,
      components: foundation.components.length,
      patterns: foundation.patterns.length
    };
    const inventory = await saveFoundationInventory(directory, { status, startedAt, completedAt: new Date().toISOString(), skills: statuses, counts }, foundation);
    return { inventory, foundation, results };
  } catch (error) {
    if (signal?.aborted) throw error;
    await saveFoundationInventory(directory, { status: 'failed', startedAt, failedAt: new Date().toISOString(), error: error.message });
    throw error;
  }
}
