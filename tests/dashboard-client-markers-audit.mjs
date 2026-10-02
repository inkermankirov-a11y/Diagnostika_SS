import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('home-dashboard.js','utf8');
const css=fs.readFileSync('home-dashboard.css','utf8');
const loader=fs.readFileSync('app-loader.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(js.includes('function nextInteractionTime(c)'),'next client interaction calculation missing');
assert.ok(js.includes('function hasUpcomingInteraction(c,days=7)'),'upcoming client interaction calculation missing');
assert.ok(js.includes('calendarApi()?.forClient')||js.includes('api?.forClient?.(c.id)'),'calendar client events are not used for the yellow indicator');
assert.ok(js.includes('function calendarEventStartTime(event)'),'calendar date/time parsing missing');
assert.ok(js.includes('time>=now&&time<limit'),'upcoming-session window must be less than seven days');
assert.ok(js.includes("row.classList.toggle('new-client',newClient)"),'new-client row marker missing');
assert.ok(js.includes('return !sessions.some(session=>'),'new-client marker must remain until the first session actually starts');
assert.equal(js.includes('hd-new-client-dot'),false,'old blinking green new-client dot returned');
assert.ok(js.includes('hd-upcoming-session-dot'),'yellow upcoming-session indicator missing');
assert.ok(js.includes("'session:created','session:updated','session:deleted'"),'session lifecycle does not refresh client markers');
assert.ok(js.includes("'calendar:event-created','calendar:event-updated','calendar:event-deleted','calendar:events-replaced'"),'calendar lifecycle does not refresh client markers');
assert.ok(css.includes('.hd-client-row.new-client::after'),'static green new-client bar missing');
assert.equal(css.includes('hdNewClientPulse'),false,'green new-client marker must not blink');
assert.ok(css.includes('@keyframes hdUpcomingSessionPulse'),'yellow upcoming-session pulse missing');
assert.ok(css.includes('.hd-client-pin-cell'),'fixed pin alignment cell missing');
assert.ok(css.includes('.hd-client-status-cell'),'fixed status alignment cell missing');
assert.ok(css.includes('padding-right:10px'),'client list is still too close to its scrollbar');
assert.ok(loader.includes('home-dashboard.css?v=20261002-client-markers-1'),'dashboard CSS cache key missing');
assert.ok(js.includes("if(a.pinned!==b.pinned)return a.pinned?-1:1"),'pinned and unpinned groups are not kept separate');
assert.ok(js.includes('if(a.nextAt!==b.nextAt)return a.nextAt-b.nextAt'),'clients are not ordered by nearest upcoming interaction inside each group');
assert.ok(js.includes('if(a.pinned&&a.pinRank!==b.pinRank)return a.pinRank-b.pinRank'),'pin order fallback missing');
assert.ok(loader.includes('home-dashboard.js?v=20261002-next-meeting-sort-1'),'dashboard JS cache key missing');
assert.ok(index.includes('app-loader.js?v=20261002-next-meeting-sort-1'),'app-loader cache key missing');

console.log('DASHBOARD_CLIENT_MARKERS_AUDIT_OK');
