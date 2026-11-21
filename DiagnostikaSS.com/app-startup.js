'use strict';
(() => {
  const root=document.documentElement;
  const status=document.getElementById('appStartupStatus');
  const failure=document.getElementById('appStartupFailure');
  let failed=false,shown=false,scheduled=false,recovering=false;
  const headerReady=()=>!!(window.DiagnostikaSettingsUI&&document.getElementById('settingsMenuBtn')&&document.getElementById('headerUtilityGroup')&&document.getElementById('quickNotesBtn')&&document.querySelector('.settings-panel #storageBtn')&&!document.getElementById('saveHistoryBtn'));
  document.getElementById('appStartupRetry')?.addEventListener('click',()=>location.reload());
  document.getElementById('appReloadBtn')?.addEventListener('click',()=>location.reload());
  function ready(){
    return !!(window.DiagnostikaCoreReady && window.DiagnostikaHomeDashboard &&
      window.DiagnostikaDashboardSessions && window.DiagnostikaHomeWorkspace &&
      document.querySelector('.home-dashboard') && headerReady());
  }
  function showFailure(message){
    failed=true;root.classList.remove('diagnostika-dashboard-ready');
    root.classList.add('diagnostika-startup-failed');
    if(status)status.hidden=true;
    const text=failure?.querySelector('p');
    if(text)text.textContent=message||'Не удалось завершить запуск. Повторите загрузку. Не очищайте данные сайта.';
  }
  function update(){
    if(failed||shown||scheduled||!ready())return;
    scheduled=true;
    // Allow the assembled dashboard and header to finish their synchronous rendering.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      scheduled=false;if(failed||shown||!ready())return;
      if(status)status.hidden=true;
      shown=true;root.classList.add('diagnostika-dashboard-ready');
      window.dispatchEvent(new Event('diagnostika:ready'));
    }));
  }
  window.addEventListener('diagnostika:runtime-unhealthy',event=>{
    const issues=Array.isArray(event.detail?.issues)?event.detail.issues.filter(Boolean):[];
    showFailure('Внутренняя проверка приложения не пройдена.'+(issues.length?' Код проверки: '+issues.slice(0,4).join(', ')+'.':'')+' Не очищайте данные сайта; повторите загрузку.');
  });
  window.addEventListener('diagnostika:runtime-error',()=>showFailure('Не удалось загрузить системные компоненты. Не очищайте данные сайта; повторите загрузку.'));
  for(const name of ['diagnostika:core-ready','diagnostika:dashboard-loaded','diagnostika:home-workspace-ready'])window.addEventListener(name,update);
  async function recoverHeader(){
    if(recovering||failed||shown)return;
    recovering=true;
    const parts=[
      ['i18n.js?v=20261121-locale50',()=>!!window.DiagnostikaI18n],
      ['settings-menu.js?v=20261121-header52',()=>!!window.DiagnostikaSettingsUI&&!!document.getElementById('settingsMenuBtn')],
      ['header-utilities.js?v=20261121-header52',()=>!!document.getElementById('headerUtilityGroup')],
      ['quick-notes.js?v=20261121-header52',()=>!!document.getElementById('quickNotesBtn')]
    ];
    try{
      for(const [src,check] of parts){
        if(check())continue;
        await new Promise((resolve,reject)=>{
          const script=document.createElement('script');script.src=src+'&retry=1';
          const timer=setTimeout(()=>reject(Error(src)),5000);
          script.onload=()=>{clearTimeout(timer);check()?resolve():reject(Error(src));};
          script.onerror=()=>{clearTimeout(timer);reject(Error(src));};
          document.head.appendChild(script);
        });
      }
    }catch(err){console.error('Header initialization failed:',err);}
    finally{recovering=false;update();}
  }
  document.addEventListener('DOMContentLoaded',()=>{if(!headerReady())recoverHeader();else update();},{once:true});
  window.addEventListener('diagnostika:header-component-ready',update);
  update();
  setTimeout(()=>{if(!shown&&!failed){if(ready())update();else showFailure('Приложение не загрузилось полностью. Проверьте соединение и повторите загрузку. Не очищайте данные сайта: в браузере могут храниться клиенты и вложения.');}},20000);
})();
