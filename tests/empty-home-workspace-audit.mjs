import assert from 'node:assert/strict';
import fs from 'node:fs';

const home=fs.readFileSync('home-dashboard.js','utf8');
const css=fs.readFileSync('home-dashboard.css','utf8');
const loader=fs.readFileSync('app-loader.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(home.includes('<div id="hdHomeView" class="hd-home-view" aria-label="Главная"></div>'),'empty home canvas missing');
assert.equal(home.includes('hdHomeCalendar'),false,'duplicate home calendar control remains');
assert.equal(home.includes('hdHomeNotes'),false,'duplicate home notes control remains');
assert.equal(home.includes('hdHomeNext'),false,'duplicate next-meeting home widget remains');
assert.equal(home.includes('id="hdTodayList"'),false,'Today block still remains on home');
assert.equal(home.includes('id="hdUpcomingList"'),false,'Upcoming block still remains on home');
assert.equal(home.includes('id="hdAttention"'),false,'Attention block still remains on home');
assert.equal(home.includes('id="hdRecentClients"'),false,'Recent clients block still remains on home');
assert.equal(home.includes('function renderHome()'),false,'home content renderer remains');
assert.ok(home.includes("homeTrigger.onclick=showHome"),'header title home navigation was removed');
assert.ok(home.includes("if(dashboardView==='client')renderHero();"),'client view rendering is not preserved');
assert.ok(home.includes('id="hdOpenNotes"'),'client notes widget was removed');
assert.ok(home.includes('id="hdPlanBtn"'),'client AI/next-step slot was removed');
assert.ok(css.includes('.dashboard-home-mode .hd-client-only,.dashboard-home-mode #hdClientAiWidget{display:none!important}'),'client widgets are not hidden on home');
assert.ok(loader.includes('home-dashboard.css?v=20261003-empty-home-1'),'dashboard CSS cache key missing');
assert.ok(loader.includes('home-dashboard.js?v=20261003-empty-home-1'),'dashboard JS cache key missing');
assert.ok(index.includes('app-loader.js?v=20261003-empty-home-1'),'app-loader cache key missing');

console.log('EMPTY_HOME_WORKSPACE_AUDIT_OK');
