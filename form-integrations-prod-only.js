'use strict';
(() => {
  if (window.__formIntegrationsProdOnlyReady) return;
  window.__formIntegrationsProdOnlyReady = true;

  const PROD_INBOX='https://lugovoyn8n.ru/webhook/diagnostika-forms-inbox';
  const PROD_YANDEX='https://lugovoyn8n.ru/webhook/diagnostika-form-yandex';
  const MODE_KEY='diagnostika-yandex-form-mode-v1';

  function apply(){
    try{localStorage.removeItem(MODE_KEY);}catch(_){}

    try{
      const cfg=window.DiagnostikaForms?.getConfig?.();
      if(cfg){
        cfg.inboxUrl=PROD_INBOX;
        cfg.yandex=cfg.yandex||{};
        cfg.yandex.intakeUrl=PROD_YANDEX;
      }
    }catch(_){}

    try{
      const storage=window.DiagnostikaIntegrationStorage;
      const local=storage?.readLocal?.();
      if(local&&typeof local==='object'){
        local.inboxUrl=PROD_INBOX;
        local.yandex={...(local.yandex||{}),intakeUrl:PROD_YANDEX};
        storage.writeLocal?.(local);
      }
    }catch(_){}

    const inbox=document.getElementById('fiInboxUrl');
    if(inbox){inbox.value=PROD_INBOX;inbox.readOnly=true;}
    const yandex=document.getElementById('fiYandexUrl');
    if(yandex){yandex.value=PROD_YANDEX;yandex.readOnly=true;}
    document.getElementById('fiYandexModeBox')?.remove();
  }

  apply();
  setTimeout(apply,100);
  setTimeout(apply,500);
  setTimeout(apply,1500);

  const save=document.getElementById('fiSave');
  save?.addEventListener('click',apply,true);
})();
