import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import {readJudgmentWithdrawal} from '../harness-core/judgment-withdrawal.js';
const hash = value => createHash('sha256').update(value).digest('hex');
function required(value,name) { if(typeof value!=='string'||!value.trim()||value.length>10000)throw new Error(`${name} is required, up to 10000 characters`);return value.trim(); }
const validId = value => /^[a-f0-9-]{36}$/.test(value || '');
function proposalHash(value) {
  const fields = {principle:value.principle,context:value.context,reason:value.reason};
  if (Object.hasOwn(value,'exceptions')) fields.exceptions = value.exceptions;
  return hash(JSON.stringify(fields));
}
export function projectMemory(root, repository) {
  const directory=join(root,'.harness','project-memory',hash(repository));
  async function optional(path) { try { return JSON.parse(await readFile(path,'utf8')); } catch(error) { if(error.code==='ENOENT')return null;throw error; } }
  async function entry(id) {
    if(!validId(id))throw new Error('Invalid proposal ID');
    const proposal=JSON.parse(await readFile(join(directory,`${id}.json`),'utf8'));
    if(proposal.id!==id || proposalHash(proposal)!==proposal.contentHash)throw new Error('Project memory content changed after recording');
    const review=await optional(join(directory,`${id}.review.json`));
    const retirement=await optional(join(directory,`${id}.retirement.json`));
    if(review && (review.proposalHash!==proposal.contentHash || !['approve','reject'].includes(review.decision)))throw new Error('Project memory review does not match its proposal');
    if(retirement && (retirement.proposalHash!==proposal.contentHash || !['withdrawn','deprecated'].includes(retirement.status)))throw new Error('Project memory retirement does not match its proposal');
    const withdrawal=await sourceWithdrawal(proposal.source);
    return {...proposal,status:retirement?.status || (withdrawal?'source-withdrawn':review?.decision==='approve'?'approved':review?'rejected':'candidate'),review,retirement,...(withdrawal?{sourceWithdrawal:withdrawal}:{})};
  }
  async function sourceWithdrawal(source){
    if(!/^[a-zA-Z0-9_-]{4,100}$/.test(source?.runId||''))throw Error('Invalid project memory source run ID');
    return readJudgmentWithdrawal(join(root,'.harness','runs',source.runId),source.judgment,source.runId);
  }
  async function list(){await mkdir(directory,{recursive:true});const names=(await readdir(directory)).filter(name=>/^[a-f0-9-]{36}\.json$/.test(name)).sort();return Promise.all(names.map(name=>entry(name.slice(0,-5))));}
  async function propose(run, input) {
    if(!['accept','reject'].includes(run.manifest.judgment?.decision)||!run.manifest.judgment.reason?.trim())throw new Error('A recorded human judgment is required before proposing project memory');
    if(run.manifest.judgmentWithdrawal||await sourceWithdrawal({runId:run.manifest.id,judgment:run.manifest.judgment}))throw Error('A withdrawn judgment cannot propose project memory.');
    const principle=required(input.principle,'Principle'),context=required(input.context,'Applicable context'),reason=required(input.reason,'Reason');
    const exceptions=input.exceptions ?? [];
    if(!Array.isArray(exceptions)||exceptions.length>20)throw new Error('Exceptions must be a list of up to 20 entries');
    const checkedExceptions=exceptions.map(value=>required(value,'Exception'));
    const id=randomUUID(),evidence=JSON.stringify({captures:run.manifest.captures,evaluation:run.manifest.evaluation,judgment:run.manifest.judgment,execution:run.manifest.execution});
    const value={id,version:'1',status:'candidate',principle,context,reason,exceptions:checkedExceptions,createdAt:new Date().toISOString(),source:{runId:run.manifest.id,judgment:run.manifest.judgment,evidenceHash:hash(evidence)}};
    value.contentHash=proposalHash(value);
    await mkdir(directory,{recursive:true});await writeFile(join(directory,`${id}.json`),JSON.stringify(value,null,2),{flag:'wx'});return value;
  }
  async function decide(input){
    const proposal=await entry(input.id);
    if(proposal.retirement)throw new Error('Retired project memory cannot be approved; propose a new version');
    if(proposal.sourceWithdrawal)throw Error('The source judgment was withdrawn; this principle cannot be approved.');
    if(!['approve','reject'].includes(input.decision))throw new Error('Choose approve or reject');
    const value={decision:input.decision,reason:required(input.reason,'Decision reason'),at:new Date().toISOString(),proposalHash:proposal.contentHash,version:`${proposal.id}@1`};
    await writeFile(join(directory,`${input.id}.review.json`),JSON.stringify(value,null,2),{flag:'wx'});return value;
  }
  async function retire(input) {
    const proposal=await entry(input.id);
    if(proposal.retirement)throw new Error('Project memory is already retired');
    if(!['candidate','approved'].includes(proposal.status))throw new Error('Only candidates or approved principles can be retired');
    const value={status:proposal.status==='approved'?'deprecated':'withdrawn',reason:required(input.reason,'Retirement reason'),at:new Date().toISOString(),proposalHash:proposal.contentHash,version:`${proposal.id}@2`};
    await writeFile(join(directory,`${input.id}.retirement.json`),JSON.stringify(value,null,2),{flag:'wx'});
    return value;
  }
  async function active() { return (await list()).filter(value=>value.status==='approved'); }
  return {list,propose,decide,retire,active};
}
