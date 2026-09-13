'use strict';

(() => {
  if (window.__diagnostikaAiSettingsButtonReady) return;
  window.__diagnostikaAiSettingsButtonReady = true;

  function attach(){
    const dlg=document.getElementById('freeConsultationDialog');
    if(!dlg) return;
    const left=dlg.querySelector('.fc-actions-left');
    if(!left || left.querySelector('.fc-ai-settings')) return;

    const btn=document.createElement('button');
    btn.type='button';
    btn.className='tk-btn fc-ai-settings';
    btn.textContent='⚙ Настройки ИИ';
    btn.title='Изменить Production URL webhook и ключ доступа';
    btn.onclick=()=>{
      try{
        const cfg=window.DiagnostikaRequestAI?.configure?.();
        if(cfg){
          const st=dlg.querySelector('.fc-status');
          if(st){st.textContent='Настройки ИИ сохранены';setTimeout(()=>{if(st.textContent==='Настройки ИИ сохранены')st.textContent='';},1600);}
        }
      }catch(err){
        alert(err?.message||'Не удалось сохранить настройки ИИ');
      }
    };
    left.appendChild(btn);
  }

  attach();
  new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});
})();
