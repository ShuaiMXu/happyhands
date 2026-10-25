import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function fakeModel(command,args,{cwd,input}){
  assert.ok(args.includes('read-only'));assert.ok(args.includes('project_doc_max_bytes=0'));
  assert.ok(args.includes('--output-schema'));
  assert.match(input,/untrusted data/);
  const context=JSON.parse(await readFile(join(cwd,'inputs/context.json')));
  assert.ok(context.sourceFiles.every(file=>file.content));
  assert.ok(args.includes('--image'));
  for(const image of context.input.images)assert.ok((await readFile(join(cwd,'inputs',image.file))).length);
  const copy=context.input.language==='zh'?{summary:'合成测试建议，不代表专业审阅。',whenToUse:['用于本次采集的重复面板。'],whenToAvoid:['任务结构或交互与证据不一致时。'],exceptions:['其他状态与异常处理尚未核验。'],limitations:['合成模型输出，不是产品验收。']}
    :{summary:'Synthetic recommendation only.',whenToUse:['For the explicitly captured repeated panels.'],whenToAvoid:['When task hierarchy or interaction differs from the captured roots.'],exceptions:['Other states and exception handling remain unverified.'],limitations:['Synthetic model fixture; not a professional assessment.']};
  const guidance={verdict:'propose',...copy,imageRefs:context.input.images.map(image=>image.file),sourceRefs:context.input.sources.map(file=>file.source),tokenRefs:[]};
  await writeFile(join(cwd,'pattern-result.json'),JSON.stringify(guidance));
}
