'use strict';

(() => {
  if(window.__formIntegrationsTestModeReady) return;
  window.__formIntegrationsTestModeReady=true;

  const PROD_INBOX='https://lugovoyn8n.ru/webhook/diagnostika-forms-inbox';
  const TEST_INBOX='https://lugovoyn8n.ru/webhook-test/diagnostika-forms-inbox';
  const PROD_YANDEX='https://lugovoyn8n.ru/webhook/diagnostika-form-yandex';
  const TEST_YANDEX='https://lugovoyn8n.ru/webhook-test/diagnostika-form-yandex';

  function copy(text,button){
    const value=String(text||'');
    if(!value) return;
    const done=()=>{
      const old=button.textContent;
      button.textContent='Скопировано';
      setTimeout(()=>button.textContent=old,1200);
    };
    if(navigator.clipboard?.writeText){
      navigator.clipboard.writeText(value).then(done).catch(()=>fallback());
    }else fallback();
    function fallback(){
      const ta=document.createElement('textarea');
      ta.value=value;ta.style.position='fixed';ta.style.opacity='0';
      document.body.appendChild(ta);ta.focus();ta.select();
      try{document.execCommand('copy');done();}catch(_){}
      ta.remove();
    }
  }

  function isTestValue(v){return String(v||'').includes('/webhook-test/');}

  function setMode(test){
    const inbox=document.getElementById('fiInboxUrl');
    const yandex=document.getElementById('fiYandexUrl');
    const toggle=document.getElementById('fiN8nTestMode');
    const label=document.getElementById('fiN8nModeLabel');
    const note=document.getElementById('fiN8nModeNote');
    if(toggle) toggle.checked=!!test;
    if(inbox) inbox.value=test?TEST_INBOX:PROD_INBOX;
    if(yandex) yandex.value=test?TEST_YANDEX:PROD_YANDEX;
    if(label) label.textContent=test?'ТЕСТОВЫЙ':'РАБОЧИЙ';
    if(note){
      note.textContent=test
        ? 'Тест: в n8n нажми Execute workflow / Listen for test event. Для проверки Яндекс Формы временно укажи тестовый webhook ниже. Тестовый адрес работает только пока n8n ждёт событие.'
        : 'Рабочий режим: используется production webhook. Workflow n8n должен быть Published / Active.';
    }
  }

  function wrapUrlWithCopy(input,label){
    if(!input || input.parentElement?.querySelector(`[data-url-copy-for="${input.id}"]`)) return;
    const parent=input.parentElement;
    const row=document.createElement('div');
    row.className='fi-test-url-row';
    parent.insertBefore(row,input);
    row.appendChild(input);
    const b=document.createElement('button');
    b.type='button';b.dataset.urlCopyFor=input.id;b.textContent=label;b.title='Скопировать URL';
    b.onclick=e=>{e.preventDefault();e.stopPropagation();copy(input.value,b);};
    row.appendChild(b);
  }

  function attach(){
    const dlg=document.getElementById('formIntegrationsDialog');
    if(!dlg) return;

    const grid=dlg.querySelector('.fi-grid');
    if(grid && !document.getElementById('fiN8nModeBox')){
      const box=document.createElement('div');
      box.id='fiN8nModeBox';box.className='fi-mode-box';
      box.innerHTML=`
        <div class="fi-mode-head">
          <strong>Режим n8n</strong>
          <label class="fi-mode-toggle"><input id="fiN8nTestMode" type="checkbox"> Тестовый режим</label>
          <span id="fiN8nModeLabel" class="fi-mode-badge">РАБОЧИЙ</span>
        </div>
        <div id="fiN8nModeNote" class="fi-mode-note"></div>`;
      grid.insertAdjacentElement('afterend',box);
      box.querySelector('#fiN8nTestMode').addEventListener('change',e=>setMode(e.target.checked));
    }

    wrapUrlWithCopy(document.getElementById('fiInboxUrl'),'Копировать URL');
    wrapUrlWithCopy(document.getElementById('fiYandexUrl'),'Копировать webhook');

    if(!document.getElementById('fiTestModeStyles')){
      const style=document.createElement('style');style.id='fiTestModeStyles';style.textContent=`
        .fi-mode-box{margin-top:14px;padding:12px 14px;border:1px solid #dbe3ed;border-radius:12px;background:#f8fafc}
        .fi-mode-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.fi-mode-head strong{margin-right:auto}
        .fi-mode-toggle{font-size:13px;font-weight:800;display:flex;align-items:center;gap:7px}.fi-mode-badge{font-size:11px;font-weight:900;padding:4px 8px;border-radius:999px;background:#dbeafe;color:#1e40af}
        .fi-mode-note{margin-top:8px;font-size:12px;line-height:1.4;color:#475569}
        .fi-test-url-row{display:grid;grid-template-columns:1fr auto;gap:7px}.fi-test-url-row>button{border:1px solid #cbd5e1;background:#f8fafc;border-radius:9px;padding:0 12px;font-weight:800;cursor:pointer;min-height:40px}
        @media(max-width:650px){.fi-test-url-row{grid-template-columns:1fr}.fi-test-url-row>button{height:38px}}
      `;document.head.appendChild(style);
    }

    const sync=()=>{
      const inbox=document.getElementById('fiInboxUrl');
      const yandex=document.getElementById('fiYandexUrl');
      const test=isTestValue(inbox?.value)||isTestValue(yandex?.value);
      const toggle=document.getElementById('fiN8nTestMode');
      const label=document.getElementById('fiN8nModeLabel');
      const note=document.getElementById('fiN8nModeNote');
      if(toggle) toggle.checked=test;
      if(label) label.textContent=test?'ТЕСТОВЫЙ':'РАБОЧИЙ';
      if(note) note.textContent=test
        ? 'Тест: в n8n нажми Execute workflow / Listen for test event. Для проверки Яндекс Формы временно укажи тестовый webhook ниже. Тестовый адрес работает только пока n8n ждёт событие.'
        : 'Рабочий режим: используется production webhook. Workflow n8n должен быть Published / Active.';
    };

    if(dlg.dataset.testModeWatch!=='1'){
      dlg.dataset.testModeWatch='1';
      new MutationObserver(()=>{if(dlg.open)setTimeout(sync,0);}).observe(dlg,{attributes:true,attributeFilter:['open']});
      dlg.addEventListener('close',sync);
    }
    sync();
  }

  attach();
  new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});
})();
