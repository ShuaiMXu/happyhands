import {fileURLToPath} from 'node:url';
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {createRun,saveCapture,saveEvaluation,loadRun,confirmFinding} from '../packages/harness-core/store.js';
const exec=promisify(execFile),cli=fileURLToPath(new URL('../scripts/harness.mjs',import.meta.url));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'hh-control-cli-'));t.after(()=>rm(root,{recursive:true,force:true}));const run=await createRun({spec:structuredClone(sample),url:'http://localhost',outputRoot:root});for(const phase of ['before','after']){if(phase==='after')await confirmFinding(run.directory,sample.findings[0].id,'supported','Synthetic fixture only, not human acceptance');await mkdir(join(run.directory,phase));await writeFile(join(run.directory,phase,'desktop.png'),png);await saveCapture(run.directory,phase,{viewports:{desktop:{screenshot:phase+'/desktop.png'}}});}await saveEvaluation(run.directory,{status:'synthetic'});return {root,run};}
test('CLI cumulative policy and report share the native locked ledger',async t=>{
 const {root,run}=await fixture(t),input=join(root,'policy.json');await writeFile(input,JSON.stringify({maxCalls:0}));
 const configured=JSON.parse((await exec(process.execPath,[cli,'review-budget','--run',run.directory,'--input',input,'--reason','No paid calls for this synthetic task'])).stdout);assert.equal(configured.policy.maxCalls,0);
 const report=JSON.parse((await exec(process.execPath,[cli,'review-costs','--run',run.directory])).stdout);assert.equal(report.totals.calls,0);assert.equal(report.policyChanges.length,1);
});
test('CLI preflight does not need a model binary and does not reserve costs',async t=>{
 const {run}=await fixture(t);const output=JSON.parse((await exec(process.execPath,[cli,'model-review','--run',run.directory,'--preflight-only','true'],{env:{...process.env,WORKBENCH_CODEX:'/nonexistent/no-model-should-start'}})).stdout);
 assert.equal(output.status,'preflight-only');assert.equal(output.plan.originals.length,2);assert.equal((await loadRun(run.directory)).manifest.reviewCosts,undefined);
});
test('CLI normalization retains exact raw bytes and creates provenance without a model',async t=>{
 const {root,run}=await fixture(t),input=join(root,'raw.json'),out=join(root,'normalized.json');const raw={schemaVersion:'0.1',skillId:'visual-qa-evaluator',reviewer:{type:'model',name:'Synthetic only',version:'1'},reviewedAt:'2026-11-16T00:00:00Z',verdict:'needs-evidence',screenshotRefs:['before/desktop.png','after/desktop.png'],findings:[],rationale:'Test only',limitations:['No actual inspection']};const bytes=Buffer.from(JSON.stringify(raw,null,3)+'\n');await writeFile(input,bytes);
 await exec(process.execPath,[cli,'review-normalize','--run',run.directory,'--input',input,'--out',out]);assert.deepEqual(await readFile(input),bytes);assert.deepEqual(JSON.parse(await readFile(out)),raw);const provenance=JSON.parse(await readFile(out+'.provenance.json'));assert.match(provenance.rawInputBytesHash,/^[a-f0-9]{64}$/);assert.deepEqual(provenance.changes,[]);
});
