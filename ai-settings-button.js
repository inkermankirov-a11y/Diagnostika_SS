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
    s.src='free-consultation-archive.js?v=20260913-121';
    s.setAttribute('data-fc-archive','1');
    document.body.appendChild(s);
  }

  function loadConsultationExtraFields(){
    if(window.__freeConsultationExtraFieldsReady) return;
    if(document.querySelector('script[data-fc-extra-fields]')) return;
    const s=document.createElement('script');
    s.src='free-consultation-extra-fields.js?v=20260913-122';
    s.setAttribute('data-fc-extra-fields','1');
    document.body.appendChild(s);
  }

  function loadQuestionnaireCopyFix(){
    if(window.__formIntegrationsCopyFixReady) return;
    if(document.querySelector('script[data-form-integrations-copy-fix]')) return;
    const s=document.createElement('script');
    s.src='form-integrations-copy-fix.js?v=20260913-124';
    s.setAttribute('data-form-integrations-copy-fix','1');
    document.body.appendChild(s);
  }

  function loadQuestionnaireInboxFix(){
    if(window.__formIntegrationsInboxFixReady) return;
    if(document.querySelector('script[data-form-integrations-inbox-fix]')) return;
    const s=document.createElement('script');
    s.src='form-integrations-inbox-fix.js?v=20260913-129';
    s.setAttribute('data-form-integrations-inbox-fix','1');
    document.body.appendChild(s);
  }

  function loadQuestionnaireModeButtons(){
    if(window.__formIntegrationsModeButtonsReady) return;
    if(document.querySelector('script[data-form-integrations-mode-buttons]')) return;
    const s=document.createElement('script');
    s.src='form-integrations-mode-buttons.js?v=20260913-130';
    s.setAttribute('data-form-integrations-mode-buttons','1');
    document.body.appendChild(s);
  }

  function loadQuestionnaireHelpers(){
    loadQuestionnaireCopyFix();
    loadQuestionnaireInboxFix();
    loadQuestionnaireModeButtons();
  }

  function loadQuestionnaireIntegrations(){
    if(!window.__diagnostikaIntegrationStorageReady && !document.querySelector('script[data-integration-folder-storage]')){
      const s=document.createElement('script');
      s.src='integration-folder-storage.js?v=20260913-123';
      s.setAttribute('data-integration-folder-storage','1');
      s.onload=()=>loadQuestionnaireIntegrations();
      document.body.appendChild(s);
      return;
    }
    if(!window.__diagnostikaFormIntegrationsReady && !document.querySelector('script[data-form-integrations]')){
      const s=document.createElement('script');
      s.src='form-integrations.js?v=20260913-123';
      s.setAttribute('data-form-integrations','1');
      s.onload=()=>loadQuestionnaireHelpers();
      document.body.appendChild(s);
    }else{
      loadQuestionnaireHelpers();
    }
    if(!window.__diagnostikaClientQuestionnairesReady && !document.querySelector('script[data-client-questionnaires]')){
      const s=document.createElement('script');
      s.src='client-questionnaires.js?v=20260913-123';
      s.setAttribute('data-client-questionnaires','1');
      document.body.appendChild(s);
    }
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
  loadConsultationExtraFields();
  loadQuestionnaireIntegrations();
  attach();
  new MutationObserver(()=>{
    attach();
    loadConsultationArchive();
    loadConsultationExtraFields();
    loadQuestionnaireIntegrations();
  }).observe(document.body,{childList:true,subtree:true});
})();