'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const js=read('home-dashboard.js');
const css=read('home-dashboard.css');
const loader=read('app-loader.js');
const html=read('index.html');
const begin=js.indexOf('  function isUrgentSessionTime(');
const end=js.indexOf('  function upcomingInteractionLabel(',begin);
assert.ok(begin!==-1&&end>begin,'Urgency decision function missing');
const urgent=vm.runInNewContext(js.slice(begin,end)+'; isUrgentSessionTime;');

test('session beacon is urgent for today and tomorrow in local calendar time',()=>{
  const now=new Date(2026,10,18,17,4).getTime();
  assert.equal(urgent(new Date(2026,10,18,18,0).getTime(),now),true);
  assert.equal(urgent(new Date(2026,10,19,0,0).getTime(),now),true);
  assert.equal(urgent(new Date(2026,10,19,23,59).getTime(),now),true);
  assert.equal(urgent(new Date(2026,10,20,0,0).getTime(),now),false);
  assert.equal(urgent(new Date(2026,10,18,17,0).getTime(),now),false);
  assert.equal(urgent(NaN,now),false);
});
test('same session turns red after midnight without rolling 48-hour interpretation',()=>{
  const appointment=new Date(2026,10,19,10,0).getTime();
  assert.equal(urgent(appointment,new Date(2026,10,17,23,59).getTime()),false);
  assert.equal(urgent(appointment,new Date(2026,10,18,0,1).getTime()),true);
});
test('red urgency applies only to imminent session events, not other beacon kinds',()=>{
  assert.match(js,/upcomingKind==='session'&&isUrgentSessionTime\(upcomingInfo\.time\)/);
  assert.match(js,/urgentSession\?' is-urgent':''/);
  assert.match(css,/\.hd-upcoming-session-dot\.is-session\.is-urgent\{/);
  assert.match(css,/--hd-beacon:#f04452/);
  assert.match(css,/\.hd-upcoming-session-dot\.is-diagnosis\{--hd-beacon:#f4b72a/);
  assert.match(css,/\.hd-upcoming-session-dot\.is-reminder\{--hd-beacon:#8b5cf6/);
});
test('urgency refreshes in place without unnecessary re-rendering',()=>{
  assert.match(js,/dot\.classList\.toggle\('is-urgent',isUrgentSessionTime\(time\)\)/);
  assert.match(js,/if\(elapsed&&!consultationDialogOpen\(\)\)renderClients\(\)/);
  assert.match(js,/},60000\);/);
});
test('deployed dashboard code uses new cache markers',()=>{
  assert.match(loader,/home-dashboard\.css\?v=20261118-numbered-tooltip-1/);
  assert.match(loader,/home-dashboard\.js\?v=20261118-numbered-tooltip-1/);
  assert.match(html,/app-loader\.js\?v=20261118-numbered-events-1/);
});
