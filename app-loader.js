'use strict';
(() => {
  function loadOnce(src, marker){
    if(document.querySelector(`script[${marker}]`)) return;
    const s=document.createElement('script');
    s.src=src;
    s.setAttribute(marker,'1');
    document.body.appendChild(s);
  }
  loadOnce('session-payment-data-repair.js?v=20260912-56','data-session-payment-data-repair');
  loadOnce('session-payment-mode-rule.js?v=20260912-59','data-session-payment-mode-rule');
  loadOnce('client-ai-full-context.js?v=20260917-clientaifull1','data-client-ai-full-context');
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
      s.src='home-dashboard.js?v=20260916-newui1';
      s.setAttribute('data-home-dashboard','1');
      s.onload=()=>{
        if(!document.querySelector('script[data-home-dashboard-sessions]')){
          const x=document.createElement('script');
          x.src='home-dashboard-sessions.js?v=20260916-newui1';
          x.setAttribute('data-home-dashboard-sessions','1');
          document.body.appendChild(x);
        }
      };
      document.body.appendChild(s);
    }else if(!document.querySelector('script[data-home-dashboard-sessions]')){
      const x=document.createElement('script');
      x.src='home-dashboard-sessions.js?v=20260916-newui1';
      x.setAttribute('data-home-dashboard-sessions','1');
      document.body.appendChild(x);
    }
  }

  function loadRequestApi(){
    if(window.DiagnostikaRequests?.select){
      loadDashboard();
      return;
    }

    const existing=document.querySelector('script[data-request-api]');
    if(existing){
      existing.addEventListener('load',loadDashboard,{once:true});
      return;
    }

    const api=document.createElement('script');
    api.src='request-api.js?v=20260916-newui1';
    api.setAttribute('data-request-api','1');
    api.onload=loadDashboard;
    document.body.appendChild(api);
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
  api.src='client-api.js?v=20260916-clientapi1';
  api.setAttribute('data-client-api','1');
  api.onload=loadRequestApi;
  document.body.appendChild(api);
})();
