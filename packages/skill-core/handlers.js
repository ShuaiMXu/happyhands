import {sourceContent,embeddedAssetInventory} from './source-content.js';
import {brandDeclarationEvidence} from './brand-evidence.js';
import {patternLibraryCurator} from './patterns.js';
import { cssDeclarations } from './css-tokens.js';
import { themeTokens } from './theme-tokens.js';
import { basename, join } from 'node:path';
import { sourceFiles } from './scan.js';
import { readFile } from 'node:fs/promises';
import { detectDrift } from './drift.js';
import { auditStates } from './states.js';
import { auditContrast } from './contrast.js';
import { captureEntries } from '../harness-core/capture-state.js';
import { inventoryComponents,productSource } from './components.js';
import {componentGraph} from './component-graph.js';
import { componentReusePlan } from '../experience-core/component-reuse.js';
import {designSystemContext} from './design-system.js';
const designSourceOnly=scan=>({...scan,files:scan.files.filter(file=>!file.dependencyInput&&!file.path.split('/').includes('node_modules'))});
const sourceDecodeErrors=scan=>scan.files.flatMap(file=>{
  const decoded=sourceContent(file);
  return decoded.error?[{file:file.path,location:decoded.location,message:decoded.error}]:[];
});

// Browser-evidence skills read captures in either recorded shape: the legacy
// single-URL capture with named viewports, and the task-state capture plan.
// Both normalise to the same flat list; a state that did not render carries no
// DOM to analyse, so it stays in the capture artifact instead of reaching a skill.
function capturedStates(capture) {
  return captureEntries(capture).filter(entry => entry.reached !== false && entry.dom);
}

// Display key mirrors captureKey's format but skips its validation: the IDs were
// validated when the capture was recorded, and a finding label is not a path.
function nameOf(entry) {
  return entry.legacy ? entry.configurationId : `${entry.stateId}--${entry.configurationId}`;
}

function occurrences(files, regex) {
  const found = new Map();
  for (const file of files) {
    for (const match of file.content.matchAll(regex)) {
      const value = match[1];
      const item = found.get(value) || { value, count: 0, sources: new Set() };
      item.count += 1;
      item.sources.add(file.path);
      found.set(value, item);
    }
  }
  return [...found.values()].map(item => ({ ...item, sources: [...item.sources].slice(0, 8) }));
}

