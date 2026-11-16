import {mkdtemp, rm, symlink, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {testTmpRoot} from './tmp-root.mjs';

let probe;
// Windows only lets an administrator (or Developer Mode) create symlinks. The
// tests that need one are about refusal, not about the platform, so probe once
// and skip with a reason instead of failing the suite on a locked-down account.
export function canSymlink() {
  probe ??= (async () => {
    const root = await mkdtemp(join(testTmpRoot(), 'hh-symlink-probe-'));
    try {
      await writeFile(join(root, 'target'), 'x');
      await symlink(join(root, 'target'), join(root, 'link'), 'file');
      return true;
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOTSUP', 'UNKNOWN'].includes(error.code)) return false;
      throw error;
    } finally {
      await rm(root, {recursive: true, force: true});
    }
  })();
  return probe;
}
