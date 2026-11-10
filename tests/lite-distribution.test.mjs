import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,realpath,readFile,writeFile,mkdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {buildLite} from '../scripts/build-lite.mjs';
import {installSkill} from '../skills/happyhands/lib/install.mjs';
import {verifyBundle} from '../skills/happyhands/lib/integrity.mjs';
const exec=promisify(execFile),repo=fileURLToPath(new URL('../',import.meta.url));
async function fixture(t){const root=await realpath(await mkdtemp(join(tmpdir(),'hh-lite-test-')));t.after(()=>rm(root,{recursive:true,force:true}));const output=join(root,'bundle');await buildLite(output);return {root,output};}
test('portable bundle works from a different project and contains complete methods without UI dependencies',async t=>{
 const f=await fixture(t),manifest=await verifyBundle(f.output),pkg=JSON.parse(await readFile(join(f.output,'package.json')));
 assert.ok(manifest.files.some(row=>row.path==='skills/vendor/ojo/upstream/references/component-recipe.md'));
 assert.ok(manifest.files.some(row=>row.path==='docs/lightweight.md'),'the installed Harness guide must retain its lightweight setup reference');
 assert.ok(!manifest.files.some(row=>row.path.startsWith('apps/')||row.path.startsWith('public/')||row.path.includes('node_modules/')));
 assert.ok(!pkg.dependencies.react&&!pkg.dependencies.tldraw&&!pkg.dependencies.vite);
 const packed=JSON.parse((await exec(process.platform==='win32'?'npm.cmd':'npm',['pack',f.output,'--pack-destination',f.root,'--json'],{shell:process.platform==='win32'})).stdout)[0];
 const paths=new Set(packed.files.map(file=>file.path));assert.ok(manifest.files.every(file=>paths.has(file.path)),'npm must preserve every file the runtime declares');
 await symlink(join(repo,'node_modules'),join(f.output,'node_modules'),process.platform==='win32'?'junction':'dir');
 const project=join(f.root,'unrelated-project');await mkdir(project);
 const result=await exec(process.execPath,[join(f.output,'bin/happyhands.mjs'),'skills'],{cwd:project});
 assert.ok(JSON.parse(result.stdout).some(skill=>skill.id==='component-state-auditor'));
 const {stageDesignGuidance}=await import(pathToFileURL(join(f.output,'packages/skill-core/design-guidance.js')));
 const {stageOjoGuidance}=await import(pathToFileURL(join(f.output,'packages/skill-core/ojo-guidance.js')));
 const run=join(f.root,'run');await mkdir(run);assert.ok((await stageDesignGuidance(run,'review')).packs.length>=2);assert.ok((await stageOjoGuidance(run,'review')).metadata);
});
test('user-scoped installation is discoverable outside the product and leaves its source alone',async t=>{
 const f=await fixture(t),home=join(f.root,'user');await mkdir(home);
 const result=await installSkill({source:f.output,project:f.root,agent:'claude-code',userHome:home,installDependencies:async()=>{}});
 assert.equal(result.directory,join(home,'.claude/skills/happyhands'));await verifyBundle(result.directory);
 await assert.rejects(readFile(join(f.root,'.agents/skills/happyhands/SKILL.md')),/ENOENT/);
});
test('installer retains a working bundle and refuses an existing skill or a corrupt input',async t=>{
 const f=await fixture(t);let installed=0;
 const result=await installSkill({source:f.output,project:f.root,scope:'project',installDependencies:async()=>installed++});
 assert.equal(installed,1);await verifyBundle(result.directory);
 await assert.rejects(installSkill({source:f.output,project:f.root,scope:'project',installDependencies:async()=>{throw Error('Must not run');}}),/already exists/);
 await writeFile(join(f.output,'SKILL.md'),'changed');
 await assert.rejects(installSkill({source:f.output,project:f.root,scope:'project',destination:join(f.root,'different'),installDependencies:async()=>{}}),/Bundle file changed/);
});
test('dependency failure rolls back the incomplete skill and project links cannot redirect installation',async t=>{
 const f=await fixture(t);
 await assert.rejects(installSkill({source:f.output,project:f.root,scope:'project',installDependencies:async()=>{throw Error('offline');}}),/offline/);
 await assert.rejects(readFile(join(f.root,'.agents/skills/happyhands/SKILL.md')),/ENOENT/);
 const other=join(f.root,'other');await mkdir(other);await rm(join(f.root,'.agents'),{recursive:true});await symlink(other,join(f.root,'.agents'),'dir');
 await assert.rejects(installSkill({source:f.output,project:f.root,scope:'project',installDependencies:async()=>{}}),/symbolic links/);
});
