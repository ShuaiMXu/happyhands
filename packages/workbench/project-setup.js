import { readFile, access } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createServer } from 'node:net';

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

// Inspect declared metadata only. Never execute package scripts while discovering a project.
// Custom scripts remain a manual setting; a free port is checked again at capture time.
export async function discoverProject(repository, { port = availablePort } = {}) {
  const root = repository.root;
  let pkg;
  try { pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    return { repository, name: basename(root), detected: false, reason: 'No readable package.json; configure the preview in advanced settings.' };
  }
  const name = typeof pkg.name === 'string' && pkg.name.trim() ? pkg.name.trim().slice(0, 200) : basename(root);
  const script = pkg.scripts?.dev;
  const framework = typeof script === 'string' && !/[;&|<>$`\r\n]/.test(script) && !/--background\b/.test(script)
    ? /^vite(?:\s|$)/.test(script) ? 'Vite' : /^astro\s+dev(?:\s|$)/.test(script) ? 'Astro' : null
    : null;
  if (!framework) return { repository, name, detected: false, reason: 'The dev script is not a supported Vite or Astro preview; configure it in advanced settings.' };
  let manager = /^pnpm@/.test(pkg.packageManager || '') ? 'pnpm' : 'npm';
  if (pkg.packageManager && !/^(npm|pnpm)@/.test(pkg.packageManager)) return { repository, name, detected: false, reason: 'Configure this package manager in advanced settings.' };
  if (!pkg.packageManager) try { await access(join(root, 'pnpm-lock.yaml')); manager = 'pnpm'; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const previewPort = await port();
  let dependenciesInstalled = true;
  try { await access(join(root, 'node_modules')); } catch (error) { if (error.code !== 'ENOENT') throw error; dependenciesInstalled = false; }
  return { repository, name, detected: true, framework, script, dependenciesInstalled,
    url: `http://127.0.0.1:${previewPort}/`,
    // Astro 7 auto-backgrounds in agent environments. --ignore-lock explicitly
    // keeps this one-off preview in the foreground so the Harness owns its tree.
    start: { command: manager, args: ['run', 'dev', ...(manager === 'npm' ? ['--'] : []), ...(framework === 'Astro' ? ['--ignore-lock'] : []), '--host', '127.0.0.1', '--port', String(previewPort)] } };
}
