'use strict';

(() => {
  if (window.__formIntegrationsInboxFixReady) return;
  window.__formIntegrationsInboxFixReady = true;

  const PROD_INBOX = 'https://lugovoyn8n.ru/webhook/diagnostika-forms-inbox';

  function forceProdInbox(){
    try{
      const cfg = window.DiagnostikaForms?.getConfig?.();
      if (cfg) cfg.inboxUrl = PROD_INBOX;
    }catch(_){}

    const input = document.getElementById('fiInboxUrl');
    if (input && input.value !== PROD_INBOX) input.value = PROD_INBOX;
  }

  function bind(){
    forceProdInbox();

    const check = document.getElementById('fiCheck');
    if (check && check.dataset.prodInboxGuard !== '1'){
      check.dataset.prodInboxGuard = '1';
      check.addEventListener('click', forceProdInbox, true);
    }

    const save = document.getElementById('fiSave');
    if (save && save.dataset.prodInboxGuard !== '1'){
      save.dataset.prodInboxGuard = '1';
      save.addEventListener('click', forceProdInbox, true);
    }
  }

  bind();
  setTimeout(bind, 100);
  setTimeout(bind, 500);
  setTimeout(bind, 1500);
})();