// A token's category comes from its name when the name says what it is
// (radius, gap, font…) and from its value shape otherwise (hex is a color,
// ms/s is motion). Name wins because --header-height: 8px is a space slot
// even though the value is a bare length.
function tokenCategoryOf(name, value) {
  const n = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  const has = words => new RegExp(`(?:^|[-_.])(?:${words})(?:$|[-_.])`).test(n);
  // Explicit colour suffixes win (e.g. shadow-color), but a component/property
  // prefix alone must not turn border-width or text-shadow into colours.
  if (/(?:color|colour)$/.test(n)) return 'color';
  if (has('radius|corner|round|rounded')) return 'radius';
  if (has('shadow|elevation|glow')) return 'shadow';
  if (has('duration|transition|motion|easing|delay')) return 'motion';
  if (has('font|type|typography|leading|tracking|weight')) return 'type';
  if (has('space|spacing|gap|padding|margin|inset|offset|size|width|height')) return 'space';
  if (has('color|colour|bg|background|fg|foreground|text|border|stroke|ring|fill|tint')) return 'color';
  const v = value.trim().toLowerCase();
  if (/^(#|rgba?\(|hsla?\(|oklch\(|oklab\(|color\()/.test(v)) return 'color';
  if (/^calc\(/.test(v)) return 'other';
  if (/\d+m?s\b/.test(v)) return 'motion';
  if (/^-?\d*\.?\d+(px|rem|em|%|vh|vw|ch)/.test(v)) return 'space';
  return 'other';
}

async function foundationExtractor({ repo, sourceSnapshot, rubricSnapshot }) {
  if (!repo) return needs('A repository path is required to extract a foundation.');
  const source = sourceSnapshot ?? await sourceFiles(repo);
  // Example CSS in tests and saved output is not the running product's design
  // foundation. Keep it in provenance, but never promote it into candidate rules.
  const graphScan = {...source, files: source.files.filter(file => !file.path.endsWith('.md') && !/(^|\/)(?:tests?|__tests__|fixtures?|output)(\/|$)|\.(?:test|spec)\.[^.]+$/i.test(file.path))};
  const scan=designSourceOnly(graphScan);
  // Capture the declared value, not just the name: an inventory without
  // values cannot be promoted into the Experience Spec, whose tokens require
  // category, value and source. A name resolving to several values keeps its
  // most frequent value and lists the rest as observed variants.
  // Declarations are read theme-aware: a value inside a prefers-color-scheme:dark
  // media block or a [data-theme="dark"] rule files itself under themes.dark,
  // everything else under themes.light. When both sides exist the base value
  // stays light and themes carries the pair, the shape a full design-system
  // package (tokens.json with light/dark) exports.
  const declared = new Map();
  const DARK_CONTEXT = /prefers-color-scheme\s*:\s*dark|data-theme\s*=\s*["']?dark/i;
  function record(name, value, theme, file, line, contexts = [], embedded = null) {
    const slot = declared.get(name) || { counts: new Map(), themes: new Map(), declarations: [] };
    slot.declarations.push({file,line,value,theme:theme || 'base',contexts,...(embedded?{embedded}:{})});
    if (theme) {
      const current = slot.themes.get(theme) || new Map();
      current.set(value, (current.get(value) || 0) + 1);
      slot.themes.set(theme, current);
    } else {
      slot.counts.set(value, (slot.counts.get(value) || 0) + 1);
    }
    declared.set(name, slot);
  }
  const parseErrors = [];
  for (const file of scan.files) {
    const parsed = cssDeclarations(file);
    if (parsed) {
      if (parsed.error) parseErrors.push(parsed.error);
      for (const d of parsed.declarations) record(d.name,d.value,d.theme,file.path,d.line,d.contexts,d.embedded);
      continue;
    }
    let darkDepth = -1; // brace depth at which the current dark block opened
    let depth = 0;
    for (const [index, line] of file.content.split(/\r?\n/).entries()) {
      const opens = (line.match(/{/g) || []).length;
      const closes = (line.match(/}/g) || []).length;
      if (darkDepth < 0 && DARK_CONTEXT.test(line) && opens > 0) darkDepth = depth;
      const theme = darkDepth >= 0 ? 'dark' : null;
      depth += opens;
      for (const match of line.matchAll(/(--[a-zA-Z0-9-_]+)\s*:\s*([^;{}]+)/g)) {
        const value = match[2].trim();
        if (value && !value.startsWith('$') && !value.includes('${')) record(match[1], value, theme, file.path, index + 1);
      }
      depth -= closes;
      if (darkDepth >= 0 && depth <= darkDepth) darkDepth = -1;
    }
  }
  const pickTop = counts => [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const tokens = [...declared.entries()].map(([name, slot]) => {
    const sources = new Set(slot.declarations.map(item=>item.file));
    const themes = {};
    for (const [theme, counts] of slot.themes) themes[theme] = pickTop(counts);
    const base = themes.light ?? pickTop(slot.counts) ?? themes.dark;
    const variantSet = new Set([...slot.counts.keys(), ...[...slot.themes.values()].flatMap(counts => [...counts.keys()])]);
    
    return {
      name,
      value: base,
      category: tokenCategoryOf(name, base),
      themes: themes.dark && (themes.light || slot.counts.size) ? { light: themes.light || pickTop(slot.counts), dark: themes.dark } : undefined,
      variants: variantSet.size ? [...variantSet] : undefined,
      source: [...sources][0],
      declarations: slot.declarations,
      aliases: [...new Set([...variantSet].flatMap(value=>[...value.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)].map(match=>match[1])))],
      consumers: scan.files.flatMap(file=>file.content.split(/\r?\n/).flatMap((line,index)=>line.includes('var(') && [...line.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)].some(match=>match[1]===name)?[{file:file.path,line:index+1}]:[])),
      conflicts: [...slot.counts.keys()].length > 1 || [...slot.themes.values()].some(counts=>counts.size>1),
      sourceCount: sources.size,
      sources: [...sources].slice(0, 8),
      status: 'observed'
    };
  }).sort((a, b) => b.sourceCount - a.sourceCount || a.name.localeCompare(b.name));
  const byName = new Map(tokens.map(token=>[token.name,token]));
  const cycleCache = new Map();
  const hasCycle = (name, path = new Set()) => { if(path.has(name))return true; if(cycleCache.has(name))return cycleCache.get(name); path.add(name); const cycle=(byName.get(name)?.aliases || []).some(alias=>hasCycle(alias,path)); path.delete(name); cycleCache.set(name,cycle); return cycle; };
  for(const token of tokens){token.unresolvedAliases=token.aliases.filter(name=>!byName.has(name));token.aliasCycle=hasCycle(token.name);}
  const theme = themeTokens(scan.files);
  for (const token of theme.tokens) tokens.push({ ...token, category: tokenCategoryOf(token.objectPath.join('-'), token.value) });
  const components = inventoryComponents(graphScan.files,{truncated:graphScan.truncated});
  return {
    status: parseErrors.length || theme.issues.length || scan.truncated ? 'needs-evidence' : 'complete',
    evidence: [{ type: 'source-scan', parseErrors, themeIssues: theme.issues, filesScanned: scan.files.length, truncated: scan.truncated, tokensWithVariants: tokens.filter(token => token.variants).length }],
    findings: tokens.filter(token=>token.conflicts || token.aliasCycle || token.unresolvedAliases?.length).map((token,index)=>({id:`TOKEN-REVIEW-${index+1}`,title:`${token.name} has conflicting declarations or unresolved aliases; review before approval`,confidence:'high',evidence:[{declarations:token.declarations,aliases:token.aliases,unresolvedAliases:token.unresolvedAliases,aliasCycle:token.aliasCycle}]})),
    proposedUpdates: [{ type: 'design-foundation', status: 'observed', tokens, components }],
    limitations: [
      'Static source scan only; semantic token purpose, component variants and brand intent require human review.',
      'The summary value is the most frequent declaration per name, not an approved rule. File/line declarations, variants, consumers, unresolved aliases and cycles are preserved; conditional overrides still require human review.',
      'Category is inferred from the token name first and the value shape second; an unusual naming convention can file a token under the wrong slot.',
      'CSS files use PostCSS with ancestor contexts; other style sources retain a line-based heuristic. Arbitrary theme names, runtime styles and mixed-theme selectors require manual review.',
      'Named theme/token/palette objects and theme-file default/module.exports objects are parsed without executing code. Static relative named imports and re-exports are traced within the captured snapshot. Dynamic values, package aliases, namespace imports and require calls require inspection; object-key layers are declarations, not approved semantic intent.'
    ]
  };
}

async function consistencyAuditor({ repo, spec, sourceSnapshot, rubricSnapshot }) {
  if (!repo) return needs('A repository path is required to audit consistency.');
  const raw = designSourceOnly(sourceSnapshot ?? await sourceFiles(repo));
  const excludedSources = raw.files.filter(file => !productSource(file) || /(^|\/)(vendor|generated|_next|third-party)(\/|$)/i.test(file.path));
  const excludedPaths = new Set(excludedSources.map(file => file.path));
  const scan = {...raw, files: raw.files.filter(file => !excludedPaths.has(file.path))};
  const colors = occurrences(scan.files, /(#[0-9a-fA-F]{3,8})(?![0-9a-fA-F])/g).filter(item => item.count > 1);
  const radii = occurrences(scan.files, /border-radius\s*:\s*([^;\n}]+)/g).filter(item => item.count > 1);
  const approved = new Set((spec.designFoundation?.tokens || []).filter(item => item.status === 'approved').map(item => item.value.toLowerCase()));
  const ungoverned = colors.filter(item => !approved.has(item.value.toLowerCase()));
  const findings = [];
  if (ungoverned.length >= 6) findings.push({
    id: 'CONSISTENCY-COLOR-SPRAWL',
    title: `${ungoverned.length} repeated literal colors are not represented by approved tokens`,
    confidence: 'medium',
    evidence: ungoverned.slice(0, 12)
  });
  if (radii.length >= 5) findings.push({
    id: 'CONSISTENCY-RADIUS-SPRAWL',
    title: `${radii.length} repeated border-radius values may represent an ungoverned scale`,
    confidence: 'low',
    evidence: radii.slice(0, 12)
  });
  return {
    status: 'complete',
    evidence: [{ type: 'source-scan', filesScanned: scan.files.length, excludedSources: [...excludedPaths], literalColors: colors.length, radiusValues: radii.length }],
    findings,
    proposedUpdates: [],
    limitations: ['Literal-frequency heuristics do not prove a UX inconsistency; generated code and contextual exceptions need review.']
  };
}

async function visualHierarchyReviewer({ run, spec, rubricSnapshot }) {
  const capture = run.manifest.captures.before;
  if (!capture) return needs('A baseline browser capture is required.');
  const entries = capturedStates(capture);
  if (!entries.length) return needs('The baseline capture reached no renderable state.');
  const findings = [];
  for (const entry of entries) {
    const name = nameOf(entry).toUpperCase();
    if (entry.dom.h1.length !== 1) findings.push({
      id: `HIERARCHY-H1-${name}`,
      title: `${name} has ${entry.dom.h1.length} visible H1 headings`,
      confidence: 'high',
      evidence: [{ screenshot: entry.screenshot, h1: entry.dom.h1 }]
    });
    if (entry.dom.actions.length > 8) findings.push({
      id: `HIERARCHY-ACTIONS-${name}`,
      title: `${name} exposes ${entry.dom.actions.length} first-screen actions and needs priority review`,
      confidence: 'low',
      evidence: [{ screenshot: entry.screenshot, actions: entry.dom.actions }]
    });
  }
  return {
    status: 'needs-evidence',
    evidence: entries.map(entry => ({ state: nameOf(entry), screenshot: entry.screenshot, h1: entry.dom.h1, actions: entry.dom.actions })),
    reviewBrief: { rubric: rubricSnapshot, criticalTask: spec.project.task, designFoundation: spec.designFoundation || null, foundationApproval: run.manifest.foundationApproval || null },
    findings,
    proposedUpdates: [],
    limitations: ['DOM structure can flag review targets but cannot judge visual hierarchy without image analysis and the critical user task.']
  };
}

function baseline(run) {
  return run.manifest.captures.before;
}

async function informationArchitectureReviewer({ run, spec }) {
  const capture = baseline(run);
  if (!capture) return needs('A baseline browser capture is required.');
  const entries = capturedStates(capture);
  if (!entries.length) return needs('The baseline capture reached no renderable state.');
  const evidence = entries.map(entry => ({ state: nameOf(entry), screenshot: entry.screenshot, headings: entry.dom.headings || [], actions: entry.dom.actions || [], landmarks: entry.dom.landmarks || {} }));
  const findings = [];
  for (const item of evidence) {
    if (!item.landmarks.main) findings.push({ id: `IA-MAIN-${item.state.toUpperCase()}`, title: `${item.state} has no main landmark for the critical task`, confidence: 'high', evidence: [item], impact: 3, effort: 1 });
    const levels = item.headings.map(heading => heading.level);
    if (levels.some((level, index) => index > 0 && level > levels[index - 1] + 1)) findings.push({ id: `IA-HEADING-SKIP-${item.state.toUpperCase()}`, title: `${item.state} heading structure skips a level`, confidence: 'medium', evidence: [item], impact: 2, effort: 1 });
  }
  return { status: 'needs-evidence', evidence: [{ criticalTask: spec.project.task }, ...evidence], findings, proposedUpdates: [], limitations: ['One captured route can verify page structure but cannot establish the full product information architecture or task path.'] };
}

async function interactionReviewer({ run, spec }) {
  const capture = baseline(run);
  if (!capture) return needs('A baseline browser capture is required.');
  const entries = capturedStates(capture);
  if (!entries.length) return needs('The baseline capture reached no renderable state.');
  const evidence = entries.map(entry => ({ state: nameOf(entry), screenshot: entry.screenshot, controls: entry.dom.controls || [] }));
  const findings = [];
  for (const item of evidence) {
    const unnamed = item.controls.filter(control => !control.label);
    if (unnamed.length) findings.push({ id: `INTERACTION-UNNAMED-${item.state.toUpperCase()}`, title: `${item.state} exposes ${unnamed.length} visible controls without an accessible name`, confidence: 'high', evidence: [{ ...item, controls: unnamed }], impact: 4, effort: 2 });
  }
  return { status: 'needs-evidence', evidence: [{ criticalTask: spec.project.task }, ...evidence], findings, proposedUpdates: [], limitations: ['Static capture checks visible controls only. Task steps, feedback, loading, success, error and empty states still require interaction replay.'] };
}

async function contentDesignReviewer({ run, spec }) {
  const capture = baseline(run);
  if (!capture) return needs('A baseline browser capture is required.');
  const entries = capturedStates(capture);
  if (!entries.length) return needs('The baseline capture reached no renderable state.');
  const vague = /^(click here|learn more|more|submit|continue|下一步|更多|点击这里)$/i;
  const evidence = entries.map(entry => ({ state: nameOf(entry), screenshot: entry.screenshot, visibleCopy: entry.dom.visibleCopy || [], actions: entry.dom.actions || [] }));
  const findings = [];
  for (const item of evidence) {
    const labels = item.actions.filter(action => vague.test(action.label.trim()));
    if (labels.length) findings.push({ id: `CONTENT-VAGUE-ACTION-${item.state.toUpperCase()}`, title: `${item.state} has ${labels.length} action labels that do not describe the outcome`, confidence: 'medium', evidence: [{ ...item, actions: labels }], impact: 3, effort: 1 });
  }
  return { status: 'needs-evidence', evidence: [{ criticalTask: spec.project.task }, ...evidence], findings, proposedUpdates: [], limitations: ['String checks find ambiguous labels but cannot judge positioning, factual accuracy or user language without product context and human review.'] };
}

async function accessibilityReviewer({ run, repo }) {
  if (!repo) return needs('A repository path is required for accessibility review.');
  const capture = baseline(run);
  if (!capture) return needs('A baseline browser capture is required.');
  const entries = capturedStates(capture);
  if (!entries.length) return needs('The baseline capture reached no renderable state.');
  const evidence = entries.map(entry => ({ state: nameOf(entry), screenshot: entry.screenshot, accessibility: entry.dom.accessibility || null, language: entry.dom.language, landmarks: entry.dom.landmarks || {}, images: entry.dom.images || {}, unlabeledInputs: entry.dom.unlabeledInputs || [], controls: entry.dom.controls || [] }));
  const findings = [];
  for (const item of evidence) {
    for (const rule of item.accessibility?.violations || []) findings.push({id: `A11Y-AXE-${rule.id.toUpperCase()}-${item.state.toUpperCase()}`,title:rule.help,confidence:'high',impact:['critical','serious'].includes(rule.impact)?5:3,effort:2,evidence:[{state:item.state,screenshot:item.screenshot,engineVersion:item.accessibility.version,rule}]});
    if (!item.language) findings.push({ id: `A11Y-LANG-${item.state.toUpperCase()}`, title: `${item.state} document has no language declaration`, confidence: 'high', evidence: [item], impact: 3, effort: 1 });
    if (item.images.missingAlt?.length) findings.push({ id: `A11Y-ALT-${item.state.toUpperCase()}`, title: `${item.state} has ${item.images.missingAlt.length} images without alt attributes`, confidence: 'high', evidence: [item], impact: 4, effort: 2 });
    if (item.unlabeledInputs.length) findings.push({ id: `A11Y-FORM-${item.state.toUpperCase()}`, title: `${item.state} has ${item.unlabeledInputs.length} unlabeled form controls`, confidence: 'high', evidence: [item], impact: 5, effort: 2 });
  }
  return { status: evidence.some(item=>item.accessibility?.status === 'failed' || item.accessibility?.incomplete?.length) ? 'needs-evidence' : 'complete', evidence, findings, proposedUpdates: [], limitations: ['Automated semantic checks do not certify WCAG conformance; keyboard order, focus visibility, contrast and assistive-technology behavior need manual review.'] };
}

async function responsiveReviewer({ run, spec }) {
  const capture = baseline(run);
  if (!capture) return needs('A baseline browser capture is required.');
  const entries = capturedStates(capture);
  // Responsive review compares configurations of the same state. With a legacy
  // capture every entry is the implicit `page` state, so this keeps the original
  // desktop-versus-mobile behaviour; with a capture plan it never compares two
  // different task states against each other.
  const groups = new Map();
  for (const entry of entries) {
    const list = groups.get(entry.stateId) || [];
    list.push(entry);
    groups.set(entry.stateId, list);
  }
  const matched = [...groups.values()].filter(list => list.length >= 2);
  if (!matched.length) return needs('At least two matched configurations of one state are required.');
  const evidence = [];
  const findings = [];
  for (const group of matched) {
    const items = group.map(entry => ({ state: nameOf(entry), width: entry.width, height: entry.height, screenshot: entry.screenshot, horizontalOverflow: entry.dom.horizontalOverflow, actions: entry.dom.actions || [], controls: entry.dom.controls || [] }));
    evidence.push(...items);
    for (const item of items) {
      if (item.horizontalOverflow) findings.push({ id: `RESPONSIVE-OVERFLOW-${item.state.toUpperCase()}`, title: `${item.state} has horizontal page overflow`, confidence: 'high', evidence: [item], impact: 5, effort: 2 });
      const small = item.controls.filter(control => control.width < 24 || control.height < 24);
      if (small.length) findings.push({ id: `RESPONSIVE-TARGET-${item.state.toUpperCase()}`, title: `${item.state} has ${small.length} visible controls smaller than 24×24px`, confidence: 'medium', evidence: [{ ...item, controls: small }], impact: 3, effort: 2 });
    }
    const [first, ...rest] = items;
    const primary = first.actions[0]?.label;
    if (primary && rest.some(item => !item.actions.some(action => action.label === primary))) findings.push({ id: `RESPONSIVE-ACTION-CONTINUITY-${first.state.toUpperCase()}`, title: 'The first visible action in one configuration is absent in another matched configuration of the same state', confidence: 'medium', evidence: items, impact: 4, effort: 2 });
  }
  return { status: 'complete', evidence: [{ criticalTask: spec.project.task }, ...evidence], findings, proposedUpdates: [], limitations: ['Matched configurations verify sampled states only; intermediate breakpoints, orientation and alternative input modes remain untested.'] };
}

// An asset's role is read from its filename the way a person would file it:
// logo.svg is the logo, favicon.ico is the favicon. The regex is a heuristic
// and the role stays observed until a person confirms it.
function assetRoleOf(path) {
  const name = path.toLowerCase();
  if (/favicon/.test(name)) return 'favicon';
  if (/og[-_]?image|social|share/.test(name)) return 'og-image';
  if (/logo/.test(name)) return 'logo';
  if (/mark|monogram/.test(name)) return 'mark';
  if (/\.(?:woff2?|ttf|otf)$/.test(name)) return 'font';
  if (/icon/.test(name)) return 'icon';
  return 'other';
}

async function brandFoundationExtractor({ run, repo, spec, sourceSnapshot, rubricSnapshot }) {
  if (!repo) return needs('A repository path is required to extract brand evidence.');
  const capture = baseline(run);
  if (!capture) return needs('A baseline browser capture is required.');
  const scan = designSourceOnly(sourceSnapshot ?? await sourceFiles(repo,{includeDesignDocs:true}));
  const excludedAssetSources=scan.files.filter(file=>!productSource(file)||/(^|\/)scripts\/(?:verify|test)[-_][^/]+\.[cm]?[jt]sx?$/i.test(file.path)).map(file=>file.path);
  const assetFiles=scan.files.filter(file=>!excludedAssetSources.includes(file.path));
  const assets = new Map();
  const assetPattern = /["'`](\/?[^"'`\s)]+\.(?:avif|gif|ico|jpe?g|png|svg|webp|woff2?|ttf|otf))["'`]/gi;
  for (const file of assetFiles.filter(file=>!file.path.endsWith('.md'))) {
    for (const match of sourceContent(file).content.matchAll(assetPattern)) {
      const path = match[1];
      const key = path;
      const current = assets.get(key) || { path, sources: new Set() };
      current.sources.add(file.path);
      assets.set(key, current);
    }
  }
  const embedded=assetFiles.map(embeddedAssetInventory);
  const assetErrors=embedded.flatMap(item=>item.errors);
  const rendered = capturedStates(capture).map(entry => ({ state: nameOf(entry), screenshot: entry.screenshot, title: entry.dom.title || '', h1: entry.dom.h1 || [], visibleCopy: entry.dom.visibleCopy || [] }));
  const candidates = [...assets.values()].map(item => ({
    name: basename(item.path),
    path: item.path,
    role: assetRoleOf(item.path),
    format: (item.path.match(/\.([a-z0-9]+)$/i) || [null, ''])[1].toLowerCase(),
    sources: [...item.sources],
    status: 'observed'
  }));
  // Voice evidence keeps the state each sample rendered in, so a promoted
  // voice rule can cite where the wording was actually seen.
  const voiceEvidence = rendered
    .flatMap(item => [item.title, ...item.h1.slice(0, 2), ...item.visibleCopy.slice(0, 6)].filter(Boolean).map(sample => ({ sample: sample.trim(), source: item.state })))
    .filter((item, index, all) => all.findIndex(other => other.sample === item.sample) === index)
    .slice(0, 20);
  const declarations=brandDeclarationEvidence(scan);
  const sourceErrors=sourceDecodeErrors(scan);
  return {
    status: scan.truncated||sourceErrors.length||assetErrors.length||declarations.omissions.length||declarations.alternatives.length ? 'needs-evidence' : 'complete',
    evidence: [{ type: 'source-scan', filesScanned: scan.files.length, truncated: Boolean(scan.truncated), excludedAssetSources, assetErrors, sourceErrors }, ...rendered],
    findings: [],
    proposedUpdates: [{
      type: 'brand-foundation-candidates',
      status: 'observed',
      assets: [...candidates,...embedded.flatMap(item=>item.assets).map(asset=>({...asset,role:assetRoleOf(asset.name)}))],
      voiceEvidence,
      declarations,
      declaredContext: { goal: spec.project.goal, audience: spec.project.audience }
    }],
    limitations: [
      'Test/fixture paths and explicitly named scripts/verify-*, scripts/test-* sources are excluded from brand asset discovery; excluded paths remain in source-scan evidence.',
      'Assets and copy are observed candidates. Brand meaning, positioning, voice rules and asset approval require human review.',
      'Embedded asset records contain metadata only. Dimensions, actual usage, duplicates and redistribution rights require inspection; no embedded blobs are exported.',
      'Asset roles come from filename conventions; an unconventionally named logo files itself under other until a person says otherwise.'
    ]
  };
}

async function componentInventory({ repo, sourceSnapshot, rubricSnapshot }) {
  if (!repo) return needs('A repository path is required to inventory components.');
  const scan = sourceSnapshot ?? await sourceFiles(repo);
  const components = inventoryComponents(scan.files);
  const sourceErrors=sourceDecodeErrors(designSourceOnly(scan));
  return {
    status: scan.truncated || sourceErrors.length ? 'needs-evidence' : 'complete',
    evidence: [{ type: 'source-scan', filesScanned: scan.files.length, truncated: scan.truncated, sourceErrors, componentFiles: components.map(item => item.source),moduleResolutionIssues:componentGraph(scan.files.map(file=>({...file,...sourceContent(file)})),{truncated:scan.truncated}).issues }],
    findings: [],
    proposedUpdates: [{ type: 'component-inventory', status: 'observed', components }],
    limitations: ['Static imports, snapshot-backed tsconfig/jsconfig aliases and relative HTML script/loader references identify candidates, not verified runtime composition. Config inputs/hashes are retained; missing package bases, absolute configs and ambiguous scope remain unresolved. Root-relative server mounts, generated components and variants can be missed; inspect the source API and rendered states before reuse.']
  };
}

async function fixPlanner({ run, spec }) {
  if (!run.manifest.findingId) return needs('Select and confirm a finding before planning a fix.');
  const confirmation = run.manifest.confirmation;
  if (confirmation?.verdict !== 'supported' || confirmation.findingId !== run.manifest.findingId) {
    return needs('The selected finding requires a matching supported human confirmation before planning a fix.');
  }
  const finding = spec.findings.find(item => item.id === run.manifest.findingId);
  if (!finding) return needs('The selected finding is absent from the Experience Spec.');
  const approved = spec.designFoundation
    ? [...spec.designFoundation.tokens, ...spec.designFoundation.components, ...spec.designFoundation.patterns].filter(item => item.status === 'approved')
    : [];
  return {
    status: 'complete',
    evidence: spec.evidence.filter(item => finding.evidenceIds.includes(item.id)),
    findings: [],
    proposedUpdates: [{ type: 'fix-plan', findingId: finding.id, intent: finding.proposal, constraints: approved.map(item => ({ name: item.name, source: item.source })), acceptance: ['Preserve existing working paths', 'Render the same desktop and mobile states', 'Record regressions and remaining uncertainty'] }],
    limitations: ['This plan preserves declared constraints; file-level edit scope still requires repository inspection.']
  };
}

async function componentReusePlanner({ spec, run }) {
  const foundation = spec.designFoundation;
  if (!foundation) return needs('A Design Foundation is required to decide component reuse.');
  const plan = componentReusePlan(spec, run.manifest.findingId, (await designSystemContext(run)).before);
  const components = [...plan.components, ...plan.observedNeedsReview];
  return {
    status: components.length ? 'complete' : 'needs-evidence',
    evidence: components.map(item => ({ name: item.name, source: item.source, variants: item.variants, states: item.states, status: item.status })),
    findings: [],
    proposedUpdates: [{ type: 'reuse-candidates', ...plan }],
    limitations: components.length ? ['Component suitability for the selected fix requires semantic repository inspection.'] : ['No reusable component candidates are documented.']
  };
}

async function visualQaEvaluator({ run }) {
  const before = run.manifest.captures.before;
  const after = run.manifest.captures.after;
  if (!before || !after) return needs('Matching before and after captures are required for visual QA.');
  const afterByKey = new Map(captureEntries(after).map(entry => [nameOf(entry), entry]));
  return {
    status: 'needs-evidence',
    evidence: captureEntries(before).map(entry => {
      const matched = afterByKey.get(nameOf(entry));
      return {
        state: nameOf(entry),
        before: entry.screenshot ?? null,
        after: matched?.screenshot ?? null,
        beforeH1: entry.dom?.h1 ?? null,
        afterH1: matched?.dom?.h1 ?? null
      };
    }),
    findings: [],
    proposedUpdates: [],
    limitations: ['Matched artifacts are ready, but screenshot-aware independent review is required before claiming visual improvement.']
  };
}

async function judgmentDistiller({ run }) {
  const judgment = run.manifest.judgment;
  if (!judgment || run.manifest.judgmentWithdrawal) return needs('An active accept or reject judgment with a reason is required.');
  return {
    status: 'complete',
    evidence: [{ findingId: run.manifest.findingId, decision: judgment.decision, reason: judgment.reason, at: judgment.at }],
    findings: [],
    proposedUpdates: [{ type: 'judgment-candidate', scope: 'project', decision: judgment.decision, statement: judgment.reason, promotion: 'Human review is required before this becomes a Foundation or Expertise rule.' }],
    limitations: ['One judgment is project evidence, not a universal design principle.']
  };
}

async function evidenceGate({ run, spec, repo, skill }) {
  const available = { repository: Boolean(repo), designFoundation: Boolean(spec.designFoundation), baselineCapture: Boolean(run.manifest.captures.before), afterCapture: Boolean(run.manifest.captures.after), criticalTask: Boolean(spec.project.task), finding: Boolean(run.manifest.findingId), judgment: Boolean(run.manifest.judgment) && !run.manifest.judgmentWithdrawal, projectHistory: false, gitDiff: false, regressionCases: false };
  const missing = skill.requiredInputs.filter(input => !available[input]);
  return {
    status: 'needs-evidence', evidence: [{ requiredInputs: skill.requiredInputs, available, missing }], findings: [], proposedUpdates: [],
    limitations: [missing.length ? `Missing required inputs: ${missing.join(', ')}.` : `${skill.id} requires model-assisted or task-level review beyond the current deterministic handler.`]
  };
}

async function designSystemDrift({ repo, spec, sourceSnapshot, rubricSnapshot }) {
  if (!repo) return needs('A repository path is required to detect drift.');
  const foundation = spec.designFoundation;
  if (!foundation?.tokens?.length) return needs('A design foundation with tokens is required before drift can be claimed.');
  const scan = designSourceOnly(sourceSnapshot ?? await sourceFiles(repo));
  const drift = detectDrift({ files: scan.files, foundation });
  const approved = drift.index.approved.length;
  const governedShare = drift.usage.literalValues + drift.usage.governedReferences === 0
    ? null
    : Number((drift.usage.governedReferences / (drift.usage.literalValues + drift.usage.governedReferences)).toFixed(3));
  const limitations = [
    'Static text scan. Values behind computed styles, class utilities, images or runtime theming are not covered, and a var(--token) reference is not followed to the value it resolves to.',
    'Semantic slots are inferred from nearby keywords, so an unusual naming convention can miss a real conflict or group two unrelated values.',
    'Every finding reports a divergence, not a direction. An implementation value that already shipped may be the truth and the token may be what has to change; a person decides and records which.',
    'Registering a value as a token does not change the implementation. A proposed token is an entry in the foundation only, until the code is changed to reference it.'
  ];
  if (drift.skippedScales.length) limitations.push(`No approved scale exists for ${drift.skippedScales.join(', ')}, so off-scale values in those categories were not checked.`);
  if (!approved) limitations.push('This foundation has no approved tokens. Observed entries are candidates, not rules, so these divergences are review targets rather than established drift.');
  return {
    status: approved ? 'complete' : 'needs-evidence',
    evidence: [{
      type: 'source-scan',
      filesScanned: scan.files.length,
      truncated: scan.truncated,
      tokens: drift.index.tokens.length,
      approvedTokens: approved,
      literalValues: drift.usage.literalValues,
      governedReferences: drift.usage.governedReferences,
      governedShare,
      scales: drift.index.scales
    }],
    findings: drift.findings,
    proposedUpdates: drift.nominations.length
      ? [{
        type: 'design-foundation',
        status: 'observed',
        effect: 'registers-the-value-only',
        appliedToCode: false,
        tokens: drift.nominations.map(item => ({ category: 'color', name: null, value: item.value, source: item.sources[0]?.file ?? null, occurrences: item.count, fileCount: item.fileCount, status: 'observed' }))
      }]
      : [],
    limitations
  };
}

async function componentStateAudit({ repo, spec, skill, sourceSnapshot, rubricSnapshot }) {
  if (!repo) return needs('A repository path is required to audit component states.');
  const components = (spec.designFoundation?.components || []);
  if (!components.length) return needs('A design foundation with components is required; there is nothing documented to audit.');
  const rubric = rubricSnapshot ?? JSON.parse(await readFile(join(skill.directory, 'rubric.json'), 'utf8'));
  const scan = designSourceOnly(sourceSnapshot ?? await sourceFiles(repo));
  const audit = auditStates({ components, files: scan.files, rubric });
  const documented = components.filter(item => (item.states || []).length).length;
  const limitations = [
    'Observed findings come from a static text scan. The absence of a state word is not proof that the state is missing, and its presence is not proof that the state works.',
    'A required state is a design decision, not a defect. It may live in another component, or the component may belong to a different class; the audit names the gap and leaves the call.',
    `Required state sets come from rubric ${audit.rubricVersion} in this Skill version. A project with different component classes has to replace that rubric before the required sets mean anything for it.`
  ];
  if (audit.counts.unclassified) limitations.push(`${audit.counts.unclassified} component(s) match no class in the rubric, so nothing is required of them here.`);
  if (audit.counts.withSource < audit.counts.components) limitations.push(`${audit.counts.components - audit.counts.withSource} component(s) have missing, ambiguous or unreadable source at the recorded path, so only their documented states were audited.`);
  if (scan.truncated) limitations.push('The source snapshot is truncated; observed state coverage is incomplete even where the documented-state comparison is available.');
  if (!documented) limitations.push('No component in this foundation declares any state, so the documented tier had nothing to compare and every result rests on the source scan alone.');
  return {
    status: documented && !scan.truncated && audit.counts.withSource === audit.counts.components ? 'complete' : 'needs-evidence',
    evidence: [{ type: 'component-state-audit', rubricVersion: audit.rubricVersion, filesScanned: scan.files.length, truncated: scan.truncated, counts: audit.counts, componentsWithDeclaredStates: documented, components: audit.components }],
    findings: audit.findings,
    proposedUpdates: [],
    limitations
  };
}

async function tokenContrast({ repo, spec, sourceSnapshot, rubricSnapshot }) {
  const foundation = spec.designFoundation;
  if (!foundation?.tokens?.length) return needs('A design foundation with colour tokens is required to compute contrast.');
  const scan = repo ? designSourceOnly(sourceSnapshot ?? await sourceFiles(repo)) : null;
  const audit = auditContrast({ foundation, files: scan?.files || [] });
  if (!audit.pairs.length) {
    return {
      status: 'needs-evidence',
      evidence: [{ type: 'token-contrast', thresholds: audit.thresholds, counts: audit.counts, unreadable: audit.unreadable, translucent: audit.translucent }],
      findings: [],
      proposedUpdates: [],
      limitations: ['No colour pair could be computed. Contrast needs a pair that something states: a role with both a text and a surface token, or a declaration that sets a text colour and a background together.']
    };
  }
  const limitations = [
    'Only pairs that something states are computed: a role with both a text and a surface token, and declarations that set a text colour and a background together. A pair nobody expressed is not invented.',
    'WCAG thresholds depend on the size and weight of the text, which a token pair does not carry. A ratio below 3:1 fails every use; between 3:1 and 4.5:1 it carries large text or non-text only, and whether that is what it carries has to be checked in the interface.',
    'Contrast is necessary, not sufficient. A pair that passes can still be illegible against a photograph, behind a gradient, or at a weight the ratio does not describe.'
  ];
  if (!repo) limitations.push('No repository was given, so only pairs declared by token names were computed.');
  if (audit.translucent.length) limitations.push(`${audit.translucent.length} token(s) carry an alpha channel; their rendered colour depends on what is behind them, so they were skipped.`);
  if (audit.unreadable.length) limitations.push(`${audit.unreadable.length} colour token(s) hold a value that is not a hex colour and could not be measured.`);
  return {
    status: 'complete',
    evidence: [{ type: 'token-contrast', thresholds: audit.thresholds, filesScanned: scan?.files.length ?? 0, counts: audit.counts, pairs: audit.pairs, unreadable: audit.unreadable, translucent: audit.translucent }],
    findings: audit.findings,
    proposedUpdates: [],
    limitations
  };
}

function needs(message) {
  return { status: 'needs-evidence', evidence: [], findings: [], proposedUpdates: [], limitations: [message] };
}

const HANDLERS = Object.freeze({ foundationExtractor, consistencyAuditor, visualHierarchyReviewer, informationArchitectureReviewer, interactionReviewer, contentDesignReviewer, accessibilityReviewer, responsiveReviewer, brandFoundationExtractor, componentInventory, designSystemDrift, componentStateAudit, tokenContrast, fixPlanner, componentReusePlanner, visualQaEvaluator, judgmentDistiller, patternLibraryCurator, evidenceGate });

export async function runHandler(name, context) {
  const handler = HANDLERS[name];
  if (!handler) throw new Error(`Handler is not allow-listed: ${name}.`);
  return handler(context);
}
