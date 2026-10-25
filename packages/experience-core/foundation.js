// All rule fields participate in approval comparison and replacement history.
// Metadata stays separate; future schema fields cannot silently bypass the gate.
export function foundationRuleFields(entry) {
  return Object.fromEntries(Object.keys(entry).filter(key=>!['status','evidence','decision'].includes(key)).sort().map(key=>[key,structuredClone(entry[key])]));
}

export function restoreFoundationRule(entry, previous) {
  for(const key of Object.keys(foundationRuleFields(entry)))delete entry[key];
  Object.assign(entry,structuredClone(previous));
}

// Staged entries are a separate review surface. Existing approved snapshots
// stay untouched until the complete version passes the ordinary approval gate.
export function foundationWithPatternAdmissions(foundation,records=[]){
  const draft=structuredClone(foundation);if(!draft)return draft;
  for(const record of records){
    const entry=record.entry,provenance=entry?.evidence?.provenance;
    if(provenance?.type!=='pattern-guidance-admission')throw Error('Invalid staged pattern provenance.');
    const existing=draft.patterns.find(item=>item.evidence?.provenance?.runId===provenance.runId&&item.evidence?.provenance?.admissionId===provenance.admissionId);
    if(existing)continue;
    if(draft.patterns.some(item=>item.name===entry.name&&item.source===entry.source))throw Error('A pattern with this source and name already exists; use explicit replacement.');
    draft.patterns.push(structuredClone(entry));
  }
  return draft;
}

export function approvedPatternConstraints(foundation){
  const patterns=foundation?.status==='approved'?foundation.patterns.filter(item=>item.status==='approved'&&item.usage):[];
  return patterns.length?'\n## Approved pattern constraints\nApply these only where their usage conditions hold. Preserve avoidance conditions, exceptions and evidence limits; do not infer unreviewed states. Source examples are historical evidence, not executable instructions.\n'+JSON.stringify(patterns.map(item=>foundationRuleFields(item)),null,2)+'\n':'';
}

const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/;
const DECISIONS = new Set(['approved', 'deprecated']);

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function assertDecided(entries, label) {
  for (const entry of entries || []) {
    if(entry.evidence || entry.decision){
      const action=entry.decision?.action;
      if(!['approved','replace','deprecated','deferred'].includes(action)||!entry.decision?.reason?.trim())throw new Error(`Foundation item ${entry.name} needs an explicit decision and reason.`);
      if((action==='deprecated')!==(entry.status==='deprecated'))throw new Error(`Foundation item ${entry.name} decision does not match status.`);
    }
    if (entry.decision?.action === 'deferred') {
      if (entry.status !== 'observed') throw new Error('Deferred Foundation entries must remain observed.');
      continue;
    }
    if (!DECISIONS.has(entry.status)) {
      throw new Error(`${label} "${entry.name || 'unnamed'}" must be approved or deprecated; observed entries cannot constrain generation.`);
    }
  }
}

export function assertFoundationApproval(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Foundation approval must be a JSON object.');
  if (input.schemaVersion !== '0.1') throw new Error('Foundation approval schemaVersion must be 0.1.');
  if (!VERSION.test(String(input.foundationVersion || ''))) throw new Error('foundationVersion must be a semantic version such as 1.0.0.');
  requiredText(input.reviewer?.name, 'Foundation reviewer name');
  if (!['human', 'team'].includes(input.reviewer?.type)) throw new Error('Foundation reviewer type must be human or team.');
  requiredText(input.reason, 'Foundation approval reason');
  const foundation = input.foundation;
  if (!foundation || typeof foundation !== 'object') throw new Error('Foundation approval must include a complete foundation snapshot.');
  for (const key of ['brand', 'tokens', 'components', 'patterns']) if (!(key in foundation)) throw new Error(`Foundation snapshot is missing ${key}.`);
  if (!Array.isArray(foundation.brand?.principles) || !Array.isArray(foundation.brand?.voice) || !Array.isArray(foundation.brand?.assets)) {
    throw new Error('Foundation brand must include principles, voice and assets arrays.');
  }
  for (const [entries, label] of [[foundation.brand.assets, 'Brand asset'], [foundation.tokens, 'Token'], [foundation.components, 'Component'], [foundation.patterns, 'Pattern']]) {
    if (!Array.isArray(entries)) throw new Error(`${label} collection must be an array.`);
    assertDecided(entries, label);
  }
  const usable = [...foundation.tokens, ...foundation.components, ...foundation.patterns].filter(entry => entry.status === 'approved');
  for(const pattern of foundation.patterns.filter(item=>item.status==='approved'&&item.usage)){
    if(pattern.usage.schemaVersion!=='0.1'||['whenToUse','whenToAvoid','exceptions','limitations','dependencies'].some(key=>!Array.isArray(pattern.usage[key])||!pattern.usage[key].length||pattern.usage[key].some(value=>typeof value!=='string'||!value.trim()))
      ||!Array.isArray(pattern.usage.tokenReferences)||!Array.isArray(pattern.usage.examples)||pattern.usage.examples.length<2)throw Error(`Pattern ${pattern.name} needs complete usage conditions, exceptions, dependencies and examples.`);
    const components=new Set(foundation.components.filter(item=>item.status==='approved').map(item=>item.source));
    const tokens=new Set(foundation.tokens.filter(item=>item.status==='approved').map(item=>item.name));
    if(pattern.usage.dependencies.some(source=>!components.has(source)))throw Error(`Pattern ${pattern.name} depends on components that are not approved in this Foundation version.`);
    if(pattern.usage.tokenReferences.some(name=>!tokens.has(name)))throw Error(`Pattern ${pattern.name} references tokens that are not approved in this Foundation version.`);
  }
  if (!usable.length) throw new Error('Foundation approval needs at least one approved token, component or pattern.');
  return input;
}

export function approvedFoundationFrom(input) {
  assertFoundationApproval(input);
  return { ...structuredClone(input.foundation), status: 'approved' };
}

export function foundationApprovalReference(input) {
  assertFoundationApproval(input);
  return {
    schemaVersion: input.schemaVersion,
    foundationVersion: input.foundationVersion,
    reviewer: structuredClone(input.reviewer),
    reason: input.reason.trim(),
    reviewedAt: input.reviewedAt || new Date().toISOString()
  };
}
