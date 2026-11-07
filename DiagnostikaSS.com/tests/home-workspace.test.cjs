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

test('restores hero and all three counters above upcoming events, but not the removed sections',()=>{
  const x=makeBrowser();
  assert.match(x.home.innerHTML,/Мой рабочий день/);
  assert.match(x.home.innerHTML,/hwsMetrics/);
  assert.match(x.home.innerHTML,/Ближайшие события/);
  assert.ok(x.home.innerHTML.indexOf('Мой рабочий день')<x.home.innerHTML.indexOf('hwsMetrics'));
  assert.ok(x.home.innerHTML.indexOf('hwsMetrics')<x.home.innerHTML.indexOf('Ближайшие события'));
  assert.match(x.$('#hwsMetrics').innerHTML,/Встреч сегодня/);
  assert.match(x.$('#hwsMetrics').innerHTML,/Ожидают внимания/);
  assert.match(x.$('#hwsMetrics').innerHTML,/Активных запросов/);
  assert.match(x.$('#hwsMetrics').innerHTML,/hws-metric-value">1</);
  assert.doesNotMatch(x.home.innerHTML,/hws-priorities|hws-resume|hws-action-row|Продолжить работу|Новый клиент/);
  assert.equal(x.right.children.length,1);
  assert.match(x.right.children[0].innerHTML,/Мысль дня/);
  assert.doesNotMatch(x.right.children[0].innerHTML,/next-quote|hwsQuoteNumber|hwsFavorite/);
  assert.match(x.$('#hwsSchedule').innerHTML,/Ирина Волкова/);
});

test('privacy hides names and calendar event titles',()=>{
  const x=makeBrowser();
  x.click('privacy');
  assert.doesNotMatch(x.$('#hwsSchedule').innerHTML,/Ирина Волкова/);
  assert.match(x.$('#hwsSchedule').innerHTML,/Имя скрыто/);
  x.click('privacy');
  assert.match(x.$('#hwsSchedule').innerHTML,/Ирина Волкова/);
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
  assert.match(loader,/home-start-workspace\.js\?v=20261107-minimal-daily-thought-2/);
  assert.match(loader,/home-start-workspace\.css\?v=20261107-minimal-daily-thought-2/);
  assert.match(loader,/loadHomeWorkspace\(\)/);
  assert.match(notes,/openQuickThoughts/);
  assert.match(notes,/addQuickThought/);
  assert.match(index,/app-loader\.js\?v=20261107-minimal-daily-thought-2/);
  assert.match(index,/quick-notes\.js\?v=20261107-quick-thoughts-tabs-2/);
});
