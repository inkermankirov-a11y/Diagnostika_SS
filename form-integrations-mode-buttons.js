'use strict';

(() => {
  if (window.__formIntegrationsModeButtonsReady) return;
  window.__formIntegrationsModeButtonsReady = true;

  const PROD_INBOX='https://lugovoyn8n.ru/webhook/diagnostika-forms-inbox';
  const PROD_YANDEX='https://lugovoyn8n.ru/webhook/diagnostika-form-yandex';
  const TEST_YANDEX='https://lugovoyn8n.ru/webhook-test/diagnostika-form-yandex';

  const q=id=>document.getElementById(id);
  const dlg=q('formIntegrationsDialog');
  const yandexUrl=q('fiYandexUrl');
  const inboxUrl=q('fiInboxUrl');
  if(!dlg || !yandexUrl || !inboxUrl) return;

  // Сайт всегда забирает анкеты через опубликованный production inbox.
  inboxUrl.value=PROD_INBOX;
  inboxUrl.readOnly=true;
  inboxUrl.title='Этот адрес всегда рабочий и не переключается в тестовый режим';

  const source=yandexUrl.closest('.fi-source');
  if(!source || q('fiYandexModeBox')) return;

  const box=document.createElement('div');
  box.id='fiYandexModeBox';
  box.className='fi-yandex-mode-box';
  box.innerHTML=`
    <div class="fi-yandex-mode-title">Режим Яндекс Формы</div>
    <div class="fi-yandex-mode-buttons">
      <button type="button" id="fiYandexProdMode">Рабочий</button>
      <button type="button" id="fiYandexTestMode">Тестовый режим</button>
      <span id="fiYandexModeBadge"></span>
    </div>
    <div id="fiYandexModeHelp" class="fi-yandex-mode-help"></div>`;

  const urlLabel=yandexUrl.closest('label');
  if(urlLabel) source.insertBefore(box,urlLabel); else source.appendChild(box);

  const style=document.createElement('style');
  style.textContent=`
    .fi-yandex-mode-box{padding:11px 12px;border:1px solid #dbe3ed;border-radius:10px;background:#f8fafc}
    .fi-yandex-mode-title{font-size:12px;font-weight:900;margin-bottom:8px}
    .fi-yandex-mode-buttons{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .fi-yandex-mode-buttons button{height:36px;padding:0 14px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;font-weight:900;cursor:pointer}
    .fi-yandex-mode-buttons button.active{background:#1d4ed8;color:#fff;border-color:#1d4ed8}
    #fiYandexTestMode.active{background:#d97706;border-color:#d97706}
    #fiYandexModeBadge{font-size:11px;font-weight:900;padding:4px 8px;border-radius:999px;background:#e2e8f0;color:#334155}
    .fi-yandex-mode-help{margin-top:8px;font-size:12px;line-height:1.4;color:#475569}
  `;
  document.head.appendChild(style);

  function syncUi(){
    inboxUrl.value=PROD_INBOX;
    inboxUrl.readOnly=true;
    const test=String(yandexUrl.value||'').includes('/webhook-test/');
    q('fiYandexProdMode')?.classList.toggle('active',!test);
    q('fiYandexTestMode')?.classList.toggle('active',test);
    const badge=q('fiYandexModeBadge');
    if(badge) badge.textContent=test?'ТЕСТ':'РАБОЧИЙ';
    const help=q('fiYandexModeHelp');
    if(help) help.textContent=test
      ? 'Тест: в тестовой копии n8n сначала нажми Execute workflow, затем включи тестовый сценарий в Яндекс Форме. Сайт продолжает получать анкеты через рабочий inbox.'
      : 'Рабочий режим: основной workflow n8n должен быть Published / Active, а в Яндекс Форме включён рабочий сценарий.';
  }

  function setMode(test){
    inboxUrl.value=PROD_INBOX;
    yandexUrl.value=test?TEST_YANDEX:PROD_YANDEX;
    const st=q('fiStatus');
    if(st) st.textContent=test
      ? 'Выбран тестовый webhook Яндекс Формы. Нажми «Сохранить».'
      : 'Выбран рабочий webhook Яндекс Формы. Нажми «Сохранить».';
    syncUi();
  }

  q('fiYandexProdMode').addEventListener('click',()=>setMode(false));
  q('fiYandexTestMode').addEventListener('click',()=>setMode(true));
  yandexUrl.addEventListener('input',syncUi);
  dlg.addEventListener('close',syncUi);

  // openDialog сначала подставляет сохранённые значения. После открытия возвращаем inbox на production.
  q('formIntegrationsBtn')?.addEventListener('click',()=>setTimeout(syncUi,0));

  syncUi();
})();
