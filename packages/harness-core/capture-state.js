import Ajv from 'ajv/dist/2020.js';
import schema from '../../capture-state.schema.json' with { type: 'json' };

const validate = new Ajv({ allErrors: true, formats: { uri: true } }).compile(schema);
const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function assertCapturePlan(plan) {
  if (!validate(plan)) throw new Error(validate.errors.map(error => `${error.instancePath || '/'} ${error.message}`).join('; '));
  const configurationIds = new Set(plan.configurations.map(item => item.id));
  for (const [label, values] of [['configuration', plan.configurations], ['state', plan.states]]) {
    const ids = values.map(item => item.id);
    if (new Set(ids).size !== ids.length) throw new Error(`Capture ${label} IDs must be unique.`);
  }
  for (const state of plan.states) {
    for(const file of state.sourceEntries||[])if(file.includes('\\')||file.includes('\0')||/^(?:[a-z]:|\/)/i.test(file)||file.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('State source entries must be normalized repository-relative paths.');
    if (state.scrollSurface && (['full-page','page-surfaces'].includes(state.captureMode) || state.scrollSurface.top > state.scrollSurface.scrollHeight - state.scrollSurface.clientHeight)) throw Error('Scroll surface segments require viewport capture and a reachable offset.');
    const unknownConfigurations = (state.configurations || []).filter(id => !configurationIds.has(id));
    if (unknownConfigurations.length) throw new Error(`Capture state ${state.id} references unknown configurations: ${unknownConfigurations.join(', ')}.`);
    if (!state.region) continue;
    const file = state.region.source.file.replaceAll('\\','/');
    if (/^(?:[a-z]:\/|\/|\.\.(?:\/|$))/i.test(file)) throw new Error(`Capture state ${state.id} region source must stay inside the reviewed repository.`);
    if (!state.region.selector.trim() || !state.region.source.anchor.trim()) throw new Error(`Capture state ${state.id} region selector and source anchor cannot be blank.`);
    if (state.region.instance) {
      if (!state.region.source.component?.trim()) throw Error('Component instance evidence requires a named source component.');
      const variants = state.region.instance.variants;
      if (new Set(variants.map(item=>item.name)).size !== variants.length || new Set(variants.map(item=>item.attribute)).size !== variants.length) throw Error('Component variant names and attributes must be unique.');
    }
  }
  const screenshots=new Set();
  for(const state of plan.states)for(const configuration of configurationsForState(plan,state)){
    const key=captureKey(state.id,configuration.id);
    if(screenshots.has(key))throw Error('Capture screenshot filenames must uniquely identify one state and configuration: '+key);
    screenshots.add(key);
  }
  return plan;
}

export function configurationsForState(plan, state) {
  const selected = state.configurations ? new Set(state.configurations) : null;
  return selected ? plan.configurations.filter(configuration => selected.has(configuration.id)) : plan.configurations;
}

export function captureKey(stateId, configurationId) {
  if (!ID.test(stateId) || !ID.test(configurationId)) throw new Error('Capture state and configuration IDs must be safe path segments.');
  return `${stateId}--${configurationId}`;
}

// New captures are a list keyed by task state and named configuration. Legacy captures remain
// readable as one implicit `page` state whose configurations are the old viewport names.
export function captureEntries(capture) {
  if (Array.isArray(capture?.states)) return capture.states;
  return Object.entries(capture?.viewports || {}).map(([configurationId, view]) => ({
    legacy: true,
    stateId: 'page',
    configurationId,
    start: capture.url ? { url: capture.url } : null,
    actions: [],
    ...view
  }));
}

export function entriesByKey(capture) {
  return new Map(captureEntries(capture).map(entry => [captureKey(entry.stateId, entry.configurationId), entry]));
}

export function screenshotReference(phase, entry) {
  return entry.screenshot || `${phase}/${captureKey(entry.stateId, entry.configurationId)}.png`;
}

// Composite page evidence keeps each original addressable without pretending
// its geometry tiles are new business states or matched before/after states.
export function captureOriginals(capture) {
  return captureEntries(capture).flatMap(entry=>[entry.screenshot,...(entry.interactionParts||[]).map(part=>part.screenshot),...(entry.pageSurfaces?.surfaces||[]).flatMap(surface=>surface.tiles.map(tile=>tile.screenshot))].filter(Boolean));
}
