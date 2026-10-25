import {captureEntries} from '../harness-core/capture-state.js';

export function componentCoverage(component, capture) {
  const references = captureEntries(capture).filter(entry=>(entry.region||entry.plannedRegion)?.source?.file===component.source).map(entry=>{
    const region = entry.region||entry.plannedRegion;
    const captured = entry.reached !== false && entry.screenshot && region.source.fileHash === component.sourceHash
      && region.verification === 'unique-visible-selector-and-shared-source-anchor';
    const instance = entry.componentInstance;
    const bound = captured && entry.reached === true && region.instance && instance
      && instance.verification === 'declared-root-instance-stable-at-screenshot-boundary'
      && instance.id === region.instance.id && instance.selector === region.selector
      && (instance.visibility?.image!=='full-document' || ['full-page','page-surfaces'].includes(entry.captureMode)
        && entry.screenshotSize?.height>=entry.documentSize?.height && entry.screenshotSize?.width>=entry.documentSize?.width)
      && instance.component === component.name && region.source.component === component.name
      && Array.isArray(region.instance.variants) && Array.isArray(instance.variants) && instance.variants.length === region.instance.variants.length
      && region.instance.variants.every(expected=>instance.variants.some(actual=>actual.name===expected.name
        && actual.attribute===expected.attribute && actual.value===expected.value && actual.observed===expected.value));
    return { stateId:entry.stateId, configurationId:entry.configurationId, selector:region.selector,
      sourceAnchor:region.source.anchor, screenshot:entry.screenshot||null,
      status:captured?'region-captured':'needs-evidence',
      ...(entry.error?{error:entry.error}:{}),
      ...(region.instance?{plannedInstance:region.instance}:{}),
      ...(bound?{instance, assertions:(entry.finalStateEvidence||[]).filter(assertion=>assertion.selector===region.selector
        && assertion.verified===true && assertion.verification==='instantaneous-boundary-check')}: {}) };
  });
  const instances = references.filter(reference=>reference.instance);
  return {status:instances.length?'partial-instance-evidence':'needs-evidence',references,
    plannedTargets:references.filter(reference=>reference.plannedInstance).length,capturedInstances:instances.length,
    missingTargets:references.filter(reference=>reference.plannedInstance&&!reference.instance).map(reference=>({stateId:reference.stateId,configurationId:reference.configurationId,error:reference.error||'Instance evidence is missing or does not match its source.'})),
    missing:instances.length?['remaining-instances-and-variants','applicable-interaction-states']
      :references.some(ref=>ref.status==='region-captured')?['component-instance-binding','applicable-interaction-states']
        :['source-mapped-capture','component-instance-binding','applicable-interaction-states'],
    limitations:[
      'A source-mapped region alone does not prove nested component coverage. Declared root instances record only the named selector, variant attributes and states at the screenshot boundary.',
      'An observed DOM attribute is not proof of a framework prop or design approval. Other instances, variants, routes and states remain unreviewed; visual quality still requires independent inspection.',
      'Full-document originals may cover a tall root outside the viewport; hit testing examines only its currently visible portion. Inspect the original image for occlusion or clipping elsewhere.'
    ]};
}
