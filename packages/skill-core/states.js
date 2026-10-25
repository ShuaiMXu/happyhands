// Component state audit.
//
// A surface that renders only its success state is not finished. The states that are missing are
// the ones nobody drew: the queue before anything happens, the half-finished run, the failure with
// no way back. This module compares what a component documents, and what its source shows, against
// a versioned rubric of what its class of component has to be able to express.
//
// Two tiers, kept apart on purpose:
//   documented — the foundation's declared states against the rubric. A data comparison; checkable.
//   observed   — state words found in the component's source. Evidence, never proof: the absence
//                of a word is not the absence of a state, and a word is not a working state.

import { sourceContent } from './source-content.js';

const CJK = /[㐀-鿿]/;

// `isGenerating`, `is_generating` and "is generating" name the same state. Split the identifier
// into words and match whole words, so `generated` never satisfies a search for `generate`.
function words(text) {
  return ` ${String(text).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().replace(/[^a-z0-9㐀-鿿]+/g, ' ').trim()} `;
}

function matchTerms(haystack, terms) {
  const padded = words(haystack);
  // CJK text carries no word separators, so those terms are matched as substrings.
  return terms.filter(term => (CJK.test(term) ? String(haystack).includes(term) : padded.includes(words(term))));
}

export function canonicalStates(values, vocabulary) {
  const found = new Set();
  const unmapped = [];
  for (const value of values) {
    let mapped = false;
    for (const [state, terms] of Object.entries(vocabulary)) {
      if (matchTerms(value, terms).length) {
        found.add(state);
        mapped = true;
      }
    }
    if (!mapped) unmapped.push(value);
  }
  return { states: [...found], unmapped };
}

function scanText(text, vocabulary) {
  const found = new Set();
  for (const [state, terms] of Object.entries(vocabulary)) if (matchTerms(text, terms).length) found.add(state);
  return [...found];
}

// `JobList` is a list, `ShotCard` is a card: in a compound name the last word is the head noun,
// so the class whose keyword sits furthest right wins. Matching in rubric order instead would make
// classification depend on how the rubric happens to be sorted.
function classify(name, classes) {
  const parts = words(name).trim().split(' ');
  let best = null;
  for (const item of classes) {
    const index = Math.max(...item.match.map(term => parts.lastIndexOf(term)));
    if (index >= 0 && (best === null || index > best.index)) best = { item, index };
  }
  return best?.item ?? null;
}

function sourceFor(component, files) {
  const target = String(component.source || '').replace(/\\/g, '/');
  if (!target) return null;
  const exact = files.filter(file => file.path.replace(/\\/g, '/') === target);
  if (exact.length === 1) return exact[0];
  if (exact.length || /\.[a-z]+$/i.test(target)) return null;
  // Legacy Foundation sources may omit an extension, never their directory.
  // Ambiguous implementations cannot supply evidence for each other.
  const candidates = files.filter(file => file.path.replace(/\\/g, '/').replace(/\.[a-z]+$/i, '') === target);
  return candidates.length === 1 ? candidates[0] : null;
}

