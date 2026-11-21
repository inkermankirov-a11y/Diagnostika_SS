'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {performance}=require('node:perf_hooks');
const before=execFileSync('git',['show','cefc70123ae7bab00455c61d1b04bb4ce18b83ed:DiagnostikaSS.com/core/state-codec.js'],{encoding:'utf8'});
const after=fs.readFileSync('core/state-codec.js','utf8');
function load(source){const window={};vm.runInNewContext(source,{window,TextEncoder,TextDecoder,Uint8Array,Uint16Array,Math,String,Number});return window.DiagnostikaStateCodec;}
const old=load(before),next=load(after);
const cases=['', 'a', 'ab', 'abc', '😀', 'Русский текст / Français / 中文 / Ελληνικά', '\u0000\ud800\udfff', ...[4095,4096,4097,7679,7680,7681,15360].map(n=>'a'.repeat(n))];
let seed=123456789;
for(let i=0;i<100;i++){let s='';for(let j=0;j<i*3;j++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;s+=String.fromCharCode(seed&65535);}cases.push(s);}
const state={version:4,clients:Array.from({length:100},(_,i)=>({id:'client-'+i,name:'Синтетический клиент '+i,photoData:'data:image/jpeg;base64,'+'Abc0123456789+/'.repeat(500),requests:[{id:'r-'+i,title:'Запрос 😀',situations:[{id:'s-'+i,description:'Данные',beliefs:[{text:'Пример',level:7}]}]}],sessions:[{id:'s-'+i,notes:'Запись',attachments:[{id:'attachment-'+i,name:'file.pdf'}]}]})),calendarEvents:[],extra:{unknownField:'keep me'}};
cases.push(JSON.stringify(state),JSON.stringify({...state,photo:'a'.repeat(2_000_000)}));
test('identical stored representation across legacy and optimized codec',()=>{
 for(const raw of cases){const a=old.pack(raw),b=next.pack(raw);assert.equal(b,a);assert.equal(next.unpack(a),old.unpack(a));assert.equal(old.unpack(b),next.unpack(b));}
});
test('all fields, photo bytes and attachment references survive exactly',()=>{
 assert.deepEqual(JSON.parse(next.unpack(old.pack(JSON.stringify(state)))),state);
 assert.deepEqual(JSON.parse(old.unpack(next.pack(JSON.stringify(state)))),state);
});
test('malformed input still fails closed',()=>{
 const packed=next.pack(JSON.stringify(state));
 for(const value of [packed.slice(0,-1),packed+'x',packed.slice(0,-1)+String.fromCharCode(32+(packed.charCodeAt(packed.length-1)-31)%32768),'DSS15V1:zzzzzzzz:0:','DSS15V1:1:x:!','garbage'])assert.throws(()=>next.unpack(value));
});
test('report codec timings, no speed threshold',()=>{
 const raw=JSON.stringify(state),median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)];
 for(const [name,codec] of [['existing',old],['optimized',next]]){
  const packed=codec.pack(raw);for(let i=0;i<3;i++){codec.pack(raw);codec.unpack(packed);}
  const pack=[],unpack=[];
  for(let i=0;i<7;i++){let t=performance.now();codec.pack(raw);pack.push(performance.now()-t);t=performance.now();codec.unpack(packed);unpack.push(performance.now()-t);}
  console.log('CODEC_BENCHMARK',JSON.stringify({name,jsonChars:raw.length,storedChars:packed.length,packMs:median(pack),unpackMs:median(unpack)}));
 }
});
