'use strict';

(() => {
  const SYMBOLS={RUB:'₽',USD:'$',EUR:'€',KZT:'₸'};
  const currentClient=()=>typeof client==='function'?client():null;
  const paymentOf=r=>{
    if(!r)return null;
    if(!r.payment||typeof r.payment!=='object')r.payment={mode:'',total:0,payments:[]};
    if(!Array.isArray(r.payment.payments))r.payment.payments=[];
    return r.payment;
  };
  function requestFromDialog(c,dlg){
    const text=dlg?.querySelector('#paymentRequestSub')?.textContent||'';
    const m=text.match(/Запрос\s+(\d+)/i);
    if(m&&c?.requests?.[Number(m[1])-1])return c.requests[Number(m[1])-1];
    return window.DiagnostikaRequests?.current?.(c)||c?.requests?.find(r=>r.id===c?.currentRequestId)||null;
  }
  function symbolForDialog(c,r,dlg){
    const selected=dlg?.querySelector('#paymentCurrency')?.value;
    const code=selected||paymentOf(r)?.currency||c?.currency||'RUB';
    return SYMBOLS[code]||'₽';
  }
  function replaceMoneySymbols(root,symbol){
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const text=node.nodeValue||'';
      if(/[₽$€₸]/.test(text))node.nodeValue=text.replace(/[₽$€₸]/g,symbol);
    });
  }
  function enforce(){
    const c=currentClient();
    if(!c)return;
    document.querySelectorAll('.payment-dialog:not(.all-client-payments-dialog)').forEach(dlg=>{
      const r=requestFromDialog(c,dlg);
      if(!r)return;
      const sym=symbolForDialog(c,r,dlg);
      // Текущий диалог запроса: ВСЕ суммы обязаны использовать валюту этого запроса.
      replaceMoneySymbols(dlg.querySelector('#paymentSummary'),sym);
      replaceMoneySymbols(dlg.querySelector('#paymentHistoryWrap'),sym);
      replaceMoneySymbols(dlg.querySelector('#sessionPaymentLedger'),sym);
      replaceMoneySymbols(dlg.querySelector('#sessionFinalPrice'),sym);
      // На случай старых/добавочных элементов оплаты.
      dlg.querySelectorAll('.payment-row strong,.payment-summary-card,.session-final-price').forEach(el=>replaceMoneySymbols(el,sym));
    });
  }

  document.addEventListener('change',e=>{
    if(e.target?.id==='paymentCurrency'){
      const dlg=e.target.closest('.payment-dialog');
      const c=currentClient(),r=requestFromDialog(c,dlg);
      if(c&&r){
        const p=paymentOf(r),code=e.target.value;
        p.currency=code;p.currencyManual=true;
        if(typeof save==='function')save();
      }
      setTimeout(enforce,0);setTimeout(enforce,50);
    }
  },true);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#paymentAddBtn,#paymentSaveSettings,#allClientPaymentsBtn'))setTimeout(enforce,0);
  },true);
  const mo=new MutationObserver(()=>setTimeout(enforce,0));
  mo.observe(document.body,{childList:true,subtree:true,characterData:true});
  setInterval(()=>{
    if(document.querySelector('.payment-dialog[open]'))enforce();
  },300);
  setTimeout(enforce,0);
  window.DiagnostikaCurrencyHardRule={refresh:enforce};
})();
