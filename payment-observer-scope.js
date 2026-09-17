'use strict';

(() => {
  if(window.__diagnostikaPaymentObserverScopeInstalled)return;
  const NativeMutationObserver=window.MutationObserver;
  if(typeof NativeMutationObserver!=='function')return;

  const scopedScripts=[
    'payment-enhancements.js',
    'payment-session-fix.js',
    'session-payment-editor.js'
  ];
  const structuralSelector='.payment-dialog,dialog.session-edit-dialog,.session-card,#clientPaymentBox,.home-dashboard';

  const containsStructuralNode=node=>{
    if(!node||node.nodeType!==1)return false;
    try{
      return !!(node.matches?.(structuralSelector)||node.querySelector?.(structuralSelector));
    }catch(_){
      return false;
    }
  };

  function ScopedMutationObserver(callback){
    const src=document.currentScript?.src||'';
    const scoped=scopedScripts.some(name=>src.includes(name));
    if(!scoped)return new NativeMutationObserver(callback);

    return new NativeMutationObserver((records,observer)=>{
      const structuralChange=records.some(record=>
        Array.from(record.addedNodes||[]).some(containsStructuralNode)
      );
      if(structuralChange)callback(records,observer);
    });
  }

  ScopedMutationObserver.prototype=NativeMutationObserver.prototype;
  try{Object.setPrototypeOf(ScopedMutationObserver,NativeMutationObserver);}catch(_){}
  window.MutationObserver=ScopedMutationObserver;
  window.__diagnostikaPaymentObserverScopeInstalled=true;
})();
