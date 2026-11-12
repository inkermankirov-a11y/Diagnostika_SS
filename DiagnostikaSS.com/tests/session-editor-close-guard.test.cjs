'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const editor=read('modules/sessions/ui/editor.js');
const rich=read('session-rich-editor.js');
const drafts=read('edit-draft-protection.js');
const index=read('index.html');

test('session close is determined by a pristine form snapshot, not old drafts',()=>{
  assert.match(editor,/const hasUnsavedChanges=\(\)=>initialSnapshot!==null&&snapshot\(\)!==initialSnapshot/);
  assert.match(editor,/if\(!hasUnsavedChanges\(\)\)\{/);
  assert.match(editor,/initialSnapshot=snapshot\(\)/);
  assert.match(editor,/window\.AppDialog\?\.savePrompt/);
  assert.doesNotMatch(editor,/window\.confirm\('Сохранить изменения перед выходом/);
});
test('rich editor only prompts on real markup edits, and never normalizes pristine content on Apply',()=>{
  assert.match(rich,/const hasChanges=\(\)=>cleanHtml\(editor\.innerHTML\)!==initialHtml/);
  assert.match(rich,/if\(!hasChanges\(\)\)\{/);
  assert.match(rich,/window\.AppDialog\?\.savePrompt/);
  assert.doesNotMatch(rich,/window\.confirm\('Закрыть редактор/);
});
test('generic draft protection tracks changed fields, not existence of previous draft',()=>{
  assert.match(drafts,/const modified=new WeakSet\(\)/);
  assert.match(drafts,/return modified\.has\(el\)/);
  assert.match(drafts,/const live=\[\.\.\.document\.querySelectorAll\(selector\)\]\.some\(el=>modified\.has\(el\)\)/);
  assert.doesNotMatch(drafts,/window\.confirm\(/);
});
test('browser receives cache-busted scripts for editor close fix',()=>{
  assert.match(index,/edit-draft-protection\.js\?v=20261112-dialog-dirty-fix-1/);
  assert.match(index,/session-rich-editor\.js\?v=20261112-dialog-dirty-fix-1/);
  assert.match(index,/modules\/sessions\/ui\/editor\.js\?v=20261112-dialog-dirty-fix-1/);
});
