'use strict';

(() => {
  if (window.__diagnostikaAiSettingsButtonReady) return;
  window.__diagnostikaAiSettingsButtonReady = true;

  const PROD_URL='https://lugovoyn8n.ru/webhook/diagnostika-ai-request';
  const URL_KEY='diagnostika-ai-n8n-webhook-url';

  // Для этой сборки всегда используем опубликованный production webhook.
  // Старый /webhook-test/ из localStorage больше не может влиять на работу.
  try{localStorage.setItem(URL_KEY,PROD_URL);}catch(_){}

  function loadProcessingIndicator(){
    if(window.__diagnostikaAiProcessingIndicatorReady) return;
    if(document.querySelector('script[data-ai-processing-indicator]')) return;
    const s=document.createElement('script');
    s.src='ai-processing-indicator.js?v=20260913-114';
    s.setAttribute('data-ai-processing-indicator','1');
    document.body.appendChild(s);
  }

  function forceProductionUrl(){
    try{localStorage.setItem(URL_KEY,PROD_URL);}catch(_){}
  }

  function attach(){
    const dlg=document.getElementById('freeConsultationDialog');
    if(!dlg) return;
    forceProductionUrl();

    const left=dlg.querySelector('.fc-actions-left');
    if(!left || left.querySelector('.fc-ai-settings')) return;

    const btn=document.createElement('button');
    btn.type='button';
    btn.className='tk-btn fc-ai-settings';
    btn.textContent='⚙ Настройки ИИ';
    btn.title='Ключ доступа ИИ. Production webhook уже задан программой.';
    btn.onclick=()=>{
      try{
        const cfg=window.DiagnostikaRequestAI?.configure?.();
        forceProductionUrl();
        if(cfg){
          const st=dlg.querySelector('.fc-status');
          if(st){
            st.textContent='Настройки сохранены · Production webhook установлен';
            setTimeout(()=>{if(st.textContent.includes('Production webhook'))st.textContent='';},2200);
          }
        }
      }catch(err){
        forceProductionUrl();
        alert(err?.message||'Не удалось сохранить настройки ИИ');
      }
    };
    left.appendChild(btn);
  }

  // Даже если старый модуль успел загрузиться раньше, перед каждым кликом анализа
  // восстанавливаем правильный production URL.
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.fc-ai')) forceProductionUrl();
  },true);

  loadProcessingIndicator();
  attach();
  new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});
})();
