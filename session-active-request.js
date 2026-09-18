'use strict';

(() => {
  function currentActiveRequest(c){
    if(!c) return null;
    const current = window.DiagnostikaRequests?.current?.(c) || c.requests?.find(r => r.id === c.currentRequestId) || null;
    return current && (current.status === 'active' || current.status === 'resumed') ? current : null;
  }

  const previousOpenSessionEditor = window.openSessionEditor;
  if(typeof previousOpenSessionEditor === 'function'){
    window.openSessionEditor = function(c, s, number){
      // Для новой/непривязанной сессии сразу подставляем текущий активный запрос.
      // Уже сохранённую связь старой сессии не меняем.
      if(c && s && !s.requestId){
        const active = currentActiveRequest(c);
        if(active){
          const api=window.DiagnostikaSessions?.moduleAware===true
            ? window.DiagnostikaSessions
            : window.DiagnostikaPlatform?.services?.sessions||null;
          api?.update?.(s.id,{requestId:active.id},{
            client:c,
            source:'session-active-request',
            render:false
          });
        }
      }
      return previousOpenSessionEditor.call(this, c, s, number);
    };
  }
})();
