// Deterministic checks over a baseline capture.
//
// The Harness already records document width, viewport width and sampled
// computed styles for every captured state. Those facts are enough to report a
// few defects without any model: horizontal overflow, text contrast below the
// WCAG AA threshold, and interactive targets smaller than the WCAG 2.5.8 minimum.
// Each finding cites the capture it came from and states the measured numbers, so
// a person can reproduce it from the screenshot alone.
//
// Limits are deliberate: styles come from the sampled elements the capture
// recorded, not the whole DOM, and a transparent background means the effective
// backdrop is unknown, so those elements are never reported as low contrast.

export const DETERMINISTIC_CHECKS_VERSION = 'deterministic-checks@1';
const TEXT_TAGS = new Set(['p', 'span', 'a', 'button', 'li', 'label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'small', 'strong', 'em', 'td', 'th', 'legend', 'figcaption']);
const TARGET_TAGS = new Set(['a', 'button', 'summary', 'input', 'select', 'textarea']);
const MIN_TARGET_PX = 24;
const LARGE_TEXT_PX = 24;
const LARGE_BOLD_TEXT_PX = 18.66;
const NORMAL_CONTRAST = 4.5;
const LARGE_CONTRAST = 3;

export function parseColor(value) {
  const text = String(value || '').trim().toLowerCase();
  const rgba = text.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/);
  if (rgba) {
    const [r, g, b] = rgba.slice(1, 4).map(Number);
    const alpha = rgba[4] === undefined ? 1 : Number(rgba[4]);
    if ([r, g, b, alpha].every(Number.isFinite)) return {r, g, b, alpha};
    return null;
  }
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].split('').map(item => item + item).join('') : hex[1];
    return {r: parseInt(digits.slice(0, 2), 16), g: parseInt(digits.slice(2, 4), 16), b: parseInt(digits.slice(4, 6), 16), alpha: 1};
  }
  return null;
}

