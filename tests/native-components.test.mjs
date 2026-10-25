import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryComponents } from '../packages/skill-core/components.js';

test('native UI discovery follows relative script references and excludes fixtures and utility scripts', () => {
  const components = inventoryComponents([
    {path:'web/index.html',content:'<script src="./ui-dialog.js?v=2"></script><script src="request.js"></script><script src="https://other/ui.js"></script>'},
    {path:'web/ui-dialog.js',content:'window.Confirm = () => document.createElement("dialog");'},
    {path:'web/request.js',content:'window.Request = () => fetch("/api");'},
    {path:'web/unused.js',content:'document.createElement("button");'},
    {path:'tests/components/Fake.js',content:'export const Fake = () => null;'}
  ]);
  assert.equal(components.length,1);
  assert.equal(components[0].source,'web/ui-dialog.js');
  assert.deepEqual(components[0].consumers,['web/index.html']);
  assert.deepEqual(components[0].exports,['Confirm']);
  assert.equal(components[0].status,'observed');
});

test('native loader manifests provide candidates without claiming runtime verification', () => {
  const components = inventoryComponents([
    {path:'web/layout.html',content:'const files=["task-sidebar.js"];document.createElement("script");'},
    {path:'web/task-sidebar.js',content:'window.TaskSidebar={render(){ host.innerHTML="<aside></aside>"; }};'},
    {path:'web/notes.html',content:'"task-sidebar.js" is a filename in documentation.'}
  ]);
  assert.deepEqual(components[0].consumers,['web/layout.html']);
  assert.equal(components[0].kind,'native-ui-module');
});
