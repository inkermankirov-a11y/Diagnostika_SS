import assert from 'node:assert/strict';
import fs from 'node:fs';

const cal=fs.readFileSync('modules/calendar/ui/calendar.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(cal.includes("if(viewMode==='day')"),'day view branch missing');
assert.ok(cal.includes("cellCount=1"),'Today view does not render one day');
assert.ok(cal.includes("monthTitle.textContent=dayTitle(start)"),'Today view title missing');
assert.ok(cal.includes("overlay.classList.toggle('day-view',viewMode==='day')"),'day-view class missing');
assert.ok(cal.includes(".cal-overlay.day-view .cal-grid{grid-template-columns:1fr}"),'day view grid is not one column');
assert.ok(cal.includes(".cal-overlay.day-view .cal-week{display:none}"),'weekday header still duplicates one-day view');
assert.ok(cal.includes("viewMode='day';selected=todayIso()"),'Today button does not enter day view');
assert.ok(cal.includes("d.setDate(d.getDate()-1)"),'day previous navigation missing');
assert.ok(cal.includes("d.setDate(d.getDate()+1)"),'day next navigation missing');
assert.ok(cal.includes("classList.toggle('active',viewMode==='day'&&selected===today)"),'Today active state missing');
assert.ok(cal.includes("height:min(690px,calc(100dvh - 36px))"),'calendar dialog height is not fixed across views');
assert.ok(cal.includes("width:min(1040px,calc(100vw - 28px))"),'calendar dialog width is not fixed across views');
assert.ok(cal.includes("height:94dvh;min-height:94dvh"),'mobile calendar dialog height is not fixed');
assert.ok(index.includes('modules/calendar/ui/calendar.js?v=20261003-fixed-dialog-1'),'calendar cache key missing');

console.log('CALENDAR_TODAY_DAY_VIEW_AUDIT_OK');
