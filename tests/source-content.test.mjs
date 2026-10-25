import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceContent} from '../packages/skill-core/source-content.js';
import {runHandler} from '../packages/skill-core/handlers.js';

test('ordinary HTML retains its source while bundle markers without a template remain unavailable', () => {
  const normal={path:'page.html',content:'<body>default loading</body>'};
  assert.deepEqual(sourceContent(normal),{content:normal.content,location:null});
  for(const type of ['manifest','ext_resources']){
    const decoded=sourceContent({path:'bundle.html',content:'<script>/* pending failed */</script>\n<script type="__bundler/'+type+'">{}</script>'});
    assert.equal(decoded.content,'');
    assert.match(decoded.error,/no readable JSON template/);
    assert.equal(decoded.location.containerLine,2);
  }
});

test('template content is parsed as JSON without executing it or using sibling resource text', () => {
  const template='<body><script>throw new Error("never execute")</script>default</body>';
  const file={path:'bundle.html',content:'<script type="__bundler/manifest">{"text":"pending"}</script>\n<script type="__bundler/template">'+JSON.stringify(template).replaceAll('<','\\u003c')+'</script>'};
  const decoded=sourceContent(file);
  assert.equal(decoded.content,template);
  assert.equal(decoded.location.coordinates,'decoded-template-lines');
  assert.equal(decoded.location.containerLine,2);
  assert.equal(decoded.error,undefined);
});

test('unreadable or missing bundle templates keep all source inventory handlers at needs-evidence', async () => {
  for(const content of ['<script type="__bundler/manifest">{}</script>','<script type="__bundler/template">{broken}</script>']){
    const sourceSnapshot={files:[{path:'bundle.html',content}],truncated:false};
    for(const handler of ['foundationExtractor','componentInventory','brandFoundationExtractor']){
      const result=await runHandler(handler,{repo:'synthetic',sourceSnapshot,spec:{project:{}},run:{manifest:{captures:{before:{viewports:{desktop:{screenshot:'synthetic-only.png',dom:{h1:[]}}}}}}}});
      assert.equal(result.status,'needs-evidence',handler);
      assert.ok(result.evidence.some(item=>item.parseErrors?.length || item.sourceErrors?.length),handler);
    }
  }
});
