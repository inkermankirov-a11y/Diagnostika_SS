import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('modules/clients/ui/card.js','utf8');
const css=fs.readFileSync('modules/clients/ui/card.css','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(js.includes('id="ccClientTime"'),'client local-time block missing');
assert.ok(js.includes("fetch('./weather-locations.json?v=20261002-client-time-1'"),'client time does not use local location/timezone catalog');
assert.ok(js.includes('function findClientLocation(rows,city,country)'),'city/country timezone resolution missing');
assert.ok(js.includes("timeZone:location.timezone"),'client time is not formatted in client timezone');
assert.ok(js.includes('function timeZoneOffsetMinutes(date,timeZone)'),'timezone difference calculation missing');
assert.ok(js.includes("setInterval(updateClientTime,30000)"),'client clock does not refresh while card is open');
assert.ok(js.includes("q('ccCountry')?.addEventListener('input',updateClientTime)"),'country edit does not refresh client time');
assert.ok(js.includes("q('ccCity')?.addEventListener('input',updateClientTime)"),'city edit does not refresh client time');
assert.ok(js.includes("state=hour>=0&&hour<6?'night':(hour>=22||hour<8?'caution':'ok')"),'late/night client-time warning missing');
assert.ok(css.includes('.cc-client-time-night'),'night warning style missing');
assert.ok(css.includes('.cc-client-time-caution'),'late/early warning style missing');
assert.ok(index.includes('modules/clients/ui/card.css?v=20261003-diagnosis-action-1'),'client card CSS cache key missing');
assert.ok(index.includes('modules/clients/ui/card.js?v=20261003-diagnosis-action-1'),'client card JS cache key missing');

console.log('CLIENT_LOCAL_TIME_AUDIT_OK');
