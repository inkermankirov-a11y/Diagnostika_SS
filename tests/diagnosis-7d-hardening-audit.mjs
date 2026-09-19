import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function walk(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='.git'||entry.name==='node_modules')continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(full));
    else if(entry.isFile()&&entry.name.endsWith('.js'))out.push(full.replaceAll('\\','/').replace(/^\.\//,''));
  }
  return out;
}

const jsFiles=walk('.');
const servicePath='modules/diagnosis/diagnosis-service.js';
const apiSource=fs.readFileSync('diagnosis-api.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');
const deepContextSource=fs.readFileSync('deep-context-button.js','utf8');

assert(apiSource.includes("version:'7D'"),'Diagnosis facade version is not 7D');
assert(apiSource.includes('Object.freeze({'),'Diagnosis facade is not frozen');
assert(indexSource.includes('diagnosis-api.js?v=20260919-diagnosis7d'),'Diagnosis 7D facade cache marker is stale');
assert(deepContextSource.includes("source:'diagnosis-ui-deep-add'"),'Legacy deep context button is not service-backed');
assert.equal(deepContextSource.includes('feeling.deep||(feeling.deep=[])'),false,'Legacy deep context button mutates feeling.deep');
assert.equal(deepContextSource.includes("typeof save==='function'"),false,'Legacy deep context button persists directly');

const mutationPatterns=[
  /\.beliefs\s*=/,
  /\.beliefs\.(?:push|splice)\s*\(/,
  /\.feelings\s*=/,
  /\.feelings\.(?:push|splice)\s*\(/,
  /\.deep\s*=/,
  /\.deep\.(?:push|splice)\s*\(/,
  /\.instincts\s*=/,
  /\.instincts\.(?:push|splice)\s*\(/
];

const situationPatterns=[
  /\.situations\s*=/,
  /\.situations\.(?:push|splice)\s*\(/
];

const allowedNested=[
  {file:servicePath,re:/.*/},
  {file:'secondary-feeling-hints.js',re:/\bbase\.deep\s*=/}
];
const allowedSituations=[
  {file:servicePath,re:/.*/},
  {file:'modules/requests/request-service.js',re:/\bcreated\.situations\s*=/},
  {file:'free-consultation-v2.js',re:/\.aiResult\.situations\s*=/},
  {file:'free-consultation-archive.js',re:/\bai\.situations\s*=/}
];

function allowed(file,line,rules){
  return rules.some(rule=>rule.file===file&&rule.re.test(line));
}

const violations=[];
for(const file of jsFiles){
  const lines=fs.readFileSync(file,'utf8').split('\n');
  lines.forEach((line,index)=>{
    if(mutationPatterns.some(re=>re.test(line))&&!allowed(file,line,allowedNested)){
      violations.push({file,line:index+1,kind:'nested',text:line.trim()});
    }
    if(situationPatterns.some(re=>re.test(line))&&!allowed(file,line,allowedSituations)){
      violations.push({file,line:index+1,kind:'situations',text:line.trim()});
    }
  });
}
assert.deepEqual(violations,[],'Direct Diagnosis tree writers remain outside service: '+JSON.stringify(violations));

const ownerFiles=jsFiles.filter(file=>{
  const s=fs.readFileSync(file,'utf8');
  return s.includes('window.DiagnostikaDiagnosis=')||s.includes('window.DiagnostikaDiagnosis =');
});
assert.deepEqual(ownerFiles,['diagnosis-api.js'],'DiagnostikaDiagnosis has multiple owners');

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(()=>{
  const fixture={version:4,clients:[{
    id:'diag-7d-client',name:'Diagnosis 7D Client',
    currentRequestId:'diag-7d-r1',lastDiagnosisRequestId:'diag-7d-r1',
    requests:[{id:'diag-7d-r1',title:'Hardening',status:'active',situations:[{
      id:'diag-7d-s1',name:'Hardening situation',level:5,result:'',beliefs:[{
        id:'diag-7d-b1',text:'belief',level:5,feelings:[{
          id:'diag-7d-f1',text:'feeling',level:5,deep:[]
        }]
      }]
    }]}],sessions:[],quickNotes:[],questionnaires:[]
  }]};
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(fixture));
  localStorage.setItem('diagnostika-last-client-id','diag-7d-client');
  localStorage.setItem('diagnostika-ui-language','ru');
});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));

await page.goto('http://127.0.0.1:8000/index.html?diagnosis-7d=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>window.DiagnostikaDiagnosis?.version==='7D'
  && window.DiagnostikaPlatform?.services?.diagnosis
  && document.documentElement.classList.contains('diagnostika-dashboard-ready'),
  null,{timeout:20000});

const runtime=await page.evaluate(()=>{
  const facade=window.DiagnostikaDiagnosis;
  const service=window.DiagnostikaPlatform.services.diagnosis;
  const c=window.DiagnostikaClients.current();
  const before={
    current:c.currentRequestId,last:c.lastDiagnosisRequestId,
    active:window.DiagnostikaRequests.activeId(c),
    viewed:window.DiagnostikaRequests.viewedId(c)
  };
  const snap=facade.snapshot('diag-7d-r1',c.id);
  snap.situations[0].name='MUTATED READ COPY';
  const live=window.DiagnostikaRequests.get('diag-7d-r1',c);
  let facadeWriteBlocked=false;
  try{facade.injected='x';}catch(_){facadeWriteBlocked=true;}
  return {
    facadeFrozen:Object.isFrozen(facade),
    serviceFrozen:Object.isFrozen(service),
    eventsFrozen:Object.isFrozen(service.events),
    facadeWriteBlocked:facadeWriteBlocked||facade.injected===undefined,
    liveName:live.situations[0].name,
    after:{
      current:c.currentRequestId,last:c.lastDiagnosisRequestId,
      active:window.DiagnostikaRequests.activeId(c),
      viewed:window.DiagnostikaRequests.viewedId(c)
    },
    before
  };
});

assert.equal(runtime.facadeFrozen,true,'Diagnosis facade is not frozen at runtime');
assert.equal(runtime.serviceFrozen,true,'Diagnosis service is not frozen at runtime');
assert.equal(runtime.eventsFrozen,true,'Diagnosis events are not frozen at runtime');
assert.equal(runtime.facadeWriteBlocked,true,'Diagnosis facade accepted injected property');
assert.equal(runtime.liveName,'Hardening situation','Diagnosis snapshot leaked a live state reference');
assert.deepEqual(runtime.after,runtime.before,'Diagnosis read/hardening changed request authority');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('DIAGNOSIS_7D_HARDENING_SUCCESS',JSON.stringify({
  scannedJs:jsFiles.length,
  facadeFrozen:runtime.facadeFrozen,
  serviceFrozen:runtime.serviceFrozen,
  requestAuthority:runtime.after
}));

await context.close();
await browser.close();
