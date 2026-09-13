'use strict';

(() => {
  if (window.__formIntegrationsInboxFixReady) return;
  window.__formIntegrationsInboxFixReady = true;

  const PROD_INBOX = 'https://lugovoyn8n.ru/webhook/diagnostika-forms-inbox';
  const SEEN_KEY = 'diagnostika-questionnaire-seen-v1';

  function loadSeen(){
    try{
      const v=JSON.parse(localStorage.getItem(SEEN_KEY)||'[]');
      return new Set(Array.isArray(v)?v.map(String):[]);
    }catch(_){return new Set();}
  }

  function saveSeen(set){
    try{localStorage.setItem(SEEN_KEY,JSON.stringify([...set]));}catch(_){}
  }

  function collectSeenFromState(){
    const seen=loadSeen();
    try{
      const pools=[...(state?.clients||[]),...(state?.deletedClients||[])];
      for(const c of pools){
        for(const q of c?.questionnaires||[]){
          if(q?.externalId) seen.add(String(q.externalId));
        }
      }
    }catch(_){}
    saveSeen(seen);
    return seen;
  }

  function forceProdInbox(){
    try{
      const cfg = window.DiagnostikaForms?.getConfig?.();
      if (cfg) cfg.inboxUrl = PROD_INBOX;
    }catch(_){}

    const input = document.getElementById('fiInboxUrl');
    if (input && input.value !== PROD_INBOX) input.value = PROD_INBOX;
  }

  function translateStatus(){
    const st=document.getElementById('fiStatus');
    if(!st) return;
    const text=String(st.textContent||'').trim();
    if(text==='Получено новых: 0. Новых клиентов: 0. Добавлено к существующим: 0.'){
      st.textContent='Анкет не найдено.';
    }else if(text==='Failed to fetch'){
      st.textContent='Не удалось получить анкеты: n8n сейчас недоступен или рабочий workflow не опубликован.';
    }
  }

  if(!window.__diagnostikaInboxFetchGuard){
    window.__diagnostikaInboxFetchGuard=true;
    const nativeFetch=window.fetch.bind(window);
    window.fetch=async function(input,init){
      const url=typeof input==='string'?input:String(input?.url||'');
      const isInbox=url.includes('/diagnostika-forms-inbox');
      if(!isInbox) return nativeFetch(input,init);

      forceProdInbox();
      let response;
      try{
        response=await nativeFetch(input,init);
      }catch(_){
        throw new Error('Не удалось получить анкеты: n8n сейчас недоступен или рабочий workflow не опубликован.');
      }

      if(!response.ok) return response;
      try{
        const data=await response.clone().json();
        if(data && Array.isArray(data.submissions)){
          const seen=collectSeenFromState();
          const submissions=data.submissions.filter(s=>{
            const id=String(s?.externalId||s?.id||'');
            return !id || !seen.has(id);
          });
          const headers=new Headers(response.headers);
          headers.set('Content-Type','application/json');
          return new Response(JSON.stringify({...data,submissions}),{
            status:response.status,
            statusText:response.statusText,
            headers
          });
        }
      }catch(_){}
      return response;
    };
  }

  window.addEventListener('diagnostika:questionnairesImported',()=>{
    setTimeout(collectSeenFromState,0);
  });

  function bind(){
    forceProdInbox();
    collectSeenFromState();

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

    const st=document.getElementById('fiStatus');
    if(st && st.dataset.ruStatusGuard!=='1'){
      st.dataset.ruStatusGuard='1';
      new MutationObserver(translateStatus).observe(st,{childList:true,subtree:true,characterData:true});
    }
    translateStatus();
  }

  bind();
  setTimeout(bind,100);
  setTimeout(bind,500);
  setTimeout(bind,1500);
})();
