'use strict';

(() => {
  const currentClient=()=>typeof client==='function'?client():null;
  const currentRequest=c=>window.DiagnostikaRequests?.current?.(c)||c?.requests?.find(r=>r.id===c?.currentRequestId)||null;
  const paymentOf=r=>{
    if(!r)return null;
    if(!r.payment||typeof r.payment!=='object')r.payment={mode:'',total:0,payments:[]};
    if(!Array.isArray(r.payment.payments))r.payment.payments=[];
    if(!Number.isFinite(Number(r.payment.sessionAmount)))r.payment.sessionAmount=0;
    if(!Number.isFinite(Number(r.payment.sessionDiscount)))r.payment.sessionDiscount=0;
    return r.payment;
  };
  const money=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(v)||0);

  const style=document.createElement('style');
  style.textContent=`
    .payment-dialog.session-mode #paymentTotalField{display:none!important}
    .payment-dialog.session-mode #sessionPriceField{display:none!important}
    .payment-dialog.session-mode #paymentHistoryWrap{display:none!important}
    .payment-dialog:not(.session-mode) #sessionPaymentSettings{display:none!important}
    .payment-save-settings{background:linear-gradient(#3fa56f,#218955)!important;color:#fff!important}
  `;
  document.head.appendChild(style);

  function persistSessionSettings(dlg){
    const c=currentClient(),r=currentRequest(c);if(!r)return;
    const p=paymentOf(r),mode=dlg.querySelector('#paymentMode')?.value||'';
    p.mode=mode;
    if(mode==='session'){
      const base=dlg.querySelector('#sessionBasePrice')||dlg.querySelector('#sessionPrice');
      const discount=dlg.querySelector('#sessionDiscount');
      if(base)p.sessionAmount=Math.max(0,Number(base.value)||0);
      if(discount)p.sessionDiscount=Math.min(100,Math.max(0,Number(discount.value)||0));
      p.total=0;
    }else{
      p.total=Math.max(0,Number(dlg.querySelector('#paymentTotal')?.value)||0);
    }
    if(typeof save==='function')save();
    try{window.DiagnostikaPayments?.refresh?.();}catch(e){}
    try{window.DiagnostikaSessionPayments?.refresh?.();}catch(e){}
  }

  function ensureSaveButton(dlg){
    let btn=dlg.querySelector('#paymentSaveSettings');
    if(btn)return btn;
    const footer=dlg.querySelector('.payment-footer');
    if(!footer)return null;
    btn=document.createElement('button');
    btn.type='button';btn.id='paymentSaveSettings';btn.className='tk-btn payment-save-settings';btn.textContent='Сохранить оплату';
    footer.insertBefore(btn,footer.firstChild);
    btn.addEventListener('click',()=>{
      persistSessionSettings(dlg);
      apply();
      btn.textContent='✓ Сохранено';
      setTimeout(()=>{if(btn.isConnected)btn.textContent='Сохранить оплату';},1200);
    });
    return btn;
  }

  function apply(){
    const dlg=document.querySelector('.payment-dialog');if(!dlg)return;
    const mode=dlg.querySelector('#paymentMode')?.value||'';
    const isSession=mode==='session';
    dlg.classList.toggle('session-mode',isSession);
    const totalField=dlg.querySelector('#paymentTotalField');
    if(totalField){totalField.hidden=isSession;totalField.style.display=isSession?'none':'';}
    const history=dlg.querySelector('#paymentHistoryWrap');if(history)history.hidden=isSession;
    const hint=dlg.querySelector('#paymentSessionHint');if(hint)hint.hidden=!isSession;
    const settings=dlg.querySelector('#sessionPaymentSettings');
    if(settings){settings.hidden=!isSession;settings.style.display=isSession?'grid':'none';}
    const legacy=dlg.querySelector('#sessionPriceField');if(legacy)legacy.style.display='none';
    ensureSaveButton(dlg);

    if(isSession){
      const c=currentClient(),r=currentRequest(c),p=paymentOf(r);
      const base=dlg.querySelector('#sessionBasePrice');const discount=dlg.querySelector('#sessionDiscount');const final=dlg.querySelector('#sessionFinalPrice');
      if(base&&document.activeElement!==base)base.value=p?.sessionAmount||'';
      if(discount&&document.activeElement!==discount)discount.value=p?.sessionDiscount||'';
      if(final&&p){const d=Math.min(100,Math.max(0,Number(p.sessionDiscount)||0));const price=Math.max(0,(Number(p.sessionAmount)||0)*(1-d/100));final.innerHTML=`Итог за сессию: <strong>${money(price)} ₽</strong>${d?` <span style="color:#728092">(скидка ${d}%)</span>`:''}`;}
    }
  }

  // Стоимость сессии и скидка сохраняются сразу при вводе. Это исключает ситуацию,
  // когда в поле видно 10 000 ₽, а в данных запроса ещё остаётся 0.
  document.addEventListener('input',e=>{
    if(e.target?.id!=='sessionBasePrice'&&e.target?.id!=='sessionDiscount')return;
    const dlg=e.target.closest('.payment-dialog');if(!dlg)return;
    persistSessionSettings(dlg);
    const c=currentClient(),r=currentRequest(c),p=paymentOf(r),final=dlg.querySelector('#sessionFinalPrice');
    if(final&&p){const d=Math.min(100,Math.max(0,Number(p.sessionDiscount)||0));const price=Math.max(0,(Number(p.sessionAmount)||0)*(1-d/100));final.innerHTML=`Итог за сессию: <strong>${money(price)} ₽</strong>${d?` <span style="color:#728092">(скидка ${d}%)</span>`:''}`;}
  },true);

  document.addEventListener('change',e=>{if(e.target?.id==='paymentMode')setTimeout(apply,0);});
  const observer=new MutationObserver(()=>setTimeout(apply,0));observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(apply,0);
})();
