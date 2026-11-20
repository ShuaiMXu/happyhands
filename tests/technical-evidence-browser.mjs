import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join} from 'node:path';
import {technicalProject} from './helpers/technical-project.mjs';
import {createRun,loadRun} from '../packages/harness-core/store.js';
import {readVerificationEvidence} from '../packages/harness-core/verification.js';
import {projectMemoryRegistry} from '../packages/harness-core/project-memory.js';

async function serve(t, checkout, port=0) {
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(await readFile(join(checkout, 'index.html')));
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(port, '127.0.0.1', resolve));
  const close=()=>new Promise(resolve=>server.close(resolve));
  t.after(close);
  return {url:`http://127.0.0.1:${server.address().port}/`,port:server.address().port,close};
}

const managedServer=`
  import {createServer} from 'node:http';
  import {readFile} from 'node:fs/promises';
  const html=await readFile('index.html');
  createServer((request,response)=>{
    response.setHeader('Content-Type','text/html; charset=utf-8');
    response.end(html);
  }).listen(Number(process.argv[2]),'127.0.0.1');
`;

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
    const checksButtonName = scenario.policy.kind === 'button-name';
    const alternateName = checksButtonName ? '<script>if(location.search)document.querySelector("#save").setAttribute("aria-label","Save changes")</script>' : '';
    const html = body => '<!doctype html><meta name="viewport" content="width=device-width"><title>Fixture</title><main style="margin:0">' + body + '</main>';
    const p = await technicalProject(t, {'index.html':html(scenario.before)+alternateName,'serve.mjs':managedServer});
    const reservation = await serve(t, p.repo);
    const {url,port}=reservation;
    await reservation.close();
    const planPath = join(p.root,'capture.json');
    await writeFile(planPath, JSON.stringify({
      schemaVersion:'0.1', adapter:'web',
      configurations:[{id:'phone', viewport:{width:390,height:844}}],
      states:[{id:'default',start:{url},actions:[],sourceEntries:['index.html']},
        ...(checksButtonName ? [{id:'alternate',start:{url:`${url}?view=alternate`},actions:[],sourceEntries:['index.html']}] : [])]
    }));
    await assert.rejects(p.start({url,capturePlan:planPath,evidencePolicy:scenario.policy}),/managed start command/);
    const run = await p.start({url,capturePlan:planPath,start:{command:'node',args:['serve.mjs',String(port)]},evidencePolicy:scenario.policy});
    let safetyRule,alternateRule;
    if(checksButtonName){
      const source=await createRun({spec:p.spec,url,outputRoot:join(p.root,'runs'),id:'prior-button'});
      source.manifest.onboarding=(await loadRun(run)).manifest.onboarding;
      source.manifest.judgment={decision:'accept',reason:'Synthetic approval for the browser regression fixture'};
      await writeFile(join(source.directory,'run.json'),JSON.stringify(source.manifest));
      const {store}=await projectMemoryRegistry(source);
      const propose = state => store.propose(source,{principle:'The named save button remains discoverable',context:`${state} state of the save view`,reason:'A missing accessible name hid this action from button-name navigation',
        scope:{failureClass:'missing-button-name',trigger:{files:['index.html'],states:[state]},check:{type:'technical',policy:scenario.policy}}});
      safetyRule=await propose('default');
      alternateRule=await propose('alternate');
      for(const {id} of [safetyRule,alternateRule])await store.decide({id,decision:'approve',reason:'Synthetic approval of exact browser scope'});
    }
    const before = JSON.parse(await p.invoke('verify','--run',run,'--phase','before'));
    assert.equal(before.status, 'fail');
    if(safetyRule){
      const check=JSON.parse(await p.invoke('memory','--run',run,'--action','checks')).find(row=>row.id===safetyRule.id);
      assert.deepEqual([check.status,check.matchedStates],['selected',['default']]);
    }
    await p.fix({'index.html':html(scenario.after)+alternateName});
    const unrelated = await serve(t,p.candidate,port);
    await assert.rejects(p.invoke('verify','--run',run,'--phase','after','--repo',p.candidate), /port is already in use/);
    await unrelated.close();
    const after = JSON.parse(await p.invoke('verify','--run',run,'--phase','after','--repo',p.candidate));
    assert.equal(after.status, 'pass');
    assert.deepEqual(after.changedFiles, ['index.html']);
    assert.equal(after.visual, 'not-reviewed');
    assert.notEqual(after.source.commit, before.source.commit);
    assert.ok(before.preview.fingerprint && after.preview.fingerprint);
    assert.equal(after.preview.binding,'managed-checkout');
    assert.equal(after.checks[0].key, before.checks[0].key);
    assert.equal(after.checks[0].route, before.checks[0].route);
    scenario.check(before.checks, after.checks);
    assert.deepEqual(await readdir(join(run,'technical','before')), ['capture.json']);
    assert.deepEqual(await readdir(join(run,'technical','after')), ['capture.json']);
    assert.equal(JSON.parse(await p.invoke('next','--run',run)).stage, 'technical-verified');
    const report=JSON.parse(await p.invoke('report','--run',run));
    const reportHtml=await readFile(report.path,'utf8');
    assert.match(reportHtml,/Changed files in the candidate<\/dt><dd>index\.html/);
    assert.match(reportHtml,/default--phone · 390×844 · \/: fail → pass/);
    if(safetyRule){
      const checks=JSON.parse(await p.invoke('memory','--run',run,'--action','checks'));
      const fixed=checks.find(row=>row.id===safetyRule.id);
      assert.deepEqual([fixed.status,fixed.result,fixed.evidence.states],['executed','pass',['default--phone']]);
      assert.equal(before.checks.find(row=>row.stateId==='alternate').status,'pass');
      const alternate=checks.find(row=>row.id===alternateRule.id);
      assert.equal(alternate.status,'needs-evidence');
      assert.match(alternate.reason,/matched scope/);
      assert.match(reportHtml,/missing-button-name<\/dt><dd>executed · pass/);
    }
  });
}

