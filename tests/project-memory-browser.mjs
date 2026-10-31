import {createServer} from 'vite';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {projectMemory} from '../packages/workbench/memory.js';

// Real UI with an isolated local store; no project judgments are changed.
const root=await mkdtemp(join(tmpdir(),'memory-browser-'));
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
const run={spec:{project:{name:'Fixture',task:'Review'}},manifest:{id:'fixture-run',captures:{},judgment:{decision:'reject',reason:'Synthetic fixture'}}};
let server;
try {
  server=await createServer({configFile:false,root:process.cwd(),cacheDir:join(root,'vite-cache'),server:{host:'127.0.0.1',port:0,fs:{allow:[process.cwd(),root]}},optimizeDeps:{noDiscovery:true,include:['react','react/jsx-runtime','react/jsx-dev-runtime','react-dom','react-dom/client','@radix-ui/react-dialog','@radix-ui/react-checkbox','@radix-ui/react-select'],exclude:['@tldraw/assets']}});await server.listen();const base='http://127.0.0.1:'+server.httpServer.address().port;
  for(const language of ['zh','en']){
    const store=projectMemory(root,language),page=await browser.newPage();page.on('pageerror',error=>console.error(error.message));
    await page.route(base+'/**',async route=>{
      const url=new URL(route.request().url());
      try {
        if(url.pathname.startsWith('/api/')){
          let value=[];
          if(url.pathname.endsWith('/withdraw-judgment')){
            const input=route.request().postDataJSON();if(!input.reason.trim())throw Error('Withdrawal reason required');
            return route.fulfill({json:{withdrawal:{reason:input.reason},exportError:null}});
          }
          if(url.pathname.endsWith('/state'))value={};
          if(url.pathname.endsWith('/memory')){
            const input=route.request().postDataJSON();
            value=!input?await store.list():input.action==='propose'?await store.propose(run,input):input.action==='retire'?await store.retire(input):await store.decide(input);
          }
          return route.fulfill({json:value});
        }
        if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><title>Memory fixture</title></head><body><script type="module" src="/packages/ui/workbench.js"></script></body></html>'});
        return route.continue();
      }catch(error){return route.fulfill({status:400,json:{error:error.message}});}
    });
    await page.goto(base);await page.waitForFunction(()=>document.documentElement.dataset.hhComponents==='ready');
    await page.evaluate(async({run,language})=>{const i18n=await import('/apps/designer/i18n.js');i18n.setLanguage(language);const {openOperations}=await import('/apps/designer/cowart/operations.js');openOperations(run);},{run,language});
    const labels=language==='zh'?['项目经验候选','建议保留的原则','适用范围','不适用的情况（可选，每行一项）','经验记录理由','提出经验候选','批准原则','停用原则','已弃用']:['Project memory candidates','Proposed principle','Applicable context','Exceptions (optional, one per line)','Reason for the memory record','Propose project memory','Approve principle','Retire principle','Deprecated'];
    await page.getByText(labels[0],{exact:true}).click();
    await page.getByLabel(labels[1],{exact:true}).fill('Use outcome labels');
    await page.getByLabel(labels[2],{exact:true}).fill('Review screens');
    await page.getByLabel(labels[3],{exact:true}).fill('Destructive actions');
    await page.getByLabel(labels[4],{exact:true}).fill('Fixture reason');
    await page.getByRole('button',{name:labels[5],exact:true}).click();
    await page.getByRole('button',{name:labels[6],exact:true}).click();
    await page.getByRole('button',{name:labels[7],exact:true}).click();
    await page.getByText(new RegExp('Use outcome labels.*'+labels[8])).waitFor();
    assert.equal((await store.active()).length,0);
    const entries=await store.list();assert.equal(entries[0].review.decision,'approve');assert.deepEqual(entries[0].exceptions,['Destructive actions']);
    assert.equal(await page.getByRole('button',{name:labels[7],exact:true}).count(),0);
    await page.evaluate(async()=>{
      document.querySelector('[data-ui-dialog][open]').close();
      const {projectMemoryView}=await import('/apps/designer/project-memory-view.js');
      const view=projectMemoryView({context:{entries:[{principle:'<img src=x onerror=alert(1)>',context:'Review screens',exceptions:['Destructive actions'],source:{runId:'prior-run'}}]}});
      document.body.append(view);view.open=true;
    });
    assert.equal(await page.locator('#diagnosis-project-memory img').count(),0);
    assert.ok((await page.locator('#diagnosis-project-memory').textContent()).includes('prior-run'));
    assert.ok((await page.locator('#diagnosis-project-memory summary').textContent()).includes(language==='zh'?'诊断时参考的项目经验':'Project context saved with this diagnosis'));
    await page.evaluate(async()=>{
      const {incrementalReviewView}=await import('/apps/designer/incremental-review-view.js');
      const view=incrementalReviewView({mode:'incremental',reasonCode:'verified-source-delta',delta:{status:'verified',baselineRunId:'prior-run',changes:[{kind:'modified',path:'<img src=x onerror=alert(1)>'}],impact:{states:[{stateId:'<img src=x>',urls:['http://localhost/shop'],status:'potentially-affected'},{stateId:'about',urls:['http://localhost/about'],status:'impact-unknown'}]}}});view.open=true;document.body.append(view);
    });
    assert.equal(await page.locator('#incremental-review-context img').count(),0);
    assert.equal(await page.locator('#incremental-review-context summary').textContent(),language==='zh'?'本轮变动范围':'Changes in this review');
    assert.ok((await page.locator('#incremental-review-context a').getAttribute('href')).includes('run%3Aprior-run'));
    assert.ok((await page.locator('#incremental-review-context ul').textContent()).includes(language==='zh'?'可能受影响':'Potentially affected'));
    assert.ok((await page.locator('#incremental-review-context ul').textContent()).includes(language==='zh'?'影响范围待确认':'Impact not established'));
    await page.evaluate(async()=>{
      document.getElementById('incremental-review-context').remove();
      const {incrementalReviewView}=await import('/apps/designer/incremental-review-view.js');
      const view=incrementalReviewView({reasonCode:'verified-source-delta',delta:{captureSelection:{status:'selected',selectedStateIds:['home'],excludedStateIds:['<img src=x>']}}},{onFullReview:async()=>{document.body.dataset.fullReviewRequested='true';}});view.open=true;document.body.append(view);
    });
    assert.equal(await page.locator('#incremental-review-context img').count(),0);
    assert.ok((await page.locator('#incremental-review-context').textContent()).includes(language==='zh'?'未纳入本轮复查':'Not reviewed in this run'));
    assert.ok((await page.locator('#incremental-review-context').textContent()).includes(language==='zh'?'其余页面未复查':'Other pages remain unreviewed'));
    await page.getByRole('button',{name:language==='zh'?'重新完整审阅':'Start a full review',exact:true}).click();
    assert.equal(await page.evaluate(()=>document.body.dataset.fullReviewRequested),'true');
    await page.evaluate(async run=>{
      const {judgmentWithdrawalView}=await import('/apps/designer/judgment-withdrawal-view.js');
      const node=judgmentWithdrawalView(run,async input=>{
        const response=await fetch('/api/workbench/withdraw-judgment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
        const result=await response.json();if(!response.ok)throw Error(result.error);return result;
      },()=>{document.body.dataset.withdrawalChanged='true';});
      node.id='withdrawal-fixture';node.open=true;document.body.append(node);
    },run);
    const withdrawal=page.locator('#withdrawal-fixture'),control=withdrawal.getByRole('button',{name:language==='zh'?'撤回这次决定':'Withdraw decision',exact:true});
    await control.click();await withdrawal.getByRole('status').filter({hasText:'Withdrawal reason required'}).waitFor();
    await withdrawal.getByLabel(language==='zh'?'撤回理由':'Withdrawal reason',{exact:true}).fill('Earlier scope was incomplete');
    await control.click();await page.waitForFunction(()=>document.body.dataset.withdrawalChanged==='true');assert.equal(await control.isDisabled(),true);
    await page.close();console.log('PASS memory lifecycle UI',language);
  }
}finally{await browser.close();await server?.close();await rm(root,{recursive:true,force:true});}
