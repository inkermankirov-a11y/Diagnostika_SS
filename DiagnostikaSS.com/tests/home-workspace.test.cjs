'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'home-start-workspace.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'app-loader.js'),'utf8');
const notes=fs.readFileSync(path.join(root,'quick-notes.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');

function makeBrowser(){
  const listeners={},platformListeners={},store=new Map(),fields=new Map();
  const make=()=>({textContent:'',innerHTML:'',value:'',dataset:{},setAttribute(){},appendChild(){}});
  const $=selector=>{
    if(!fields.has(selector))fields.set(selector,make());
    return fields.get(selector);
  };
  const dashboard={hidden:false,querySelector:$,addEventListener:(n,cb)=>listeners[n]=cb,contains:()=>true};
  const home={innerHTML:'',closest:()=>dashboard},right={children:[],appendChild(node){this.children.push(node);}};
  fields.set('.hd-right',right);
  const document={querySelector:q=>q==='.home-dashboard #hdHomeView'?home:null,
    createElement:make,addEventListener:(n,cb)=>listeners[n]=cb,getElementById:()=>null};
  const localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value))};
  const due=new Date(Date.now()-86400000);
  const upcoming=new Date(Date.now()+3600000);
  const day=x=>[x.getFullYear(),String(x.getMonth()+1).padStart(2,'0'),String(x.getDate()).padStart(2,'0')].join('-');
  const clock=x=>String(x.getHours()).padStart(2,'0')+':'+String(x.getMinutes()).padStart(2,'0');
  const fakeClients=[{id:'client1',name:'Ирина Волкова',requests:[{id:'r1',status:'active'}],sessions:[]}];
  const events=[
    {id:'appointment',clientId:'client1',type:'Сессия',title:'Ирина Волкова: встреча',
      date:day(upcoming),time:clock(upcoming)},
    {id:'reminder',clientId:'client1',type:'Напоминание',title:'Задача для Ирины Волковой',
      date:day(due),time:'09:00'}
  ];
  const savedNotes=[],updateCalls=[];let selected=null,calendarOpened=0,quickOpened=0;
  const window={
    DiagnostikaClients:{list:()=>fakeClients},
    DiagnostikaHomeDashboard:{currentView:()=> 'home',openClient:id=>{selected=id;},addClient(){}},
    DiagnostikaCalendar:{moduleAware:true,list:()=>events,update:(id,patch)=>{
      updateCalls.push(id);Object.assign(events.find(x=>x.id===id),patch);return true;}},
    DiagnostikaPlatform:{events:{on:(name,fn)=>platformListeners[name]=fn}},
    DiagnostikaQuickNotes:{addQuickThought:content=>(savedNotes.push(content),true),openQuickThoughts:()=>{quickOpened++;}},
    DiagnostikaCalendarUI:{open:()=>{calendarOpened++;}},
    addEventListener(){}
  };
  const navigator={clipboard:{writeText:async()=>{}}};
  vm.runInNewContext(source,{window,document,localStorage,navigator,console:{warn(){},error(){}},Date,Intl});
  const click=(action,extra={})=>listeners.click({target:{closest:()=>({dataset:{action,...extra}})}});
  return {window,home,right,$,store,savedNotes,updateCalls,events,click,
    selected:()=>selected,calendarOpened:()=>calendarOpened,quickOpened:()=>quickOpened,platformListeners};
}

test('retains compact top header, two counters, and a compact event section',()=>{
  const x=makeBrowser();
  assert.match(x.home.innerHTML,/Мой рабочий день/);
  assert.match(x.home.innerHTML,/hws-hero-compact/);
  assert.match(x.home.innerHTML,/Ближайшие события/);
  assert.match(x.home.innerHTML,/hws-schedule-header-compact/);
  assert.ok(x.home.innerHTML.indexOf('Мой рабочий день')<x.home.innerHTML.indexOf('hwsMetrics'));
  assert.ok(x.home.innerHTML.indexOf('hwsMetrics')<x.home.innerHTML.indexOf('Ближайшие события'));
  assert.match(x.$('#hwsMetrics').innerHTML,/Встреч сегодня/);
  assert.match(x.$('#hwsMetrics').innerHTML,/Ожидают внимания/);
  assert.doesNotMatch(x.$('#hwsMetrics').innerHTML,/Активных запросов/);
  assert.equal((x.$('#hwsMetrics').innerHTML.match(/hws-metric is-/g)||[]).length,2);
  assert.doesNotMatch(x.home.innerHTML,/hws-privacy|Скрыть имена|hws-schedule-toolbar|hws-priorities|hws-resume|hws-action-row/);
  assert.equal(x.right.children.length,1);
  assert.match(x.right.children[0].innerHTML,/Мысль дня/);
  assert.match(x.$('#hwsSchedule').innerHTML,/Ирина Волкова/);
});

