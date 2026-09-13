'use strict';

(() => {
  if (window.__diagnostikaAiSettingsButtonReady) return;
  window.__diagnostikaAiSettingsButtonReady = true;

  function loadProcessingIndicator(){
    if(window.__diagnostikaAiProcessingIndicatorReady) return;
    if(document.querySelector('script[data-ai-processing-indicator]')) return;
    const s=document.createElement('script');
    s.src='ai-processing-indicator.js?v=20260913-119';
    s.setAttribute('data-ai-processing-indicator','1');
    document.body.appendChild(s);
  }

  function loadConsultationArchive(){
    if(window.__freeConsultationArchiveReady) return;
    if(document.querySelector('script[data-fc-archive]')) return;
    const s=document.createElement('script');
    s.src='free-consultation-archive.js?v=20260913-119';
    s.setAttribute('data-fc-archive','1');
    document.body.appendChild(s);
  }

  function attach(){
    const dlg=document.getElementById('freeConsultationDialog');
    if(!dlg) return;
    const left=dlg.querySelector('.fc-actions-left');
    if(!left || left.querySelector('.fc-ai-settings')) return;

    const btn=document.createElement('button');
    btn.type='button';
    btn.className='tk-btn fc-ai-settings';
    btn.textContent='⚙ Настройки ИИ';
    btn.title='Изменить ключ доступа ИИ';
    btn.onclick=()=>{
      try{
        const cfg=window.DiagnostikaRequestAI?.configure?.();
        if(cfg){
          const st=dlg.querySelector('.fc-status');
          if(st){
            st.textContent='Настройки ИИ сохранены';
            setTimeout(()=>{if(st.textContent==='Настройки ИИ сохранены')st.textContent='';},1800);
          }
        }
      }catch(err){
        alert(err?.message||'Не удалось сохранить настройки ИИ');
      }
    };
    left.appendChild(btn);
  }

  loadProcessingIndicator();
  loadConsultationArchive();
  attach();
  new MutationObserver(()=>{attach();loadConsultationArchive();}).observe(document.body,{childList:true,subtree:true});
})();
