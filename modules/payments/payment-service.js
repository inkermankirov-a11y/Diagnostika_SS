'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform)return;

  const services=platform.services||{};
  if(!platform.services)platform.services=services;
  if(services.payments)return;

  const EVENTS=Object.freeze({
    updated:'payment:updated',
    added:'payment:added',
    deleted:'payment:deleted',
    sessionUpdated:'session-payment:updated'
  });

  const now=()=>new Date().toISOString();
  const clone=value=>{
    if(value===undefined)return undefined;
    try{if(typeof structuredClone==='function')return structuredClone(value);}catch(_){}
    try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}
  };
  const num=value=>{
    const n=Number(String(value??'').replace(/[\s\u00A0\u202F]/g,'').replace(',','.'));
    return Number.isFinite(n)?n:0;
  };
  const makeId=()=>{
    try{if(crypto?.randomUUID)return crypto.randomUUID();}catch(_){}
    return 'payment_'+Date.now()+'_'+Math.random().toString(16).slice(2);
  };

  function clientsService(){
    return platform.services?.clients||window.DiagnostikaClients||null;
  }
  function requestsService(){
    return platform.services?.requests
      ||(window.DiagnostikaRequests?.moduleAware===true?window.DiagnostikaRequests:null)
      ||null;
  }
  function sessionsService(){
    return platform.services?.sessions
      ||(window.DiagnostikaSessions?.moduleAware===true?window.DiagnostikaSessions:null)
      ||null;
  }

  function resolveClient(clientRef){
    if(clientRef&&typeof clientRef==='object'){
      const id=clientRef.id;
      if(id!==undefined&&id!==null&&id!==''){
        const via=clientsService()?.findById?.(id);
        if(via)return via;
        try{
          const rows=platform.store?.clients?.()||[];
          const found=rows.find(c=>c&&String(c.id)===String(id));
          if(found)return found;
        }catch(_){}
      }
      return clientRef;
    }
    if(clientRef!==undefined&&clientRef!==null&&clientRef!==''){
      const via=clientsService()?.findById?.(clientRef);
      if(via)return via;
      try{
        const rows=platform.store?.clients?.()||[];
        return rows.find(c=>c&&String(c.id)===String(clientRef))||null;
      }catch(_){return null;}
    }
    const current=clientsService()?.current?.();
    if(current)return current;
    try{return platform.store?.currentClient?.()||null;}catch(_){}
    try{return typeof client==='function'?client():null;}catch(_){return null;}
  }

  function resolveRequest(requestRef,c){
    if(!c)return null;
    if(requestRef&&typeof requestRef==='object'){
      const id=requestRef.id;
      if(id!==undefined&&id!==null&&id!==''){
        return requestsService()?.get?.(id,c)
          ||(c.requests||[]).find(r=>r&&String(r.id)===String(id))
          ||null;
      }
      return requestRef;
    }
    if(requestRef===undefined){
      return requestsService()?.current?.(c)
        ||(c.requests||[]).find(r=>r&&String(r.id)===String(c.currentRequestId))
        ||null;
    }
    if(requestRef===null||requestRef==='')return null;
    return requestsService()?.get?.(requestRef,c)
      ||(c.requests||[]).find(r=>r&&String(r.id)===String(requestRef))
      ||null;
  }

  function resolveSession(sessionRef,c){
    if(!c)return null;
    if(sessionRef&&typeof sessionRef==='object'){
      const id=sessionRef.id;
      if(id!==undefined&&id!==null&&id!==''){
        return sessionsService()?.get?.(id,c)
          ||(c.sessions||[]).find(s=>s&&String(s.id)===String(id))
          ||null;
      }
      return sessionRef;
    }
    if(sessionRef===undefined||sessionRef===null||sessionRef==='')return null;
    return sessionsService()?.get?.(sessionRef,c)
      ||(c.sessions||[]).find(s=>s&&String(s.id)===String(sessionRef))
      ||null;
  }

  function blankRequestPayment(c){
    return {mode:'',total:0,payments:[],currency:c?.currency||'RUB',sessionAmount:0,sessionDiscount:0};
  }
  function blankSessionPayment(){
    return {paid:false,amount:0,receiptUrl:'',note:''};
  }
  function ensureRequestPayment(r,c){
    if(!r.payment||typeof r.payment!=='object')r.payment=blankRequestPayment(c);
    if(!Array.isArray(r.payment.payments))r.payment.payments=[];
    if(!r.payment.currency)r.payment.currency=c?.currency||'RUB';
    if(!Number.isFinite(Number(r.payment.total)))r.payment.total=0;
    if(!Number.isFinite(Number(r.payment.sessionAmount)))r.payment.sessionAmount=0;
    if(!Number.isFinite(Number(r.payment.sessionDiscount)))r.payment.sessionDiscount=0;
    return r.payment;
  }
  function ensureSessionPayment(s){
    if(!s.payment||typeof s.payment!=='object')s.payment=blankSessionPayment();
    return s.payment;
  }

  function persist(){
    try{
      if(platform.store?.legacySave?.())return true;
    }catch(_){}
    try{
      if(typeof save==='function'){save();return true;}
    }catch(error){
      console.error('[DiagnostikaPlatform] payment persistence failed',error);
    }
    return false;
  }

  function emit(type,detail={}){
    const payload={...detail,source:detail.source||'payment-service',emittedAt:detail.emittedAt||now()};
    try{
      if(platform.paymentEvents?.emit)return platform.paymentEvents.emit(type,payload);
    }catch(_){}
    try{
      return platform.events?.emit?.(type,Object.freeze(payload))||0;
    }catch(_){return 0;}
  }

  function syncBridge(){
    try{platform.paymentEvents?.resync?.();}catch(_){}
  }

  function requestPayment(requestRef,clientRef){
    const c=resolveClient(clientRef);
    const r=resolveRequest(requestRef,c);
    return r?.payment&&typeof r.payment==='object'?r.payment:null;
  }

  function sessionPayment(sessionRef,clientRef){
    const c=resolveClient(clientRef);
    const s=resolveSession(sessionRef,c);
    return s?.payment&&typeof s.payment==='object'?s.payment:null;
  }

  function updateRequest(requestRef,changes={},options={}){
    const c=resolveClient(options.client??options.clientId);
    const r=resolveRequest(requestRef,c);
    if(!c||!r||!changes||typeof changes!=='object')return null;
    const before=clone(r.payment);
    const payment=ensureRequestPayment(r,c);
    const patch=clone(changes)||{};
    delete patch.payments;
    Object.assign(payment,patch);
    if(Object.prototype.hasOwnProperty.call(patch,'total'))payment.total=Math.max(0,num(payment.total));
    if(Object.prototype.hasOwnProperty.call(patch,'sessionAmount'))payment.sessionAmount=Math.max(0,num(payment.sessionAmount));
    if(Object.prototype.hasOwnProperty.call(patch,'sessionDiscount'))payment.sessionDiscount=Math.min(100,Math.max(0,num(payment.sessionDiscount)));
    syncBridge();
    if(!persist()){
      if(before===undefined)delete r.payment;else r.payment=before;
      syncBridge();
      return null;
    }
    emit(EVENTS.updated,{
      clientId:c.id,
      requestId:r.id,
      paymentId:null,
      change:'settings',
      before,
      after:clone(r.payment),
      source:options.source||'payment-service-request-update'
    });
    return r.payment;
  }

  function addPayment(requestRef,data={},options={}){
    const c=resolveClient(options.client??options.clientId);
    const r=resolveRequest(requestRef,c);
    if(!c||!r||!data||typeof data!=='object')return null;
    const payment=ensureRequestPayment(r,c);
    const record={
      id:data.id||makeId(),
      date:data.date||'',
      amount:Math.max(0,num(data.amount)),
      note:data.note||'',
      receiptUrl:data.receiptUrl||'',
      ...(data.sessionId?{sessionId:data.sessionId}:{}),
      ...(data.source?{source:data.source}:{})
    };
    if(payment.payments.some(x=>x&&String(x.id)===String(record.id)))return null;
    payment.payments.push(record);
    syncBridge();
    if(!persist()){
      payment.payments.pop();
      syncBridge();
      return null;
    }
    emit(EVENTS.added,{
      clientId:c.id,requestId:r.id,paymentId:record.id,amount:record.amount,payment:clone(record),
      source:options.source||'payment-service-add'
    });
    return record;
  }

  function updatePayment(requestRef,paymentId,changes={},options={}){
    const c=resolveClient(options.client??options.clientId);
    const r=resolveRequest(requestRef,c);
    const payment=r?ensureRequestPayment(r,c):null;
    const record=payment?.payments?.find(x=>x&&String(x.id)===String(paymentId));
    if(!c||!r||!record||!changes||typeof changes!=='object')return null;
    const before=clone(record);
    const patch=clone(changes)||{};
    delete patch.id;
    Object.assign(record,patch);
    if(Object.prototype.hasOwnProperty.call(patch,'amount'))record.amount=Math.max(0,num(record.amount));
    syncBridge();
    if(!persist()){
      for(const key of Object.keys(record))delete record[key];
      Object.assign(record,before);
      syncBridge();
      return null;
    }
    emit(EVENTS.updated,{
      clientId:c.id,requestId:r.id,paymentId:record.id,change:'record',
      before,after:clone(record),amount:num(record.amount),
      source:options.source||'payment-service-record-update'
    });
    return record;
  }

  function removePayment(requestRef,paymentId,options={}){
    const c=resolveClient(options.client??options.clientId);
    const r=resolveRequest(requestRef,c);
    const payment=r?ensureRequestPayment(r,c):null;
    const index=payment?.payments?.findIndex(x=>x&&String(x.id)===String(paymentId))??-1;
    if(!c||!r||!payment||index<0)return null;
    const removed=payment.payments[index];
    payment.payments.splice(index,1);
    syncBridge();
    if(!persist()){
      payment.payments.splice(index,0,removed);
      syncBridge();
      return null;
    }
    emit(EVENTS.deleted,{
      clientId:c.id,requestId:r.id,paymentId:removed.id,amount:num(removed.amount),payment:clone(removed),
      source:options.source||'payment-service-remove'
    });
    return removed;
  }

  function updateSession(sessionRef,changes={},options={}){
    const c=resolveClient(options.client??options.clientId);
    const s=resolveSession(sessionRef,c);
    if(!c||!s||!changes||typeof changes!=='object')return null;
    const before=clone(s.payment);
    const payment=ensureSessionPayment(s);
    const patch=clone(changes)||{};
    Object.assign(payment,patch);
    if(Object.prototype.hasOwnProperty.call(patch,'amount'))payment.amount=Math.max(0,num(payment.amount));
    if(Object.prototype.hasOwnProperty.call(patch,'paid'))payment.paid=payment.paid===true;
    syncBridge();
    if(!persist()){
      if(before===undefined)delete s.payment;else s.payment=before;
      syncBridge();
      return null;
    }
    emit(EVENTS.sessionUpdated,{
      clientId:c.id,
      requestId:s.requestId||payment.requestId||null,
      sessionId:s.id,
      before,
      after:clone(s.payment),
      paid:s.payment?.paid===true,
      amount:num(s.payment?.amount),
      source:options.source||'payment-service-session-update'
    });
    return s.payment;
  }

  services.payments=Object.freeze({
    events:EVENTS,
    request:requestPayment,
    session:sessionPayment,
    updateRequest,
    addPayment,
    updatePayment,
    removePayment,
    updateSession
  });
})();