test('event shows scheduled appointment date/time, not creation date',()=>{
  const x=makeBrowser();
  const event=x.events.find(e=>e.id==='appointment');
  event.title='Сессия';
  event.createdAt='2020-01-01T00:00:00.000Z';
  x.window.DiagnostikaHomeWorkspace.render();
  const markup=x.$('#hwsSchedule').innerHTML;
  assert.match(markup,/Сессия/);
  assert.match(markup,/Ирина Волкова/);
  assert.match(markup,/Запланировано:/);
  const scheduled=new Intl.DateTimeFormat('ru-RU',
    {day:'numeric',month:'long',year:'numeric'}).format(new Date(event.date+'T12:00:00'));
  assert.ok(markup.includes(scheduled));
  const [hour,minute]=event.time.split(':');
  assert.ok(markup.includes(hour.padStart(2,'0')+':'+minute));
  assert.doesNotMatch(markup,/2020|1 января/);
});

test('absence of appointment time is visibly indicated, never fabricated as 12:00',()=>{
  const x=makeBrowser();
  const event=x.events.find(e=>e.id==='appointment');
  event.time='';
  x.window.DiagnostikaHomeWorkspace.render();
  const markup=x.$('#hwsSchedule').innerHTML;
  assert.match(markup,/Время не указано/);
  assert.doesNotMatch(markup,/12:00/);
});

test('legacy planned session without explicit scheduled time is not shown as an appointment',()=>{
  const x=makeBrowser();
  x.events.splice(0,x.events.length);
  const client=x.window.DiagnostikaClients.list()[0];
  client.sessions=[{id:'legacy',planned:true,date:'2040-02-03',createdAt:'2040-02-03T10:00:00.000Z'}];
  x.window.DiagnostikaHomeWorkspace.render();
  assert.match(x.$('#hwsSchedule').innerHTML,/Ближайших событий нет/);
  client.sessions[0].scheduledTime='18:30';
  x.window.DiagnostikaHomeWorkspace.render();
  assert.match(x.$('#hwsSchedule').innerHTML,/18:30/);
});

test('one thought remains unchanged during the same day',()=>{
  const x=makeBrowser();
  const first=x.$('#hwsQuoteText').textContent;
  x.window.DiagnostikaHomeWorkspace.render();
  assert.equal(x.$('#hwsQuoteText').textContent,first);
  assert.doesNotMatch(x.right.children[0].innerHTML,/1\s*\/\s*30|Другая мысль/);
});

test('quick capture saves to dedicated category and opens its tab',()=>{
  const x=makeBrowser();
  x.$('#hwsQuickThought').value='Идея для консультации';
  x.click('save-thought');
  assert.deepEqual(x.savedNotes,['Идея для консультации']);
  assert.equal(x.$('#hwsQuickThought').value,'');
  x.click('quick-thoughts');
  assert.equal(x.quickOpened(),1);
});

test('calendar and client links remain functional',()=>{
  const x=makeBrowser();
  x.click('open-client',{clientId:'client1'});
  assert.equal(x.selected(),'client1');
  x.click('calendar');
  assert.equal(x.calendarOpened(),1);
});

test('scripts are wired only to com and use fresh cache versions',()=>{
  assert.match(loader,/home-start-workspace\.js\?v=20261109-compact-dates-1/);
  assert.match(loader,/home-start-workspace\.css\?v=20261109-compact-dates-1/);
  assert.match(loader,/loadHomeWorkspace\(\)/);
  assert.match(notes,/openQuickThoughts/);
  assert.match(notes,/addQuickThought/);
  assert.match(index,/app-loader\.js\?v=20261109-compact-dates-1/);
  assert.match(index,/quick-notes\.js\?v=20261107-quick-thoughts-tabs-2/);
});
