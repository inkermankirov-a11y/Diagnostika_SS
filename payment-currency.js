'use strict';

(() => {
  const LANG_KEY='diagnostika-ui-language';
  const CUR={RUB:{symbol:'₽',label:'₽ RUB'},USD:{symbol:'$',label:'$ USD'},EUR:{symbol:'€',label:'€ EUR'},KZT:{symbol:'₸',label:'₸ KZT'}};
  const langDefault=()=>({ru:'RUB',en:'USD',fr:'EUR',de:'EUR',it:'EUR'})[localStorage.getItem(LANG_KEY)||'en']||'USD';
  const clientNow=()=>typeof client==='function'?client():null;
  const paymentWriter=()=>window.DiagnostikaPayments?.moduleAware===true?window.DiagnostikaPayments:null;
  const reqFromDialog=(c,dlg)=>{
    const t=dlg?.querySelector('#paymentRequestSub')?.textContent||'';
    const m=t.match(/Запрос\s+(\d+)/i);
    if(m&&c?.requests?.[Number(m[1])-1])return c.requests[Number(m[1])-1];
    return window.DiagnostikaRequests?.current?.(c)||c?.requests?.find(r=>r.id===c?.currentRequestId)||null;
  };
  const paymentOf=(c,r)=>paymentWriter()?.request?.(r?.id,c)||(r?.payment&&typeof r.payment==='object'?r.payment:null);
  const currencyFor=(c,r)=>{
    if(!c)return langDefault();
    const clientCurrency=c.currencyManual?(c.currency||langDefault()):langDefault();
    const p=paymentOf(c,r);
    return p?.currencyManual?(p.currency||clientCurrency):clientCurrency;
  };
  const symbolFor=(c,r)=>CUR[currencyFor(c,r)]?.symbol||'₽';
  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const spaced=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(num(v)).replace(/[\u00A0\u202F]/g,' ');

  const style=document.createElement('style');style.textContent=`.payment-currency-field{min-width:130px}.payment-currency-field select{height:38px;border:1px solid #b9c6d4;border-radius:7px;padding:0 9px;background:#fff;width:100%}@media(max-width:760px){.payment-currency-field{min-width:0}}`;document.head.appendChild(style);

  function ensureSelector(){
    const dlg=document.querySelector('.payment-dialog:not(.all-client-payments-dialog)');if(!dlg)return;
    const grid=dlg.querySelector('.payment-grid');if(!grid)return;
    let label=dlg.querySelector('#paymentCurrencyField');
    if(!label){
      label=document.createElement('label');label.id='paymentCurrencyField';label.className='payment-field payment-currency-field';label.innerHTML='Валюта<select id="paymentCurrency"><option value="RUB">₽ RUB</option><option value="USD">$ USD</option><option value="EUR">€ EUR</option><option value="KZT">₸ KZT</option></select>';
      grid.appendChild(label);
      label.querySelector('select').addEventListener('change',e=>{
        const c=clientNow(),r=reqFromDialog(c,dlg);if(!c||!r)return;
        const code=e.target.value;
        const updated=paymentWriter()?.updateRequest?.(
          r.id,
          {currency:code,currencyManual:true},
          {client:c,source:'payment-currency-selector'}
        );
        if(!updated)return;
        window.DiagnostikaClients?.update?.(
          c.id,
          {currency:code,currencyManual:true},
          {source:'payment-currency-client',render:false}
        );
        refresh();
        try{window.DiagnostikaPayments?.refresh?.();}catch(_){ }
        try{window.DiagnostikaCurrencyHardRule?.refresh?.();}catch(_){ }
      });
    }
    const c=clientNow(),r=reqFromDialog(c,dlg);if(c&&r&&document.activeElement!==label.querySelector('select'))label.querySelector('select').value=currencyFor(c,r);
  }

  function prepareMoneyInput(el){
    if(!el||el.dataset.spacedMoney==='1')return;
    el.dataset.spacedMoney='1';try{el.type='text';}catch(_){ }
    el.inputMode='decimal';
    const show=()=>{if(document.activeElement!==el&&String(el.value).trim()!=='')el.value=spaced(el.value);};
    el.addEventListener('focus',()=>{el.value=String(el.value).replace(/[\s\u00A0\u202F]/g,'');});
    el.addEventListener('blur',()=>setTimeout(show,0));
    show();
  }

  document.addEventListener('click',e=>{
    if(!e.target?.closest?.('#paymentSaveSettings,#paymentAddBtn'))return;
    ['#sessionBasePrice','#paymentTotal','#paymentAmount'].forEach(sel=>{const el=document.querySelector('.payment-dialog '+sel);if(el)el.value=String(el.value).replace(/[\s\u00A0\u202F]/g,'');});
  },true);

  function replaceCurrencyText(el,symbol){
    if(!el)return;
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{if(/[₽$€₸]/.test(n.nodeValue))n.nodeValue=n.nodeValue.replace(/[₽$€₸]/g,symbol);});
  }

  let scheduled=false;
  function refresh(){
    scheduled=false;
    ensureSelector();
    const dlg=document.querySelector('.payment-dialog:not(.all-client-payments-dialog)');
    const c=clientNow(),r=reqFromDialog(c,dlg);
     if(dlg&&c&&r){
      const sym=symbolFor(c,r);
      replaceCurrencyText(dlg.querySelector('#paymentSummary'),sym);
      replaceCurrencyText(dlg.querySelector('#sessionFinalPrice'),sym);
      dlg.querySelectorAll('.payment-row strong').forEach(el=>replaceCurrencyText(el,sym));
      ['#sessionBasePrice','#paymentTotal','#paymentAmount'].forEach(sel=>prepareMoneyInput(dlg.querySelector(sel)));
    }
    document.querySelectorAll('.client-payment-box').forEach(box=>replaceCurrencyText(box,symbolFor(c,window.DiagnostikaRequests?.current?.(c))));
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(refresh);}

  const mo=new MutationObserver(mutations=>{if(mutations.some(m=>m.addedNodes.length||m.removedNodes.length))schedule();});
  mo.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target?.closest?.('[data-lang],.language-menu,.language-selector'))setTimeout(schedule,20);});
  document.addEventListener('click',e=>{if(e.target?.closest?.('#paymentAddBtn,#paymentSaveSettings,.client-payment-btn'))setTimeout(schedule,0);},true);
  setTimeout(schedule,0);
  window.DiagnostikaPaymentCurrency={refresh:schedule};
})();