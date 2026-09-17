'use strict';

(() => {
  if(window.__diagnostikaPaymentObserverGuardInstalled)return;
  const NativeMutationObserver=window.MutationObserver;
  if(typeof NativeMutationObserver!=='function')return;

  const blockedScripts=[
    'payment-enhancements.js',
    'payment-session-fix.js',
    'session-payment-editor.js'
  ];

  function GuardedMutationObserver(callback){
    const src=document.currentScript?.src||'';
    const blocked=blockedScripts.some(name=>src.includes(name));
    if(blocked){
      return {
        observe(){},
        disconnect(){},
        takeRecords(){return[];}
      };
    }
    return new NativeMutationObserver(callback);
  }

  GuardedMutationObserver.prototype=NativeMutationObserver.prototype;
  try{Object.setPrototypeOf(GuardedMutationObserver,NativeMutationObserver);}catch(_){}

  window.MutationObserver=GuardedMutationObserver;
  window.__diagnostikaPaymentObserverGuardInstalled=true;
})();
