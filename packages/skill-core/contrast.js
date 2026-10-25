// Token contrast audit.
//
// Whether a colour pair is legible is arithmetic, not taste. A design system that changes its
// danger colour from a bright red to a dark one is arguing about how it looks; the contrast ratio
// against the surface it sits on is a number, and WCAG says what that number has to be.
//
// This module computes the ratio for pairs that are known to be used together: pairs the token
// names themselves declare (a role's text colour against that role's surface), and pairs the
// source puts in one declaration. It does not guess pairings that nobody expressed.

import { normalizeColor, roleOf, slotOf } from './drift.js';

// WCAG 2.2 AA: 4.5 for normal text, 3.0 for large text and for non-text contrast.
export const THRESHOLDS = Object.freeze({ bodyText: 4.5, largeText: 3, nonText: 3 });

export function parseColor(value) {
  const hex = normalizeColor(String(value).trim());
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) return null;
  const alpha = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16), alpha, hex: hex.slice(0, 7) };
}

function channel(value) {
  const ratio = value / 255;
  return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color) {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

export function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [light, dark] = a >= b ? [a, b] : [b, a];
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

export function verdictFor(ratio) {
  if (ratio < THRESHOLDS.nonText) return 'fails-every-use';
  if (ratio < THRESHOLDS.bodyText) return 'large-text-and-non-text-only';
  return 'passes-aa';
}

// A role's text colour is used on that role's surface. The names say so; nothing is inferred
// about pairings the system never declared.
export function declaredPairs(foundation) {
  const colors = (foundation?.tokens || [])
    .filter(token => token.category === 'color')
    .map(token => ({ token, color: parseColor(token.value), role: roleOf(token.name), slot: slotOf(token.name) }));
  const usable = colors.filter(item => item.color);
  const unreadable = colors.filter(item => !item.color).map(item => ({ name: item.token.name, value: item.token.value }));
  const translucent = usable.filter(item => item.color.alpha < 1).map(item => ({ name: item.token.name, value: item.token.value }));
  const pairs = [];
  for (const foreground of usable) {
    if (foreground.slot !== 'text' || !foreground.role) continue;
    for (const background of usable) {
      if (background.role !== foreground.role || background.slot !== 'surface') continue;
      if (foreground.color.alpha < 1 || background.color.alpha < 1) continue;
      pairs.push({
        origin: 'declared',
        role: foreground.role,
        foreground: { name: foreground.token.name, value: foreground.color.hex, status: foreground.token.status },
        background: { name: background.token.name, value: background.color.hex, status: background.token.status },
        ratio: contrastRatio(foreground.color, background.color)
      });
    }
  }
  return { pairs, unreadable, translucent };
}

const FOREGROUND = /(?:^|[^a-zA-Z-])(?:color|Color)\s*:\s*['"`]?(#[0-9a-fA-F]{3,8})/g;
const BACKGROUND = /background(?:-color)?\s*:\s*['"`]?(#[0-9a-fA-F]{3,8})|backgroundColor\s*:\s*['"`]?(#[0-9a-fA-F]{3,8})/g;

// A declaration that sets both a text colour and a background states a pairing, whatever the
// token names say. Blocks are split on `}`, which bounds a CSS rule and a JSX style object alike.
export function observedPairs(files, { maxDistance = 240, limit = 40 } = {}) {
  const pairs = new Map();
  for (const file of files) {
    let offset = 0;
    for (const block of file.content.split('}')) {
      const foregrounds = [...block.matchAll(FOREGROUND)].map(match => ({ value: match[1], index: match.index }));
      const backgrounds = [...block.matchAll(BACKGROUND)].map(match => ({ value: match[1] || match[2], index: match.index }));
      for (const foreground of foregrounds) {
        for (const background of backgrounds) {
          if (Math.abs(foreground.index - background.index) > maxDistance) continue;
          const text = parseColor(foreground.value);
          const surface = parseColor(background.value);
          if (!text || !surface || text.alpha < 1 || surface.alpha < 1) continue;
          const key = `${text.hex}|${surface.hex}`;
          const existing = pairs.get(key);
          const line = file.content.slice(0, offset + Math.min(foreground.index, background.index)).split(/\r?\n/).length;
          if (existing) {
            existing.count += 1;
            if (existing.sources.length < 4) existing.sources.push(`${file.path}:${line}`);
            continue;
          }
          pairs.set(key, {
            origin: 'observed',
            foreground: { name: null, value: text.hex },
            background: { name: null, value: surface.hex },
            ratio: contrastRatio(text, surface),
            count: 1,
            sources: [`${file.path}:${line}`]
          });
        }
      }
      offset += block.length + 1;
    }
  }
  return [...pairs.values()].sort((a, b) => a.ratio - b.ratio).slice(0, limit);
}

export function auditContrast({ foundation, files = [] }) {
  const declared = declaredPairs(foundation);
  const observed = observedPairs(files);
  const pairs = [...declared.pairs, ...observed].map(pair => ({ ...pair, verdict: verdictFor(pair.ratio) }));
  const findings = [];
  const failing = pairs.filter(pair => pair.verdict === 'fails-every-use');
  const bodyOnly = pairs.filter(pair => pair.verdict === 'large-text-and-non-text-only');
  if (failing.length) findings.push({
    id: 'CONTRAST-BELOW-MINIMUM',
    title: `${failing.length} colour pair(s) fall below ${THRESHOLDS.nonText}:1 and fail WCAG AA for every use`,
    confidence: failing.every(pair => pair.origin === 'declared') ? 'high' : 'medium',
    evidence: failing.sort((a, b) => a.ratio - b.ratio)
  });
  if (bodyOnly.length) findings.push({
    id: 'CONTRAST-BELOW-BODY-TEXT',
    title: `${bodyOnly.length} colour pair(s) reach ${THRESHOLDS.nonText}:1 but not ${THRESHOLDS.bodyText}:1, so they carry large text or non-text only`,
    confidence: bodyOnly.every(pair => pair.origin === 'declared') ? 'high' : 'medium',
    evidence: bodyOnly.sort((a, b) => a.ratio - b.ratio)
  });
  return {
    thresholds: THRESHOLDS,
    pairs,
    unreadable: declared.unreadable,
    translucent: declared.translucent,
    counts: { declared: declared.pairs.length, observed: observed.length, failing: failing.length, bodyOnly: bodyOnly.length },
    findings: findings.map(item => ({
      ...item,
      // The ratio is arithmetic; which colour moves is not. Darkening the text, lightening the
      // surface and restricting the pair to large text are all valid answers.
      resolution: { status: 'unresolved', options: ['change-foreground', 'change-background', 'restrict-the-pair'], decidedBy: 'human' }
    }))
  };
}
