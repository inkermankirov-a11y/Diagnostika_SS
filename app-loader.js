'use strict';
(() => {
  function loadOnce(src, marker){
    if(document.querySelector(`script[${marker}]`)) return;
    const s=document.createElement('script');
    s.src=src;
    s.setAttribute(marker,'1');
    document.body.appendChild(s);
  }
  loadOnce('modules/payments/ui/data-repair.js?v=20260930-modular25a','data-session-payment-data-repair');
  loadOnce('modules/payments/ui/session-mode.js?v=20260930-modular25a','data-session-payment-mode-rule');
})();

// Fast startup: start the module graph immediately after the core shell is ready.
(() => {
  function coreAvailable(){
    try{
      return typeof state!=='undefined'
        && Array.isArray(state?.clients)
        && typeof save==='function'
        && typeof client==='function'
        && typeof renderClient==='function'
        && typeof renderMode==='function';
    }catch(_){
      return false;
    }
  }

  if(!coreAvailable()) return;
  window.DiagnostikaCoreReady=true;
  window.dispatchEvent(new Event('diagnostika:core-ready'));

  const DOMAINS=Object.freeze([
    {
      id:'clients',
      service:['modules/clients/client-service.js?v=20260918-clients2b2&db=14b&pin=18a&cleanup=23b&profile=20261003-1','data-clients-service'],
      module:['modules/clients/index.js?v=20260918-clients2b2','data-clients-module'],
      api:['client-api.js?v=20260918-clients2b2&api=13d&pin=18a&cleanup=23b','data-client-api'],
      ready:()=>window.DiagnostikaClients?.moduleAware===true
    },
    {
      id:'requests',
      service:['modules/requests/request-service.js?v=20260918-requests3d&cleanup=23c','data-requests-service'],
      module:['modules/requests/index.js?v=20260918-requests3d','data-requests-module'],
      api:['request-api.js?v=20260918-requests3d&api=13d&cleanup=23b','data-request-api'],
      ready:()=>window.DiagnostikaRequests?.moduleAware===true
    },
    {
      id:'diagnosis',
      service:['modules/diagnosis/diagnosis-service.js?v=20260919-diagnosis7c&cleanup=23c','data-diagnosis-service'],
      module:['modules/diagnosis/index.js?v=20260919-diagnosis7c','data-diagnosis-module'],
      api:['diagnosis-api.js?v=20260919-diagnosis7d&api=13d','data-diagnosis-api'],
      ready:()=>window.DiagnostikaDiagnosis?.moduleAware===true
    },
    {
      id:'sessions',
      service:['modules/sessions/session-service.js?v=20260918-sessions4c&cleanup=23c','data-sessions-service'],
      module:['modules/sessions/index.js?v=20260918-sessions4c','data-sessions-module'],
      api:['session-api.js?v=20260918-sessions4c&api=13d','data-session-api'],
      ready:()=>window.DiagnostikaSessions?.moduleAware===true
    },
    {
      id:'files',
      service:['modules/files/file-service.js?v=20260919-files9d&cleanup=23c','data-files-service'],
      module:['modules/files/index.js?v=20260919-files9d','data-files-module'],
      api:['files-api.js?v=20260919-files9d&api=13d','data-files-api'],
      ready:()=>window.DiagnostikaFiles?.moduleAware===true
    },
    {
      id:'export',
      service:['modules/export/export-service.js?v=20260919-export10d','data-export-service'],
      module:['modules/export/index.js?v=20260919-export10d','data-export-module'],
      api:['export-api.js?v=20260919-export10d&api=13d','data-export-api'],
      ready:()=>window.DiagnostikaExport?.moduleAware===true
    },
    {
      id:'calendar',
      service:['modules/calendar/calendar-service.js?v=20260919-calendar8a&cleanup=23c','data-calendar-service'],
      module:['modules/calendar/index.js?v=20260919-calendar8a','data-calendar-module'],
      api:['calendar-api.js?v=20260919-calendar8d&api=13d','data-calendar-api'],
      ready:()=>window.DiagnostikaCalendar?.moduleAware===true
    },
    {
      id:'payments',
      service:['modules/payments/payment-service.js?v=20260918-payment5d&cleanup=23c','data-payments-service'],
      module:['modules/payments/index.js?v=20260918-payment5d','data-payments-module'],
      api:['payment-api.js?v=20260918-payment5d&api=13d','data-payment-api'],
      ready:()=>window.DiagnostikaPayments?.moduleAware===true
    },
    {
      id:'ai',
      service:['modules/ai/ai-service.js?v=20260919-ai6d&cleanup=23c','data-ai-service'],
      module:['modules/ai/index.js?v=20260919-ai6d','data-ai-module'],
      api:['ai-api.js?v=20260919-ai6d&api=13d','data-ai-api'],
      ready:()=>window.DiagnostikaAI?.moduleAware===true
    }
  ]);

  function loadScript(src,marker,ready){
    try{if(ready?.())return Promise.resolve();}catch(_){}
    const existing=document.querySelector(`script[${marker}]`);
    if(existing){
      if(existing.dataset.diagnostikaLoaded==='1')return Promise.resolve();
      return new Promise((resolve,reject)=>{
        const done=()=>{existing.dataset.diagnostikaLoaded='1';resolve();};
        existing.addEventListener('load',done,{once:true});
        existing.addEventListener('error',()=>reject(new Error(`Failed to load ${src}`)),{once:true});
        queueMicrotask(()=>{try{if(ready?.())resolve();}catch(_){}});
      });
    }
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.setAttribute(marker,'1');
      script.onload=()=>{script.dataset.diagnostikaLoaded='1';resolve();};
      script.onerror=()=>reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });
  }

  async function loadDomain(domain){
    await loadScript(domain.service[0],domain.service[1],()=>Boolean(window.DiagnostikaPlatform?.services?.[domain.id]));
    await loadScript(domain.module[0],domain.module[1],()=>Boolean(window.DiagnostikaPlatform?.modules?.get?.(domain.id)));
    await loadScript(domain.api[0],domain.api[1],domain.ready);
  }

  function warmDashboardAssets(){
    if(!document.querySelector('link[data-brand-icon]')){
      const icon=document.createElement('link');
      icon.rel='stylesheet';
      icon.href='brand-icon.css?v=20260912-46';
      icon.setAttribute('data-brand-icon','1');
      document.head.appendChild(icon);
    }
    if(!document.querySelector('link[data-home-dashboard]')){
      const css=document.createElement('link');
      css.rel='stylesheet';
      css.href='home-dashboard.css?v=20261003-client-ai-binding-7';
      css.setAttribute('data-home-dashboard','1');
      document.head.appendChild(css);
    }
    for(const [href,marker] of [
      ['home-dashboard.js?v=20261003-client-ai-binding-7','data-home-dashboard-preload'],
      ['home-dashboard-sessions.js?v=20261003-capsule-4','data-home-dashboard-sessions-preload']
    ]){
      if(document.querySelector(`link[${marker}]`))continue;
      const preload=document.createElement('link');
      preload.rel='preload';
      preload.as='script';
      preload.href=href;
      preload.setAttribute(marker,'1');
      document.head.appendChild(preload);
    }
  }

  function loadDashboard(){
    if(!document.querySelector('link[data-brand-icon]')){
      const icon=document.createElement('link');
      icon.rel='stylesheet';
      icon.href='brand-icon.css?v=20260912-46';
      icon.setAttribute('data-brand-icon','1');
      document.head.appendChild(icon);
    }
    if(!document.querySelector('link[data-home-dashboard]')){
      const l=document.createElement('link');
      l.rel='stylesheet';
      l.href='home-dashboard.css?v=20261003-client-ai-binding-7';
      l.setAttribute('data-home-dashboard','1');
      document.head.appendChild(l);
    }
    if(!document.querySelector('script[data-home-dashboard]')){
      const s=document.createElement('script');
      s.src='home-dashboard.js?v=20261003-client-ai-binding-7';
      s.setAttribute('data-home-dashboard','1');
      s.onload=()=>{
        if(!document.querySelector('script[data-home-dashboard-sessions]')){
          const x=document.createElement('script');
          x.src='home-dashboard-sessions.js?v=20261003-capsule-4';
          x.setAttribute('data-home-dashboard-sessions','1');
          document.body.appendChild(x);
        }
      };
      document.body.appendChild(s);
    }else if(!document.querySelector('script[data-home-dashboard-sessions]')){
      const x=document.createElement('script');
      x.src='home-dashboard-sessions.js?v=20261003-capsule-4';
      x.setAttribute('data-home-dashboard-sessions','1');
      document.body.appendChild(x);
    }
  }

  function publishRuntimeGate(status, report = null, error = null){
    const snapshot=Object.freeze({
      status,
      checkedAt:new Date().toISOString(),
      issues:Object.freeze([...(report?.issues||[])]),
      error:error?String(error?.message||error):null
    });
    window.DiagnostikaRuntimeGate=snapshot;
    return snapshot;
  }

  async function verifyRuntimeContract(){
    publishRuntimeGate('checking');
    try{
      const runtime=window.DiagnostikaRuntime;
      if(!runtime?.refresh)throw new Error('runtime-contract-missing');
      const report=runtime.ready
        ? await runtime.ready
        : await runtime.refresh({source:'app-loader-health-gate',timeoutMs:10000});
      if(report?.ready!==true){
        publishRuntimeGate('unhealthy',report);
        window.dispatchEvent(new CustomEvent('diagnostika:runtime-unhealthy',{detail:{issues:[...(report?.issues||[])]}}));
        return;
      }
      publishRuntimeGate('ready',report);
    }catch(error){
      publishRuntimeGate('error',null,error);
      window.dispatchEvent(new CustomEvent('diagnostika:runtime-error',{detail:{message:String(error?.message||error)}}));
    }
  }

  function loadRuntimeContract(){
    if(window.DiagnostikaRuntime?.version==='15A'){
      verifyRuntimeContract();
      return;
    }

    const existing=document.querySelector('script[data-runtime-contract]');
    if(existing){
      existing.addEventListener('load',verifyRuntimeContract,{once:true});
      existing.addEventListener('error',()=> {
        publishRuntimeGate('error',null,new Error('runtime-contract-load-failed'));
        window.dispatchEvent(new CustomEvent('diagnostika:runtime-error',{detail:{message:'runtime-contract-load-failed'}}));
      },{once:true});
      return;
    }

    const runtime=document.createElement('script');
    runtime.src='core/runtime-contract.js?v=20260919-final15a&hardening=19a';
    runtime.setAttribute('data-runtime-contract','1');
    runtime.onload=verifyRuntimeContract;
    runtime.onerror=()=>{
      publishRuntimeGate('error',null,new Error('runtime-contract-load-failed'));
      window.dispatchEvent(new CustomEvent('diagnostika:runtime-error',{detail:{message:'runtime-contract-load-failed'}}));
    };
    document.body.appendChild(runtime);
  }

  async function startModuleGraph(){
    warmDashboardAssets();
    await Promise.all([
      loadScript('roles-api.js?v=20260919-roles11d','data-roles-api',()=>window.DiagnostikaRoles?.moduleAware===true),
      ...DOMAINS.map(loadDomain)
    ]);
    // Do not block first paint on the runtime health audit.
    // Required modules/APIs are loaded at this point, so the dashboard can start immediately.
    loadDashboard();
    setTimeout(loadRuntimeContract,0);
  }

  Promise.resolve(window.DiagnostikaPlatform?.ready)
    .then(startModuleGraph)
    .catch(error=>{
      console.error('[DiagnostikaPlatform] parallel module graph failed to start',error);
      window.dispatchEvent(new CustomEvent('diagnostika:runtime-error',{detail:{message:'module-graph-start-failed'}}));
    });
})();
