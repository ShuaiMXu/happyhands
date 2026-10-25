// Adapter for HappyClaw's committed real-browser checks. Run from its checkout.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const value=flag=>process.argv[process.argv.indexOf(flag)+1];
const mode=value('--mode'),url=value('--url'),out=resolve(value('--out'));
assert.ok(['menu','ui','commands'].includes(mode));assert.ok(url?.startsWith('http'));
await mkdir(out,{recursive:true});
const harness=fileURLToPath(new URL('../../',import.meta.url));
let result;
if(mode==='menu'||mode==='ui'){
  const script=mode==='menu'?'scripts/verify-mobile-menu.mjs':'scripts/verify-ui.mjs';
  await promisify(execFile)(process.execPath,[script,'--url',url,'--out',out],{cwd:process.cwd(),env:{...process.env,HARNESS_ROOT:harness},timeout:110000,maxBuffer:1024*1024});
  const original=JSON.parse(await readFile(join(out,'result.json'),'utf8')),source=await readFile(script,'utf8');
  result={status:'pass',producer:{script,sha256:createHash('sha256').update(source).digest('hex'),source},original};
}else{
  const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[];
  try{
    for(const width of [320,390,768,1280]){
      const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']}),page=await context.newPage();
      await page.goto(new URL('#quickstart',url).href,{waitUntil:'networkidle'});
      assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize),'16px');
      const pre=page.locator('.command-step pre').first();await pre.focus();
      const before=await pre.evaluate(e=>({scrollLeft:e.scrollLeft,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth}));
      if(before.scrollWidth>before.clientWidth){for(let i=0;i<30;i++)await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>{const e=document.querySelector('.command-step pre');return e.scrollLeft+e.clientWidth>=e.scrollWidth-2;});}
      const after=await pre.evaluate(e=>({scrollLeft:e.scrollLeft,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,focused:document.activeElement===e,text:e.textContent}));
      await page.screenshot({path:join(out,`command-end-${width}.png`)});const copies=[];
      for(const [i,expected] of ['git clone https://github.com/riba2534/happyclaw.git','cd happyclaw','make start'].entries()){
        await page.locator('[data-copy-command]').nth(i).click();await page.getByRole('status').nth(i).filter({hasText:'命令已复制'}).waitFor();
        const actual=await page.evaluate(()=>navigator.clipboard.readText());assert.equal(actual,expected);copies.push({expected,actual});
      }
      await page.screenshot({path:join(out,`copied-${width}.png`)});
      const check={width,rootFontSize:'16px',before,after,copies};
      if(width===390){
        await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:()=>Promise.reject(new DOMException('Permission denied','NotAllowedError'))}));
        await page.locator('[data-copy-command]').first().click();await page.locator('#copy-status-clone').filter({hasText:'手动复制'}).waitFor();
        assert.equal(await page.locator('[data-copy-command]').first().isEnabled(),true);await page.screenshot({path:join(out,'copy-denied-390.png')});
        check.denial='Simulated Clipboard API rejection: manual-copy feedback and recovered button.';
      }
      checks.push(check);await context.close();
    }
  }finally{await browser.close();}
  result={status:'pass',checks};
}
await writeFile(join(out,'result.json'),JSON.stringify(result,null,2));
