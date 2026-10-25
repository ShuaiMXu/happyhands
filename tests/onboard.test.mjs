import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectRepository, loadProjectConfig, publicProjectConfig, waitForPreview } from '../packages/harness-core/onboard.js';

test('project config resolves repository, spec and start cwd relative to its file', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pd-onboard-test-'));
  t.after(async () => {
    if (!root.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, 'project'));
  await writeFile(join(root, 'project.json'), JSON.stringify({
    version: '0.1', spec: 'experience.json', repo: 'project', url: 'http://127.0.0.1:4100',
    start: { command: 'npm', args: ['run', 'dev'], cwd: 'project', env: { FRAMEWORK_TELEMETRY_DISABLED: '1' } }
  }));
  const config = await loadProjectConfig(join(root, 'project.json'));
  assert.equal(config.repo, join(root, 'project'));
  assert.equal(config.spec, join(root, 'experience.json'));
  assert.equal(config.start.cwd, join(root, 'project'));
  assert.equal(config.start.env.FRAMEWORK_TELEMETRY_DISABLED, '1');
  assert.equal(config.url, 'http://127.0.0.1:4100/');
});

test('project config rejects unsafe or incomplete launch descriptions', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pd-onboard-test-'));
  t.after(async () => {
    if (!root.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(root, { recursive: true, force: true });
  });
  const path = join(root, 'project.json');
  await writeFile(path, JSON.stringify({ version: '0.1', spec: 'a', repo: 'b', url: 'file:///tmp/app' }));
  await assert.rejects(loadProjectConfig(path), /http or https/i);
  await writeFile(path, JSON.stringify({ version: '0.1', spec: 'a', repo: 'b', url: 'http://localhost', start: { args: 'npm run dev' } }));
  await assert.rejects(loadProjectConfig(path), /start\.command/i);
  await writeFile(path, JSON.stringify({ version: '0.1', spec: 'a', repo: 'b', url: 'http://localhost', start: { command: 'npm & calc', args: [] } }));
  await assert.rejects(loadProjectConfig(path), /bare executable/i);
});

