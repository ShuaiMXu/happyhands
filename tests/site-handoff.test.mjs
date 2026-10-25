import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {assertSiteHandoff,encodeSiteHandoff,decodeSiteHandoff,localWorkbenchURL} from '../packages/workbench/site-handoff-contract.js';
import {collectDesignSources,designSourceContext} from '../packages/harness-core/design-sources.js';
import {createWorkbench} from '../packages/workbench/service.js';
import {createRun,saveCapture,saveOnboarding,confirmFinding,savePlan,loadRun,verifiedExecutionBrief} from '../packages/harness-core/store.js';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
const data=()=>({schemaVersion:'0.1',id:randomUUID(),repo:'/Users/演示/My Project',task:'保持长命令单行',designSources:['DESIGN.md','src/components']});
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'site-handoff-'));t.after(()=>rm(root,{recursive:true,force:true}));await writeFile(join(root,'DESIGN.md'),'Keep commands single-line.');return root;}
const digest=value=>createHash('sha256').update(JSON.stringify(assertSiteHandoff(value))).digest('hex');
test('website links round-trip Unicode without sending data in HTTP query, and reject remote or executable targets',()=>{
 const input=data(),url=new URL(localWorkbenchURL('http://127.0.0.1:4190/apps/designer/',input));
 assert.equal(url.search,'');assert.deepEqual(decodeSiteHandoff(url.hash.slice(9)),input);
 for(const base of ['https://example.com/apps/designer/','javascript:alert(1)','http://127.0.0.1@evil.example/apps/designer/','http://127.0.0.1:4190/elsewhere/'])assert.throws(()=>localWorkbenchURL(base,input));
 for(const patch of [{start:{command:'rm'}},{runId:'another-run'},{designSources:['../secret.md']},{designSources:['src/../../secret.md']},{designSources:['.git/config']},{task:'x\nrun command'}])assert.throws(()=>assertSiteHandoff({...input,...patch}));
 assert.throws(()=>decodeSiteHandoff('a'.repeat(22001)));assert.throws(()=>decodeSiteHandoff('invalid!'));
 assert.equal(encodeSiteHandoff(input),encodeSiteHandoff(input));
});
test('selected design sources retain complete text and hashes; missing, changed, linked or excessive files fail closed',async t=>{
 const root=await fixture(t),refs=await collectDesignSources(root,['DESIGN.md']);
 const run={manifest:{onboarding:{config:{repo:root,designSources:refs}}}};
 assert.equal((await designSourceContext(run))[0].content,'Keep commands single-line.');
 await writeFile(join(root,'DESIGN.md'),'Changed');await assert.rejects(designSourceContext(run),/changed/);
 await assert.rejects(collectDesignSources(root,['missing.md']),/ENOENT/);await assert.rejects(collectDesignSources(root,['../secret.md']),/relative/);
 // Directory junctions exercise the same canonical-path guard without requiring
 // Windows file-symlink privileges; POSIX still checks a direct file symlink.
 if(process.platform==='win32'){
  await mkdir(join(root,'link-source'));await writeFile(join(root,'link-source','DESIGN.md'),'Linked reference');
  await symlink(join(root,'link-source'),join(root,'linked'),'junction');
  await assert.rejects(collectDesignSources(root,['linked/DESIGN.md']),/symlink/);
 }else{
  await symlink(join(root,'DESIGN.md'),join(root,'linked.md'));await assert.rejects(collectDesignSources(root,['linked.md']),/symlink/);
 }
 await mkdir(join(root,'components'));
 for(let i=0;i<15;i++)await writeFile(join(root,'components',i+'.tsx'),'export const Button'+i+'=()=>null;');
 const many=await collectDesignSources(root,['components']);
 assert.equal((await designSourceContext({manifest:{onboarding:{config:{repo:root,designSources:many}}}})).length,15);
 await mkdir(join(root,'empty'));await assert.rejects(collectDesignSources(root,['empty']),/no supported files/);
 await writeFile(join(root,'large.md'),'x'.repeat(256001));await assert.rejects(collectDesignSources(root,['large.md']),/budget/);
});
test('handoff receipts reuse the existing durable job and run; changed data cannot hijack the identity',async t=>{
 const root=await fixture(t),repo=await fixture(t),handoff={...data(),repo,designSources:['DESIGN.md']};
 const deps={inspectRepository:async()=>({root:repo,commit:'a'.repeat(40),dirty:false}),waitForPreview:async()=>{},captureBrowser:async()=>{throw Error('Intentional capture failure');}};
 const service=createWorkbench(root,deps),input={siteHandoff:handoff,repo,task:handoff.task,url:'http://127.0.0.1:4321/'};
 t.after(()=>service.close());
 const job=await service.configure(input);
 for(let n=0;n<100;n++){const current=await service.jobs.get(job.id);if(current.status==='failed')break;await new Promise(resolve=>setTimeout(resolve,15));}
 const receipt=await service.siteHandoff(handoff.id,digest(handoff));assert.equal(receipt.job.id,job.id);assert.ok(receipt.runId);
 const run=await service.localRun(receipt.runId);assert.equal(run.manifest.onboarding.config.designSources[0].path,'DESIGN.md');assert.equal(run.manifest.judgment,null);
 assert.equal((await service.configure(input)).id,job.id);assert.equal((await service.jobs.list()).length,1);
 await assert.rejects(service.configure({...input,task:'Different task',siteHandoff:{...handoff,task:'Different task'}}),/different project/);
 const restarted=createWorkbench(root,deps);t.after(()=>restarted.close());assert.equal((await restarted.siteHandoff(handoff.id,digest(handoff))).runId,receipt.runId);
});
test('the human-confirmed execution brief includes selected design text and blocks substitution or source changes',async t=>{
 const root=await fixture(t),refs=await collectDesignSources(root,['DESIGN.md']);
 await mkdir(join(root,'runs'));
 const {directory}=await createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:join(root,'runs')});
 await saveOnboarding(directory,{status:'ready',config:{repo:root,designSources:refs}});
 await saveCapture(directory,'before',{at:new Date().toISOString(),url:'http://localhost',viewports:{desktop:{width:1280,height:800,status:200,screenshot:'before/desktop.png',dom:{h1:['HappyClaw'],actions:[],horizontalOverflow:false}}}});
 await confirmFinding(directory,'F1','supported','Only the approved scope.');await savePlan(directory,'F1');
 const run=await loadRun(directory);assert.match(await verifiedExecutionBrief(run),/Keep commands single-line/);
 const changed=structuredClone(run);changed.manifest.onboarding.config.designSources=[];await assert.rejects(verifiedExecutionBrief(changed),/changed after planning/);
 await writeFile(join(root,'DESIGN.md'),'Different rule');await assert.rejects(verifiedExecutionBrief(run),/changed/);
});
