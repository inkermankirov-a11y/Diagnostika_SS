import assert from 'node:assert/strict';
import fs from 'node:fs';

const calendar=fs.readFileSync('modules/calendar/ui/calendar.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(calendar.includes('cal-client-time-preview'),'client time preview UI missing');
assert.ok(calendar.includes("fetch('./weather-locations.json?v=20261002-calendar-client-time-1'"),'calendar does not use local timezone catalog');
assert.ok(calendar.includes('function findClientLocation(rows,city,country)'),'country/city timezone resolution missing');
assert.ok(calendar.includes("const localInstant=new Date(date+'T'+time+':00')"),'scheduled local date/time is not converted');
assert.ok(calendar.includes("timeZone:location.timezone"),'scheduled time is not formatted in client timezone');
assert.ok(calendar.includes('clientDayRelation(date,map)'),'next/previous client day indication missing');
assert.ok(calendar.includes('formatOffsetDifference(clientOffset-localOffset)'),'timezone difference indication missing');
assert.ok(calendar.includes("hour>=0&&hour<6?'night':(hour>=22||hour<8?'caution':'ok')"),'late/night scheduling warning missing');
assert.ok(calendar.includes("dateInput.addEventListener('input',updateClientTimePreview)"),'date change does not refresh client time');
assert.ok(calendar.includes("timeInput.addEventListener('input',updateClientTimePreview)"),'time change does not refresh client time');
assert.ok(calendar.includes("clientSelect.addEventListener('change',updateClientTimePreview)"),'client change does not refresh client time');
assert.ok(index.includes('modules/calendar/ui/calendar.js?v=20261002-client-time-preview-1'),'calendar cache key missing');

console.log('CALENDAR_CLIENT_TIME_PREVIEW_AUDIT_OK');
