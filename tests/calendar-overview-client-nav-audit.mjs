import assert from 'node:assert/strict';
import fs from 'node:fs';

const calendar=fs.readFileSync('modules/calendar/ui/calendar.js','utf8');
const header=fs.readFileSync('header-utilities.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(header.includes("DiagnostikaCalendar.open({mode:'overview'})"),'header calendar does not open overview mode');
assert.ok(calendar.includes("btn.onclick=()=>openCalendar({mode:'client'})"),'client card calendar does not open client mode');
assert.ok(calendar.includes("openMode=options?.mode==='overview'?'overview':'client'"),'calendar open mode switch missing');
assert.ok(calendar.includes("cal-overlay.overview-mode .cal-form{display:none}"),'overview still shows assignment form by default');
assert.ok(calendar.includes('cal-quick-assign'),'overview quick assignment button missing');
assert.ok(calendar.includes("assignOpen=!assignOpen"),'quick assignment toggle missing');
assert.ok(calendar.includes('cal-view-month')&&calendar.includes('cal-view-week'),'month/week overview switch missing');
assert.ok(calendar.includes("viewMode==='week'"),'week calendar rendering missing');
assert.ok(calendar.includes('weekTitle(start)'),'week range title missing');
assert.ok(calendar.includes('clientAvatarHtml(c)'),'tooltip avatar source missing');
assert.ok(calendar.includes("api.select(clientId,{source:'calendar-tooltip-open-client'})"),'tooltip client navigation does not select client');
assert.ok(calendar.includes("shell?.setMode?.('card')"),'tooltip client navigation does not return to the client dashboard');
assert.ok(calendar.includes('shell?.renderMode?.()'),'tooltip client navigation does not render dashboard mode');
assert.ok(calendar.includes("document.getElementById('clientCardDialog')"),'client navigation does not close an open client card');
assert.ok(index.includes('modules/calendar/ui/calendar.js?v=20261002-overview-clientnav-1'),'calendar cache key missing');
assert.ok(index.includes('header-utilities.js?v=20261002-calendar-overview-1'),'header cache key missing');

console.log('CALENDAR_OVERVIEW_CLIENT_NAV_AUDIT_OK');
