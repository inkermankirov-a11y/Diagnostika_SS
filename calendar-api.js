'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform||window.DiagnostikaCalendar?.moduleAware===true)return;

  const legacyUi=window.DiagnostikaCalendar&&window.DiagnostikaCalendar.moduleAware!==true
    ? window.DiagnostikaCalendar
    : null;

  const service=()=>platform.services?.calendar||null;
  const invoke=(name,args,failValue)=>{
    const fn=service()?.[name];
    return typeof fn==='function'?fn(...args):failValue;
  };

  window.DiagnostikaCalendar=Object.freeze({
    version:'8A',
    moduleAware:true,
    events:Object.freeze({
      created:'calendar:event-created',
      updated:'calendar:event-updated',
      deleted:'calendar:event-deleted',
      replaced:'calendar:events-replaced'
    }),
    open(...args){
      try{return typeof legacyUi?.open==='function'?legacyUi.open(...args):false;}catch(_){return false;}
    },
    refresh(...args){
      try{return typeof legacyUi?.refresh==='function'?legacyUi.refresh(...args):false;}catch(_){return false;}
    },
    list(filter={}){return invoke('list',[filter],[]);},
    get(id){return invoke('get',[id],null);},
    forDate(date,filter={}){return invoke('forDate',[date,filter],[]);},
    forClient(clientRef,filter={}){return invoke('forClient',[clientRef,filter],[]);},
    create(data={},options={}){return invoke('create',[data,options],null);},
    update(id,changes={},options={}){return invoke('update',[id,changes,options],null);},
    remove(id,options={}){return invoke('remove',[id,options],null);},
    replace(items=[],options={}){return invoke('replace',[items,options],null);}
  });
})();