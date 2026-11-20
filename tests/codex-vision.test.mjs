import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectCodexVision} from '../packages/harness-core/codex-vision.js';

test('Codex metadata resolves the configured model and its image capability without a model turn', async t => {
  const directory=await mkdtemp(join(tmpdir(),'hh-codex-vision-'));
  t.after(()=>rm(directory,{force:true,recursive:true}));
  const originalBaseUrl=process.env.OPENAI_BASE_URL;
  delete process.env.OPENAI_BASE_URL;
  t.after(()=>{if(originalBaseUrl!==undefined)process.env.OPENAI_BASE_URL=originalBaseUrl;});
  await writeFile(join(directory,'app-server'),`
const {createInterface}=require('node:readline');
const methods=['initialize','initialized','config/read','model/list','model/list'];
const config={model:'fixture-image',model_provider:'openai'};
const rows=[
  {data:[{id:'fixture-text',model:'fixture-text',isDefault:true,inputModalities:['text']}],nextCursor:'page2'},
  {data:[{id:'fixture-image',model:'fixture-image',inputModalities:['text','image']}],nextCursor:null}
];
createInterface({input:process.stdin}).on('line',line=>{
  const {id,method,params}=JSON.parse(line);
  if(method!==methods.shift())process.exit(42);
  if(id===undefined)return;
  let result={};
  if(method==='config/read')result={config};
  if(method==='model/list'){
    if(rows.length===1 && params?.cursor!=='page2')process.exit(43);
    result=rows.shift();
  }
  process.stdout.write(JSON.stringify({id,result})+'\\n');
});`);
  assert.deepEqual(await inspectCodexVision(process.execPath,directory,null),
    {model:'fixture-image',provider:'openai',modalities:['text','image']});
  assert.deepEqual(await inspectCodexVision(process.execPath,directory,'fixture-text'),
    {model:'fixture-text',provider:'openai',modalities:['text']});
  assert.deepEqual(await inspectCodexVision(join(directory,'absent-command'),directory,'fixture-unknown'),
    {model:'fixture-unknown',provider:null,modalities:null});
});
