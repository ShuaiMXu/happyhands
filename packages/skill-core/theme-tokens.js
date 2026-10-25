import ts from 'typescript';
import { posix } from 'node:path';

// Parse only the captured source snapshot. No module is imported or evaluated,
// and dependency resolution never reads outside that snapshot.
export function themeTokens(files, { maxSteps = 50000, maxSourceBytes = 8 * 1024 * 1024 } = {}) {
  const segment = value => encodeURIComponent(value).replaceAll('.', '%2E');
  const modules = new Map(), issues = [], tokens = [];
  const sources = new Map(files.filter(file => /\.[cm]?[jt]sx?$/.test(file.path)).map(file => [file.path, file]));
  let parsedBytes = 0;
  const themeName = name => /(?:^|[-_.])(?:theme|themes|tokens|palette)(?:$|[-_.])/i.test(name.replace(/([a-z])([A-Z])/g, '$1-$2'));
  function parse(file) {
    if (modules.has(file.path)) return modules.get(file.path);
    parsedBytes += Buffer.byteLength(file.content);
    if (parsedBytes > maxSourceBytes) {
      issues.push({ file: file.path, line: 1, reason: 'Theme source parsing budget exceeded' });
      return null;
    }
    let ast;
    try {
      ast = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true,
        /x$/.test(file.path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    } catch (error) {
      issues.push({ file: file.path, line: 1, reason: `Theme parser failed: ${error.message}` });
      return null;
    }
    const module = { file, ast, bindings: new Map(), exports: new Map(), roots: [] };
    for (const statement of ast.statements) {
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name)) continue;
          const name = declaration.name.text;
          module.bindings.set(name, { node: declaration.initializer, constant: Boolean(statement.declarationList.flags & ts.NodeFlags.Const) });
          if (statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) module.exports.set(name, { local: name });
          const exported = statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
          let initializer = declaration.initializer;
          while (initializer && (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer) || ts.isParenthesizedExpression(initializer))) initializer = initializer.expression;
          if (themeName(name) || exported && themeName(posix.basename(file.path).replace(/\.[^.]+$/, '')) && initializer && ts.isObjectLiteralExpression(initializer)) module.roots.push({ name, node: declaration.name });
        }
      } else if (ts.isImportDeclaration(statement) && statement.importClause && ts.isStringLiteral(statement.moduleSpecifier)) {
        const from = statement.moduleSpecifier.text, clause = statement.importClause;
        if (clause.name) module.bindings.set(clause.name.text, { from, imported: 'default' });
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const item of clause.namedBindings.elements) module.bindings.set(item.name.text, { from, imported: (item.propertyName || item.name).text });
        }
      } else if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
        module.exports.set('default', { node: statement.expression });
        if (themeName(posix.basename(file.path).replace(/\.[^.]+$/, '')) || /(?:^|\/)tailwind\.config\./.test(file.path)) {
          module.roots.push({ name: 'default', node: statement.expression, tailwind: /(?:^|\/)tailwind\.config\./.test(file.path) });
        }
      } else if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const item of statement.exportClause.elements) module.exports.set(item.name.text,
          statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
            ? { from: statement.moduleSpecifier.text, imported: (item.propertyName || item.name).text }
            : { local: (item.propertyName || item.name).text });
      } else if (ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression)
        && statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && statement.expression.left.getText(ast) === 'module.exports') {
        module.exports.set('default', { node: statement.expression.right });
        if (themeName(posix.basename(file.path).replace(/\.[^.]+$/, '')) || /(?:^|\/)tailwind\.config\./.test(file.path)) {
          module.roots.push({ name: 'default', node: statement.expression.right, tailwind: /(?:^|\/)tailwind\.config\./.test(file.path) });
        }
      }
    }
    modules.set(file.path, module);
    return module;
  }
  // Parse candidate theme modules first; parse ordinary modules only when a
  // static theme reference actually imports them.
  for (const file of sources.values()) {
    if (themeName(posix.basename(file.path).replace(/\.[^.]+$/, '')) || /(?:^|\/)tailwind\.config\./.test(file.path)
      || [...file.content.matchAll(/\b(?:const|let|var)\s+([\w$]+)/g)].some(match => themeName(match[1]))) parse(file);
  }
  const location = (module, node) => ({ file: module.file.path, line: module.ast.getLineAndCharacterOfPosition(node?.getStart(module.ast) ?? 0).line + 1 });
  const missing = (module, node, reason) => ({ kind: 'unknown', reason, ...location(module, node) });
  let steps = 0;
  function resolveModule(module, from) {
    if (!from.startsWith('.')) return null;
    const base = posix.normalize(posix.join(posix.dirname(module.file.path), from));
    const stem = base.replace(/\.[cm]?jsx?$/, '');
    const candidates = [base, ...[base, stem].flatMap(path => ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs', '/index.ts', '/index.js'].map(ext => path + ext))];
    const file = candidates.map(path => sources.get(path)).find(Boolean);
    return file ? parse(file) : null;
  }
  function binding(module, name, stack, exported = false) {
    if (stack.size > 64 || ++steps > maxSteps) return missing(module, null, 'Static extraction budget exceeded');
    const id = `${module.file.path}#${exported ? 'export:' : ''}${name}`;
    if (module.ast.parseDiagnostics.length) return missing(module, null, 'Referenced module has syntax errors');
    if (stack.has(id)) return missing(module, null, `Cyclic reference: ${id}`);
    const next = new Set(stack).add(id), entry = (exported ? module.exports : module.bindings).get(name);
    if (!entry) return missing(module, null, `Unresolved reference: ${id}`);
    let result;
    if (entry.from) {
      const target = resolveModule(module, entry.from);
      result = target ? binding(target, entry.imported, next, true) : missing(module, null, `Import not in snapshot: ${entry.from}`);
    } else if (entry.local) result = binding(module, entry.local, next);
    else if (entry.constant === false) return missing(module, entry.node, `Mutable binding: ${name}`);
    else result = evaluate(module, entry.node, next);
    return { ...result, references: [...(result.references || []), id] };
  }
  function evaluate(module, node, stack = new Set(), depth = 0) {
    if (++steps > maxSteps || depth > 64) return missing(module, node, 'Static extraction budget exceeded');
    if (!node) return missing(module, node, 'Missing initializer');
    const child = value => evaluate(module, value, stack, depth + 1);
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) return child(node.expression);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isNumericLiteral(node)) {
      return { kind: 'scalar', value: node.text, valueKind: ts.isNumericLiteral(node) ? 'number' : 'string', ...location(module, node), references: [] };
    }
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) return { kind: 'scalar', value: '-' + node.operand.text, valueKind: 'number', ...location(module, node), references: [] };
    if (ts.isIdentifier(node)) return binding(module, node.text, stack);
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const parent = child(node.expression), key = ts.isPropertyAccessExpression(node) ? node.name.text
        : node.argumentExpression && (ts.isStringLiteral(node.argumentExpression) || ts.isNumericLiteral(node.argumentExpression)) ? node.argumentExpression.text : null;
      if (key === null || parent.kind !== 'object' || !parent.entries.has(key)) return missing(module, node, `Unresolved property: ${node.getText(module.ast).slice(0, 160)}`);
      const value = parent.entries.get(key);
      return { ...value, references: [...(value.references || []), ...(parent.references || []).map(ref => `${ref}.${segment(key)}`)] };
    }
    if (ts.isObjectLiteralExpression(node)) {
      const entries = new Map(), unresolved = [];
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) {
          const spread = child(property.expression);
          if (spread.kind !== 'object') {
            // A dynamic spread may overwrite any preceding property.
            entries.clear(); unresolved.push(spread);
          } else {
            if (spread.unresolved.length) entries.clear();
            for (const [key, value] of spread.entries) entries.set(key, { ...value, references: [...(value.references || []), ...(spread.references || []).map(ref => `${ref}.${segment(key)}`)] });
            unresolved.push(...spread.unresolved);
          }
          continue;
        }
        const key = property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name)) ? property.name.text : null;
        if (key === null) { entries.clear(); unresolved.push(missing(module, property, 'Computed property may overwrite earlier values')); continue; }
        const value = ts.isPropertyAssignment(property) ? child(property.initializer)
          : ts.isShorthandPropertyAssignment(property) ? binding(module, key, stack)
            : missing(module, property, 'Accessor or method is not executed');
        entries.set(key, value);
      }
      return { kind: 'object', entries, unresolved, references: [], ...location(module, node) };
    }
    if (ts.isArrayLiteralExpression(node)) {
      const values = node.elements.map(child);
      if (values.every(value => value.kind === 'scalar' && value.valueKind !== 'array')) return { kind: 'scalar', value: JSON.stringify(values.map(value => value.valueKind === 'number' ? Number(value.value) : value.value)), valueKind: 'array', references: values.flatMap(value => value.references), ...location(module, node) };
    }
    return missing(module, node, `Unsupported static value: ${ts.SyntaxKind[node.kind]}`);
  }
  for (const module of modules.values()) {
    for (const root of module.roots) {
      if (module.ast.parseDiagnostics.length) {
        issues.push(...module.ast.parseDiagnostics.map(diagnostic => ({ file: module.file.path, line: module.ast.getLineAndCharacterOfPosition(diagnostic.start || 0).line + 1, reason: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ') })));
        continue;
      }
      let value = evaluate(module, root.node);
      if (root.tailwind) value = value.kind === 'object' && value.entries.has('theme') ? value.entries.get('theme') : missing(module, root.node, 'Tailwind theme is not a static object');
      function flatten(current, path, inherited = []) {
        if (path.length > 64) { issues.push({ root: `${module.file.path}#${root.name}`, reason: 'Theme object depth budget exceeded' }); return; }
        if (current.kind === 'unknown') { issues.push({ root: `${module.file.path}#${root.name}`, path, ...current }); return; }
        const references = [...new Set([...inherited, ...(current.references || [])])];
        if (current.kind === 'object') {
          issues.push(...current.unresolved.map(item => ({ root: `${module.file.path}#${root.name}`, path, ...item })));
          for (const [key, entry] of current.entries) flatten(entry, [...path, key], references.map(ref => `${ref}.${segment(key)}`));
          return;
        }
        if (!path.length) return; // A scalar named theme is not a theme object.
        const layer = path.find(part => /^(primitive|primitives|semantic|semantics|component|components)$/i.test(part));
        const name = `${module.file.path}#${root.name}.${path.map(segment).join('.')}`;
        tokens.push({ name, value: current.value, valueKind: current.valueKind,
          source: module.file.path, declarations: [{ file: current.file, line: current.line, value: current.value, contexts: [root.name, ...path] }],
          objectPath: [root.name, ...path], origin: { file: current.file, line: current.line }, references: references.filter(reference => reference !== name),
          layer: layer ? layer.toLowerCase().replace(/s$/, '') : 'unclassified', layerBasis: layer ? 'explicit-object-key' : 'not-declared',
          format: 'static-theme-object', status: 'observed' });
      }
      flatten(value, root.tailwind ? ['theme'] : []);
    }
  }
  return { tokens, issues };
}
