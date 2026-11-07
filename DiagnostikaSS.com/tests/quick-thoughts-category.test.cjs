'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','quick-notes.js'),'utf8');

function createMockElement(){
  const descendants=new Map();
  const element={
    children:[],style:{},dataset:{},attrs:{},className:'',value:'',textContent:'',hidden:false,
    setAttribute(name,value){this.attrs[name]=String(value);},
    focus(){},addEventListener(){},
    appendChild(node){this.children.push(node);return node;},
    querySelector(query){
      if(!descendants.has(query))descendants.set(query,createMockElement());
      return descendants.get(query);
    },
    querySelectorAll(query){
      if(query!=='.quick-notes-tab')return [];
      if(!descendants.has('tabs')){
        descendants.set('tabs',['notes','quickThought'].map(kind=>{
          const tab=createMockElement();tab.dataset.kind=kind;return tab;
        }));
      }
      return descendants.get('tabs');
    }
  };
  let content='';
  Object.defineProperty(element,'innerHTML',{
    get(){return content;},set(value){content=value;element.children=[];}
  });
  return element;
}

function harness(){
  const settings=createMockElement();
  settings.parentNode={insertBefore(){}};
  const doc={
    documentElement:{style:{}},head:createMockElement(),body:createMockElement(),
    getElementById(){return null;},
    querySelector(query){return query==='.settings-wrap'?settings:null;},
    createElement(){return createMockElement();},
    addEventListener(){}
  };
  const state={generalNotes:[{id:'legacy',text:'Старая заметка',
    createdAt:Date.now()-86400000,updatedAt:Date.now()-86400000}]};
  let writes=0;
  const win={DiagnostikaI18n:{language:'ru'},dispatchEvent(){}};
  function CustomEvent(name,options){this.type=name;this.detail=options.detail;}
  vm.runInNewContext(source,{document:doc,window:win,
    localStorage:{getItem(){return null;}},state,
    save:()=>{writes++;return true;},
    CustomEvent,setTimeout:()=>{},console,Date,Intl,Math
  });
  return {api:win.DiagnostikaQuickNotes,state,document:doc,writes:()=>writes};
}

test('quick thoughts have their own saved category and timestamp',()=>{
  const {api,state,writes}=harness();
  assert.equal(api.addQuickThought('Идея для работы'),true);
  assert.equal(api.add('Обычная заметка'),true);
  assert.equal(state.generalNotes.length,3);
  const thought=state.generalNotes.find(n=>n.kind==='quickThought');
  assert.ok(thought);
  assert.equal(thought.text,'Идея для работы');
  assert.ok(Number.isFinite(thought.createdAt));
  assert.equal(state.generalNotes.find(n=>n.id==='legacy').text,'Старая заметка');
  assert.equal(writes(),2);
});

test('Quick Thoughts tab displays only dated quick thoughts; Notes tab preserves originals',()=>{
  const {api,document}=harness();
  api.addQuickThought('Сегодня придумал упражнение');
  api.add('Новая обычная заметка');
  api.openQuickThoughts();
  const overlay=document.body.children.at(-1);
  const tabs=overlay.querySelectorAll('.quick-notes-tab');
  const list=overlay.querySelector('.quick-notes-list');
  assert.equal(tabs[1].attrs['aria-selected'],'true');
  assert.ok(list.children.some(node=>node.className==='quick-note-day-header'&&node.textContent==='Сегодня'));
  assert.equal(list.children.filter(node=>node.className==='quick-note-item').length,1);
  tabs[0].onclick();
  assert.equal(tabs[0].attrs['aria-selected'],'true');
  assert.equal(list.children.filter(node=>node.className==='quick-note-item').length,2);
  assert.ok(list.children.every(node=>node.className!=='quick-note-day-header'));
});

test('editing a quick thought keeps its category and preserves other notes',()=>{
  const {api,state,document}=harness();
  api.addQuickThought('Первый текст');
  api.openQuickThoughts();
  const overlay=document.body.children.at(-1);
  const list=overlay.querySelector('.quick-notes-list');
  const row=list.children.find(node=>node.className==='quick-note-item');
  row.onclick();
  overlay.querySelector('.quick-notes-text').value='Отредактированный текст';
  overlay.querySelector('.quick-notes-save').onclick();
  const thought=state.generalNotes.find(note=>note.kind==='quickThought');
  assert.equal(thought.text,'Отредактированный текст');
  assert.equal(state.generalNotes.find(note=>note.id==='legacy').text,'Старая заметка');
});
