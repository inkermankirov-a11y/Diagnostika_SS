'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const context={window:{}};
vm.runInNewContext(read('session-event-label.js'),context);
const label=context.window.DiagnostikaSessionEventLabel;
const dashboard=read('home-dashboard.js');
const home=read('home-start-workspace.js');
const css=read('home-dashboard.css');
const loader=read('app-loader.js');
const html=read('index.html');

test('generic calendar session receives the number of its own linked client session',()=>{
  const client={id:'client-vika',sessions:[
    {id:'s1',date:'2026-11-10',appointmentType:'Сессия',status:'completed'},
    {id:'s2',date:'2026-11-19',scheduledTime:'19:00',appointmentType:'Сессия',status:'planned',planned:true,calendarEventId:'event2'}
  ]};
  const event={id:'event2',clientId:client.id,type:'Сессия',title:'Сессия',date:'2026-11-19',time:'19:00'};
  assert.equal(label.title(event,client),'Сессия №2');
  assert.equal(label.sessionNumber(event,client),2);
});

test('calendar number is primary source even if the linked session has an older title',()=>{
  const client={id:'c',sessions:[{id:'one',calendarTitle:'Сессия №1',appointmentType:'Сессия'}]};
  assert.equal(label.title({type:'Сессия',title:'Сессия',sessionNumber:4,sessionId:'one'},client),'Сессия №4');
  assert.equal(label.title({type:'Сессия',title:'Сессия №3',sessionId:'one'},client),'Сессия №3');
});

test('multiple clients keep their independent session numbering',()=>{
  const clientA={id:'a',sessions:[
    {id:'a1',appointmentType:'Сессия',date:'2026-01-05'},
    {id:'a2',appointmentType:'Сессия',date:'2026-11-19',scheduledTime:'19:00',calendarEventId:'ea',planned:true}
  ]};
  const clientB={id:'b',sessions:[
    {id:'b1',appointmentType:'Сессия',date:'2026-01-01'},
    {id:'b2',appointmentType:'Диагностика',date:'2026-01-04'},
    {id:'b3',appointmentType:'Сессия',date:'2026-01-06'},
    {id:'b4',appointmentType:'Сессия',date:'2026-11-19',scheduledTime:'19:00',calendarEventId:'eb',planned:true}
  ]};
  assert.equal(label.title({id:'ea',type:'Сессия',title:'Сессия',clientId:'a'},clientA),'Сессия №2');
  assert.equal(label.title({id:'eb',type:'Сессия',title:'Сессия',clientId:'b'},clientB),'Сессия №3');
});

test('unique matching of legacy event date and time recovers session number',()=>{
  const client={sessions:[
    {id:'s1',date:'2026-10-11',appointmentType:'Сессия'},
    {id:'s2',date:'2026-11-19',scheduledTime:'19:00',requestId:'r1',planned:true,appointmentType:'Сессия'}
  ]};
  assert.equal(label.title({type:'Сессия',title:'Сессия',date:'2026-11-19',time:'19:00',requestId:'r1'},client),'Сессия №2');
});

test('ambiguous and non-session events never receive invented numbers',()=>{
  const client={sessions:[
    {id:'s1',date:'2026-11-19',scheduledTime:'19:00',planned:true},
    {id:'s2',date:'2026-11-19',scheduledTime:'19:00',planned:true}
  ]};
  assert.equal(label.title({type:'Сессия',title:'Сессия',date:'2026-11-19',time:'19:00'},client),'Сессия');
  assert.equal(label.title({type:'Напоминание',title:'Проверить документы'},client),'Проверить документы');
  assert.equal(label.title({type:'Диагностика',title:'Диагностика'},client),'Диагностика');
});

test('all dashboard surfaces consume the same resolver and show separate day/time in tooltip',()=>{
  assert.ok(home.includes('window.DiagnostikaSessionEventLabel?.title?.(e.event,c)'));
  assert.ok(dashboard.includes('window.DiagnostikaSessionEventLabel?.title?.(event,client)'));
  assert.ok(dashboard.includes('data-session-title='));
  assert.ok(dashboard.includes('title.textContent=dot.dataset.sessionTitle'));
  assert.ok(dashboard.includes('tooltip.replaceChildren(header,bottom)'));
  assert.match(css,/\.hd-beacon-tooltip-title\{[^}]*font-size:15px/);
  assert.match(css,/\.hd-beacon-tooltip-time\{[^}]*font-size:18px/);
});

test('the current .com build loads the shared resolver before its dashboard',()=>{
  const resolverTag='session-event-label.js?v=20261118-numbered-events-1';
  const loaderTag='app-loader.js?v=20261118-numbered-events-1';
  assert.ok(html.includes(resolverTag));
  assert.ok(html.indexOf(resolverTag)<html.indexOf(loaderTag));
  assert.ok(loader.includes('home-start-workspace.js?v=20261118-numbered-events-1'));
  assert.ok(loader.includes('home-dashboard.js?v=20261118-numbered-tooltip-1'));
  assert.ok(loader.includes('home-dashboard.css?v=20261118-numbered-tooltip-1'));
});