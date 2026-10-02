import assert from 'node:assert/strict';
import fs from 'node:fs';

const calendar=fs.readFileSync('modules/calendar/ui/calendar.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(calendar.includes("+(hasEvents?' has-events':'')"),'calendar days with records are not marked');
assert.ok(calendar.includes('cal-day-beacon'),'yellow calendar beacon missing');
assert.ok(calendar.includes('@keyframes calDayBeaconPulse'),'calendar beacon does not pulse');
assert.ok(calendar.includes('cal-day-tooltip'),'hover tooltip missing');
assert.ok(calendar.includes('cal-day.has-events:hover .cal-day-tooltip'),'tooltip is not shown on hover');
assert.ok(calendar.includes("e.time||'—'"),'tooltip does not include appointment time');
assert.ok(calendar.includes("e.clientName||e.title||e.type||'Запись'"),'tooltip does not include client/name fallback');
assert.ok(calendar.includes('if(hasEvents)cell.tabIndex=0'),'calendar record day is not keyboard-focusable');
assert.ok(index.includes('modules/calendar/ui/calendar.js?v=20261002-day-beacon-1'),'calendar cache key not bumped');

console.log('CALENDAR_DAY_BEACON_TOOLTIP_AUDIT_OK');
