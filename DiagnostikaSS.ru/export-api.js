'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform||window.DiagnostikaExport?.moduleAware===true)return;

  const service=()=>platform.services?.export||null;
  const invoke=(name,args,failValue)=>{
    if(platform.api?.invokeService)return platform.api.invokeService('export',name,args,failValue);
    const fn=service()?.[name];
    try{return typeof fn==='function'?fn(...args):failValue;}catch(_){return failValue;}
  };

  function download(payload,options={}){
    if(!payload?.filename||typeof payload.text!=='string')return false;
    try{
      const blob=new Blob([payload.text],{type:payload.mimeType||'application/octet-stream'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=payload.filename;
      a.rel='noopener';
      a.style.display='none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      platform.events?.emit('export:downloaded',Object.freeze({
        kind:payload.kind||'file',
        filename:payload.filename,
        source:options.source||'export-browser-download',
        emittedAt:new Date().toISOString()
      }));
      return true;
    }catch(error){
      console.error('[DiagnostikaPlatform] export download failed',error);
      return false;
    }
  }

  window.DiagnostikaExport=Object.freeze({
    version:'10D',
    moduleAware:true,
    events:Object.freeze({
      generated:'export:generated',
      downloaded:'export:downloaded'
    }),
    safeName(value,fallback){return invoke('safeName',[value,fallback],fallback||'Клиент');},
    diagnosisTxt(client,request,options={}){return invoke('diagnosisTxt',[client,request,options],null);},
    stateBackup(state,options={}){return invoke('stateBackup',[state,options],null);},
    download
  });
})();