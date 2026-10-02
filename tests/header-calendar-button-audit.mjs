import assert from 'node:assert/strict';
import fs from 'node:fs';

const header=fs.readFileSync('header-utilities.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(header.includes('id="headerCalendarBtn"'),'header calendar button missing');
assert.ok(header.indexOf('id="headerWeatherBtn"') < header.indexOf('id="headerCalendarBtn"'),'calendar must be after weather');
assert.ok(header.indexOf('id="headerCalendarBtn"') < header.indexOf('id="headerCurrencyBtn"'),'calendar must be before currency');
assert.ok(header.includes("typeof window.DiagnostikaCalendar?.open==='function'"),'calendar public API is not used');
assert.ok(header.includes('window.DiagnostikaCalendar.open()'),'calendar button does not open existing calendar');
assert.ok(header.includes("typeof window.DiagnostikaCalendarUI?.open==='function'"),'calendar UI fallback missing');
assert.ok(header.includes("document.getElementById('ccCalendarBtn')"),'client-card calendar fallback missing');
assert.ok(index.includes('header-utilities.js?v=20261002-header-calendar-1'),'header utilities cache key not bumped');

console.log('HEADER_CALENDAR_BUTTON_AUDIT_OK');