test('next reruns bound specialist checks after the captured preview has stopped', async t => {
  const checkScript = `
    import {writeFile} from 'node:fs/promises';
    import {join} from 'node:path';
    const [url,out]=process.argv.slice(2);
    const response=await fetch(url);
    const body=await response.text();
    const status=response.ok&&body.includes('<h1>Fixture menu</h1>')?'pass':'fail';
    await writeFile(join(out,'result.json'),JSON.stringify({status}));
  `;
  const p=await technicalProject(t,{'index.html':'<!doctype html><h1>Fixture menu</h1>','serve.mjs':managedServer,'check.mjs':checkScript});
  const reservation=await serve(t,p.repo);
  const {url,port}=reservation;
  await reservation.close();
  const planPath=join(p.root,'capture.json'),configPath=join(p.root,'project.json');
  await writeFile(planPath,JSON.stringify({schemaVersion:'0.1',adapter:'web',configurations:[{id:'phone',viewport:{width:390,height:844}}],states:[{id:'menu',start:{url},actions:[]}]}));
  const config={version:'0.1',mode:'review',spec:'experience.json',repo:p.repo,url,capturePlan:planPath,
    start:{command:'node',args:['serve.mjs',String(port)]},verificationChecks:[{id:'menu',command:'node',args:['check.mjs','{url}','{out}'],stage:'normal-layout',method:'Fetch the bound preview and check its heading',limitations:['HTTP probe only'],stateIds:['menu'],screenshots:[]}]};
  await writeFile(configPath,JSON.stringify(config));
  const directory=await p.invoke('onboard','--config',configPath,'--out',join(p.root,'runs'));
  await p.invoke('confirm','--run',directory,'--finding',p.spec.findings[0].id,'--verdict','supported','--note','Replay the original fixture preview');
  const preview=await serve(t,p.repo,port);
  await p.invoke('capture','--run',directory,'--phase','after','--plan',planPath,'--repo',p.repo);
  await p.invoke('evaluate','--run',directory);
  const next=JSON.parse(await p.invoke('next','--run',directory));
  assert.equal(next.stage,'needs-specialist-verification');
  assert.deepEqual(next.cli.steps[0].argv,['verify','--run',directory,'--managed','true']);
  await assert.rejects(p.invoke(...next.cli.steps[0].argv),/port is already in use/);
  await preview.close();
  await assert.rejects(p.invoke('verify','--run',directory,'--config',configPath),/fetch failed|preview is unavailable/);
  await writeFile(configPath,JSON.stringify({...config,start:{...config.start,args:['other.mjs',String(port)]}}));
  await assert.rejects(p.invoke(...next.cli.steps[0].argv),/configuration changed/);
  await writeFile(configPath,JSON.stringify(config));
  await p.invoke(...next.cli.steps[0].argv);
  const {manifest}=await loadRun(directory);
  const evidence=await readVerificationEvidence(directory,manifest);
  assert.deepEqual(evidence.records.map(row=>[row.id,row.status,row.preview.binding]),[['menu','pass','capture-response-match']]);
  assert.equal(JSON.parse(await p.invoke('next','--run',directory)).stage,'needs-visual-qa');
  const released=await serve(t,p.repo,port);
  await released.close();
});

test('a Hero layout change stays at the visual gate after real matched captures and structural evaluation', async t => {
  const page = size => '<!doctype html><meta name="viewport" content="width=device-width"><title>Hero</title>' +
    `<main><h1 style="font-size:${size}px">Browse design resources</h1><a href="#library">Browse library</a></main>`;
  const p = await technicalProject(t, {'index.html':page(28)});
  const {url:baseline} = await serve(t,p.repo);
  // The low-level visual entry still enforces independent QA and keeps this
  // fixture focused on the evidence gate rather than authoring a design audit.
  const run = await p.invoke('init','--spec',join(p.root,'experience.json'),'--url',baseline,'--out',join(p.root,'runs'));
  await p.invoke('capture','--run',run,'--phase','before');
  await p.invoke('confirm','--run',run,'--finding',p.spec.findings[0].id,'--verdict','supported','--note','Fixture Hero typography change');
  await p.fix({'index.html':page(34)});
  const {url:candidate} = await serve(t,p.candidate);
  await p.invoke('capture','--run',run,'--phase','after','--url',candidate);
  await p.invoke('evaluate','--run',run);
  const status = JSON.parse(await p.invoke('status','--run',run));
  assert.equal(status.workflow.stage, 'needs-visual-qa');
  assert.equal(status.evaluation.views.desktop.checks.noHorizontalOverflow, true);
  await assert.rejects(p.invoke('judge','--run',run,'--decision','accept'), /Independent Visual QA/);
});
