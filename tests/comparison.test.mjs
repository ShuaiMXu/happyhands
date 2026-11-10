import test from 'node:test';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import sample from '../examples/happyclaw-site/experience.json' with {type:'json'};
import {createRun} from '../packages/harness-core/store.js';
import {exportComparison} from '../packages/harness-core/comparison.js';
import {verificationHash as hash} from '../packages/harness-core/verification.js';

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'hh-comparison-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const {directory,manifest}=await createRun({spec:structuredClone(sample),url:'http://localhost:3000/form',outputRoot:root,id:'cmp00001'});
 const originals={};
 for(const [phase,color] of [['before',[100,20,5,255]],['after',[12,80,180,255]]]){
  const image=new PNG({width:16,height:10});
  for(let i=0;i<image.data.length;i+=4)image.data.set(color,i);
  // Nonuniform pixels and alpha catch resizing, recoloring and bad offsets.
  image.data.set([9,10,11,128],4*17);
  const bytes=PNG.sync.write(image),path=`${phase}/form--desktop.png`;
  originals[phase]=image;
  await mkdir(join(directory,phase));await writeFile(join(directory,path),bytes);
  manifest.captures[phase]={
   at:'2026-11-10T00:00:00Z',verificationSource:{version:1,commit:'a'.repeat(40),dirty:phase==='after',contentHash:hash(phase)},verificationPreviewFingerprint:hash(phase+'preview'),verificationOriginalHashes:{[path]:hash(bytes)},
   states:[{stateId:'form',configurationId:'desktop',width:16,height:10,status:200,reached:true,start:{url:`http://localhost:${phase==='before'?3000:3001}/form`},actions:[],screenshot:path,dom:{scroll:{x:0,y:0},language:'en',appearance:{theme:'light',colorScheme:'light'}}}]
  };
 }
 const save=()=>writeFile(join(directory,'run.json'),JSON.stringify(manifest));await save();
 return {root,directory,manifest,originals,save,options:{directory,state:'form',configuration:'desktop'}};
}

test('export preserves every original pixel at 1:1 and is repeatable without changing the run',async t=>{
 const f=await fixture(t),before=await readFile(join(f.directory,'run.json'));
 const out=await exportComparison(f.options),image=PNG.sync.read(await readFile(out.image));
 assert.equal(image.width,56);assert.equal(image.height,10);
 for(const phase of ['before','after'])for(let y=0;y<10;y++)for(let x=0;x<16;x++){
  const offset=(y*56+x+(phase==='after'?40:0))*4,index=(y*16+x)*4;
  assert.deepEqual(image.data.subarray(offset,offset+4),f.originals[phase].data.subarray(index,index+4));
 }
 assert.deepEqual(await exportComparison(f.options),out);
 assert.deepEqual(await readFile(join(f.directory,'run.json')),before);
 const record=JSON.parse(await readFile(out.provenance));
 assert.equal(record.image.sha256,hash(await readFile(out.image)));
 assert.equal(record.layout.crop,null);assert.equal(out.acceptance,'not-assessed');
 assert.ok(record.limitations.some(s=>s.includes('does not establish improvement')));
 assert.ok(!JSON.stringify(record).includes(f.root),'no absolute local paths enter shareable provenance');
});

test('changing an original or removing capture-time provenance blocks the export',async t=>{
 const f=await fixture(t);
 await writeFile(join(f.directory,'before/form--desktop.png'),PNG.sync.write(f.originals.after));
 await assert.rejects(exportComparison(f.options),/Original screenshot changed/);
 await writeFile(join(f.directory,'before/form--desktop.png'),PNG.sync.write(f.originals.before));
 delete f.manifest.captures.after.verificationSource;await f.save();
 await assert.rejects(exportComparison(f.options),/source and preview binding/);
});

test('known route, state action, theme, language, scroll and viewport mismatches are rejected',async t=>{
 const f=await fixture(t),original=structuredClone(f.manifest.captures.after.states[0]);
 const mutations=[e=>e.start.url='http://localhost:3001/other',e=>e.actions.push({type:'click',role:'button',name:'Other'}),e=>e.dom.appearance.theme='dark',e=>e.dom.language='zh',e=>e.dom.scroll.y=50,e=>e.width=15];
 for(const mutate of mutations){
  const value=structuredClone(original);mutate(value);f.manifest.captures.after.states=[value];await f.save();
  await assert.rejects(exportComparison(f.options),/context differ|viewport|PNG/);
 }
});

test('a missing/ambiguous/unreached state or bootstrap never becomes a comparison',async t=>{
 const f=await fixture(t),after=f.manifest.captures.after;
 after.states.push(structuredClone(after.states[0]));await f.save();
 await assert.rejects(exportComparison(f.options),/Expected one after capture/);
 after.states.pop();after.states[0].reached=false;await f.save();
 await assert.rejects(exportComparison(f.options),/not reached/);
 f.manifest.mode='bootstrap';await f.save();
 await assert.rejects(exportComparison(f.options),/bootstrap has no baseline/);
 await assert.rejects(exportComparison({...f.options,state:'../bad'}),/safe path segments/);
});

test('unsafe paths, corrupt PNGs, altered exports and output into evidence are refused',async t=>{
 const f=await fixture(t),original=f.manifest.captures.after.states[0];
 original.screenshot='../outside.png';await f.save();
 await assert.rejects(exportComparison(f.options),/unexpected path/);
 original.screenshot='after/form--desktop.png';await f.save();
 const data=await readFile(join(f.directory,original.screenshot));data[data.length-1]^=1;
 await writeFile(join(f.directory,original.screenshot),data);f.manifest.captures.after.verificationOriginalHashes[original.screenshot]=hash(data);await f.save();
 await assert.rejects(exportComparison(f.options),/CRC|checksum/i);
 await writeFile(join(f.directory,original.screenshot),PNG.sync.write(f.originals.after));f.manifest.captures.after.verificationOriginalHashes[original.screenshot]=hash(PNG.sync.write(f.originals.after));await f.save();
 await assert.rejects(exportComparison({...f.options,outputRoot:join(f.directory,'before')}),/inside evidence/);
 const out=await exportComparison(f.options);await writeFile(out.image,'altered');
 await assert.rejects(exportComparison(f.options),/Existing comparison changed/);
});

test('linked originals are rejected',async t=>{
 if(process.platform==='win32')return t.skip('Symlink creation needs privileges on Windows.');
 const f=await fixture(t),path=join(f.directory,'before/form--desktop.png'),outside=join(f.root,'original.png');
 await writeFile(outside,await readFile(path));await rm(path);await symlink(outside,path);
 await assert.rejects(exportComparison(f.options),/symlinks/);
});

test('the real CLI exports the selected pair and rejects binding without a repository',async t=>{
 const f=await fixture(t),exec=promisify(execFile),script=fileURLToPath(new URL('../scripts/harness.mjs',import.meta.url));
 const result=await exec(process.execPath,[script,'compare','--run',f.directory,'--state','form','--configuration','desktop']);
 assert.equal(JSON.parse(result.stdout).acceptance,'not-assessed');
 f.manifest.captures.before=null;f.manifest.captures.after=null;await f.save();
 await assert.rejects(exec(process.execPath,[script,'capture','--run',f.directory,'--phase','before','--bind-evidence','true']),error=>error.stderr.includes('requires --repo DIRECTORY'));
});
