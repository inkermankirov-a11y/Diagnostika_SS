'use strict';

(() => {
  if (window.__freeConsultationExtraFieldsReady) return;
  window.__freeConsultationExtraFieldsReady = true;

  // Historical tried/didntHelp fields are maintained in archives only.
  // The live consultation uses the single .fc-attempts field. Never recreate
  // .fc-tried/.fc-didnt-help while the specialist is typing.
  function removeDuplicateFields(){
    const grid=document.querySelector('#freeConsultationDialog .fc-grid');
    if(!grid)return;
    for(const field of grid.querySelectorAll('.fc-tried,.fc-worked,.fc-didnt-help')){
      const label=field.closest('.fc-field');
      if(label)label.remove();else field.remove();
    }
    for(const fragment of grid.querySelectorAll('.fc-extra-fields-fragment')){
      if(!fragment.querySelector('textarea,input,select'))fragment.remove();
    }
  }

  function getClient(){
    try{if(typeof client==='function')return client()||null;}catch(_){}
    try{return state?.clients?.find(c=>String(c.id)===String(clientId))||null;}catch(_){}
    return null;
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


  // Observe only archive editor replacement, not every DOM mutation in the app.
  // subtree:false avoids recursive notifications when archive fields are added.
  let archiveBound=false;
  function bindArchive(){
    if(archiveBound)return true;
    const dialog=document.querySelector('.fc-archive-dialog');
    const editor=dialog?.querySelector('.fc-archive-editor');
    if(!editor)return false;
    archiveBound=true;
    new MutationObserver(records=>{
      if(records.some(record=>record.addedNodes.length))enhanceArchiveEditor();
    }).observe(editor,{childList:true});
    dialog.addEventListener('toggle',()=>{if(dialog.open)enhanceArchiveEditor();});
    enhanceArchiveEditor();
    return true;
  }

  document.addEventListener('click',event=>{
    if(event.target?.closest?.('.fc-archive-restore'))saveArchiveExtraBeforeRestore();
  },true);

  const dialog=document.getElementById('freeConsultationDialog');
  dialog?.addEventListener('toggle',()=>{if(dialog.open)removeDuplicateFields();});
  removeDuplicateFields();
  if(!bindArchive()){
    document.querySelector('script[data-fc-archive]')?.addEventListener('load',bindArchive,{once:true});
  }
})();
