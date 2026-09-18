'use strict';

(() => {
  const style = document.createElement('style');
  style.textContent = `
    .diag-launch-dialog{border:1px solid #7f7f7f;padding:0;width:420px;max-width:92vw;background:#EEF1F4;color:#111}
    .diag-launch-dialog::backdrop,.request-history-dialog::backdrop{background:rgba(0,0,0,.28)}
    .diag-launch-card{padding:22px 16px 16px;background:#EEF1F4}
    .diag-launch-title{font-size:24px;font-weight:800;margin:0 8px 6px}
    .diag-launch-sub{color:#68758d;margin:0 8px 18px}
    .diag-launch-actions{background:#fff;padding:16px;display:grid;gap:12px}
    .diag-launch-actions button{border:0;padding:10px 12px;background:#E7EAEE;cursor:pointer}
    .diag-launch-actions .primary{background:#4169E1;color:white}
    .request-history-dialog{border:1px solid #777;padding:0;width:min(760px,94vw);height:min(430px,88vh);background:#EEF1F4}
    .request-history-shell{height:100%;display:flex;flex-direction:column;padding:14px}
    .request-history-title{font-size:19px;font-weight:800;margin:4px 2px 14px}
    .request-history-table{background:#fff;border:1px solid #9b9b9b;display:grid;grid-template-rows:auto 1fr;min-height:0;flex:1}
    .request-history-head,.request-history-row{display:grid;grid-template-columns:58px 152px 1fr}
    .request-history-head{background:#E4E7EB;font-weight:700;border-bottom:1px solid #8f8f8f}
    .request-history-head>div{padding:5px 8px;border-right:1px solid #9b9b9b;text-align:center}
    .request-history-body{overflow:auto}
    .request-history-row{cursor:pointer;border-bottom:1px solid transparent}
    .request-history-row>div{padding:8px 8px}
    .request-history-row>div:first-child,.request-history-row>div:nth-child(2){text-align:center}
    .request-history-row.selected{background:#DCE7F8;outline:1px solid #4169E1}
    .request-history-footer{display:flex;align-items:center;gap:8px;margin-top:10px}
    .request-history-footer button{border:0;background:#EDF0F3;padding:8px 13px;cursor:pointer}
    .request-history-footer .primary{background:#4169E1;color:#fff}
    .request-history-footer .close{margin-left:auto}
  `;
  document.head.appendChild(style);

  const launch = document.createElement('dialog');
  launch.id = 'diagnosisLaunchDialog';
  launch.className = 'diag-launch-dialog';
  launch.innerHTML = `
    <div class="diag-launch-card">
      <div class="diag-launch-title">ДИАГНОСТИКА</div>
      <div class="diag-launch-sub">Выбери, с какой диагностикой работать</div>
      <div class="diag-launch-actions">
        <button id="diagNewBtn" class="primary">+ Новая диагностика</button>
        <button id="diagPreviousBtn">Предыдущие запросы</button>
        <button id="diagDeleteBtn">Удалить запрос</button>
      </div>
    </div>`;
  document.body.appendChild(launch);

  const history = document.createElement('dialog');
  history.id = 'requestHistoryDialog';
  history.className = 'request-history-dialog';
  history.innerHTML = `
    <div class="request-history-shell">
      <div class="request-history-title">ЗАПРОСЫ КЛИЕНТА</div>
      <div class="request-history-table">
        <div class="request-history-head"><div>№</div><div>Изменён</div><div>Общий запрос</div></div>
        <div id="requestHistoryBody" class="request-history-body"></div>
      </div>
      <div class="request-history-footer">
        <button id="requestOpenBtn" class="primary">Открыть выбранный</button>
        <button id="requestDeleteSelectedBtn">Удалить выбранный</button>
        <button id="requestHistoryCloseBtn" class="close">Закрыть</button>
      </div>
    </div>`;
  document.body.appendChild(history);

  let historySelectedId = null;

  function requestsApi(){
    return window.DiagnostikaRequests?.moduleAware===true
      ? window.DiagnostikaRequests
      : window.DiagnostikaPlatform?.services?.requests||null;
  }

  function currentClient(){
    return window.DiagnostikaClients?.current?.()
      || (typeof client==='function'?client():null);
  }

  function requestDate(r) {
    const raw = r?.updatedAt || r?.modifiedAt || r?.createdAt || '';
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString('ru-RU', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',', '');
  }

  function populateHistory(selectId = null) {
    const api=requestsApi();
    const c=currentClient();
    const rows=api?.list?.(c)||[];
    const body=document.querySelector('#requestHistoryBody');
    body.innerHTML='';
    if(!api||!c||!rows.length){
      body.innerHTML='<div style="padding:18px;color:#777">Предыдущих запросов пока нет.</div>';
      historySelectedId=null;
      return;
    }
    historySelectedId=selectId&&api.get(selectId,c)?selectId:rows[0].id;
    rows.forEach((r,i)=>{
      const row=document.createElement('div');
      row.className='request-history-row'+(String(r.id)===String(historySelectedId)?' selected':'');
      row.dataset.requestId=r.id;
      row.innerHTML=`<div>${i+1}</div><div>${requestDate(r)}</div><div></div>`;
      row.children[2].textContent=r.title||'Без названия';
      row.onclick=()=>{historySelectedId=r.id;populateHistory(historySelectedId);};
      row.ondblclick=()=>openSelectedRequest();
      body.appendChild(row);
    });
  }

  function enterDiagnosis(r){
    if(!r)return false;
    try{
      situationId=r.situations?.[0]?.id||null;
      selected=null;
      mode='diagnosis';
    }catch(_){return false;}
    try{if(typeof renderMode==='function')renderMode();}catch(_){return false;}
    history.close();
    launch.close();
    return true;
  }

  function openDiagnosisFor(id){
    const api=requestsApi();
    const c=currentClient();
    const r=api?.get?.(id,c);
    if(!api||!c||!r)return false;
    if(!api.view(r.id,{client:c,source:'diagnosis-history-view'}))return false;
    return enterDiagnosis(r);
  }

  function openSelectedRequest(){
    if(!historySelectedId)return alert('Выбери запрос из списка.');
    openDiagnosisFor(historySelectedId);
  }

  function deleteRequestById(id){
    const api=requestsApi();
    const c=currentClient();
    const r=api?.get?.(id,c);
    if(!api||!c||!r)return;
    if(!confirm(`Удалить запрос «${r.title||'Без названия'}» со всей его диагностикой?`))return;
    if(!api.remove(r.id,{client:c,source:'diagnosis-history-delete'}))return;
    const next=api.viewedId?.(c)||api.activeId?.(c)||null;
    populateHistory(next);
  }

  document.querySelector('#diagNewBtn').onclick=()=>{
    const api=requestsApi();
    const c=currentClient();
    if(!api||!c)return;
    const created=api.create({title:'Новый запрос'},{client:c,source:'diagnosis-create'});
    if(created)enterDiagnosis(created);
  };

  document.querySelector('#diagPreviousBtn').onclick=()=>{
    const api=requestsApi();
    const c=currentClient();
    if(!api||!c||!api.list(c).length)return alert('У клиента пока нет предыдущих запросов.');
    populateHistory(api.viewedId(c)||api.activeId(c));
    launch.close();
    history.showModal();
  };

  document.querySelector('#diagDeleteBtn').onclick=()=>{
    const api=requestsApi();
    const c=currentClient();
    if(!api||!c||!api.list(c).length)return alert('Удалять нечего: у клиента нет запросов.');
    populateHistory(api.viewedId(c)||api.activeId(c));
    launch.close();
    history.showModal();
  };

  document.querySelector('#requestOpenBtn').onclick=openSelectedRequest;
  document.querySelector('#requestDeleteSelectedBtn').onclick=()=>{
    if(!historySelectedId)return alert('Выбери запрос из списка.');
    deleteRequestById(historySelectedId);
  };
  document.querySelector('#requestHistoryCloseBtn').onclick=()=>history.close();

  launch.addEventListener('click',e=>{if(e.target===launch)launch.close();});
  history.addEventListener('click',e=>{if(e.target===history)history.close();});
})();
