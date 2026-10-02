import assert from 'node:assert/strict';
import fs from 'node:fs';

const header=fs.readFileSync('header-utilities.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(header.includes("id='headerFlipClockWrap'")||header.includes("clockWrap.id='headerFlipClockWrap'"),'flip clock container missing');
assert.ok(header.includes("buildFlipPanel('hours')"),'hour flip panel missing');
assert.ok(header.includes("buildFlipPanel('minutes')"),'minute flip panel missing');
assert.ok(header.includes('@keyframes headerFlipTop'),'top flip animation missing');
assert.ok(header.includes('@keyframes headerFlipBottom'),'bottom flip animation missing');
assert.ok(header.includes("String(now.getHours()).padStart(2,'0')"),'hours are not local browser time');
assert.ok(header.includes("String(now.getMinutes()).padStart(2,'0')"),'minutes are not local browser time');
assert.ok(header.includes("minute!==flipClockMinute"),'clock does not update on minute change');
assert.ok(header.includes("clockWrap.hidden=available<185"),'clock overlap protection missing');
assert.ok(index.includes('header-utilities.js?v=20261002-flip-clock-1'),'header utility cache key missing');

console.log('HEADER_FLIP_CLOCK_AUDIT_OK');
