'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'modules/calendar/ui/calendar.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const a=src.indexOf('  function eventActionLabel(');
const b=src.indexOf('  function eventTooltipNote(',a);
assert(a>=0&&b>a,'Session label helper not present');
let client=null;
const {label,display}=vm.runInNewContext(src.slice(a,b)+'; ({label:eventActionLabel,display:calendarEventDisplayTitle});',{
  clientById:()=>client,Number,String
});

test('planned session uses numbered metadata rather than generic type',()=>{
  assert.equal(label({type:'Сессия',title:'Сессия №2',sessionNumber:2}), 'Сессия №2');
  assert.equal(label({type:'Сессия',title:'Сессия',sessionNumber:3}), 'Сессия №3');
  assert.equal(label({type:'Сессия',title:'Сессия №2'}), 'Сессия №2');
});
test('legacy linked session keeps its number when calendar record lacks one',()=>{
  client={sessions:[{id:'s2',calendarEventId:'c2',calendarTitle:'Сессия №2'}]};
  assert.equal(label({id:'c2',clientId:'client',sessionId:'s2',type:'Сессия',title:'Сессия'}),'Сессия №2');
  client=null;
});
test('no invented session number when no reliable metadata exists',()=>{
  assert.equal(label({type:'Сессия',title:'Сессия'}),'Сессия');
  assert.equal(label({type:'Сессия',sessionNumber:-1,title:'Сессия'}),'Сессия');
  assert.equal(label({type:'Сессия',sessionNumber:1.5,title:'Сессия'}),'Сессия');
});
test('other calendar appointment categories are unchanged',()=>{
  assert.equal(label({type:'Диагностика',title:'Диагностика'}),'Диагностика');
  assert.equal(label({type:'Напоминание',title:'Напоминание'}),'Напоминание');
  assert.equal(display({type:'Напоминание',title:'Купить лекарства'}),'Купить лекарства');
});
test('numbered sessions also appear in day details and calendar tooltip',()=>{
  assert.equal(display({type:'Сессия',title:'Сессия №2'}),'Сессия №2');
  assert(src.includes('const action=eventActionLabel(e);'));
  assert(src.includes("esc(calendarEventDisplayTitle(e))"));
  assert(src.includes('class="cal-day-tooltip-action"'));
  assert(index.includes('modules/calendar/ui/calendar.js?v=20261118-session-number-label-1'));
});
