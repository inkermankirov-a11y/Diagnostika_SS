import fs from 'node:fs';
import assert from 'node:assert/strict';

const view=fs.readFileSync('client-ai-chat-view.js','utf8');
const css=fs.readFileSync('home-dashboard.css','utf8');
const index=fs.readFileSync('index.html','utf8');

new Function(view);

assert(view.includes('hd-ai-hints-menu-portal'),'Hints portal class missing');
assert(view.includes('document.body.appendChild(menu)'),'Hints menu is not portaled to body');
assert(view.includes('function positionHintsMenu(btn,menu)'),'Hints viewport positioning missing');
assert(view.includes('function hideHintsMenu()'),'Hints menu cleanup missing');
assert(css.includes('width:350px!important'),'Right column width is not fixed');
assert(css.includes('min-width:350px!important'),'Right column can still shrink');
assert(css.includes('height:190px!important'),'AI message area can still collapse');
assert(css.includes('min-height:395px!important'),'AI card can still cut off its footer/input controls');
assert(css.includes('grid-template-rows:max-content max-content!important'),'Right column can still compress the AI card');
assert(css.includes('min-width:760px'),'Very narrow desktop layout can still stack/collapse');
assert(index.includes('client-ai-chat-view.js?v=20261003-compact-expanded-6'),'AI view cache key missing');
assert(view.includes('width:min(880px,calc(100vw - 56px))!important'),'Expanded AI dialog is not compact');
assert(view.includes('max-width:880px!important'),'Expanded AI dialog can still stretch full-width');
assert(!view.includes('diagnostika-client-ai-chat-expanded-v1'),'Expanded AI state is still persisted');
assert(view.includes('setExpanded(false);'),'AI does not default to collapsed state');

console.log('CLIENT_AI_FIXED_COLUMN_AUDIT_OK');