// spawnPreview launches the preview through cmd.exe on Windows (shell:true is
// what lets it reach .cmd shims like npm). That is only safe because every
// metacharacter cmd.exe would interpret is rejected here first; this test pins
// the two halves together in one place.
test('every shell metacharacter a Windows preview spawn would interpret is rejected before it runs', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pd-onboard-shell-'));
  t.after(async () => {
    if (!root.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(root, { recursive: true, force: true });
  });
  const path = join(root, 'project.json');
  for (const dangerous of ['whoami & calc', 'whoami | calc', 'whoami > out', 'whoami < in', 'whoami ^ x', 'whoami %PATH%', 'whoami\r&calc', 'whoami\n&calc']) {
    await writeFile(path, JSON.stringify({ version: '0.1', spec: 'a', repo: 'b', url: 'http://localhost', start: { command: 'npm', args: ['run', dangerous] } }));
    // Simulate Windows in a separate process so the host's platform and the
    // concurrently running tests remain untouched. No preview is launched.
    execFileSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { loadProjectConfig } from ${JSON.stringify(new URL('../packages/harness-core/onboard.js', import.meta.url).href)};
      Object.defineProperty(process, 'platform', { value: 'win32' });
      await assert.rejects(loadProjectConfig(process.argv[1]), /control characters|argument/i);
    `, path]);
    if (process.platform !== 'win32') {
      const config = await loadProjectConfig(path);
      assert.equal(config.start.args[1], dangerous, 'shell-free platforms preserve literal arguments');
    }
  }
  await writeFile(path, JSON.stringify({ version: '0.1', spec: 'a', repo: 'b', url: 'http://localhost', start: { command: 'npm', args: ['run', 'dev'] } }));
  const config = await loadProjectConfig(path);
  assert.deepEqual(config.start.args, ['run', 'dev'], 'an ordinary argument still passes');
});

test('project config resolves and validates a capture plan as its review start point', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pd-onboard-plan-'));
  t.after(async () => {
    if (!root.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, 'project'));
  await writeFile(join(root, 'plan.json'), JSON.stringify({
    schemaVersion: '0.1', adapter: 'web',
    configurations: [{ id: 'desktop', viewport: { width: 1440, height: 900 } }],
    states: [{ id: 'pricing', start: { url: 'http://127.0.0.1:4100/pricing' }, actions: [] }]
  }));
  await writeFile(join(root, 'project.json'), JSON.stringify({
    version: '0.1', spec: 'experience.json', repo: 'project', mode: 'review', capturePlan: 'plan.json'
  }));
  const config = await loadProjectConfig(join(root, 'project.json'));
  assert.equal(config.capturePlanPath, join(root, 'plan.json'));
  assert.equal(config.capturePlanDocument.states[0].id, 'pricing');
  assert.equal(config.url, 'http://127.0.0.1:4100/pricing');
  assert.equal(publicProjectConfig(config).capturePlan, join(root, 'plan.json'));
});

test('capture plans stay on the managed preview origin and cover configured routes', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pd-onboard-routes-'));
  t.after(async () => {
    if (!root.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, 'project'));
  const plan = {
    schemaVersion: '0.1', adapter: 'web', configurations: [{ id: 'desktop', viewport: { width: 1280, height: 800 } }],
    states: [{ id: 'home', start: { url: 'http://127.0.0.1:4100/' }, actions: [] }]
  };
  await writeFile(join(root, 'plan.json'), JSON.stringify(plan));
  const configPath = join(root, 'project.json');
  await writeFile(configPath, JSON.stringify({ version: '0.1', spec: 'experience.json', repo: 'project', url: 'http://127.0.0.1:4100/', routes: ['/', '/pricing'], capturePlan: 'plan.json' }));
  await assert.rejects(loadProjectConfig(configPath), /missing configured routes.*pricing/i);
  plan.states.push({ id: 'pricing', start: { url: 'http://127.0.0.1:4100/pricing' }, actions: [] });
  await writeFile(join(root, 'plan.json'), JSON.stringify(plan));
  assert.deepEqual((await loadProjectConfig(configPath)).routes, ['/', '/pricing']);
  plan.states[1].start.url = 'https://example.com/pricing';
  await writeFile(join(root, 'plan.json'), JSON.stringify(plan));
  await assert.rejects(loadProjectConfig(configPath), /configured preview origin/i);
});

test('preview readiness records the final reachable URL', async t => {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end('<h1>Ready</h1>');
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  t.after(() => server.close());
  const address = server.address();
  const result = await waitForPreview(`http://127.0.0.1:${address.port}/`, { timeoutMs: 2000, intervalMs: 10 });
  assert.equal(result.status, 200);
  assert.equal(result.finalUrl, `http://127.0.0.1:${address.port}/`);
});

test('repository inspection records commit and dirty state', async () => {
  const repository = await inspectRepository(fileURLToPath(new URL('..', import.meta.url)));
  assert.match(repository.commit, /^[0-9a-f]{40}$/);
  assert.equal(typeof repository.dirty, 'boolean');
});

test('the public project config records environment names without their values', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pd-onboard-env-'));
  t.after(async () => {
    if (!root.startsWith(tmpdir() + sep)) throw new Error('Unexpected test path.');
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(root, 'app'), { recursive: true });
  await writeFile(join(root, 'spec.json'), '{}');
  await writeFile(join(root, 'project.json'), JSON.stringify({
    version: '0.1', spec: 'spec.json', repo: 'app', url: 'http://127.0.0.1:4321/',
    start: { command: 'npm', args: ['run', 'dev'], env: { SUPABASE_SERVICE_KEY: 'super-secret-value' } }
  }));

  const config = await loadProjectConfig(join(root, 'project.json'));
  // The spawn still needs the real values.
  assert.equal(config.start.env.SUPABASE_SERVICE_KEY, 'super-secret-value');

  const published = publicProjectConfig(config);
  assert.deepEqual(published.start.envKeys, ['SUPABASE_SERVICE_KEY']);
  assert.equal('env' in published.start, false);
  assert.doesNotMatch(JSON.stringify(published), /super-secret-value/);
});

test('project configuration validates and retains explicit Taste/Impeccable preferences without assuming v2 has dials',async t=>{
 const root=await mkdtemp(join(tmpdir(),'guidance-project-'));t.after(()=>rm(root,{recursive:true,force:true}));const path=join(root,'project.json');
 const config={version:'0.1',spec:'experience.json',repo:root,url:'http://127.0.0.1:4100',designGuidance:{taste:'dials-v1',intent:'animate',dials:{DESIGN_VARIANCE:4,MOTION_INTENSITY:2,VISUAL_DENSITY:7}}};await writeFile(path,JSON.stringify(config));const loaded=await loadProjectConfig(path);assert.deepEqual(loaded.designGuidance,config.designGuidance);assert.deepEqual(publicProjectConfig(loaded).designGuidance,config.designGuidance);
 await writeFile(path,JSON.stringify({...config,designGuidance:{taste:'public-page',dials:{DESIGN_VARIANCE:4}}}));await assert.rejects(loadProjectConfig(path),/v2 has no dials/);
});

 test('verification scope is rejected before review when its states are absent from the plan', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pd-scope-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const config=JSON.parse(await readFile(new URL('../examples/happyclaw-site/project.json',import.meta.url),'utf8'));
  config.spec='experience.json';config.repo='.';delete config.start;config.capturePlan='capture.json';
  await writeFile(join(root,'capture.json'),JSON.stringify({schemaVersion:'0.1',adapter:'web',configurations:[{id:'desktop',viewport:{width:1280,height:800}}],states:[{id:'whole-page',start:{url:config.url},actions:[]}]}));
  await writeFile(join(root,'project.json'),JSON.stringify(config));
  await assert.rejects(loadProjectConfig(join(root,'project.json')),/names states missing from capture plan/);
 });

test('the HappyClaw first-review example keeps specialist scopes within nine planned targets',async()=>{
 const config=await loadProjectConfig(fileURLToPath(new URL('../examples/happyclaw-site/first-review-project.json',import.meta.url)));
 const ids=new Set(config.capturePlanDocument.states.map(state=>state.id));
 assert.equal(config.capturePlanDocument.states.reduce((count,state)=>count+(state.configurations||config.capturePlanDocument.configurations).length,0),9);
 for(const check of config.verificationChecks)assert.ok(check.stateIds.every(id=>ids.has(id)));
});
