import {tmpdir} from 'node:os';
import {existsSync} from 'node:fs';

// POSIX tools bundled with Windows (bsdtar, Git Bash) mis-handle absolute paths
// that contain non-ASCII characters: `C:\Users\…、\…` reaches tar as `A?`. When the
// account name is non-ASCII, tests that shell out need an ASCII root, or they
// measure the machine's path rather than the code. HAPPYHANDS_TEST_TMP wins.
export function testTmpRoot() {
  if (process.platform !== 'win32') return tmpdir();
  for (const candidate of [process.env.HAPPYHANDS_TEST_TMP, 'C:\\temp', 'C:\\tmp']) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return tmpdir();
}
