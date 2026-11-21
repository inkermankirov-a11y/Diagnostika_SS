import {chromium,firefox,webkit} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const target=process.env.PERF_URL||'http://127.0.0.1:8149/index.html';
const origin=new URL(target).origin;
if(!['127.0.0.1','localhost'].includes(new URL(target).hostname))throw Error('Only use a local test server. Do not benchmark real client accounts.');
const rounds=Number(process.env.PERF_ROUNDS||3);
const engines={chromium,firefox,webkit};
const scenarios=[
 {id:'desktop-empty',viewport:{width:1440,height:900},count:0,engines:['chromium']},
 {id:'desktop-100',viewport:{width:1440,height:900},count:100,engines:['chromium','firefox','webkit']},
 {id:'mobile-100',viewport:{width:390,height:844},count:100,touch:true,engines:['chromium','webkit']}
];
function fixture(n){return {version:4,clients:Array.from({length:n},(_,i)=>({id:'perf-'+i,name:'Synthetic client '+i,currentRequestId:'request-'+i,requests:[{id:'request-'+i,title:'Synthetic request',status:'active',situations:[]}],sessions:[],questionnaires:[],quickNotes:[]})),calendarEvents:[]};}
function inventory(){
 const html=readFileSync('index.html','utf8');
 const assets=[...html.matchAll(/<(script|link)\b[^>]*(?:src|href)="([^"]+)"[^>]*>/gi)].map(m=>{
   const file=m[2].split('?')[0];let bytes=0;
   try{bytes=statSync(resolve(file)).size;}catch{}
   return {type:m[1],file,bytes,preload:/preload/.test(m[0])};
 });
 return {scripts:assets.filter(a=>a.type==='script').length,styles:assets.filter(a=>a.file.endsWith('.css')).length,preloads:assets.filter(a=>a.preload).length,rawBytes:assets.filter(a=>!a.preload).reduce((sum,a)=>sum+a.bytes,0)};
}
const results=[];
for(const [engine,launcher] of Object.entries(engines)){
 const browser=await launcher.launch({headless:true});
 try{
  for(const scenario of scenarios.filter(s=>s.engines.includes(engine))){
   for(let i=0;i<rounds;i++){
    const context=await browser.newContext({viewport:scenario.viewport,hasTouch:!!scenario.touch,deviceScaleFactor:scenario.touch?2:1,locale:'ru-RU',timezoneId:'Europe/Moscow'});
    const page=await context.newPage();let errors=[],failed=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('requestfailed',req=>{if(req.url().startsWith(origin+'/'))failed.push(new URL(req.url()).pathname);});
    // Keep this isolated from all real accounts and databases. No API credentials.
    await page.addInitScript(({data,origin})=>{
      if(location.origin!==origin)return;
      if(!localStorage.getItem('perf-seeded')){
        localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
        localStorage.setItem('diagnostika-ui-language','ru');
        localStorage.setItem('perf-seeded','1');
      }
      window.__perfReadyMs=null;
      window.addEventListener('diagnostika:ready',()=>{window.__perfReadyMs=performance.now();},{once:true});
    },{data:fixture(scenario.count),origin});
    try{
     for(const phase of ['cold','warm']){
      errors=[];failed=[];
      const result={engine,scenario:scenario.id,round:i+1,phase};
      try{
       if(phase==='cold')await page.goto(target,{waitUntil:'domcontentloaded',timeout:30000});
       else await page.reload({waitUntil:'domcontentloaded',timeout:30000});
       await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready')||document.documentElement.classList.contains('diagnostika-startup-failed'),null,{timeout:30000});
       Object.assign(result,await page.evaluate(()=>{
        const nav=performance.getEntriesByType('navigation')[0];
        const entries=performance.getEntriesByType('resource').filter(e=>e.name.startsWith(location.origin+'/'));
        const paints=performance.getEntriesByType('paint');
        const bytes=key=>entries.reduce((sum,e)=>sum+(e[key]||0),0);
        const app=document.querySelector('.home-dashboard');
        return {ready:document.documentElement.classList.contains('diagnostika-dashboard-ready'),readyMs:window.__perfReadyMs,ttfbMs:nav?.responseStart??null,domContentLoadedMs:nav?.domContentLoadedEventEnd??null,firstContentfulPaintMs:paints.find(p=>p.name==='first-contentful-paint')?.startTime??null,localResourceCount:entries.length,localTransferBytes:bytes('transferSize'),localDecodedBytes:bytes('decodedBodySize'),dashboardVisible:!!app&&!!app.getClientRects().length};
       }));
      }catch(e){result.ready=false;result.failure=String(e.message).slice(0,700);}
      result.pageErrors=[...new Set(errors)];result.failedLocalRequests=[...new Set(failed)];results.push(result);
      console.log(JSON.stringify(result));
     }
    }finally{await context.close();}
   }
  }
 }finally{await browser.close();}
}
const median=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);return a.length?a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2:null;};
const groups={};
for(const r of results)(groups[[r.engine,r.scenario,r.phase].join('/') ]??=[]).push(r);
const summary=Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{readyRuns:v.filter(r=>r.ready&&r.dashboardVisible).length,totalRuns:v.length,medianReadyMs:median(v.filter(r=>r.ready&&r.dashboardVisible).map(r=>r.readyMs)),medianLocalTransferBytes:median(v.map(r=>r.localTransferBytes)),pageErrorRuns:v.filter(r=>r.pageErrors.length).length}]));
const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),target,inventory:inventory(),summary,results};
mkdirSync('performance-results',{recursive:true});writeFileSync('performance-results/startup.json',JSON.stringify(report,null,2)+'\n');
console.log('PERFORMANCE_BASELINE',JSON.stringify(summary));
if(results.some(r=>!r.ready||!r.dashboardVisible||r.pageErrors.length||r.failedLocalRequests.length))process.exitCode=1;
