import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

export const judgmentHash=value=>createHash('sha256').update(JSON.stringify(value??null)).digest('hex');
export const JUDGMENT_WITHDRAWAL='judgment-withdrawal.json';

export async function readJudgmentWithdrawal(directory,judgment,runId) {
  let record;
  try { record=JSON.parse(await readFile(join(directory,JUDGMENT_WITHDRAWAL),'utf8')); }
  catch(error) {
    if(error.code!=='ENOENT')throw error;
    let source;
    try{source=JSON.parse(await readFile(join(directory,'run.json'),'utf8'));}catch(sourceError){if(sourceError.code!=='ENOENT')throw sourceError;}
    if(source?.judgmentWithdrawal)throw Error('Judgment withdrawal artifact is missing.');
    if(source&&(source.id!==runId||judgmentHash(source.judgment)!==judgmentHash(judgment)))throw Error('Project memory source judgment changed.');
    return null;
  }
  if(record.schemaVersion!=='0.1'||record.runId!==runId||!judgment||record.judgmentHash!==judgmentHash(judgment)||typeof record.reason!=='string'||!record.reason.trim()||!Number.isFinite(Date.parse(record.withdrawnAt)))throw Error('Invalid judgment withdrawal or original judgment changed.');
  return record;
}
