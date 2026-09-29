'use strict';

(() => {
  function currentActiveRequest(c){
    if(!c)return null;
    const current=window.DiagnostikaRequests?.current?.(c)
      ||c.requests?.find(r=>r.id===c.currentRequestId)
      ||null;
    return current&&(current.status==='active'||current.status==='resumed')?current:null;
  }

  function sessionsApi(){
    return window.DiagnostikaSessions?.moduleAware===true?window.DiagnostikaSessions:null;
  }

  function linkActiveRequest(event){
    const {client:c,session:s,dialog:dlg}=event.detail||{};
    if(!c||!s||s.requestId)return;
    const active=currentActiveRequest(c);
    if(!active)return;
    const updated=sessionsApi()?.update?.(s.id,{requestId:active.id},{
      client:c,
      source:'session-active-request',
      render:false
    });
    if(!updated)return;
    const requestSelect=dlg?.querySelector('.session-edit-grid select:not(.session-format-select)');
    if(requestSelect)requestSelect.value=active.id;
  }

  document.addEventListener('diagnostika:session-editor-opened',linkActiveRequest);
})();
