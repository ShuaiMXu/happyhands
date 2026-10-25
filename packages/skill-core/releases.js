import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {skillContracts,regressionEvidenceHash,inputHash} from './release-inputs.js';
import {runRegression} from './regression.js';

const VERSION = /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/;
const hash = value => createHash('sha256').update(value).digest('hex');

function required(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

export async function createSkillRelease({ root = '.', registryRoot, version, reviewer, reason, regressionReport }) {
  if (!VERSION.test(version || '')) throw new Error('Expertise release version must be semantic.');
  required(reviewer, 'Release reviewer'); required(reason, 'Release reason');
  if (regressionReport?.passed!==true || regressionReport.requiresReview!==false) throw new Error('A clean deterministic regression report is required.');
  if (regressionReport.modelReview?.status !== 'reviewed' || !regressionReport.modelReview.reviewer || !regressionReport.modelReview.reason) {
    throw new Error('Independent model review with reviewer and reason is required before release.');
  }
  required(regressionReport.modelReview.reviewer,'Independent model reviewer');required(regressionReport.modelReview.reason,'Independent model review reason');
  const corpus=JSON.parse(await readFile(new URL('../../regression/cases.json',import.meta.url),'utf8'));
  const current=await runRegression(corpus,{registryRoot});
  if(!current.passed||regressionReport.evidenceHash!==regressionEvidenceHash(regressionReport)||regressionReport.evidenceHash!==current.evidenceHash)throw Error('Regression report does not match current corpus, implementation, skill contracts and case results.');
  if(regressionReport.modelReview.evidenceHash!==current.evidenceHash)throw Error('Independent model review must bind the current regression evidence hash.');
  const skills=await skillContracts(registryRoot);
  if(inputHash(skills)!==current.registryHash)throw Error('Skill contracts changed during release verification.');
  const release = {
    schemaVersion: '0.1', version, createdAt: new Date().toISOString(), reviewer: reviewer.trim(), reason: reason.trim(),
    regression: { corpusVersion: current.corpusVersion, corpusHash: current.corpusHash, implementationHash: current.implementationHash, registryHash:current.registryHash,evidenceHash:current.evidenceHash, reportHash: hash(JSON.stringify(regressionReport)) },
    modelReview: structuredClone(regressionReport.modelReview), skills
  };
  const directory = resolve(root, 'expertise', 'releases'); await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${version}.json`), JSON.stringify(release, null, 2) + '\n', { flag: 'wx' });
  return release;
}

export async function activateSkillRelease({ root = '.', version, reviewer, reason }) {
  if(!VERSION.test(version||''))throw Error('Expertise release version must be semantic.');
  required(reviewer, 'Activation reviewer'); required(reason, 'Activation reason');
  const base = resolve(root, 'expertise');
  await mkdir(base, { recursive: true });
  const lockPath = join(base, 'activation.lock');
  // Fail closed: never reclaim a lock from a timeout or an unreadable PID.
  const lock = await open(lockPath, 'wx').catch(error => {
    if (error.code === 'EEXIST') throw Error('An activation lock exists. Wait for its owner or verify recovery before removing it.');
    throw error;
  });
  const temporary = join(base, `.active-${randomUUID()}.tmp`);
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
    await lock.sync();
    const releaseText = await readFile(join(base, 'releases', `${version}.json`), 'utf8');
    const release = JSON.parse(releaseText);
    const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
    if (release.schemaVersion !== '0.1' || release.version !== version ||
      !['corpusHash', 'implementationHash', 'registryHash', 'evidenceHash', 'reportHash'].every(key => digest(release.regression?.[key])) ||
      !Array.isArray(release.skills) || !release.skills.length || inputHash(release.skills) !== release.regression.registryHash ||
      release.modelReview?.status !== 'reviewed' || release.modelReview.evidenceHash !== release.regression.evidenceHash) {
      throw Error('Invalid or unbound expertise release; regenerate and review its evidence before activation.');
    }
    required(release.reviewer, 'Release reviewer'); required(release.reason, 'Release reason');
    required(release.modelReview.reviewer, 'Independent model reviewer'); required(release.modelReview.reason, 'Independent model review reason');
    const previous = await readFile(join(base, 'active.json'), 'utf8').then(JSON.parse).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (previous && (previous.schemaVersion !== '0.1' || !VERSION.test(previous.releaseVersion || ''))) throw Error('Invalid active release pointer; recovery is required.');
    const activation = { schemaVersion: '0.1', activationId: randomUUID(), releaseVersion: version, releaseHash: hash(releaseText), previousVersion: previous?.releaseVersion || null, previousActivationId: previous?.activationId || null, reviewer: reviewer.trim(), reason: reason.trim(), activatedAt: new Date().toISOString() };
    const audit = join(base, 'activations'); await mkdir(audit, { recursive: true });
    // This immutable record is prepared intent. Only the pointer and its chain
    // establish committed activations; an orphan after a crash is not success.
    const content = JSON.stringify(activation, null, 2) + '\n';
    await writeSynced(join(audit, `${activation.activationId}.json`), content);
    await writeSynced(temporary, content);
    await rename(temporary, join(base, 'active.json'));
    return activation;
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
    await lock.close();
    await rm(lockPath, { force: true });
  }
}

async function writeSynced(path, content) {
  const handle = await open(path, 'wx');
  try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
}
