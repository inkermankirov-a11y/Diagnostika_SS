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

  function localizeStatus(){
    const status=document.getElementById('fiStatus');
    if(!status) return;
    const text=String(status.textContent||'').trim();

    if(/^Получено новых:\s*0\./i.test(text)){
      status.textContent='Анкет не найдено.';
      return;
    }

    if(/failed to fetch|networkerror|load failed/i.test(text)){
      status.textContent='Не удалось получить анкеты: n8n сейчас недоступен. Проверьте, что workflow для получения анкет опубликован и активен.';
    }
  }

  function scheduleStatusCheck(){
    setTimeout(localizeStatus,150);
    setTimeout(localizeStatus,600);
    setTimeout(localizeStatus,1500);
    setTimeout(localizeStatus,3000);
  }

  function bind(){
    forceProdInbox();

    const check = document.getElementById('fiCheck');
    if (check && check.dataset.prodInboxGuard !== '1'){
      check.dataset.prodInboxGuard = '1';
      check.addEventListener('click',()=>{
        forceProdInbox();
        scheduleStatusCheck();
      },true);
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
