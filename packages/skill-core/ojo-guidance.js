import { readFile, mkdir, writeFile, mkdtemp, rename, rm, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const vendorRoot = fileURLToPath(new URL('../../skills/vendor/ojo/', import.meta.url));
const files = ['LICENSE', 'SKILL.md', ...[
  'anti-patterns', 'component-libraries', 'component-recipe', 'design-audit',
  'hero-enrichment', 'icon-guidelines', 'material-metaphor', 'motion-system', 'visual-tokens'
].map(name => `references/${name}.md`)];
const hash = value => createHash('sha256').update(value).digest('hex');
const adapterVersion = '1.0.0';
const modes = new Set(['review', 'implementation']);

// Fixed file inventory: upstream instructions and paths never choose executable code.
// Read and verify everything before exposing a bundle to an agent.
export async function loadOjoGuidance(mode = 'review', root = vendorRoot) {
  if (!modes.has(mode)) throw new Error(`Unknown OJO guidance mode: ${mode}`);
  const sourceText = await readFile(join(root, 'source.json'), 'utf8');
  const source = JSON.parse(sourceText);
  if (source.repository !== 'https://github.com/touchine-ojo/OJO-Design-Skills' || source.license !== 'MIT' || !/^[a-f0-9]{40}$/.test(source.revision)) throw new Error('Invalid OJO source identity');
  if (source.files?.length !== files.length || new Set(source.files.map(item => item.path)).size !== files.length || source.files.some(item => !files.includes(item.path))) throw new Error('Invalid OJO source inventory');
  const documents = [];
  for (const path of files) {
    const bytes = await readFile(join(root, 'upstream', path));
    // Git stores text blobs with LF line endings, while Windows may check the
    // vendored Markdown out as CRLF. Verify the canonical Git text bytes so the
    // provenance check stays stable across platforms without weakening it.
    const canonical = Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'));
    if (hash(canonical) !== source.files.find(item => item.path === path)?.sha256) throw new Error(`OJO source hash mismatch: ${path}`);
    documents.push({ path: `upstream/${path}`, content: canonical.toString('utf8'), sha256: hash(canonical) });
  }
  const adapter = await readFile(join(root, 'ADAPTER.md'), 'utf8');
  const readFirst = ['ADAPTER.md', 'upstream/SKILL.md', 'upstream/references/anti-patterns.md',
    ...(mode === 'review' ? ['upstream/references/design-audit.md'] : [])];
  const bundleHash = hash(JSON.stringify({ source, adapterVersion, adapter, mode, readFirst, documents: documents.map(({path,sha256}) => ({path,sha256})) }));
  const metadata = { id: 'ojo-app-ui-ux', adapterVersion, mode, repository: source.repository, revision: source.revision, license: source.license, bundleHash, readFirst };
  return { metadata, adapter, documents, sourceText };
}

async function verifySnapshot(directory, documents) {
  for (const document of documents) {
    let content;
    try { content = await readFile(join(directory, document.path), 'utf8'); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      throw new Error(`OJO snapshot changed: ${document.path} is missing`);
    }
    if (content !== document.content) throw new Error(`OJO snapshot changed: ${document.path}`);
  }
}

async function snapshotExists(directory) {
  try {
    const entry = await lstat(directory);
    if (!entry.isDirectory()) throw new Error('OJO snapshot changed: expected a directory');
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function stageOjoGuidance(directory, mode, { renameDirectory = rename } = {}) {
  const bundle = await loadOjoGuidance(mode);
  // v1 wrote directly into the hash directory and may contain interrupted files.
  // Preserve those artifacts; v2 publishes only complete directories atomically.
  const reference = `ojo-guidance/v2/${bundle.metadata.bundleHash}`;
  const destination = join(directory, reference);
  const documents = [
    {path:'ADAPTER.md',content:bundle.adapter}, {path:'source.json',content:bundle.sourceText},
    ...bundle.documents, {path:'bundle.json',content:JSON.stringify(bundle.metadata,null,2)+'\n'}
  ];
  if (await snapshotExists(destination)) {
    await verifySnapshot(destination, documents);
  } else {
    await mkdir(dirname(destination), { recursive: true });
    const staging = await mkdtemp(join(dirname(destination), '.pending-'));
    try {
      for (const document of documents) {
        const target = join(staging, document.path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, document.content, { flag: 'wx' });
      }
      await verifySnapshot(staging, documents);
      for (let attempt = 0; ; attempt++) {
       try { await renameDirectory(staging, destination); break; }
       catch (error) {
        // A concurrent caller may have published the identical complete bundle.
        // Do not overwrite it or confuse a different I/O error with a winner.
        if (!['EEXIST', 'ENOTEMPTY', 'EPERM', 'EACCES', 'EBUSY'].includes(error.code)) throw error;
        if (await snapshotExists(destination)) { await verifySnapshot(destination, documents); break; }
        // Windows indexing can briefly hold a newly written directory. Retry
        // publication, retaining the verified snapshot and bounded failure.
        if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 9) throw error;
        await delay(50 * (attempt + 1));
       }
      }
    } finally {
      // Only this invocation's temporary directory is ours to remove. Staging
      // left by a killed process cannot block a retry or hide a published bundle.
      await rm(staging, { recursive: true, force: true });
    }
  }
  return { ...bundle, metadata: { ...bundle.metadata, reference } };
}

export function ojoGuidancePrompt(bundle, directory) {
  const location = join(directory, bundle.metadata.reference);
  return `Harness design guidance: OJO, revision ${bundle.metadata.revision}, bundle ${bundle.metadata.bundleHash}.\nRead the following guidance files (reading this snapshot outside the worktree is permitted; all source edits remain inside the worktree):\n${bundle.metadata.readFirst.map(path => join(location,path)).join('\n')}\nLoad other bundled references only as relevant. Apply the following Harness adapter over conflicting upstream workflow, tool, output, style-ban or authority instructions:\n${bundle.adapter}`;
}
