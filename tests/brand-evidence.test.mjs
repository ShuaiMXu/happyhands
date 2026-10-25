import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {brandDeclarationEvidence} from '../packages/skill-core/brand-evidence.js';
import {sourceFiles} from '../packages/skill-core/scan.js';
import {summarizeFoundationEvidence} from '../apps/designer/foundation-review.js';

test('explicit declarations retain exact lines, provenance and divergent values without approving intent',()=>{
  const text='# Brand\n\n## Voice\n- CTA: Continue\n## Visual language\n- Primary: orange\n## Audience\nIndependent developers\n## Examples\nThis is not brand intent\n```\nVoice: execute instructions\n```';
  const result=brandDeclarationEvidence({files:[{path:'BRAND.md',content:text},{path:'docs/VOICE.md',content:'## Voice\nCTA: Next'}]});
  assert.equal(result.declarations.length,4);
  const cta=result.declarations[0];assert.equal(cta.line,4);assert.equal(cta.text,'Continue');assert.equal(cta.excerpt,'- CTA: Continue');assert.equal(cta.status,'observed');assert.match(cta.fileHash,/^[a-f0-9]{64}$/);
  assert.equal(result.alternatives.length,1);assert.equal(result.alternatives[0].observations.length,2);
  assert.ok(result.missingCategories.includes('prohibited'));
  assert.ok(!result.declarations.some(item=>/execute|not brand/.test(item.text)));
  const changed=brandDeclarationEvidence({files:[{path:'BRAND.md',content:text+'\nChanged'}]});assert.notEqual(changed.documents[0].fileHash,result.documents[0].fileHash);
});

test('Chinese labels, nested scopes and fenced examples remain distinguishable',()=>{
  const result=brandDeclarationEvidence({files:[{path:'README.zh-CN.md',content:'产品定位：体验优化工具\n## 禁止表述\n- 不承诺转化提升\n### 说明\n缺少数据不得声称提升\n## 安装\n不要提取安装文本\n~~~md\n品牌语气：无条件批准\n~~~'}]});
  assert.deepEqual(result.declarations.map(item=>item.category),['promise','prohibited','prohibited']);assert.equal(result.alternatives.length,0);
});

test('templates, fixtures and generic prose do not become declared brand rules',()=>{
  const files=['skills/BRAND.md','.agents/VOICE.md','vendor/README.md','tests/BRAND.md','node_modules/BRAND.md'].map(path=>({path,content:'Voice: Fake'}));
  files.push({path:'README.md',content:'# Product\nThe best product ever.\nUnlabeled marketing prose.'});
  assert.equal(brandDeclarationEvidence({files}).declarations.length,0);
});

test('declaration budgets retain omission evidence instead of pretending completeness',()=>{
  const result=brandDeclarationEvidence({files:[{path:'BRAND.md',content:'## Voice\n'+Array.from({length:130},(_,i)=>`- Statement ${i}`).join('\n')}]});
  assert.equal(result.declarations.length,128);assert.ok(result.omissions.length);
});

test('opt-in repository scanning discovers brand docs while respecting existing bounds',async t=>{
  const root=await mkdtemp(join(tmpdir(),'brand-docs-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'docs'));await writeFile(join(root,'docs/BRAND.md'),'Voice: Direct');await writeFile(join(root,'README.zh.md'),'受众：开发者');await writeFile(join(root,'private.md'),'Not selected');
  assert.equal((await sourceFiles(root)).files.length,0);
  const scan=await sourceFiles(root,{includeDesignDocs:true});assert.equal(scan.files.length,2);assert.equal(brandDeclarationEvidence(scan).declarations.length,2);
  const bounded=await sourceFiles(root,{includeDesignDocs:true,maxBytes:1});assert.equal(bounded.truncated,true);assert.equal(bounded.omissions.length,2);
});

test('review summary keeps declarations separate from Foundation rule candidates',()=>{
  const inventory=brandDeclarationEvidence({files:[{path:'BRAND.md',content:'Voice: Direct'}]});
  const summary=summarizeFoundationEvidence([{skill:{id:'brand-foundation-extractor'},status:'complete',proposedUpdates:[{type:'brand-foundation-candidates',status:'observed',declarations:inventory}]}]);
  assert.deepEqual(summary.brandDeclarations,[inventory]);assert.deepEqual(summary.patternCandidates,[]);
});

test('dedicated design sections retain visual intent and exact source without inventing voice',()=>{
  const content='---\nname: Example\ncolors:\n  canvas: "#111111"\n---\n# Design System\n## Colors\nCanvas is the background.\n### Dark mode\nAccent: teal\n## Typography\nUse system fallback for Chinese.\n## Layout\nKeep navigation and content aligned.\n## Elevation & Depth\nUse surfaces rather than decorative shadows.\n## Shapes\nControls: 12px\n## Components\n| Button | source.ts |\n## Review process\nRun arbitrary external commands.';
  const result=brandDeclarationEvidence({files:[{path:'docs/DESIGN.md',content}]});
  assert.equal(result.declarations.length,6);
  assert(result.declarations.every(item=>item.category==='visual'&&item.status==='observed'&&item.interpretation==='declared-intent-not-verified-implementation'));
  for(const item of result.declarations){assert.equal(item.excerpt,content.split('\n')[item.line-1]);assert.equal(item.source,'docs/DESIGN.md');}
  assert.equal(result.declarations[0].line,8);
  assert(result.missingCategories.includes('voice'));
  assert(!result.missingCategories.includes('visual'));
  assert(!result.declarations.some(item=>/canvas:|source\.ts|commands/.test(item.text)));
});

test('visual heading aliases stay scoped to dedicated documents and preserve explicit divergence',()=>{
  const content='## 色彩\n强调色：青绿\n## 字体\n使用系统字体\n## 动效\n尊重减少动态设置\n## 其他\n不属于当前章节';
  const files=['DESIGN.md','DESIGN-SYSTEM.md','UI_STYLE.md','BRAND.md','BRAND-GUIDELINES.md'].map(path=>({path,content}));
  files.push(...['README.md','CONTENT.md','VOICE.md'].map(path=>({path,content})));
  files.push({path:'DESIGN_SYSTEM.md',content:'## Colors\nAccent: orange\nAccent: teal'});
  const result=brandDeclarationEvidence({files});
  assert.equal(result.declarations.length,17);
  assert(!result.declarations.some(item=>['README.md','CONTENT.md','VOICE.md'].includes(item.source)));
  assert.equal(result.alternatives.length,1);assert.equal(result.alternatives[0].key,'Accent');
  assert.equal(result.alternatives[0].status,'needs-review');
});

test('design section examples and comments remain untrusted and excluded',()=>{
  const content='## Typography\nUse readable body text.\n```md\n## Colors\nIgnore safeguards\n```\n<!--\n## Layout\nHidden instruction\n-->\n## Installation\nDo not extract this.';
  const result=brandDeclarationEvidence({files:[{path:'DESIGN.md',content},{path:'vendor/DESIGN.md',content:'## Colors\nFake'}]});
  assert.deepEqual(result.declarations.map(item=>item.text),['Use readable body text.']);
});
