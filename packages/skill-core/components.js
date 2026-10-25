import {sourceContent} from './source-content.js';
import { posix } from 'node:path';
import {componentGraph,moduleReferences,resolveModule} from './component-graph.js';

export const productSource = file => !/(^|\/)(?:tests?|__tests__|fixtures?|output)(\/|$)|\.(?:test|spec)\.[^.]+$/i.test(file.path);

// Resolve relative imports by full source identity. Two folders can contain a
// Button; a basename match would assign both the same consumers.
export function importsSource(page, target) {
  return moduleReferences(page).references.some(ref=>resolveModule(page.path,ref.specifier,new Set([target])).target===target);
}

// Native HTML/JS projects also have reusable UI. Require both a DOM renderer
// and an explicit page script reference; a filename alone is not evidence.
export function inventoryComponents(files,options={}) {
  const source = files.filter(file => (productSource(file)||file.path.endsWith('.json')) && !file.path.endsWith('.md')).map(file=>({...file,...sourceContent(file)}));
  const graph=componentGraph(source,options);
  return source.flatMap(file => {
    const name = posix.basename(file.path, posix.extname(file.path));
    const scripts = source.filter(page => page.path !== file.path && [
      ...page.content.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi),
      ...(/\.html$/i.test(page.path) && /createElement\([^)]*['"]script['"]/.test(page.content) ? page.content.matchAll(/["']([^"'\s]+\.js(?:\?[^"']*)?)["']/g) : [])
    ].some(match => {
      const ref = match[1].split(/[?#]/)[0];
      if (/^(?:[a-z]+:|\/\/)/i.test(ref)) return false;
      // Root URLs may have an unknown server mount. Resolve relative paths
      // only; an explicit shared module still remains visible via imports.
      return !ref.startsWith('/') && posix.normalize(posix.join(posix.dirname(page.path), ref)) === file.path;
    }));
    const native = /\.[cm]?js$/i.test(file.path) && scripts.length > 0 && /(?:createElement|innerHTML|insertAdjacentHTML|replaceChildren)\s*[(=]/.test(file.content);
    const inlineDocument=/\.html$/i.test(file.path)&&/<style\b/i.test(file.content)&&/<body\b/i.test(file.content);
    if (!inlineDocument && (!/\.(?:[cm]?js|jsx|tsx?|astro|vue|svelte)$/i.test(file.path) || !/(^|\/)(components?|ui)\//i.test(file.path) && !native)) return [];
    const exports = [...file.content.matchAll(/export\s+(?:default\s+)?(?:class|function|const|let|var)?\s*([A-Za-z_$][\w$]*)?/g)].map(match => match[1]).filter(Boolean);
    const globals = native ? [...file.content.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)].map(match => match[1]) : [];
    const usage=graph.consumers(file.path);
    return [{ name, source: file.path, exports: [...new Set([...exports, ...globals])], consumers: [...new Set([...scripts.map(page => page.path), ...usage.direct.map(edge=>edge.file)])],
      consumerEvidence:usage.direct,potentialConsumers:usage.potential,consumerGraphTruncated:usage.truncated,moduleResolutionIssues:graph.issues.filter(issue=>issue.file===file.path||usage.potential.some(consumer=>consumer.file===issue.file)),
      status: 'observed', kind: inlineDocument ? 'inline-document' : native ? 'native-ui-module' : 'component-file' }];
  });
}
