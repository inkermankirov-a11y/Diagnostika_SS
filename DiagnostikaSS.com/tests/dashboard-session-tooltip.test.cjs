'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const js=read('home-dashboard.js');
const css=read('home-dashboard.css');
const loader=read('app-loader.js');
const html=read('index.html');
const begin=js.indexOf('  function sessionBeaconDay(');
const end=js.indexOf('  function upcomingInteractionLabel(',begin);
assert.ok(begin>0&&end>begin,'Missing relative session day helper');
const format=vm.runInNewContext(js.slice(begin,end)+';sessionBeaconDay;',{Intl,Date});

test('relative day has precise Today and Tomorrow labels',()=>{
  const now=new Date(2026,10,18,22,30);
  const today=format('2026-11-18',now);
  const tomorrow=format('2026-11-19',now);
  assert.equal(today.relative,'Сегодня');
  assert.equal(today.days,0);
  assert.equal(today.weekday,'среда');
  assert.equal(tomorrow.relative,'Завтра');
  assert.equal(tomorrow.days,1);
  assert.equal(tomorrow.weekday,'четверг');
  assert.equal(tomorrow.dateText,'19.11.2026');
});
test('later sessions show weekday rather than ambiguous date only',()=>{
  const now=new Date(2026,10,18);
  assert.equal(format('2026-11-20',now).relative,'Пятница');
  assert.equal(format('2026-11-23',now).relative,'Понедельник');
});
test('date labels automatically update at local midnight without reload',()=>{
  const first=new Date(2026,10,18,23,55);
  const second=new Date(2026,10,19,0,2);
  assert.equal(format('2026-11-19',first).relative,'Завтра');
  assert.equal(format('2026-11-19',second).relative,'Сегодня');
});
test('invalid dates cannot create false today/tomorrow labels',()=>{
  assert.equal(format('2026-02-30',new Date(2026,1,1)),null);
  assert.equal(format('19.11.2026',new Date(2026,10,18)),null);
  assert.equal(format('',new Date(2026,10,18)),null);
});
test('session tooltip renders separate safe date and prominent time',()=>{
  assert.ok(js.includes('data-date='));
  assert.ok(js.includes('data-time='));
  assert.ok(js.includes("upcomingInfo.event?.date||''"));
  assert.ok(js.includes("upcomingInfo.event?.time||''"));
  assert.match(js,/tooltip\.replaceChildren\(heading,dateRow,timeRow\)/);
  assert.match(js,/time\.className='hd-beacon-tooltip-time'/);
  assert.match(js,/day\.textContent=dateInfo\.relative/);
  assert.match(css,/\.hd-beacon-tooltip-time\{[^}]*font:900 20px/);
  assert.match(css,/\.hd-beacon-tooltip-day\{[^}]*font-size:17px/);
  assert.match(css,/\.hd-upcoming-tooltip\.is-session\.is-urgent \.hd-beacon-tooltip-time/);
});
test('tooltip and JS are cache-busted for the .com website',()=>{
  assert.match(loader,/home-dashboard\.css\?v=20261118-relative-day-1/);
  assert.match(loader,/home-dashboard\.js\?v=20261118-relative-day-1/);
  assert.match(html,/app-loader\.js\?v=20261118-relative-day-tooltip-1/);
});