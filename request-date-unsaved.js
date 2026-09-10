'use strict';

(() => {
  const PREFIX={ru:'Запрос',en:'Request',fr:'Demande',de:'Anliegen',it:'Richiesta'};

  function currentLang(){
    const l=window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'en';
    return PREFIX[l]?l:'en';
  }

  function formatRequestDate(raw){
    if(!raw) return '';
    const d=new Date(raw);
    if(Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(currentLang()==='en'?'en-GB':currentLang()==='fr'?'fr-FR':currentLang()==='de'?'de-DE':currentLang()==='it'?'it-IT':'ru-RU');
  }

  function relabelRequests(){
    const c=typeof client==='function'?client():null;
    const select=document.querySelector('#requestSelect');
    if(!c||!select||!Array.isArray(c.requests)) return;
    const prefix=PREFIX[currentLang()];
    [...select.options].forEach((option,index)=>{
      const r=c.requests.find(x=>x.id===option.value)||c.requests[index];
      const date=formatRequestDate(r?.createdAt||r?.createdDate||r?.date);
      const label=`${prefix} ${index+1}${date?` · ${date}`:''}`;
      if(option.textContent!==label) option.textContent=label;
    });
  }

  const requestSelect=document.querySelector('#requestSelect');
  if(requestSelect){
    new MutationObserver(()=>setTimeout(relabelRequests,0)).observe(requestSelect,{childList:true});
    requestSelect.addEventListener('change',()=>setTimeout(relabelRequests,0));
  }

  const oldSetLanguage=window.DiagnostikaI18n?.setLanguage;
  if(oldSetLanguage&&!oldSetLanguage.__requestDatePatched){
    const wrapped=function(lang){
      const result=oldSetLanguage.call(this,lang);
      setTimeout(relabelRequests,0);
      return result;
    };
    wrapped.__requestDatePatched=true;
    window.DiagnostikaI18n.setLanguage=wrapped;
  }

  function normalizePaymentTitle(){
    document.querySelectorAll('.client-payment-title').forEach(el=>{
      if(el.textContent!=='ОПЛАТА') el.textContent='ОПЛАТА';
    });
  }
  new MutationObserver(normalizePaymentTitle).observe(document.body,{childList:true,subtree:true,characterData:true});

  function snapshot(dlg){
    return [...dlg.querySelectorAll('input,select,textarea')]
      .filter(el=>el.type!=='file')
      .map(el=>`${el.type}|${el.checked?'1':'0'}|${el.value}`)
      .join('\u241e');
  }

  async function askSave(dlg,saveBtn,closeWithoutSave){
    const yes=window.AppDialog?.confirm
      ? await window.AppDialog.confirm('Сохранить изменения?','Несохранённые изменения','Да','Нет')
      : confirm('Сохранить изменения?');
    if(yes){
      saveBtn?.click();
    }else{
      closeWithoutSave();
    }
  }

  function guardSessionDialog(dlg){
    if(!dlg||dlg.dataset.unsavedGuard==='1') return;
    dlg.dataset.unsavedGuard='1';
    const initial=snapshot(dlg);
    let bypass=false;
    const saveBtn=dlg.querySelector('.session-edit-actions .primary');
    const deleteBtn=dlg.querySelector('.session-delete-btn');
    const cancelBtn=[...dlg.querySelectorAll('.session-edit-actions button')].find(b=>b!==saveBtn&&b!==deleteBtn);
    const dirty=()=>snapshot(dlg)!==initial;
    const discard=()=>{bypass=true;try{dlg.close();}catch(e){}};

    saveBtn?.addEventListener('click',()=>{bypass=true;},{capture:true});
    deleteBtn?.addEventListener('click',()=>{bypass=true;},{capture:true});

    if(cancelBtn){
      cancelBtn.addEventListener('click',e=>{
        if(bypass||!dirty()) return;
        e.preventDefault();e.stopImmediatePropagation();
        askSave(dlg,saveBtn,discard);
      },true);
    }

    dlg.addEventListener('click',e=>{
      if(e.target!==dlg||bypass) return;
      if(!dirty()){discard();return;}
      e.preventDefault();e.stopImmediatePropagation();
      askSave(dlg,saveBtn,discard);
    },true);

    dlg.addEventListener('cancel',e=>{
      if(bypass||!dirty()) return;
      e.preventDefault();
      askSave(dlg,saveBtn,discard);
    });
  }

  const oldOpenSessionEditor=window.openSessionEditor;
  if(typeof oldOpenSessionEditor==='function'&&!oldOpenSessionEditor.__unsavedGuardPatched){
    const wrapped=function(){
      const result=oldOpenSessionEditor.apply(this,arguments);
      const dialogs=[...document.querySelectorAll('dialog.session-edit-dialog')];
      guardSessionDialog(dialogs[dialogs.length-1]);
      return result;
    };
    wrapped.__unsavedGuardPatched=true;
    window.openSessionEditor=wrapped;
  }

  function guardClientCard(){
    const dlg=document.querySelector('#clientCardDialog');
    const openBtn=document.querySelector('#clientCardModeBtn');
    if(!dlg||!openBtn||dlg.dataset.unsavedGuard==='1') return;
    dlg.dataset.unsavedGuard='1';
    let initial='';let bypass=false;
    const saveBtn=dlg.querySelector('#ccSaveBtn');
    const closeBtn=dlg.querySelector('#ccCloseBtn');
    const dirty=()=>snapshot(dlg)!==initial;
    const discard=()=>{bypass=true;try{dlg.close();}catch(e){}};

    openBtn.addEventListener('click',()=>setTimeout(()=>{initial=snapshot(dlg);bypass=false;},0),true);
    saveBtn?.addEventListener('click',()=>{bypass=true;},true);
    closeBtn?.addEventListener('click',e=>{
      if(bypass||!dirty()) return;
      e.preventDefault();e.stopImmediatePropagation();
      askSave(dlg,saveBtn,discard);
    },true);
    dlg.addEventListener('click',e=>{
      if(e.target!==dlg||bypass) return;
      if(!dirty()){discard();return;}
      e.preventDefault();e.stopImmediatePropagation();
      askSave(dlg,saveBtn,discard);
    },true);
    dlg.addEventListener('cancel',e=>{
      if(bypass||!dirty()) return;
      e.preventDefault();
      askSave(dlg,saveBtn,discard);
    });
  }

  guardClientCard();
  relabelRequests();
  normalizePaymentTitle();
})();
