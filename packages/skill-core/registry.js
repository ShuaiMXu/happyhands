import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROLES = new Set(['foundation', 'diagnose', 'plan', 'review', 'learn']);
const MATURITY = new Set(['contract-only', 'bounded', 'operational']);

function validateManifest(value, directory) {
  if (!value || typeof value !== 'object') throw new Error(`Invalid skill manifest in ${directory}.`);
  if (!ID.test(value.id || '')) throw new Error(`Invalid skill id in ${directory}.`);
  if (!/^\d+\.\d+\.\d+$/.test(value.version || '')) throw new Error(`Invalid skill version for ${value.id}.`);
  if (!ROLES.has(value.role)) throw new Error(`Invalid role for ${value.id}.`);
  if (!MATURITY.has(value.maturity)) throw new Error(`Skill ${value.id} needs maturity: contract-only, bounded or operational.`);
  if (!value.description?.trim() || !value.handler?.trim()) throw new Error(`Skill ${value.id} needs description and handler.`);
  if (!Array.isArray(value.requiredInputs) || !value.requiredInputs.length) throw new Error(`Skill ${value.id} needs requiredInputs.`);
  return Object.freeze({ ...value, directory });
}

export async function loadRegistry(root = resolve('skills/product-design')) {
  const entries = await readdir(root, { withFileTypes: true });
  const manifests = [];
  for (const entry of entries.filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const directory = join(root, entry.name);
    const manifest = validateManifest(JSON.parse(await readFile(join(directory, 'skill.json'), 'utf8')), directory);
    await readFile(join(directory, 'SKILL.md'), 'utf8');
    if (manifest.id !== entry.name) throw new Error(`Skill folder ${entry.name} must match id ${manifest.id}.`);
    manifests.push(manifest);
  }
  const ids = new Set(manifests.map(item => item.id));
  if (ids.size !== manifests.length) throw new Error('Skill IDs must be unique.');
  return manifests;
}

export async function getSkill(id, root) {
  const skill = (await loadRegistry(root)).find(item => item.id === id);
  if (!skill) throw new Error(`Unknown skill: ${id}.`);
  return skill;
}
