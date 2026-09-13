'use strict';

(() => {
  if (window.__freeConsultationExtraFieldsReady) return;
  window.__freeConsultationExtraFieldsReady = true;

  function getClient(){
    try{ if(typeof client==='function'){ const c=client(); if(c) return c; } }catch(_){}
    try{ return state?.clients?.find(c=>String(c.id)===String(clientId))||null; }catch(_){}
    return null;
  }

  function saveState(){ try{ if(typeof save==='function') save(); }catch(_){} }

  function ensureCurrent(c){
    if(!c) return null;
    if(!c.freeConsultation || typeof c.freeConsultation!=='object' || Array.isArray(c.freeConsultation)) c.freeConsultation={};
    return c.freeConsultation;
  }

  function attachFields(){
    const dlg=document.getElementById('freeConsultationDialog');
    const grid=dlg?.querySelector('.fc-grid');
    if(!grid) return;

    if(!grid.querySelector('.fc-tried')){
      const wrap=document.createElement('div');
      wrap.className='fc-extra-fields-fragment';
      wrap.style.display='contents';
      wrap.innerHTML=`
        <label class="fc-field"><span>Что уже пробовал</span><textarea class="fc-tried" placeholder="Что клиент уже делал, чтобы решить проблему: терапия, разговоры, курсы, самостоятельные попытки, конкретные действия..."></textarea></label>
        <label class="fc-field"><span>Что не сработало</span><textarea class="fc-didnt-help" placeholder="Что именно не помогло, дало временный эффект или почему попытка не решила проблему..."></textarea></label>`;

      const desired=grid.querySelector('.fc-desired')?.closest('.fc-field');
      if(desired) desired.insertAdjacentElement('beforebegin',wrap);
      else grid.appendChild(wrap);
    }

    const tried=grid.querySelector('.fc-tried');
    const didnt=grid.querySelector('.fc-didnt-help');
    if(tried && !tried.dataset.fcExtraBound){
      tried.dataset.fcExtraBound='1';
      tried.addEventListener('input',()=>persistCurrent(false));
    }
    if(didnt && !didnt.dataset.fcExtraBound){
      didnt.dataset.fcExtraBound='1';
      didnt.addEventListener('input',()=>persistCurrent(false));
    }
  }

  function loadCurrentFields(){
    attachFields();
    const c=getClient(); if(!c) return;
    const fc=ensureCurrent(c);
    const dlg=document.getElementById('freeConsultationDialog');
    const tried=dlg?.querySelector('.fc-tried');
    const didnt=dlg?.querySelector('.fc-didnt-help');
    if(tried) tried.value=fc.tried||'';
    if(didnt) didnt.value=fc.didntHelp||'';
  }

  function persistCurrent(saveNow=true){
    const c=getClient(); if(!c) return;
    const fc=ensureCurrent(c);
    const dlg=document.getElementById('freeConsultationDialog');
    const tried=dlg?.querySelector('.fc-tried');
    const didnt=dlg?.querySelector('.fc-didnt-help');
    if(tried) fc.tried=tried.value||'';
    if(didnt) fc.didntHelp=didnt.value||'';
    fc.updatedAt=new Date().toISOString();
    if(saveNow) saveState();
  }

  function selectedArchiveItem(){
    const c=getClient(); if(!c) return null;
    const dlg=document.querySelector('.fc-archive-dialog');
    const cards=[...dlg?.querySelectorAll('.fc-archive-card')||[]];
    const selected=dlg?.querySelector('.fc-archive-card.selected');
    if(!selected) return null;
    const index=cards.indexOf(selected);
    if(index===0) return c.freeConsultation||null;
    const items=[...(Array.isArray(c.freeConsultationArchive)?c.freeConsultationArchive:[])]
      .sort((a,b)=>String(b.archivedAt||'').localeCompare(String(a.archivedAt||'')));
    return items[index-1]||null;
  }

  function enhanceArchiveEditor(){
    const editor=document.querySelector('.fc-archive-editor');
    const fields=editor?.querySelector('.fc-archive-fields');
    if(!fields || fields.querySelector('[data-fc-key="tried"]')) return;
    const item=selectedArchiveItem()||{};
    const make=(key,label,value)=>{
      const el=document.createElement('label');
      el.className='fc-archive-field';
      const span=document.createElement('span'); span.textContent=label;
      const ta=document.createElement('textarea'); ta.dataset.fcKey=key; ta.value=value||'';
      el.append(span,ta); return el;
    };
    const desired=fields.querySelector('[data-fc-key="desired"]')?.closest('.fc-archive-field');
    const tried=make('tried','Что уже пробовал',item.tried||'');
    const didnt=make('didntHelp','Что не сработало',item.didntHelp||'');
    if(desired){
      fields.insertBefore(tried,desired);
      fields.insertBefore(didnt,desired);
    }else{
      fields.append(tried,didnt);
    }
  }

  function saveArchiveExtraBeforeRestore(){
    const item=selectedArchiveItem();
    const editor=document.querySelector('.fc-archive-editor');
    if(!item||!editor) return;
    const tried=editor.querySelector('[data-fc-key="tried"]');
    const didnt=editor.querySelector('[data-fc-key="didntHelp"]');
    if(tried) item.tried=tried.value||'';
    if(didnt) item.didntHelp=didnt.value||'';
    item.updatedAt=new Date().toISOString();
  }

  function wrapAiGenerator(){
    const api=window.DiagnostikaRequestAI;
    if(!api || typeof api.generate!=='function' || api.generate.__fcExtraWrapped) return;
    const original=api.generate.bind(api);
    const wrapped=payload=>{
      persistCurrent(true);
      const c=getClient();
      const fc=c?.freeConsultation||{};
      const dlg=document.getElementById('freeConsultationDialog');
      return original({
        ...(payload||{}),
        tried:dlg?.querySelector('.fc-tried')?.value ?? fc.tried ?? '',
        didntHelp:dlg?.querySelector('.fc-didnt-help')?.value ?? fc.didntHelp ?? ''
      });
    };
    wrapped.__fcExtraWrapped=true;
    api.generate=wrapped;
  }

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.fc-save,.fc-ai,.fc-archive-current')) persistCurrent(true);
    if(e.target?.closest?.('.fc-archive-restore')){
      saveArchiveExtraBeforeRestore();
      setTimeout(()=>{loadCurrentFields();window.DiagnostikaFreeConsultationSync?.syncCurrent?.(true);},180);
    }
    if(e.target?.closest?.('.fc-archive-current')){
      setTimeout(()=>{loadCurrentFields();window.DiagnostikaFreeConsultationSync?.syncCurrent?.(true);},180);
    }
  },true);

  const dlg=document.getElementById('freeConsultationDialog');
  if(dlg){
    new MutationObserver(()=>{if(dlg.open)loadCurrentFields();}).observe(dlg,{attributes:true,attributeFilter:['open']});
  }

  const observer=new MutationObserver(()=>{
    attachFields();
    enhanceArchiveEditor();
    wrapAiGenerator();
  });
  observer.observe(document.body,{childList:true,subtree:true});

  attachFields();
  wrapAiGenerator();
  loadCurrentFields();
})();
