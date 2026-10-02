import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('modules/header/flip-clock.css','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(index.includes('<span class="app-title-text"><span>Психологическая</span><span>диагностика</span></span>'),'two-line app title missing');
assert.ok(css.includes('.app-title-text'),'compact title styling missing');
assert.ok(css.includes('font-size:18px'),'title is not compact');
assert.ok(css.includes('grid-template-columns:68px 14px 68px'),'clock cards are not symmetric');
assert.ok(css.includes('height:50px'),'clock outer case height is not enlarged');
assert.ok(css.includes('height:38px'),'clock inner card height changed unexpectedly');
assert.ok(css.includes('padding:5px 10px'),'clock outer case padding is not enlarged');
assert.ok(css.includes("font:700 27px/38px 'Segoe UI',Arial,sans-serif"),'clock digits are not enlarged');
assert.ok(css.includes('animation:headerColonBlink 1s steps(1,end) infinite'),'clock colon animation missing');
assert.ok(css.includes('@keyframes headerColonBlink'),'clock colon keyframes missing');
assert.ok(css.includes('gap:10px!important'),'right header controls do not have unified spacing');
assert.ok(css.includes('.header-utility-group')&&css.includes('margin-right:0!important'),'utility-group extra margin still remains');
assert.ok(css.includes('.quick-notes-wrap')&&css.includes('margin-right:0!important'),'notes extra margin still remains');
assert.ok(css.includes('@media(max-width:1180px)'),'clock responsive threshold was not updated');
assert.ok(index.includes('modules/header/flip-clock.css?v=20261003-clock-colon-1'),'clock CSS cache key missing');

console.log('UNIFIED_HEADER_LAYOUT_AUDIT_OK');
