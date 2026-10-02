import assert from 'node:assert/strict';
import fs from 'node:fs';

const utilities=fs.readFileSync('header-utilities.js','utf8');
const clock=fs.readFileSync('modules/header/flip-clock.js','utf8');
const css=fs.readFileSync('modules/header/flip-clock.css','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.equal(utilities.includes('headerFlipClockWrap'),false,'clock still coupled to header utilities');
assert.equal(utilities.includes('syncFlipClockVisibility'),false,'old one-shot clock hiding logic remains');
assert.ok(clock.includes("wrap.id='headerFlipClockWrap'"),'clock module container missing');
assert.ok(clock.includes("appHeader.insertBefore(wrap,headerButtons)"),'clock is not inserted into dedicated middle slot');
assert.ok(clock.includes("window.DiagnostikaHeaderFlipClock=Object.freeze"),'clock module public facade missing');
assert.ok(clock.includes("String(now.getHours()).padStart(2,'0')"),'clock hours missing');
assert.ok(clock.includes("String(now.getMinutes()).padStart(2,'0')"),'clock minutes missing');
assert.ok(css.includes('grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important'),'header is not split into three independent zones');
assert.ok(css.includes('.header-flip-clock-wrap'),'clock module CSS missing');
assert.ok(css.includes('@media(max-width:1420px)'),'responsive no-overlap fallback missing');
assert.ok(index.includes('modules/header/flip-clock.css?v=20261002-modular-clock-1'),'clock CSS not loaded');
assert.ok(index.includes('modules/header/flip-clock.js?v=20261002-modular-clock-1'),'clock JS not loaded');
assert.ok(index.indexOf('modules/header/flip-clock.js?v=20261002-modular-clock-1')<index.indexOf('header-utilities.js?v=20261002-clock-extracted-1'),'clock module should initialize independently before header utilities');

console.log('MODULAR_HEADER_FLIP_CLOCK_AUDIT_OK');
