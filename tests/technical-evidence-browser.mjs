import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join} from 'node:path';
import {technicalProject} from './helpers/technical-project.mjs';

async function serve(t, checkout) {
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(await readFile(join(checkout, 'index.html')));
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}/`;
}

const cases = [
  {
    policy: {kind:'button-name', selector:'#save', name:'Save changes'},
    before:'<button id="save"><svg aria-hidden="true" width="16" height="16"></svg></button>',
    after:'<button id="save" aria-label="Save changes"><svg aria-hidden="true" width="16" height="16"></svg></button>',
    check(before, after) {
      assert.equal(before[0].expectedName, 'Save changes');
      assert.equal(before[0].status, 'fail');
      assert.equal(after[0].status, 'pass');
    }
  },
  {
    policy: {kind:'horizontal-overflow'},
    before:'<div style="width:600px">Content</div>',
    after:'<div style="max-width:600px">Content</div>',
    check(before, after) {
      assert.equal(before[0].viewport.width, 390);
      assert.ok(before[0].contentWidth > before[0].viewportWidth);
      assert.equal(after[0].viewportWidth, before[0].viewportWidth);
      assert.equal(after[0].contentWidth, after[0].viewportWidth);
    }
  }
];

for (const scenario of cases) {
  test(`runtime ${scenario.policy.kind} compares real browser evidence with no screenshots`, async t => {
    const html = body => '<!doctype html><meta name="viewport" content="width=device-width"><title>Fixture</title><main style="margin:0">' + body + '</main>';
    const p = await technicalProject(t, {'index.html':html(scenario.before)});
    const url = await serve(t, p.repo);
    const planPath = join(p.root,'capture.json');
    await writeFile(planPath, JSON.stringify({
      schemaVersion:'0.1', adapter:'web',
      configurations:[{id:'phone', viewport:{width:390,height:844}}],
      states:[{id:'default',start:{url},actions:[]}]
    }));
    const run = await p.start({url,capturePlan:planPath,evidencePolicy:scenario.policy});
    const before = JSON.parse(await p.invoke('verify','--run',run,'--phase','before'));
    assert.equal(before.status, 'fail');
    await p.fix({'index.html':html(scenario.after)});
    const candidateUrl = await serve(t,p.candidate);
    await assert.rejects(p.invoke('verify','--run',run,'--phase','after','--repo',p.candidate,'--url',url), /own preview URL/);
    const after = JSON.parse(await p.invoke('verify','--run',run,'--phase','after','--repo',p.candidate,'--url',candidateUrl));
    assert.equal(after.status, 'pass');
    assert.equal(after.visual, 'not-reviewed');
    assert.notEqual(after.source.commit, before.source.commit);
    assert.ok(before.preview.fingerprint && after.preview.fingerprint);
    assert.equal(after.checks[0].key, before.checks[0].key);
    assert.equal(after.checks[0].route, before.checks[0].route);
    scenario.check(before.checks, after.checks);
    assert.deepEqual(await readdir(join(run,'technical','before')), ['capture.json']);
    assert.deepEqual(await readdir(join(run,'technical','after')), ['capture.json']);
    assert.equal(JSON.parse(await p.invoke('next','--run',run)).stage, 'technical-verified');
  });
}

test('a Hero layout change stays at the visual gate after real matched captures and structural evaluation', async t => {
  const page = size => '<!doctype html><meta name="viewport" content="width=device-width"><title>Hero</title>' +
    `<main><h1 style="font-size:${size}px">Browse design resources</h1><a href="#library">Browse library</a></main>`;
  const p = await technicalProject(t, {'index.html':page(28)});
  const baseline = await serve(t,p.repo);
  // The low-level visual entry still enforces independent QA and keeps this
  // fixture focused on the evidence gate rather than authoring a design audit.
  const run = await p.invoke('init','--spec',join(p.root,'experience.json'),'--url',baseline,'--out',join(p.root,'runs'));
  await p.invoke('capture','--run',run,'--phase','before');
  await p.invoke('confirm','--run',run,'--finding',p.spec.findings[0].id,'--verdict','supported','--note','Fixture Hero typography change');
  await p.fix({'index.html':page(34)});
  const candidate = await serve(t,p.candidate);
  await p.invoke('capture','--run',run,'--phase','after','--url',candidate);
  await p.invoke('evaluate','--run',run);
  const status = JSON.parse(await p.invoke('status','--run',run));
  assert.equal(status.workflow.stage, 'needs-visual-qa');
  assert.equal(status.evaluation.views.desktop.checks.noHorizontalOverflow, true);
  await assert.rejects(p.invoke('judge','--run',run,'--decision','accept'), /Independent Visual QA/);
});
