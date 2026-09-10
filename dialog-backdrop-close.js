'use strict';

(() => {
  function bind(dlg){
    if(!(dlg instanceof HTMLDialogElement) || dlg.dataset.backdropCloseBound==='1') return;
    dlg.dataset.backdropCloseBound='1';
    dlg.addEventListener('click',e=>{
      if(e.target===dlg && dlg.open){
        try{dlg.close();}catch(_){}
      }
    });
  }

  document.querySelectorAll('dialog').forEach(bind);
  const observer=new MutationObserver(mutations=>{
    for(const m of mutations){
      for(const node of m.addedNodes){
        if(!(node instanceof Element)) continue;
        if(node.matches?.('dialog')) bind(node);
        node.querySelectorAll?.('dialog').forEach(bind);
      }
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});
})();
