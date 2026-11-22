import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../account-limits.js',import.meta.url),'utf8');
const start=source.indexOf("let refreshInFlight=");
const end=source.indexOf("function allow(",start);
assert(start>0&&end>start);
let now=1000000, calls=[], timers=[], resolve, quota=0;
const doc={visibilityState:'visible',querySelectorAll:()=>[]};
const fake={
 document:doc,Date:{now:()=>now},Math:Object.assign(Object.create(Math),{random:()=>.5}),AbortController,
 setTimeout:(fn,delay)=>{const t={fn,delay,cleared:false};timers.push(t);return t;},clearTimeout:t=>{if(t)t.cleared=true;},
 fetch:(path)=>{calls.push(path);return new Promise(r=>{resolve=r;});},
 armTrial(){},maybeShowVIP(){},reportMetrics(){quota++;},renderQuota(){},expireTrial(){},CustomEvent:class{constructor(name,init){this.name=name;this.detail=init.detail;}},window:{dispatchEvent(){}},
};
vm.createContext(fake);
vm.runInContext("let profile=null,languageWrites=0;"+source.slice(start,end)+";globalThis.api={refresh,refreshOnFocus,statusDelay,fail:n=>refreshFailures=n};",fake);
const a=fake.api.refresh(),b=fake.api.refresh();assert.equal(a,b);assert.equal(calls.length,1);assert.equal(calls[0],'/account/api/workspace-status');
resolve({ok:true,json:async()=>({limits:{}})});await a;
assert.equal(quota,1);assert(timers.at(-1).delay>=45000&&timers.at(-1).delay<=60000);
now+=1000;fake.api.refreshOnFocus();assert.equal(calls.length,1);
doc.visibilityState='hidden';fake.api.refreshOnFocus();assert(timers.at(-1).delay>=180000&&timers.at(-1).delay<=240000);
doc.visibilityState='visible';now+=20000;fake.api.refreshOnFocus();assert.equal(calls.length,2);
resolve({ok:false,status:503});await fake.api.refresh();
assert(timers.at(-1).delay>=15000&&timers.at(-1).delay<=20000);
fake.api.fail(8);assert(fake.api.statusDelay()>=120000&&fake.api.statusDelay()<=125000);
assert(source.includes("Date.now()-lastMetrics<120000")&&source.includes("document.visibilityState==='hidden'||reporting"));
console.log('PASS: single flight, visible/background jitter, focus throttling and bounded error backoff');
