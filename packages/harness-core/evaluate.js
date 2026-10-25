import { captureEntries, entriesByKey, captureKey } from './capture-state.js';

// A bootstrap run has nothing to compare against. The same deterministic checks still apply,
// but the result is conformance evidence, never an improvement claim.
export function evaluateFirstRender(after) {
  const entries = captureEntries(after);
  if (entries.length === 0) throw new Error('The first render capture has no states.');
  const views = {};
  for (const view of entries) {
    const name = view.legacy ? view.configurationId : captureKey(view.stateId, view.configurationId);
    if (view.reached === false || !view.dom) {
      views[name] = { stateId: view.stateId, configurationId: view.configurationId, afterScreenshot: null, reachable: false, error: view.error || 'State was not reached.', checks: { stateReached: false } };
      continue;
    }
    views[name] = {
      stateId: view.stateId,
      configurationId: view.configurationId,
      viewport: { width: view.width, height: view.height },
      afterScreenshot: view.screenshot,
      afterStatus: view.status,
      afterH1: view.dom.h1,
      afterActions: view.dom.actions,
      afterControls: view.dom.controls || [],
      checks: {
        pageResponded: view.status !== null && view.status < 400,
        hasHeading: view.dom.h1.length > 0,
        noHorizontalOverflow: !view.dom.horizontalOverflow
      }
    };
  }
  return {
    version: '0.1',
    kind: 'first-render',
    at: new Date().toISOString(),
    views,
    conclusion: 'Deterministic render checks on a first render. No baseline existed, so this run cannot claim an improvement. A human must judge whether the surface serves the user task and honours the approved foundation.'
  };
}

export function evaluateCaptures(before, after) {
  const entries = captureEntries(before);
  const afterByKey = entriesByKey(after);
  if (entries.length === 0) throw new Error('The baseline capture has no states.');
  const views = {};
  for (const oldView of entries) {
    const key = captureKey(oldView.stateId, oldView.configurationId);
    const name = oldView.legacy ? oldView.configurationId : key;
    const newView = afterByKey.get(key);
    if (oldView.reached === false || !oldView.dom) {
      const recovered = Boolean(newView && newView.reached !== false && newView.dom);
      views[name] = {
        stateId: oldView.stateId,
        configurationId: oldView.configurationId,
        beforeScreenshot: null,
        afterScreenshot: recovered ? newView.screenshot : null,
        beforeReachable: false,
        reachable: recovered,
        recovery: recovered,
        beforeControls: [],
        afterControls: recovered ? (newView.dom.controls || []) : [],
        error: recovered ? null : (newView?.error || oldView.error || 'State was not reached in either capture.'),
        checks: recovered ? {
          baselineStateReached: false,
          stateReached: true,
          pageResponded: newView.status !== null && newView.status < 400,
          hasHeading: newView.dom.h1.length > 0,
          noHorizontalOverflow: !newView.dom.horizontalOverflow
        } : { baselineStateReached: false, stateReached: false }
      };
      continue;
    }
    if (!newView || newView.reached === false || !newView.dom) {
      if (oldView.legacy) throw new Error('Before and after must use the same viewport names.');
      views[name] = { stateId: oldView.stateId, configurationId: oldView.configurationId, beforeScreenshot: oldView.screenshot, afterScreenshot: null, reachable: false, error: newView?.error || 'State was not reached.', checks: { stateReached: false } };
      continue;
    }
    if (oldView.width !== newView.width || oldView.height !== newView.height) throw new Error(`Configuration ${oldView.configurationId} changed size for state ${oldView.stateId}.`);
    views[name] = {
      stateId: oldView.stateId,
      configurationId: oldView.configurationId,
      reachable: true,
      viewport: { width: oldView.width, height: oldView.height },
      beforeScreenshot: oldView.screenshot,
      afterScreenshot: newView.screenshot,
      beforeStatus: oldView.status,
      afterStatus: newView.status,
      beforeH1: oldView.dom.h1,
      afterH1: newView.dom.h1,
      beforeActions: oldView.dom.actions,
      afterActions: newView.dom.actions,
      beforeControls: oldView.dom.controls || [],
      afterControls: newView.dom.controls || [],
      checks: {
        stateReached: true,
        pageResponded: newView.status !== null && newView.status < 400,
        hasHeading: newView.dom.h1.length > 0,
        noHorizontalOverflow: !newView.dom.horizontalOverflow
      }
    };
  }
  return {
    version: '0.1',
    kind: 'comparison',
    at: new Date().toISOString(),
    views,
    conclusion: 'Structural checks only. A human must compare screenshots and the user task before claiming UX improvement.'
  };
}
