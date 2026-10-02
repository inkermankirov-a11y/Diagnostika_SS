import assert from 'node:assert/strict';
import fs from 'node:fs';

const calendar=fs.readFileSync('modules/calendar/ui/calendar.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(calendar.includes("+(hasEvents?' has-events':'')"),'calendar days with records are not marked');
assert.ok(calendar.includes('cal-day-beacon'),'yellow calendar beacon missing');
assert.ok(calendar.includes('@keyframes calDayBeaconPulse'),'calendar beacon does not pulse');
assert.ok(calendar.includes('cal-day-tooltip'),'hover tooltip missing');
assert.ok(calendar.includes('min-width:300px;max-width:360px'),'hover tooltip is still too small');
assert.ok(calendar.includes('width:42px;height:42px'),'hover tooltip avatar is still too small');
assert.ok(calendar.includes('font-size:13px'),'hover tooltip text is still too small');
assert.ok(calendar.includes('cal-day.has-events:hover .cal-day-tooltip'),'tooltip is not shown on hover');
assert.ok(calendar.includes("e.time||'—'"),'tooltip does not include appointment time');
assert.ok(calendar.includes("e.clientName||e.title||e.type||'Запись'"),'tooltip does not include client/name fallback');
assert.ok(calendar.includes('if(hasEvents)cell.tabIndex=0'),'calendar record day is not keyboard-focusable');
assert.ok(calendar.includes('cal-day-tooltip-avatar'),'calendar tooltip client avatar missing');
assert.ok(calendar.includes('cal-day-tooltip-client-link'),'calendar tooltip client link missing');
assert.ok(calendar.includes('openClientFromCalendar'),'calendar tooltip cannot navigate to a client');
assert.ok(index.includes('modules/calendar/ui/calendar.js?v=20261002-tooltip-large-1'),'calendar cache key not bumped');

console.log('CALENDAR_DAY_BEACON_TOOLTIP_AUDIT_OK');
