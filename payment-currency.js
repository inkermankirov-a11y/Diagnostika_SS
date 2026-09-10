'use strict';

(() => {
  const LANG_KEY='diagnostika-ui-language';
  const CUR={
    RUB:{symbol:'₽',label:'₽ RUB'},
    USD:{symbol:'$',label:'$ USD'},
    EUR:{symbol:'€',label:'€ EUR'},
    KZT:{symbol:'₸',label:'₸ KZT'}
  };
  const langDefault=()=>({ru:'RUB',en:'USD',fr:'EUR',de:'EUR',it:'EUR'})[localStorage.getItem(LANG_KEY)||'en']||'USD';
  const clientNow=()=>typeof client==='function'?client():null;
  const reqFromDialog=(c,dlg)=>{
    const t=dlg?.querySelector('#paymentRequestSub')?.textContent||'';
    const m=t.match(/Запрос\s+(\d+)/i);
    if(m&&c?.requests?.[Number(m[1])-1])return c.requests[Number(m[1])-1];
    return window.DiagnostikaRequests?.current?.(c)||c?.requests?.find(r=>r.id===c?.currentRequestId)||null;
  };
  const paymentOf=r=>{
    if(!r)return null;
    if(!r.payment||typeof r.payment!=='object')r.payment={mode:'',total:0,payments:[]};
    return r.payment;
  };
  const currencyFor=(c,r)=>{
    if(!c)return langDefault();
    if(!c.currencyManual)c.currency=langDefault();
    if(!c.currency)c.currency=langDefault();
    const p=paymentOf(r);
    if(p&&!p.currencyManual)p.currency=c.currency;
    return p?.currency||c.currency;
  };
  const symbolFor=(c,r)=>CUR[currencyFor(c,r)]?.symbol||'₽';
  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};
  const spaced=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(num(v)).replace(/[\u00A0\u202F]/g,' ');

  const style=document.createElement('style');
  style.textContent=`
    .payment-currency-field{min-width:130px}
    .payment-currency-field select{height:38px;border:1px solid #b9c6d4;border-radius:7px;padding:0 9px;background:#fff;width:100%}
    @media(max-width:760px){.payment-currency-field{min-width:0}}
  `;
  document.head.appendChild(style);

  function ensureSelector(){
    const dlg=document.querySelector('.payment-dialog');if(!dlg)return;
    const grid=dlg.querySelector('.payment-grid');if(!grid)return;
    let label=dlg.querySelector('#paymentCurrencyField');
    if(!label){
      label=document.createElement('label');label.id='paymentCurrencyField';label.className='payment-field payment-currency-field';label.innerHTML='Валюта<select id="paymentCurrency"><option value="RUB">₽ RUB</option><option value="USD">$ USD</option><option value="EUR">€ EUR</option><option value="KZT">₸ KZT</option></select>';
      grid.appendChild(label);
      label.querySelector('select').addEventListener('change',e=>{
        const c=clientNow(),r=reqFromDialog(c,dlg);if(!c)return;
        const code=e.target.value;
        c.currency=code;c.currencyManual=true;
        (c.requests||[]).forEach(x=>{const p=paymentOf(x);p.currency=code;p.currencyManual=true;});
        if(typeof save==='function')save();
        refresh();
        try{window.DiagnostikaPayments?.refresh?.();}catch(err){}
        try{window.DiagnostikaSessionPayments?.refresh?.();}catch(err){}
      });
    }
    const c=clientNow(),r=reqFromDialog(c,dlg);if(c&&r)label.querySelector('select').value=currencyFor(c,r);
  }

  function prepareMoneyInput(el){
    if(!el||el.dataset.spacedMoney==='1')return;
    el.dataset.spacedMoney='1';
    try{el.type='text';}catch(e){}
    el.inputMode='decimal';
    const show=()=>{if(document.activeElement!==el&&String(el.value).trim()!=='')el.value=spaced(el.value);};
    el.addEventListener('focus',()=>{el.value=String(el.value).replace(/[\s\u00A0\u202F]/g,'');});
    el.addEventListener('blur',()=>setTimeout(show,0));
    show();
  }

  // Before legacy save handlers run, strip visual grouping so Number(...) still receives 10000.
  document.addEventListener('click',e=>{
    if(!e.target?.closest?.('#paymentSaveSettings,#paymentAddBtn'))return;
    ['#sessionBasePrice','#paymentTotal','#paymentAmount'].forEach(sel=>{
      const el=document.querySelector('.payment-dialog '+sel);if(el)el.value=String(el.value).replace(/[\s\u00A0\u202F]/g,'');
    });
  },true);

  function replaceCurrencyText(el,symbol){
    if(!el)return;
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{if(/[₽$€₸]/.test(n.nodeValue))n.nodeValue=n.nodeValue.replace(/[₽$€₸]/g,symbol);});
  }

  function refresh(){
    ensureSelector();
    const dlg=document.querySelector('.payment-dialog');
    const c=clientNow(),r=reqFromDialog(c,dlg);
    if(c&&!c.currencyManual){c.currency=langDefault();(c.requests||[]).forEach(x=>{const p=paymentOf(x);if(!p.currencyManual)p.currency=c.currency;});}
    if(dlg&&c&&r){
      const sym=symbolFor(c,r);
      replaceCurrencyText(dlg.querySelector('#paymentSummary'),sym);
      replaceCurrencyText(dlg.querySelector('#sessionFinalPrice'),sym);
      // Обычная история платежей по текущему запросу раньше оставалась с жёстким символом ₽ из payment-system.js.
      dlg.querySelectorAll('.payment-row strong').forEach(el=>replaceCurrencyText(el,sym));
      dlg.querySelectorAll('.session-payment-ledger-row').forEach(row=>{
        const note=row.querySelector('.request-note')?.textContent||'';
        const m=note.match(/Запрос\s+(\d+)/i);const rr=m?c.requests?.[Number(m[1])-1]:r;
        replaceCurrencyText(row.querySelector('strong'),symbolFor(c,rr));
      });
      ['#sessionBasePrice','#paymentTotal','#paymentAmount'].forEach(sel=>prepareMoneyInput(dlg.querySelector(sel)));
    }
    document.querySelectorAll('.client-payment-box').forEach(box=>replaceCurrencyText(box,symbolFor(c,window.DiagnostikaRequests?.current?.(c))));
  }

  const mo=new MutationObserver(()=>setTimeout(refresh,0));mo.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target?.closest?.('[data-lang],.language-menu,.language-selector'))setTimeout(refresh,20);});
  setInterval(()=>{const dlg=document.querySelector('.payment-dialog');if(dlg?.open)refresh();},700);
  setTimeout(refresh,0);
})();