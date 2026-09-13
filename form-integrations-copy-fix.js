'use strict';

(() => {
  if (window.__formIntegrationsCopyFixReady) return;
  window.__formIntegrationsCopyFixReady = true;

  function copyValue(input, button){
    const value=String(input?.value||'');
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
      input.type='text';
      input.focus();
      input.select();
      try{document.execCommand('copy');done();}catch(_){}
      if(input.id!=='fiSpecialistId') input.type='password';
    }
  }

  function attach(){
    const dlg=document.getElementById('formIntegrationsDialog');
    if(!dlg || dlg.dataset.copyFix==='1') return;
    dlg.dataset.copyFix='1';
    dlg.dataset.noBackdropClose='1';

    // Правый клик нужен для обычного контекстного меню и не должен закрывать окно.
    dlg.addEventListener('contextmenu',e=>e.stopPropagation(),true);
    dlg.addEventListener('mousedown',e=>{if(e.button===2)e.stopPropagation();},true);
    dlg.addEventListener('mouseup',e=>{if(e.button===2)e.stopPropagation();},true);

    const fields=[
      ['fiSpecialistId','Копировать ID'],
      ['fiAccessKey','Копировать ключ'],
      ['fiYandexKey','Копировать ключ']
    ];
    for(const [id,label] of fields){
      const input=document.getElementById(id);
      if(!input) continue;
      const wrap=input.closest('.fi-inline');
      if(!wrap || wrap.querySelector(`[data-copy-for="${id}"]`)) continue;
      const b=document.createElement('button');
      b.type='button';
      b.dataset.copyFor=id;
      b.textContent=label;
      b.title='Скопировать значение';
      b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();copyValue(input,b);});
      wrap.appendChild(b);
    }
  }

  attach();
  new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});
})();
