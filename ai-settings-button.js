'use strict';

(() => {
  if (window.__diagnostikaAiSettingsButtonReady) return;
  window.__diagnostikaAiSettingsButtonReady = true;

  function loadOnce(src, attr, readyFlag){
    if(window[readyFlag]) return null;
    if(document.querySelector(`script[${attr}]`)) return null;
    const s=document.createElement('script');
    s.src=src;
    s.setAttribute(attr,'1');
    document.body.appendChild(s);
    return s;
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

  function loadQuestionnaireIntegrations(){
    if(window.__diagnostikaStableFormLoaderStarted) return;
    window.__diagnostikaStableFormLoaderStarted=true;

    const storage=loadOnce('integration-folder-storage.js?v=20260913-141','data-integration-folder-storage','__diagnostikaIntegrationStorageReady');
    const loadCore=()=>{
      const core=loadOnce('form-integrations.js?v=20260913-141','data-form-integrations','__diagnostikaFormIntegrationsReady');
      const loadHelpers=()=>{
        loadOnce('form-integrations-copy-fix.js?v=20260913-141','data-form-integrations-copy-fix','__formIntegrationsCopyFixReady');
        loadOnce('form-integrations-inbox-fix.js?v=20260913-141','data-form-integrations-inbox-fix','__formIntegrationsInboxFixReady');
        loadOnce('form-integrations-lock.js?v=20260913-141','data-form-integrations-lock','__formIntegrationsLockReady');
        const questionnaires=loadOnce('client-questionnaires.js?v=20260913-141','data-client-questionnaires','__diagnostikaClientQuestionnairesReady');
        const loadManualTemplate=()=>loadOnce('manual-questionnaire-template.js?v=20260913-141','data-manual-questionnaire-template','__diagnostikaManualQuestionnaireTemplateReady');
        if(questionnaires) questionnaires.addEventListener('load',loadManualTemplate,{once:true}); else loadManualTemplate();
      };
      if(core) core.addEventListener('load',loadHelpers,{once:true}); else loadHelpers();
    };
    if(storage) storage.addEventListener('load',loadCore,{once:true}); else loadCore();
  }

  loadOnce('ai-processing-indicator.js?v=20260913-141','data-ai-processing-indicator','__diagnostikaAiProcessingIndicatorReady');
  loadOnce('free-consultation-archive.js?v=20260913-141','data-fc-archive','__freeConsultationArchiveReady');
  loadOnce('free-consultation-extra-fields.js?v=20260913-141','data-fc-extra-fields','__freeConsultationExtraFieldsReady');
  attach();

  if(document.readyState==='complete') loadQuestionnaireIntegrations();
  else window.addEventListener('load',loadQuestionnaireIntegrations,{once:true});
})();
