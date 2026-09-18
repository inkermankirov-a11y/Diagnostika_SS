'use strict';

(() => {
  if (window.DiagnostikaPaymentTotalInputStability) return;

  const currentClient=()=>typeof client==='function'?client():null;
  const digits=v=>String(v??'').replace(/\D/g,'');
  const toNumber=v=>{const d=digits(v);return d?Number(d):0;};
  const format=v=>{
    const d=digits(v);
    return d?d.replace(/\B(?=(\d{3})+(?!\d))/g,' '):'';
  };

  function currentRequest(c){
    if(!c)return null;
    try{
      const r=window.DiagnostikaRequests?.current?.(c);
      if(r)return r;
    }catch(_){}
    try{
      if(typeof requestId!=='undefined'&&requestId){
        const r=(c.requests||[]).find(x=>String(x.id)===String(requestId));
        if(r)return r;
      }
    }catch(_){}
    return (c.requests||[]).find(r=>String(r.id)===String(c.currentRequestId||''))
      ||(c.requests||[]).find(r=>String(r.id)===String(c.activeRequestId||''))
      ||(c.requests||[])[0]
      ||null;
  }

  const paymentWriter=()=>window.DiagnostikaPayments?.moduleAware===true?window.DiagnostikaPayments:null;

  function paymentOf(c,r){
    try{
      const p=paymentWriter()?.request?.(r?.id,c);
      if(p)return p;
    }catch(_){}
    return r?.payment&&typeof r.payment==='object'?r.payment:null;
  }

  function fullRefresh(){
    try{window.DiagnostikaPayments?.refresh?.();}catch(_){}
    try{window.DiagnostikaPaymentConsistency?.refresh?.();}catch(_){}
    try{window.DiagnostikaClientPaymentFlags?.refresh?.();}catch(_){}
    try{window.DiagnostikaHomeDashboard?.refresh?.();}catch(_){}
  }

  function install(){
    const field=document.getElementById('paymentTotal');
    if(!field||field.dataset.totalInputStable==='2')return false;

    field.dataset.totalInputStable='2';
    field.type='text';
    field.inputMode='numeric';
    field.autocomplete='off';
    field.removeAttribute('min');
    field.removeAttribute('step');

    // Keep the visual value grouped, but only ever store plain digits.
    field.value=format(field.value);

    const onInput=e=>{
      e.stopImmediatePropagation();
      const raw=digits(field.value);
      field.value=format(raw);
      try{field.setSelectionRange(field.value.length,field.value.length);}catch(_){}

      // Keep the draft in the field only. PaymentService owns persisted request.payment.
      field.dataset.paymentTotalDraft=raw;
      // Deliberately no persistence, global refresh or rerender while typing.
    };

    const commit=e=>{
      if(e)e.stopImmediatePropagation();
      const raw=digits(field.value);
      field.value=format(raw);
      const c=currentClient(),r=currentRequest(c);if(!c||!r)return;
      const updated=paymentWriter()?.updateRequest?.(
        r.id,
        {total:raw?Number(raw):0},
        {client:c,source:'payment-dialog-total'}
      );
      if(!updated)return;
      delete field.dataset.paymentTotalDraft;
      fullRefresh();
    };

    // Capture phase on the field itself runs before the old payment-system
    // target handlers, so legacy per-keystroke rerenders cannot reset the value.
    field.addEventListener('input',onInput,true);
    field.addEventListener('change',commit,true);
    field.addEventListener('blur',commit,true);

    // Neutralize legacy property handlers as an extra safeguard.
    field.oninput=null;
    field.onchange=null;

    return true;
  }

  const observer=new MutationObserver(()=>install());
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(install,0);

  window.DiagnostikaPaymentTotalInputStability={refresh:install,format};
})();
