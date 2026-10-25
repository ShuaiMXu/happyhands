import {completePageSurfaces} from './page-surface-coverage.js';
import { captureEntries } from './capture-state.js';

export function captureRouteKey(entry) {
  try {
    const url = new URL(entry.finalUrl || entry.start?.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return `${local ? 'local-preview' : url.origin}${url.pathname}${url.search}`;
  } catch { return null; }
}
const positive = value => Number.isSafeInteger(value) && value > 0;
export function isWholePageCapture(entry) {
  return entry.captureMode === 'full-page' && entry.reached !== false && Boolean(entry.screenshot) &&
    !entry.region && !(entry.actions || []).length &&
    positive(entry.documentSize?.width) && positive(entry.documentSize?.height) &&
    positive(entry.screenshotSize?.width) && positive(entry.screenshotSize?.height) &&
    entry.screenshotSize.width >= Math.max(entry.documentSize.width, entry.width || 0) &&
    entry.screenshotSize.height >= Math.max(entry.documentSize.height, entry.height || 0);
}


export function missingAfterStates(manifest) {
  const before=captureEntries(manifest.captures?.before),after=captureEntries(manifest.captures?.after);
  const key=entry=>JSON.stringify([entry.stateId,entry.configurationId]);
  const expected=new Map([...before,...after].map(entry=>[key(entry),entry])),actual=new Map(after.map(entry=>[key(entry),entry]));
  return [...expected].flatMap(([id,entry])=>{const captured=actual.get(id);return !captured||captured.reached===false||!captured.screenshot ? [`${entry.stateId}--${entry.configurationId}`] : [];});
}

// Require an original default-state overview for every planned route/device in each phase.
// A scroll/interaction viewport, stitched image, or a tall image with no capture metadata
// cannot stand in for an overview. This describes the explicit plan, never all site routes.
export function wholePageReviewCoverage(manifest, maxImages = 24) {
  const expected = new Set(), contexts = new Set(), overviews = new Map(), missingStates = missingAfterStates(manifest);
  for (const phase of ['before', 'after']) {
    for (const entry of captureEntries(manifest.captures?.[phase])) {
      const route = captureRouteKey(entry);
      const key = `${phase}:${route || 'unknown-route'}:${entry.configurationId}`;
      contexts.add(`${route || 'unknown-route'}:${entry.configurationId}`);
      if (route && (isWholePageCapture(entry) || completePageSurfaces(entry) && isWholePageCapture({...entry,captureMode:'full-page'})) && !overviews.has(key)) overviews.set(key, { phase, entry });
    }
  }
  const phases = !manifest.captures?.before && manifest.baseline?.status === 'absent' ? ['after'] : ['before','after'];
  for(const context of contexts)for(const phase of phases)expected.add(`${phase}:${context}`);
  const missingContexts = [...expected].filter(key => !overviews.has(key));
  const selected = [...overviews.values()];
  const exceeded = selected.length > maxImages;
  return { expectedContexts: expected.size, coveredContexts: selected.length, missingContexts, missingStates,
    exceeded, ready: expected.size > 0 && !missingContexts.length && !missingStates.length && !exceeded,
    selected: exceeded ? [] : selected };
}

export function pngDimensions(bytes) {
  const signature = [137,80,78,71,13,10,26,10];
  if (bytes.length < 24 || !signature.every((value,index) => bytes[index] === value) ||
    String.fromCharCode(...bytes.subarray(12,16)) !== 'IHDR') throw new Error('Invalid PNG dimensions.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16), height = view.getUint32(20);
  if (!positive(width) || !positive(height)) throw new Error('Invalid PNG dimensions.');
  return { width, height };
}
