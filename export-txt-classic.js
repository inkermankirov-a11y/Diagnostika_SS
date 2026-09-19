'use strict';

(() => {
  const btn=document.querySelector('#exportTxtBtn');
  if(!btn)return;

  function currentClient(){
    try{return window.DiagnostikaClients?.current?.()||window.DiagnostikaPlatform?.store?.currentClient?.()||null;}catch(_){}
    try{return typeof client==='function'?client():null;}catch(_){return null;}
  }

  function currentRequest(c){
    if(!c)return null;
    try{
      const r=window.DiagnostikaRequests?.current?.(c);
      if(r)return r;
    }catch(_){}
    try{return typeof request==='function'?request():null;}catch(_){return null;}
  }

  btn.onclick=()=>{
    const api=window.DiagnostikaExport;
    if(api?.moduleAware!==true)return alert('Модуль экспорта ещё загружается.');

    const c=currentClient();
    const r=currentRequest(c);
    if(!c)return alert('Сначала выбери клиента.');
    if(!r)return alert('Сначала выбери запрос диагностики.');

    const payload=api.diagnosisTxt(c,r,{source:'export-txt-ui'});
    if(!payload||!api.download(payload,{source:'export-txt-ui-download'})){
      alert('Не удалось подготовить TXT-файл.');
    }
  };
})();
