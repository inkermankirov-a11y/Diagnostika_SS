import assert from 'node:assert/strict';
import fs from 'node:fs';

const cal=fs.readFileSync('modules/calendar/ui/calendar.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(cal.includes("if(viewMode==='day')return [new Date(selected+'T12:00:00')]"),'day view does not build a single time-grid day');
assert.ok(cal.includes("monthTitle.textContent=viewMode==='day'?dayTitle(start):weekTitle(start)"),'day/week title logic missing');
assert.ok(cal.includes("overlay.classList.toggle('day-view',viewMode==='day')"),'day-view class missing');
assert.ok(cal.includes(".cal-overlay.week-view .cal-week,.cal-overlay.day-view .cal-week{display:none}"),'legacy weekday strip is not hidden for time-grid views');
assert.ok(cal.includes(".cal-timegrid{height:474px"),'Google-style time grid missing');
assert.ok(cal.includes(".cal-time-column{position:relative"),'time-grid day columns missing');
assert.ok(cal.includes(".cal-time-event{position:absolute"),'positioned calendar events missing');
assert.ok(cal.includes(".cal-now-line"),'current-time indicator missing');
assert.ok(cal.includes("repeat(${days.length},minmax(0,1fr))"),'week/day columns are not generated dynamically');
assert.ok(cal.includes("const snapped=Math.round(raw/15)*15"),'time-grid click does not snap to 15 minutes');
assert.ok(cal.includes('const TIME_GRID_START=0'),'time grid does not start at midnight');
assert.ok(cal.includes('const TIME_GRID_END=24'),'time grid does not cover the full 24-hour day');
assert.ok(cal.includes('for(let hour=TIME_GRID_START;hour<TIME_GRID_END;hour++)'),'time labels do not cover 00:00–23:00');
assert.ok(cal.includes("scroll.scrollTop=0"),'week/day views do not open at midnight');
assert.ok(cal.includes("head.style.paddingRight=scrollbarWidth+'px'"),'time-grid header is not aligned with scrollbar width');
assert.ok(cal.includes("font-size:13px;font-weight:700"),'time labels are not readable enough');
assert.ok(cal.includes("height:58px!important"),'time-grid day headers are not normalized');
assert.ok(cal.includes("gridTemplateColumns=`64px repeat(${days.length},minmax(0,1fr))`"),'time axis is not wide enough for readable labels');
assert.ok(cal.includes("viewMode='day';selected=todayIso()"),'Today button does not enter day view');
assert.ok(cal.includes("d.setDate(d.getDate()-1)"),'day previous navigation missing');
assert.ok(cal.includes("d.setDate(d.getDate()+1)"),'day next navigation missing');
assert.ok(cal.includes("classList.toggle('active',viewMode==='day'&&selected===today)"),'Today active state missing');
assert.ok(cal.includes("height:min(690px,calc(100dvh - 36px))"),'calendar dialog height is not fixed across views');
assert.ok(cal.includes("width:min(1040px,calc(100vw - 28px))"),'calendar dialog width is not fixed across views');
assert.ok(cal.includes("height:94dvh;min-height:94dvh"),'mobile calendar dialog height is not fixed');
assert.ok(index.includes('modules/calendar/ui/calendar.js?v=20261003-timegrid-readable-1'),'calendar cache key missing');

console.log('CALENDAR_TODAY_DAY_VIEW_AUDIT_OK');
