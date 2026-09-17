'use strict';

(() => {
  const api=window.DiagnostikaPayments;
  if(!api||typeof api.summary!=='function'||typeof api.paymentOfRequest!=='function')return;

  const baseSummary=api.summary.bind(api);
  const paymentOfRequest=api.paymentOfRequest.bind(api);
  const num=v=>{const n=Number(String(v??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));return Number.isFinite(n)?n:0;};

  function currentRequest(c){
    if(!c)return null;
    return window.DiagnostikaRequests?.current?.(c)
      ||c.requests?.find(r=>String(r.id)===String(c.currentRequestId||''))
      ||null;
  }

  function sessionsFor(c,r){
    const rid=String(r?.id||'');
    if(!rid)return[];
    return (Array.isArray(c?.sessions)?c.sessions:[]).filter(s=>String(s?.requestId||s?.payment?.requestId||'')===rid);
  }

  function semanticSummary(c,r=currentRequest(c)){
    const base=baseSummary(c,r);
    if(!c||!r)return base;
    const p=paymentOfRequest(c,r)||{};

    if(p.mode==='session'){
      const sessions=sessionsFor(c,r);
      if(!sessions.length)return {...base,status:'none',label:'Не указано'};
      const paidCount=sessions.filter(s=>s?.payment?.paid===true).length;
      if(paidCount===sessions.length)return {...base,status:'paid',label:'Оплачено'};
      return {...base,status:'unpaid',label:'Не оплачено'};
    }

    if(p.mode==='parts'){
      const total=Math.max(0,num(p.total));
      const paid=(Array.isArray(p.payments)?p.payments:[]).reduce((sum,x)=>sum+num(x?.amount),0);
      if(paid<=0)return {...base,status:'unpaid',label:'Не оплачено'};
      if(total>0&&paid>=total)return {...base,status:'paid',label:'Оплачено'};
      return {...base,status:'partial',label:'Частично'};
    }

    if(p.mode==='full'){
      const total=Math.max(0,num(p.total));
      const paid=(Array.isArray(p.payments)?p.payments:[]).reduce((sum,x)=>sum+num(x?.amount),0);
      if(total>0&&paid>=total)return {...base,status:'paid',label:'Оплачено'};
      return {...base,status:'unpaid',label:'Не оплачено'};
    }

    return base;
  }

  api.summary=semanticSummary;

  function applyChip(chip,c,r){
    if(!chip||!c||!r)return;
    const s=semanticSummary(c,r);
    const nextClass=`pay-chip ${s.status}`;
    if(chip.className!==nextClass)chip.className=nextClass;
    if(chip.textContent!==s.label)chip.textContent=s.label;
  }

  function fixDatabase(){
    const table=document.querySelector('#clientDatabaseList table');
    if(!table||typeof state==='undefined'||!Array.isArray(state?.clients))return;
    [...table.querySelectorAll('tbody tr')].forEach((tr,index)=>{
      const c=state.clients[index],r=currentRequest(c),chip=tr.querySelector('.db-payment-cell .pay-chip');
      if(c&&r&&chip)applyChip(chip,c,r);
    });
  }

  function fixPaymentDialog(){
    const c=typeof client==='function'?client():null;
    const r=currentRequest(c);
    const chip=document.querySelector('dialog.payment-dialog:has(#paymentMode) #paymentSummary .pay-chip');
    if(c&&r&&chip)applyChip(chip,c,r);
  }

  const oldRenderDb=window.renderClientDatabaseTable;
  if(typeof oldRenderDb==='function'&&!oldRenderDb.__paymentSemanticRule){
    const wrapped=function(){
      const result=oldRenderDb.apply(this,arguments);
      setTimeout(fixDatabase,0);
      return result;
    };
    wrapped.__paymentSemanticRule=true;
    window.renderClientDatabaseTable=wrapped;
  }

  const oldOpen=api.open?.bind(api);
  if(oldOpen&&!api.open.__paymentSemanticRule){
    const wrappedOpen=function(){const result=oldOpen(...arguments);setTimeout(fixPaymentDialog,0);return result;};
    wrappedOpen.__paymentSemanticRule=true;
    api.open=wrappedOpen;
  }

  const oldRefresh=api.refresh?.bind(api);
  if(oldRefresh&&!api.refresh.__paymentSemanticRule){
    const wrappedRefresh=function(){const result=oldRefresh(...arguments);setTimeout(()=>{fixDatabase();fixPaymentDialog();},0);return result;};
    wrappedRefresh.__paymentSemanticRule=true;
    api.refresh=wrappedRefresh;
  }

  const dbRoot=document.querySelector('#clientDatabaseList');
  if(dbRoot){
    let queued=false;
    new MutationObserver(()=>{
      if(queued)return;
      queued=true;
      queueMicrotask(()=>{queued=false;fixDatabase();});
    }).observe(dbRoot,{childList:true,subtree:true});
  }

  const summaryRoot=document.querySelector('#paymentSummary');
  if(summaryRoot){
    let queued=false;
    new MutationObserver(()=>{
      if(queued)return;
      queued=true;
      queueMicrotask(()=>{queued=false;fixPaymentDialog();});
    }).observe(summaryRoot,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
  }

  fixDatabase();
  fixPaymentDialog();
})();
