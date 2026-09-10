'use strict';

(() => {
  function currentActiveRequest(c){
    if(!c) return null;
    const current = window.DiagnostikaRequests?.current?.(c) || c.requests?.find(r => r.id === c.currentRequestId) || null;
    return current && (current.status === 'active' || current.status === 'resumed') ? current : null;
  }

  const addSessionBtn = document.querySelector('#addSessionBtn');
  if(addSessionBtn){
    addSessionBtn.onclick = () => {
      const c = typeof client === 'function' ? client() : null;
      if(!c) return;
      if(!Array.isArray(c.sessions)) c.sessions = [];
      const active = currentActiveRequest(c);
      c.sessions.push({
        id: uid(),
        date: today(),
        requestId: active?.id || '',
        notes: ''
      });
      save();
      renderSessions();
    };
  }

  const previousOpenSessionEditor = window.openSessionEditor;
  if(typeof previousOpenSessionEditor === 'function'){
    window.openSessionEditor = function(c, s, number){
      // Для новой/непривязанной сессии сразу подставляем текущий активный запрос.
      // Уже сохранённую связь старой сессии не меняем.
      if(c && s && !s.requestId){
        const active = currentActiveRequest(c);
        if(active){
          s.requestId = active.id;
          if(typeof save === 'function') save();
        }
      }
      return previousOpenSessionEditor.call(this, c, s, number);
    };
  }
})();