export function auditStates({ components, files, rubric }) {
  const results = [];
  for (const component of components) {
    const componentClass = classify(component.name, rubric.classes);
    const declared = canonicalStates(component.states || [], rubric.vocabulary);
    const file = sourceFor(component, files);
    const decoded = file ? sourceContent(file) : null;
    const inspectable = Boolean(file && !decoded.error);
    const observed = inspectable ? scanText(decoded.content, rubric.vocabulary) : [];
    const affordances = inspectable
      ? Object.fromEntries(Object.entries(rubric.affordances).map(([key, terms]) => [key, matchTerms(decoded.content, terms).length > 0]))
      : null;
    const union = new Set([...declared.states, ...observed]);
    const result = {
      name: component.name,
      source: component.source,
      status: component.status,
      class: componentClass?.id ?? null,
      declaredStates: declared.states,
      unmappedDeclared: declared.unmapped,
      observedStates: observed,
      sourceFound: inspectable,
      sourcePath: file?.path ?? null,
      sourceCoordinates: decoded?.location || (file ? { coordinates: 'source-lines' } : null),
      sourceError: decoded?.error || null,
      affordances
    };
    if (componentClass) {
      result.requiredStates = componentClass.requiredStates;
      result.undocumentedStates = componentClass.requiredStates.filter(state => !declared.states.includes(state));
      result.absentStates = componentClass.requiredStates.filter(state => !union.has(state));
      result.undeclaredInFoundation = observed.filter(state => !declared.states.includes(state));
      result.missingAffordances = inspectable
        ? componentClass.requiredAffordances.filter(item => !affordances[item])
        : componentClass.requiredAffordances;
    }
    results.push(result);
  }

  const classified = results.filter(item => item.class);
  const unclassified = results.filter(item => !item.class);
  const findings = [];

  // Tier one: a data comparison between what the foundation documents and what the rubric requires.
  const undocumented = classified.filter(item => item.undocumentedStates.length);
  if (undocumented.length) findings.push({
    id: 'STATE-UNDOCUMENTED',
    tier: 'documented',
    title: `${undocumented.length} component(s) document fewer states than their class requires`,
    confidence: 'high',
    evidence: undocumented.map(item => ({ name: item.name, class: item.class, declared: item.declaredStates, required: item.requiredStates, undocumented: item.undocumentedStates }))
  });

  // Tier two: state words the source does not contain. Evidence for review, not a claim.
  const absent = classified.filter(item => item.sourceFound && item.absentStates.length);
  if (absent.length) findings.push({
    id: 'STATE-NO-EVIDENCE-IN-SOURCE',
    tier: 'observed',
    title: `${absent.length} component(s) show no sign of a required state in their source`,
    confidence: 'low',
    evidence: absent.map(item => ({ name: item.name, class: item.class, sourcePath: item.sourcePath, observed: item.observedStates, absent: item.absentStates }))
  });

  const recovery = classified.filter(item => item.sourceFound && item.missingAffordances.length);
  if (recovery.length) findings.push({
    id: 'STATE-NO-RECOVERY-PATH',
    tier: 'observed',
    title: `${recovery.length} component(s) show a failure state with no sign of ${[...new Set(recovery.flatMap(item => item.missingAffordances))].join(' or ')}`,
    confidence: 'low',
    evidence: recovery.map(item => ({ name: item.name, class: item.class, sourcePath: item.sourcePath, missing: item.missingAffordances, affordances: item.affordances }))
  });

  const drift = classified.filter(item => item.undeclaredInFoundation?.length);
  if (drift.length) findings.push({
    id: 'STATE-UNDECLARED-IN-FOUNDATION',
    tier: 'observed',
    title: `${drift.length} component(s) show states the foundation does not document`,
    confidence: 'medium',
    evidence: drift.map(item => ({ name: item.name, declared: item.declaredStates, observed: item.observedStates, undeclared: item.undeclaredInFoundation }))
  });

  if (unclassified.length) findings.push({
    id: 'STATE-UNCLASSIFIED-COMPONENT',
    tier: 'documented',
    title: `${unclassified.length} component(s) match no class in the rubric, so no required state set applies`,
    confidence: 'high',
    evidence: unclassified.map(item => ({ name: item.name, declared: item.declaredStates, observed: item.observedStates }))
  });

  return {
    rubricVersion: rubric.version,
    components: results,
    findings: findings.map(item => ({
      ...item,
      // A missing state is a design decision, not a defect to auto-fix: it may belong to another
      // component, or the class may be wrong. The audit names the gap and leaves the call.
      resolution: { status: 'unresolved', options: ['add-the-state', 'document-the-state', 'reclassify-the-component'], decidedBy: 'human' }
    })),
    counts: {
      components: results.length,
      classified: classified.length,
      unclassified: unclassified.length,
      withSource: results.filter(item => item.sourceFound).length
    }
  };
}
