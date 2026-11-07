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
  const savedNotes=[],updateCalls=[];let selected=null,calendarOpened=0;
  const window={
    DiagnostikaClients:{list:()=>fakeClients},
    DiagnostikaHomeDashboard:{currentView:()=> 'home',openClient:id=>{selected=id;},addClient(){}},
    DiagnostikaCalendar:{moduleAware:true,list:()=>events,update:(id,patch)=>{
      updateCalls.push(id);Object.assign(events.find(x=>x.id===id),patch);return true;}},
    DiagnostikaPlatform:{events:{on:(name,fn)=>platformListeners[name]=fn}},
    DiagnostikaQuickNotes:{add:content=>(savedNotes.push(content),true)},
    DiagnostikaCalendarUI:{open:()=>{calendarOpened++;}},
    addEventListener(){}
  };
  const navigator={clipboard:{writeText:async()=>{}}};
  vm.runInNewContext(source,{window,document,localStorage,navigator,console:{warn(){},error(){}},Date,Intl});
  const click=(action,extra={})=>listeners.click({target:{closest:()=>({dataset:{action,...extra}})}});
  return {window,home,right,$,store,savedNotes,updateCalls,events,click,
    selected:()=>selected,calendarOpened:()=>calendarOpened,platformListeners};
}

test('mounts meaningful data-driven blocks in both empty dashboard columns',()=>{
  const x=makeBrowser();
  assert.match(x.home.innerHTML,/Мой рабочий день/);
  assert.equal(x.right.children.length,1);
  assert.match(x.right.children[0].innerHTML,/Мысль дня/);
  assert.match(x.$('#hwsMetrics').innerHTML,/Активных запросов/);
  assert.match(x.$('#hwsSchedule').innerHTML,/Ирина Волкова/);
  assert.match(x.$('#hwsPriorityList').innerHTML,/Задача для Ирины Волковой/);
});

test('privacy mode masks names and calendar event titles',()=>{
  const x=makeBrowser();
  x.click('privacy');
  assert.doesNotMatch(x.$('#hwsSchedule').innerHTML,/Ирина Волкова/);
  assert.doesNotMatch(x.$('#hwsPriorityList').innerHTML,/Ирины Волковой/);
  assert.match(x.$('#hwsSchedule').innerHTML,/Имя скрыто/);
  x.click('privacy');
  assert.match(x.$('#hwsSchedule').innerHTML,/Ирина Волкова/);
});

test('daily philosophy is navigable, saved, and favorite indices are validated',()=>{
  const x=makeBrowser();
  assert.equal(x.window.DiagnostikaHomeWorkspace.thoughtCount,30);
  const first=x.$('#hwsQuoteText').textContent;
  x.click('next-quote');
  assert.notEqual(x.$('#hwsQuoteText').textContent,first);
  assert.match(x.store.get('diagnostika-home-workspace-daily-thought'),/index/);
  x.click('favorite');
  assert.match(x.store.get('diagnostika-home-workspace-favorites'),/^\[\d+\]$/);
  x.store.set('diagnostika-home-workspace-favorites','[999,-1]');
  x.click('favorites');
  assert.match(x.$('#hwsQuoteStatus').textContent,/Избранных мыслей пока нет/);
});

test('quick capture uses existing notes service; reminders use calendar service',()=>{
  const x=makeBrowser();
  x.$('#hwsQuickThought').value='Идея для консультации';
  x.click('save-thought');
  assert.deepEqual(x.savedNotes,['Идея для консультации']);
  assert.equal(x.$('#hwsQuickThought').value,'');
  x.click('complete-reminder',{eventId:'reminder'});
  assert.deepEqual(x.updateCalls,['reminder']);
  assert.equal(x.events.find(e=>e.id==='reminder').status,'completed');
});

test('navigation opens real client and existing calendar; recent clients persist',()=>{
  const x=makeBrowser();
  x.click('open-client',{clientId:'client1'});
  assert.equal(x.selected(),'client1');
  x.click('calendar');
  assert.equal(x.calendarOpened(),1);
  x.platformListeners['client:selected']({clientId:'client1',source:'home-dashboard-open-client'});
  assert.match(x.store.get('diagnostika-home-workspace-recent-clients'),/client1/);
});

test('wiring is scoped to the .com app and existing notes storage',()=>{
  assert.match(loader,/home-start-workspace\.js\?v=20261107-main-hub-1/);
  assert.match(loader,/home-start-workspace\.css\?v=20261107-main-hub-1/);
  assert.match(loader,/loadHomeWorkspace\(\)/);
  assert.match(notes,/window\.DiagnostikaQuickNotes=\{open,close,isOpen:.*add\}/);
  assert.match(index,/app-loader\.js\?v=20261107-main-hub-1/);
  assert.match(index,/quick-notes\.js\?v=20261107-main-hub-1/);
});
