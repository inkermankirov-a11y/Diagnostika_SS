import assert from 'node:assert/strict';
import fs from 'node:fs';

const home=fs.readFileSync('home-dashboard.js','utf8');
const css=fs.readFileSync('home-dashboard.css','utf8');
const loader=fs.readFileSync('app-loader.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(home.includes("dashboard.className='home-dashboard dashboard-home-mode'"),'dashboard does not start in home mode');
assert.ok(home.includes('id="hdHomeView"'),'home center view missing');
assert.ok(home.includes('id="hdTodayList"'),'today schedule missing');
assert.ok(home.includes('id="hdUpcomingList"'),'upcoming schedule missing');
assert.ok(home.includes('id="hdAttention"'),'attention block missing');
assert.ok(home.includes('id="hdRecentClients"'),'recent clients block missing');
assert.ok(home.includes("let dashboardView='home'"),'explicit home/client view state missing');
assert.ok(home.includes("clientFilter=button.dataset.filter"),'attention cards do not connect to client filters');
assert.ok(home.includes("dashboardView='client'"),'client selection does not enter client mode');
assert.ok(home.includes("detail?.source!=='last-client-restore'"),'last-client restore can still force the startup client screen');
assert.ok(home.includes("homeTrigger.onclick=showHome"),'header title does not return to home');
assert.ok(home.includes("window.DiagnostikaHomeDashboard={refresh,renderClients,openCard,openClientDatabase,showHome"),'home navigation is not exposed');
assert.ok(css.includes('.dashboard-home-mode .hd-client-only'),'client widgets are not isolated from home mode');
assert.ok(css.includes('.dashboard-client-mode .hd-home-only'),'home widgets are not isolated from client mode');
assert.ok(css.includes('.hd-home-view'),'home screen styles missing');
assert.ok(loader.includes('home-dashboard.css?v=20261002-home-screen-1'),'dashboard CSS cache key missing');
assert.ok(loader.includes('home-dashboard.js?v=20261002-home-screen-1'),'dashboard JS cache key missing');
assert.ok(index.includes('app-loader.js?v=20261002-home-screen-1'),'app loader cache key missing');

console.log('DASHBOARD_HOME_SCREEN_AUDIT_OK');
