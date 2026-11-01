'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const extra=read('free-consultation-extra-fields.js');
const archive=read('free-consultation-archive.js');
const sync=read('free-consultation-client-card-sync.js');
const settings=read('modules/ai/ui/settings.js');
const index=read('index.html');

// The source of the flicker was two scripts continuously inserting/removing
// the legacy attempt fields on childList mutations caused by typing.
assert.ok(!extra.includes('observe(document.body'), 'Legacy fields must not observe the entire document');
assert.ok(!archive.includes('observe(document.body'), 'Archive must not observe the entire document');
assert.ok(!extra.includes("if(!grid.querySelector('.fc-tried'))"), 'Never recreate legacy live fields');
assert.ok(!extra.includes('function persistCurrent('), 'Legacy extra module must not save live fields');
assert.ok(!extra.includes('wrapAiGenerator'), 'Legacy module must not wrap the AI generator');
assert.ok(extra.includes("removeDuplicateFields()"), 'Remove stale fields on consultation open');
assert.ok(extra.includes('observe(editor,{childList:true})'), 'Archive changes must be observed locally');
assert.ok(sync.includes("grid.querySelectorAll('.fc-extra-fields-fragment')"), 'Remove complete legacy wrapper');
assert.ok(sync.includes('migrateConsultationFields(fc)'), 'Historical attempts must still migrate');
assert.ok(archive.includes("['context','История клиента / контекст']"), 'Archive client context');
assert.ok(archive.includes("['attempts','Что пробовал / что сработало / что не сработало']"), 'Archive combined attempts');
assert.ok(settings.includes('free-consultation-extra-fields.js?v=20261101-no-duplicate-fields-1'), 'Bust legacy module cache');
assert.ok(index.includes('modules/ai/ui/settings.js?v=20261101-fc-flicker-rootfix-1'), 'Bust loader cache');

console.log('Free consultation field lifecycle checks passed.');
