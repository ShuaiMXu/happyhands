// Deterministic design-system drift detection.
//
// Three mechanisms, taken from real alignment work rather than invented:
//   1. ungoverned   — a literal value no token represents, ranked by how widely it spread.
//   2. conflict     — one semantic slot (danger text, success surface, …) carrying several values.
//   3. off-scale    — a value that sits between the steps of a token scale.
//
// A frequency check alone cannot see mechanism 2: a wrong danger colour used once in one notice
// never clears a threshold, and that is exactly the kind of value an audit has to surface.
//
// None of this decides which side is right. Implementation values are often the truth and the
// token file is what has to change. The result reports both directions and leaves the choice open.

const COLOR = /#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])/g;
const LENGTH = /(-?\d*\.?\d+)px\b/g;
const DURATION = /(\d*\.?\d+)(ms|s)(?![a-zA-Z])/g;

const DECLARATIONS = {
  radius: [/border-radius\s*:\s*([^;\n}]+)/gi, /borderRadius\s*:\s*(?:['"`]([^'"`]+)['"`]|([\d.]+))/g],
  type: [/font-size\s*:\s*([^;\n}]+)/gi, /fontSize\s*:\s*(?:['"`]([^'"`]+)['"`]|([\d.]+))/g]
};

const MOTION_LINE = /transition|animation/i;

const ROLES = Object.freeze({
  danger: /\b(danger|error|fail(ed|ure)?|invalid|destructive)\b/i,
  success: /\b(success|done|complete[d]?|passed|ok)\b/i,
  warning: /\b(warning|warn|caution|alert|pending)\b/i,
  info: /\b(info|notice|neutral-info)\b/i
});

const SLOTS = Object.freeze({
  text: /\b(color|text|fg|foreground|label)\b/i,
  surface: /\b(background|background-color|bg|surface|fill|tint)\b/i,
  border: /\b(border|border-color|outline|stroke|ring)\b/i
});

export function normalizeColor(value) {
  const hex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(hex)) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  if (/^#[0-9a-f]{4}$/.test(hex)) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}${hex[4]}${hex[4]}`;
  return hex;
}

export function toMilliseconds(value, unit) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return unit === 's' ? Math.round(amount * 1000) : Math.round(amount);
}

// `failText`, `--ff-color-danger-surface` and `fail_text` all name the same thing. Split the
// identifier into words first, or a word-boundary match silently sees none of them.
function words(text) {
  return text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
}

// The last property word before a value wins: in `{ background: A, color: B }` the slot of A is
// the surface and the slot of B is the text, and `--ff-color-danger-surface` is a surface, not a
// text colour that happens to carry the word "color" in its prefix.
export function slotOf(text) {
  const haystack = words(text);
  let best = null;
  for (const [slot, pattern] of Object.entries(SLOTS)) {
    const last = [...haystack.matchAll(new RegExp(pattern.source, 'gi'))].at(-1);
    if (last && (best === null || last.index > best.index)) best = { slot, index: last.index };
  }
  return best ? best.slot : 'unclassified';
}

export function roleOf(text) {
  const haystack = words(text);
  for (const [role, pattern] of Object.entries(ROLES)) if (pattern.test(haystack)) return role;
  return null;
}

function record(map, key, entry) {
  const item = map.get(key) || { value: key, count: 0, sources: new Map() };
  item.count += 1;
  const line = item.sources.get(entry.file) || { file: entry.file, lines: [] };
  if (line.lines.length < 4) line.lines.push(entry.line);
  item.sources.set(entry.file, line);
  map.set(key, item);
  return item;
}

function finish(map, limit = 20) {
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit)
    .map(item => ({ value: item.value, count: item.count, fileCount: item.sources.size, sources: [...item.sources.values()].slice(0, 6) }));
}

// Values written as var(--token) are already governed. Counting them separately answers the
// question that follows every alignment pass: how much of the code actually reads the tokens?
export function collectUsage(files) {
  const colors = new Map();
  const scales = { radius: new Map(), type: new Map() };
  const motion = new Map();
  const semantic = new Map();
  let governed = 0;
  let literal = 0;
  for (const file of files) {
    const lines = file.content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const at = { file: file.path, line: index + 1 };
      const governedHere = (line.match(/var\(\s*--/g) || []).length;
      governed += governedHere;
      for (const match of line.matchAll(COLOR)) {
        const value = normalizeColor(match[0]);
        literal += 1;
        record(colors, value, at);
        // The role is read from the whole declaration; the slot from what precedes this value.
        const role = roleOf(line);
        if (role) {
          const before = slotOf(line.slice(0, match.index));
          const slot = before === 'unclassified' ? slotOf(line) : before;
          const key = `${role}/${slot}`;
          const bucket = semantic.get(key) || { role, slot, values: new Map() };
          const entry = bucket.values.get(value) || { value, count: 0, sources: [] };
          entry.count += 1;
          if (entry.sources.length < 4) entry.sources.push(`${at.file}:${at.line}`);
          bucket.values.set(value, entry);
          semantic.set(key, bucket);
        }
      }
      for (const [kind, patterns] of Object.entries(DECLARATIONS)) {
        for (const pattern of patterns) {
          for (const match of line.matchAll(pattern)) {
            const raw = (match[1] ?? match[2] ?? '').toString();
            if (!raw || raw.includes('var(')) continue;
            const lengths = [...raw.matchAll(LENGTH)].map(item => Number(item[1]));
            const bare = lengths.length ? lengths : (/^\s*[\d.]+\s*$/.test(raw) ? [Number(raw)] : []);
            for (const length of bare) {
              if (!Number.isFinite(length)) continue;
              literal += 1;
              record(scales[kind], String(length), at);
            }
          }
        }
      }
      if (MOTION_LINE.test(line)) {
        for (const match of line.matchAll(DURATION)) {
          const ms = toMilliseconds(match[1], match[2]);
          if (ms === null || ms === 0) continue;
          literal += 1;
          record(motion, String(ms), at);
        }
      }
    }
  }
  return { colors, scales, motion, semantic, governedReferences: governed, literalValues: literal };
}

function numericScale(tokens, parse) {
  const values = new Set();
  for (const token of tokens) {
    const parsed = parse(token.value);
    for (const value of parsed) values.add(value);
  }
  return [...values].sort((a, b) => a - b);
}

export function foundationIndex(foundation) {
  const tokens = foundation?.tokens || [];
  const approved = tokens.filter(item => item.status === 'approved');
  const colorValues = new Map();
  for (const token of tokens) {
    const value = normalizeColor(token.value);
    if (/^#[0-9a-f]{6,8}$/.test(value)) colorValues.set(value, token);
  }
  const lengths = value => [...String(value).matchAll(LENGTH)].map(item => Number(item[1]));
  const durations = value => [...String(value).matchAll(DURATION)].map(item => toMilliseconds(item[1], item[2])).filter(item => item !== null);
  return {
    tokens,
    approved,
    colorValues,
    scales: {
      radius: numericScale(approved.filter(item => item.category === 'radius'), lengths),
      type: numericScale(approved.filter(item => item.category === 'type'), lengths),
      motion: numericScale(approved.filter(item => item.category === 'motion'), durations)
    },
    semantic: tokens.reduce((map, token) => {
      const role = roleOf(token.name);
      if (!role) return map;
      const key = `${role}/${slotOf(token.name)}`;
      const bucket = map.get(key) || { role, slot: slotOf(token.name), values: new Map() };
      const value = normalizeColor(token.value);
      const entry = bucket.values.get(value) || { value, count: 0, sources: [] };
      entry.count += 1;
      entry.sources.push(`token ${token.name} [${token.status}]`);
      bucket.values.set(value, entry);
      return map.set(key, bucket);
    }, new Map())
  };
}

// A value exactly between two steps has no nearest step. Report the tie rather than letting an
// arbitrary iteration order decide which way a value gets snapped.
function nearest(scale, value) {
  if (!scale.length) return null;
  const distance = Math.min(...scale.map(step => Math.abs(step - value)));
  const steps = scale.filter(step => Math.abs(step - value) === distance);
  return { step: steps[0], distance, tied: steps.length > 1 ? steps : null };
}

export function detectDrift({ files, foundation, nominateAt = 3 }) {
  const usage = collectUsage(files);
  const index = foundationIndex(foundation);
  const findings = [];

  const ungovernedColors = new Map([...usage.colors].filter(([value]) => !index.colorValues.has(value)));
  const nominations = finish(ungovernedColors).filter(item => item.count >= nominateAt);
  if (nominations.length) {
    findings.push({
      id: 'DRIFT-UNGOVERNED-VALUE',
      mechanism: 'ungoverned',
      title: `${ungovernedColors.size} literal colours are not represented by any token; ${nominations.length} appear at least ${nominateAt} times`,
      confidence: 'medium',
      evidence: nominations
    });
  }

  // One semantic slot must carry one value. Several values in the same slot is a conflict
  // whether they come from tokens, from the implementation, or from both at once.
  const conflicts = [];
  const slots = new Set([...usage.semantic.keys(), ...index.semantic.keys()]);
  for (const key of slots) {
    const [role, slot] = key.split('/');
    if (slot === 'unclassified') continue;
    const values = new Map();
    for (const source of [index.semantic.get(key), usage.semantic.get(key)]) {
      for (const entry of source?.values.values() || []) {
        const merged = values.get(entry.value) || { value: entry.value, count: 0, sources: [] };
        merged.count += entry.count;
        merged.sources.push(...entry.sources);
        values.set(entry.value, merged);
      }
    }
    if (values.size > 1) conflicts.push({ role, slot, values: [...values.values()].sort((a, b) => b.count - a.count) });
  }
  if (conflicts.length) {
    findings.push({
      id: 'DRIFT-SEMANTIC-CONFLICT',
      mechanism: 'conflict',
      title: `${conflicts.length} semantic slot(s) carry more than one value: ${conflicts.map(item => `${item.role} ${item.slot} (${item.values.length})`).join(', ')}`,
      confidence: 'medium',
      evidence: conflicts
    });
  }

  const offScale = [];
  for (const [kind, scale] of Object.entries(index.scales)) {
    if (!scale.length) continue;
    const used = kind === 'motion' ? usage.motion : usage.scales[kind];
    for (const item of finish(used, 40)) {
      const value = Number(item.value);
      const closest = nearest(scale, value);
      if (!closest || closest.distance === 0) continue;
      const shift = value === 0 ? 1 : closest.distance / value;
      offScale.push({
        kind,
        value,
        count: item.count,
        fileCount: item.fileCount,
        nearestStep: closest.step,
        ambiguousBetween: closest.tied,
        delta: Number((closest.step - value).toFixed(3)),
        // Snapping a duration is not a rename: it changes how the interface moves.
        changesBehaviour: kind === 'motion' && shift >= 0.2,
        sources: item.sources
      });
    }
  }
  if (offScale.length) {
    const moving = offScale.filter(item => item.changesBehaviour);
    findings.push({
      id: 'DRIFT-OFF-SCALE-VALUE',
      mechanism: 'off-scale',
      title: `${offScale.length} value(s) sit between the steps of an approved scale${moving.length ? `; snapping ${moving.length} of them would visibly change motion` : ''}`,
      confidence: 'medium',
      evidence: offScale.slice(0, 30)
    });
  }

  return {
    usage,
    index,
    findings: findings.map(item => ({
      ...item,
      // The framework never picks the winner. An implementation value that shipped is often the
      // truth and the token file is what has to change.
      resolution: { status: 'unresolved', options: ['change-implementation', 'change-token'], decidedBy: 'human' }
    })),
    nominations,
    skippedScales: Object.entries(index.scales).filter(([, scale]) => !scale.length).map(([kind]) => kind)
  };
}
