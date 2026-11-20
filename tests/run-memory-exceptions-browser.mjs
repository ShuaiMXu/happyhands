import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {mkdtemp,mkdir,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {createRun,saveOnboarding,saveCapture,confirmFinding,savePlan,saveDiagnosis,loadRun} from '../packages/harness-core/store.js';
import {diagnoseRun} from '../packages/harness-core/diagnosis.js';
import {workflowState} from '../packages/harness-core/workflow.js';
import {readRunMemoryExceptions} from '../packages/harness-core/project-memory.js';
import {projectMemory} from '../packages/workbench/memory.js';
import {workbenchServicePlugin} from '../packages/workbench/service.js';

// Actual browser -> local HTTP service -> isolated run/store. Preview identity
// is a fixture; no target source, actual model or user judgment is changed.
const root=await mkdtemp(join(tmpdir(),'run-exceptions-browser-')),repo=join(root,'project');
await mkdir(repo);await mkdir(join(root,'.harness','runs'),{recursive:true});
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:join(root,'vite-cache'),
  plugins:[workbenchServicePlugin(root,{inspectRepository:async()=>({root:repo,commit:'fixture',dirty:false}),previewReachable:async()=>false})],
  server:{host:'127.0.0.1',port:0,fs:{allow:[process.cwd(),root]}},
  optimizeDeps:{noDiscovery:true,include:['react','react/jsx-runtime','react/jsx-dev-runtime','react-dom','react-dom/client','@radix-ui/react-dialog','@radix-ui/react-checkbox','@radix-ui/react-select']}});
await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`,configPath=join(root,'project.json');
await writeFile(join(root,'experience.json'),JSON.stringify(sample));await writeFile(configPath,JSON.stringify({version:'0.1',repo,spec:'experience.json',url:base}));
const memory=projectMemory(root,await realpath(repo));
const proposal=await memory.propose({manifest:{id:'synthetic-prior',judgment:{decision:'accept',reason:'Synthetic fixture only'}}},{principle:'Use outcome labels',context:'Review screens',reason:'Synthetic fixture'});
await memory.decide({id:proposal.id,decision:'approve',reason:'Synthetic fixture review'});
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
try{
  for(const language of ['zh','en']){
    const run=await createRun({spec:structuredClone(sample),url:base,outputRoot:join(root,'.harness','runs'),id:`browser-${language}`});
    await saveOnboarding(run.directory,{repository:{root:repo,commit:'fixture'},config:{configPath,repo}});
    await mkdir(join(run.directory,'before'));await writeFile(join(run.directory,'before','desktop.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64'));
    await saveCapture(run.directory,'before',{viewports:{desktop:{screenshot:'before/desktop.png'}}});
    await saveDiagnosis(run.directory,diagnoseRun({run:await loadRun(run.directory)}));await confirmFinding(run.directory,'F1','supported','Synthetic confirmation');await savePlan(run.directory,'F1');
    const page=await browser.newPage();
    await page.route(base+'/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><title>Run exceptions fixture</title></head><body><script type="module" src="/packages/ui/workbench.js"></script></body></html>'}));
    await page.goto(base);await page.waitForFunction(()=>document.documentElement.dataset.hhComponents==='ready');
    await page.evaluate(async({run,language})=>{const i18n=await import('/apps/designer/i18n.js');i18n.setLanguage(language);const {openOperations}=await import('/apps/designer/cowart/operations.js');openOperations(run);},{run:await loadRun(run.directory),language});
    await page.getByText(language==='zh'?'项目经验候选':'Project memory candidates',{exact:true}).click();
    const exclude=page.getByRole('button',{name:language==='zh'?'仅本轮不适用':'Exclude for this review',exact:true});
    await exclude.click();await page.getByText(language==='zh'?'请填写本轮例外理由，最多 10,000 字。':'Enter a reason for this review exception, up to 10,000 characters.',{exact:true}).waitFor();
    assert.ok((await loadRun(run.directory)).manifest.plan);
    await page.getByLabel(language==='zh'?'经验记录理由':'Reason for the memory record',{exact:true}).fill('Established terminology for this task');
    await exclude.click();const restore=page.getByRole('button',{name:language==='zh'?'恢复本轮使用':'Use in this review again',exact:true});await restore.waitFor();
    assert.equal(workflowState((await loadRun(run.directory)).manifest).stage,'needs-plan');assert.equal((await memory.active()).length,1);
    await page.getByLabel(language==='zh'?'经验记录理由':'Reason for the memory record',{exact:true}).fill('The task now matches the principle');
    await restore.click();await exclude.waitFor();assert.deepEqual((await readRunMemoryExceptions(await loadRun(run.directory))).events.map(event=>event.decision),['exclude','apply']);
    await page.close();console.log('PASS run exception browser/API/store',language);
  }
}finally{await browser.close();await server.close();await rm(root,{recursive:true,force:true});}
