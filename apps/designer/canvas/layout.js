const KEY_PREFIX = 'pd-canvas-';
export function autoLayout(entries, { hasAfter = false } = {}) {
  const states = [...new Set(entries.map(e => e.stateId))];
  const configs = [...new Set(entries.map(e => e.configurationId))];
  const widths = configs.map(c => {
    const samples = entries.filter(e => e.configurationId === c);
    return samples.filter(e => e.width / e.height < .75).length > samples.length / 2 ? 132 : 220;
  });
  const positions = new Map(), rowOffsets = new Map(), colOffsets = [];
  let x = 120;
  for (const w of widths) { colOffsets.push(x); x += w * (hasAfter ? 2 : 1) + (hasAfter ? 28 : 0) + 32; }
  let y = 36;
  for (const state of states) {
    rowOffsets.set(state, y);
    let rowHeight = 160;
    configs.forEach((config, i) => {
      const matches = entries.filter(e => e.stateId === state && e.configurationId === config);
      if (!matches.length) return;
      const w = widths[i];
      const h = Math.max(...matches.map(e => e.reached === false ? 168 : w * ((e.height || 800) / (e.width || 1280)) + 38));
      positions.set(`${state}--${config}`, { x: colOffsets[i], y, w, h, afterX: colOffsets[i] + w + 28, afterW: w });
      rowHeight = Math.max(rowHeight, h);
    });
    y += rowHeight + 80;
  }
  return { positions, states, configs, rowOffsets, totalWidth: Math.max(300, x), totalHeight: y };
}
export function loadLayout(runId) {
  try {
    const data = JSON.parse(localStorage.getItem(KEY_PREFIX + runId) || 'null');
    if (!Array.isArray(data)) return new Map();
    return new Map(data.filter(([key, value]) => typeof key === 'string' && Number.isFinite(value?.x) && Number.isFinite(value?.y)));
  } catch { return new Map(); }
}
export function saveLayout(runId, positions) {
  try { localStorage.setItem(KEY_PREFIX + runId, JSON.stringify([...positions])); } catch { /* private browsing: session layout remains usable */ }
}
export function clearLayout(runId) { try { localStorage.removeItem(KEY_PREFIX + runId); } catch {} }