function channel(value) {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({r, g, b}) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

export function requiredContrast(fontSizePx, fontWeight) {
  const large = fontSizePx >= LARGE_TEXT_PX || (fontSizePx >= LARGE_BOLD_TEXT_PX && Number(fontWeight) >= 700);
  return large ? LARGE_CONTRAST : NORMAL_CONTRAST;
}

function describe(entry) {
  const tag = entry.tag || 'element';
  const className = String(entry.className || '').trim().split(/\s+/).filter(Boolean)[0];
  return className ? `${tag}.${className}` : tag;
}

function stateKey(entry) {
  return entry.legacy ? entry.configurationId : `${entry.stateId}--${entry.configurationId}`;
}

function captureRef(phase, entry) {
  return `capture:${phase}:${stateKey(entry)}`;
}

// `capture` is a stored capture object; `entries` is the shape captureEntries()
// returns for it. Phase is 'before' during diagnosis.
export function deterministicChecks({phase, capture, entries}) {
  const evidence = [];
  const findings = [];
  if (!entries?.length) return {evidence, findings};
  let contrastCount = 0;
  let targetCount = 0;
  let overflowCount = 0;
  for (const entry of entries) {
    if (entry.reached === false || !entry.dom) continue;
    const ref = captureRef(phase, entry);
    const viewport = Number(entry.width || 0);
    const documentWidth = Number(entry.documentSize?.width || 0);
    if (overflowCount < 2 && ((documentWidth && viewport && documentWidth > viewport + 1) || entry.dom.horizontalOverflow === true)) {
      overflowCount++;
      const id = `check-overflow-${overflowCount}`;
      const measured = documentWidth && viewport ? `${documentWidth}px document in a ${viewport}px viewport` : 'the capture reports horizontal overflow';
      evidence.push({id: `${id}:measurement`, type: 'deterministic-measurement', source: DETERMINISTIC_CHECKS_VERSION, value: {state: stateKey(entry), viewport, documentWidth, horizontalOverflow: entry.dom.horizontalOverflow ?? null}});
      findings.push({
        id,
        title: `Horizontal overflow at ${viewport || 'the captured'}px`,
        rootKey: `horizontal overflow ${viewport}`,
        evidenceRefs: [ref, `${id}:measurement`],
        sources: [{type: 'deterministic-check', id: DETERMINISTIC_CHECKS_VERSION}],
        verificationStatus: 'review-target',
        impact: 4,
        confidence: 5,
        effort: 2,
        priority: (4 * 5) / 2,
        proposal: `${stateKey(entry)}: ${measured}. Constrain the element that exceeds the viewport so the document never grows past it, then capture the same state again.`
      });
    }
    for (const [index, element] of (entry.dom.designSystem?.elements || []).entries()) {
      const tag = String(element.tag || '').toLowerCase();
      const styles = element.styles || {};
      const size = element.size || {};
      const fontSize = parseFloat(styles.fontSize);
      // Contrast: only when both colours are opaque. A transparent background
      // means the real backdrop is an ancestor the capture did not record.
      if (contrastCount < 3 && TEXT_TAGS.has(tag)) {
        const foreground = parseColor(styles.color);
        const background = parseColor(styles.backgroundColor);
        if (foreground && background && foreground.alpha === 1 && background.alpha === 1 && Number.isFinite(fontSize)) {
          const ratio = contrastRatio(foreground, background);
          const required = requiredContrast(fontSize, styles.fontWeight);
          if (ratio < required) {
            contrastCount++;
            const id = `check-contrast-${contrastCount}`;
            const rounded = Math.round(ratio * 100) / 100;
            evidence.push({id: `${id}:measurement`, type: 'deterministic-measurement', source: DETERMINISTIC_CHECKS_VERSION, value: {state: stateKey(entry), element: describe(element), foreground: styles.color, background: styles.backgroundColor, fontSize, contrast: rounded, required}});
            findings.push({
              id,
              title: `Text contrast ${rounded}:1 on ${describe(element)}`,
              rootKey: `contrast ${describe(element)} ${stateKey(entry)}`,
              evidenceRefs: [ref, `${id}:measurement`],
              sources: [{type: 'deterministic-check', id: DETERMINISTIC_CHECKS_VERSION}],
              verificationStatus: 'review-target',
              impact: 4,
              confidence: 5,
              effort: 2,
              priority: (4 * 5) / 2,
              proposal: `${stateKey(entry)}: ${describe(element)} renders ${styles.color} on ${styles.backgroundColor} (${rounded}:1, needs ${required}:1 at ${fontSize}px). Change the foreground or the surface until the ratio meets the threshold, keeping the label text.`
            });
          }
        }
      }
      // Target size: WCAG 2.5.8 asks for 24x24 CSS pixels, padding included.
      if (targetCount < 3 && TARGET_TAGS.has(tag)) {
        const width = Number(size.width);
        const height = Number(size.height);
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 && (width < MIN_TARGET_PX || height < MIN_TARGET_PX)) {
          targetCount++;
          const id = `check-target-${targetCount}`;
          evidence.push({id: `${id}:measurement`, type: 'deterministic-measurement', source: DETERMINISTIC_CHECKS_VERSION, value: {state: stateKey(entry), element: describe(element), width, height, minimum: MIN_TARGET_PX}});
          findings.push({
            id,
            title: `Tap target ${width}x${height} on ${describe(element)}`,
            rootKey: `target ${describe(element)} ${stateKey(entry)}`,
            evidenceRefs: [ref, `${id}:measurement`],
            sources: [{type: 'deterministic-check', id: DETERMINISTIC_CHECKS_VERSION}],
            verificationStatus: 'review-target',
            impact: 3,
            confidence: 5,
            effort: 2,
            priority: (3 * 5) / 2,
            proposal: `${stateKey(entry)}: ${describe(element)} measures ${width}x${height} CSS pixels, below the ${MIN_TARGET_PX}x${MIN_TARGET_PX} minimum. Increase the hit area with padding without moving the label.`
          });
        }
      }
    }
  }
  return {evidence, findings};
}
