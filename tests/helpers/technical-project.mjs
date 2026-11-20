import {execFile} from 'node:child_process';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import spec from '../../examples/happyclaw-site/experience.json' with {type: 'json'};

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('../../scripts/harness.mjs', import.meta.url));
export async function technicalProject(t, files) {
  const root = await mkdtemp(join(tmpdir(), 'hh-technical-test-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const repo = join(root, 'product');
  const candidate = join(root, 'candidate');
  await mkdir(repo);
  const git = (cwd, ...args) => exec('git', args, {cwd});
  await git(repo, 'init', '-q');
  await git(repo, 'config', 'user.name', 'Test');
  await git(repo, 'config', 'user.email', 'test@example.invalid');
  for (const [name, content] of Object.entries(files)) await writeFile(join(repo, name), content);
  await git(repo, 'add', '.');
  await git(repo, 'commit', '-qm', 'Baseline');
  const fix = async changes => {
    await git(repo, 'worktree', 'add', '-q', '--detach', candidate);
    for (const [name, content] of Object.entries(changes)) await writeFile(join(candidate, name), content);
    await git(candidate, 'add', '.');
    await git(candidate, 'commit', '-qm', 'Candidate');
  };
  await writeFile(join(root, 'experience.json'), JSON.stringify(spec));
  const invoke = async (...args) => {
    try {
      return (await exec(process.execPath, [cli, ...args], {cwd: root})).stdout.trim();
    } catch (error) {
      throw Error(error.stderr.trim() || error.stdout.trim() || error.message, {cause: error});
    }
  };
  const start = async config => {
    const path = join(root, 'project.json');
    await writeFile(path, JSON.stringify({version: '0.1', mode: 'review', spec: 'experience.json', repo, ...config}));
    return invoke('start', '--config', path, '--out', join(root, 'runs'));
  };
  return {root, repo, candidate, start, fix, invoke, spec};
}
