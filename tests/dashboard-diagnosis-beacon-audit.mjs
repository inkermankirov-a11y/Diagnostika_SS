import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('home-dashboard.js','utf8');
const css=fs.readFileSync('home-dashboard.css','utf8');

assert(js.includes("if(type==='диагностика'||title==='диагностика'||/^диагностика №\\d+$/i.test"),'Diagnosis is not mapped to the diagnosis beacon kind');
assert(js.includes("if(kind==='diagnosis')return 'Диагностика';"),'Diagnosis tooltip label is missing');
assert(css.includes('.hd-upcoming-session-dot.is-diagnosis{--hd-beacon:#f4b72a'),'Diagnosis beacon is not yellow');
assert(css.includes('.hd-upcoming-tooltip.is-diagnosis{border-color:#d7b84d'),'Diagnosis tooltip does not use yellow styling');
assert(css.includes('.hd-upcoming-session-dot.is-session{--hd-beacon:#4c8ed9'),'Ordinary session beacon should remain blue');
assert(!css.includes('.hd-upcoming-session-dot.is-diagnosis{--hd-beacon:#94a3b8'),'Diagnosis beacon fell back to neutral gray');

console.log('DIAGNOSIS_BEACON_YELLOW_OK');
