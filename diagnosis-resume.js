'use strict';

(() => {
  function currentClient(){
    return typeof client==='function'?client():null;
  }

  function rememberRequest(id){
    const c=currentClient();
    if(!c||!id) return;
    if(c.requests?.some(r=>r.id===id)){
      c.lastDiagnosisRequestId=id;
      if(typeof save==='function') save();
    }
  }

  function openDiagnosis(id){
    const c=currentClient();
    const r=c?.requests?.find(x=>x.id===id);
    if(!r) return false;
    requestId=r.id;
    situationId=r.situations?.some(s=>s.id===situationId)?situationId:(r.situations?.[0]?.id||null);
    selected=null;
    mode='diagnosis';
    c.lastDiagnosisRequestId=r.id;
    if(typeof save==='function') save();
    if(typeof renderRequests==='function') renderRequests();
    if(typeof renderMode==='function') renderMode();
    const launch=document.querySelector('#diagnosisLaunchDialog');
    const history=document.querySelector('#requestHistoryDialog');
    if(launch?.open) launch.close();
    if(history?.open) history.close();
    return true;
  }

  const btn=document.querySelector('#diagnosisModeBtn');
  if(btn){
    btn.onclick=()=>{
      const c=currentClient();
      if(!c) return alert('Сначала выбери клиента.');

      // Уже находимся внутри диагностики — повторное нажатие ничего не делает.
      if(mode==='diagnosis'){
        if(requestId) rememberRequest(requestId);
        return;
      }

      const candidate=(requestId && c.requests?.some(r=>r.id===requestId))
        ? requestId
        : c.lastDiagnosisRequestId;
      if(candidate && openDiagnosis(candidate)) return;

      const launch=document.querySelector('#diagnosisLaunchDialog');
      if(launch&&!launch.open) launch.showModal();
    };
  }

  const requestSelect=document.querySelector('#requestSelect');
  if(requestSelect){
    const old=requestSelect.onchange;
    requestSelect.onchange=e=>{
      if(typeof old==='function') old.call(requestSelect,e);
      rememberRequest(e.target.value);
    };
  }

  const back=document.querySelector('#backToProgressBtn');
  if(back){
    const oldBack=back.onclick;
    back.onclick=e=>{
      if(mode==='diagnosis' && requestId) rememberRequest(requestId);
      if(typeof oldBack==='function') oldBack.call(back,e);
    };
  }
})();
