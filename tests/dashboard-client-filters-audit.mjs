import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('home-dashboard.js','utf8');
const css=fs.readFileSync('home-dashboard.css','utf8');
const loader=fs.readFileSync('app-loader.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.equal(js.includes('id="hdAddClient"'),false,'New client button returned to dashboard sidebar');
assert.equal(js.includes("$('#hdAddClient').onclick"),false,'Dashboard still binds removed New client button');
assert.ok(js.includes('data-filter="new"'),'New clients filter missing');
assert.ok(js.includes('data-filter="upcoming"'),'Upcoming clients filter missing');
assert.ok(js.includes('data-filter="unpaid"'),'Unpaid clients filter missing');
assert.ok(js.includes("CLIENT_FILTER_KEY='diagnostika-dashboard-client-filter-v1'"),'Pinned client filter persistence missing');
assert.ok(js.includes("if(clientFilter==='new')return isNewClient(c)"),'New-client filter logic missing');
assert.ok(js.includes("if(clientFilter==='upcoming')return hasUpcomingInteraction(c,7)"),'Upcoming filter logic missing');
assert.ok(js.includes("if(clientFilter==='unpaid')return unpaidSessionCount(c)>0"),'Unpaid filter logic missing');
assert.ok(js.includes("if(!p||typeof p!=='object'||!p.mode)continue"),'Unpaid filter still treats unconfigured payment objects as debt');
assert.ok(js.includes("if(p.mode==='full'||p.mode==='parts')"),'Request-level unpaid modes are not handled');
assert.ok(js.includes("if(total<=0)continue"),'Zero/undefined request price is still treated as debt');
assert.equal(js.includes("'paid' in s.payment"),false,'Technical session paid=false still creates false debt');
assert.ok(js.includes("clientFilter=clientFilter===next?'all':next"),'Filter buttons do not toggle/lock correctly');
assert.ok(css.includes('.hd-client-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))'),'Filter layout missing');
assert.ok(css.includes('.hd-client-filter.active'),'Active filter state styling missing');
assert.ok(loader.includes('home-dashboard.css?v=20261002-client-filters-1'),'dashboard CSS cache key missing');
assert.ok(loader.includes('home-dashboard.js?v=20261002-unpaid-fix-1'),'dashboard JS cache key missing');
assert.ok(index.includes('app-loader.js?v=20261002-unpaid-fix-1'),'app-loader cache key missing');

console.log('DASHBOARD_CLIENT_FILTERS_AUDIT_OK');
