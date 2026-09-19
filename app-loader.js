'use strict';
(() => {
  function loadOnce(src, marker){
    if(document.querySelector(`script[${marker}]`)) return;
    const s=document.createElement('script');
    s.src=src;
    s.setAttribute(marker,'1');
    document.body.appendChild(s);
  }
  loadOnce('session-payment-data-repair.js?v=20260918-payment5d','data-session-payment-data-repair');
  loadOnce('session-payment-mode-rule.js?v=20260912-59','data-session-payment-mode-rule');
})();

// Main home screen redesign. Loaded last so it can reuse the existing application logic safely.
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

  function ensureClientsModule(){
    const loadModule=()=>{
      if(document.querySelector('script[data-clients-module]')) return;
      const moduleScript=document.createElement('script');
      moduleScript.src='modules/clients/index.js?v=20260918-clients2b2';
      moduleScript.setAttribute('data-clients-module','1');
      document.body.appendChild(moduleScript);
    };

    if(window.DiagnostikaPlatform?.services?.clients){
      loadModule();
      return;
    }

    const existing=document.querySelector('script[data-clients-service]');
    if(existing){
      existing.addEventListener('load',loadModule,{once:true});
      return;
    }

    const serviceScript=document.createElement('script');
    serviceScript.src='modules/clients/client-service.js?v=20260918-clients2b2';
    serviceScript.setAttribute('data-clients-service','1');
    serviceScript.onload=loadModule;
    document.body.appendChild(serviceScript);
  }

  ensureClientsModule();

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
      l.href='home-dashboard.css?v=20260916-newui1';
      l.setAttribute('data-home-dashboard','1');
      document.head.appendChild(l);
    }
    if(!document.querySelector('script[data-home-dashboard]')){
      const s=document.createElement('script');
      s.src='home-dashboard.js?v=20260918-clients2d';
      s.setAttribute('data-home-dashboard','1');
      s.onload=()=>{
        if(!document.querySelector('script[data-home-dashboard-sessions]')){
          const x=document.createElement('script');
          x.src='home-dashboard-sessions.js?v=20260918-sessions4c';
          x.setAttribute('data-home-dashboard-sessions','1');
          document.body.appendChild(x);
        }
      };
      document.body.appendChild(s);
    }else if(!document.querySelector('script[data-home-dashboard-sessions]')){
      const x=document.createElement('script');
      x.src='home-dashboard-sessions.js?v=20260918-sessions4c';
      x.setAttribute('data-home-dashboard-sessions','1');
      document.body.appendChild(x);
    }
  }

  function ensureRequestsFoundation(next){
    const loadModule=()=>{
      if(document.querySelector('script[data-requests-module]')){
        next();
        return;
      }
      const moduleScript=document.createElement('script');
      moduleScript.src='modules/requests/index.js?v=20260918-requests3d';
      moduleScript.setAttribute('data-requests-module','1');
      moduleScript.onload=next;
      document.body.appendChild(moduleScript);
    };

    if(window.DiagnostikaPlatform?.services?.requests){
      loadModule();
      return;
    }

    const existing=document.querySelector('script[data-requests-service]');
    if(existing){
      existing.addEventListener('load',loadModule,{once:true});
      return;
    }

    const serviceScript=document.createElement('script');
    serviceScript.src='modules/requests/request-service.js?v=20260918-requests3d';
    serviceScript.setAttribute('data-requests-service','1');
    serviceScript.onload=loadModule;
    document.body.appendChild(serviceScript);
  }

  function ensureDiagnosisFoundation(next){
    const loadModule=()=>{
      if(document.querySelector('script[data-diagnosis-module]')){
        next();
        return;
      }
      const moduleScript=document.createElement('script');
      moduleScript.src='modules/diagnosis/index.js?v=20260919-diagnosis7c';
      moduleScript.setAttribute('data-diagnosis-module','1');
      moduleScript.onload=next;
      document.body.appendChild(moduleScript);
    };

    if(window.DiagnostikaPlatform?.services?.diagnosis){
      loadModule();
      return;
    }

    const existing=document.querySelector('script[data-diagnosis-service]');
    if(existing){
      existing.addEventListener('load',loadModule,{once:true});
      return;
    }

    const serviceScript=document.createElement('script');
    serviceScript.src='modules/diagnosis/diagnosis-service.js?v=20260919-diagnosis7c';
    serviceScript.setAttribute('data-diagnosis-service','1');
    serviceScript.onload=loadModule;
    document.body.appendChild(serviceScript);
  }

  function ensureSessionsFoundation(next){
    const loadModule=()=>{
      if(document.querySelector('script[data-sessions-module]')){
        next();
        return;
      }
      const moduleScript=document.createElement('script');
      moduleScript.src='modules/sessions/index.js?v=20260918-sessions4c';
      moduleScript.setAttribute('data-sessions-module','1');
      moduleScript.onload=next;
      document.body.appendChild(moduleScript);
    };

    if(window.DiagnostikaPlatform?.services?.sessions){
      loadModule();
      return;
    }

    const existing=document.querySelector('script[data-sessions-service]');
    if(existing){
      existing.addEventListener('load',loadModule,{once:true});
      return;
    }

    const serviceScript=document.createElement('script');
    serviceScript.src='modules/sessions/session-service.js?v=20260918-sessions4c';
    serviceScript.setAttribute('data-sessions-service','1');
    serviceScript.onload=loadModule;
    document.body.appendChild(serviceScript);
  }


  function ensurePaymentsFoundation(next){
    const loadModule=()=>{
      if(document.querySelector('script[data-payments-module]')){
        next();
        return;
      }
      const moduleScript=document.createElement('script');
      moduleScript.src='modules/payments/index.js?v=20260918-payment5d';
      moduleScript.setAttribute('data-payments-module','1');
      moduleScript.onload=next;
      document.body.appendChild(moduleScript);
    };

    if(window.DiagnostikaPlatform?.services?.payments){
      loadModule();
      return;
    }

    const existing=document.querySelector('script[data-payments-service]');
    if(existing){
      existing.addEventListener('load',loadModule,{once:true});
      return;
    }

    const serviceScript=document.createElement('script');
    serviceScript.src='modules/payments/payment-service.js?v=20260918-payment5d';
    serviceScript.setAttribute('data-payments-service','1');
    serviceScript.onload=loadModule;
    document.body.appendChild(serviceScript);
  }

  function ensureAIFoundation(next){
    const loadModule=()=>{
      if(document.querySelector('script[data-ai-module]')){
        next();
        return;
      }
      const moduleScript=document.createElement('script');
      moduleScript.src='modules/ai/index.js?v=20260919-ai6d';
      moduleScript.setAttribute('data-ai-module','1');
      moduleScript.onload=next;
      document.body.appendChild(moduleScript);
    };

    if(window.DiagnostikaPlatform?.services?.ai){
      loadModule();
      return;
    }

    const existing=document.querySelector('script[data-ai-service]');
    if(existing){
      existing.addEventListener('load',loadModule,{once:true});
      return;
    }

    const serviceScript=document.createElement('script');
    serviceScript.src='modules/ai/ai-service.js?v=20260919-ai6d';
    serviceScript.setAttribute('data-ai-service','1');
    serviceScript.onload=loadModule;
    document.body.appendChild(serviceScript);
  }

  function loadAIApi(){
    ensureAIFoundation(()=>{
      if(window.DiagnostikaAI?.moduleAware===true){
        loadDashboard();
        return;
      }

      const existing=document.querySelector('script[data-ai-api]');
      if(existing){
        existing.addEventListener('load',loadDashboard,{once:true});
        return;
      }

      const api=document.createElement('script');
      api.src='ai-api.js?v=20260919-ai6d';
      api.setAttribute('data-ai-api','1');
      api.onload=loadDashboard;
      document.body.appendChild(api);
    });
  }

  function loadPaymentApi(){
    ensurePaymentsFoundation(()=>{
      if(window.DiagnostikaPayments?.moduleAware===true){
        loadAIApi();
        return;
      }

      const existing=document.querySelector('script[data-payment-api]');
      if(existing){
        existing.addEventListener('load',loadAIApi,{once:true});
        return;
      }

      const api=document.createElement('script');
      api.src='payment-api.js?v=20260918-payment5d';
      api.setAttribute('data-payment-api','1');
      api.onload=loadAIApi;
      document.body.appendChild(api);
    });
  }

  function loadSessionsApi(){
    ensureSessionsFoundation(()=>{
      if(window.DiagnostikaSessions?.moduleAware===true){
        loadPaymentApi();
        return;
      }

      const existing=document.querySelector('script[data-session-api]');
      if(existing){
        existing.addEventListener('load',loadPaymentApi,{once:true});
        return;
      }

      const api=document.createElement('script');
      api.src='session-api.js?v=20260918-sessions4c';
      api.setAttribute('data-session-api','1');
      api.onload=loadPaymentApi;
      document.body.appendChild(api);
    });
  }

  function loadDiagnosisApi(){
    ensureDiagnosisFoundation(()=>{
      if(window.DiagnostikaDiagnosis?.moduleAware===true){
        loadSessionsApi();
        return;
      }

      const existing=document.querySelector('script[data-diagnosis-api]');
      if(existing){
        existing.addEventListener('load',loadSessionsApi,{once:true});
        return;
      }

      const api=document.createElement('script');
      api.src='diagnosis-api.js?v=20260919-diagnosis7a';
      api.setAttribute('data-diagnosis-api','1');
      api.onload=loadSessionsApi;
      document.body.appendChild(api);
    });
  }

  function loadRequestApi(){
    ensureRequestsFoundation(()=>{
      if(window.DiagnostikaRequests?.moduleAware===true){
        loadDiagnosisApi();
        return;
      }

      const existing=document.querySelector('script[data-request-api]');
      if(existing){
        existing.addEventListener('load',loadDiagnosisApi,{once:true});
        return;
      }

      const api=document.createElement('script');
      api.src='request-api.js?v=20260918-requests3d';
      api.setAttribute('data-request-api','1');
      api.onload=loadDiagnosisApi;
      document.body.appendChild(api);
    });
  }

  if(window.DiagnostikaClients?.select){
    loadRequestApi();
    return;
  }

  const existing=document.querySelector('script[data-client-api]');
  if(existing){
    existing.addEventListener('load',loadRequestApi,{once:true});
    return;
  }

  const api=document.createElement('script');
  api.src='client-api.js?v=20260918-clients2b2';
  api.setAttribute('data-client-api','1');
  api.onload=loadRequestApi;
  document.body.appendChild(api);
})();
