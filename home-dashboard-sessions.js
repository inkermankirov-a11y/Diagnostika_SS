'use strict';

(() => {
  const dashboard=document.querySelector('.home-dashboard');
  if(!dashboard) return;

  const features=dashboard.querySelector('.hd-features');
  if(features) features.remove();

  const summary=dashboard.querySelector('#hdSummary');
  const host=dashboard.querySelector('.hd-main-inner');
  if(!host) return;

  let section=dashboard.querySelector('.hd-sessions-section');
  if(!section){
    section=document.createElement('section');
    section.className='hd-sessions-section';
    if(summary) summary.insertAdjacentElement('afterend',section); else host.appendChild(section);
  }

  section.innerHTML=`
    <div class="hd-sessions-head">
      <div>
        <div class="hd-sessions-title">Сессии</div>
        <div id="hdSessionsCount" class="hd-sessions-count"></div>
      </div>
      <div class="hd-sessions-actions">
        <button id="hdSessionArchive" class="hd-secondary hd-session-archive-btn" type="button">Архив сессий</button>
        <button id="hdAddSession" class="hd-primary hd-add-session" type="button">＋ Добавить сессию</button>
      </div>
    </div>
    <div id="hdSessionsList" class="hd-sessions-list"></div>
  `;

  const list=section.querySelector('#hdSessionsList');
  const count=section.querySelector('#hdSessionsCount');
  const add=section.querySelector('#hdAddSession');
  const archiveBtn=section.querySelector('#hdSessionArchive');

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const getClient=()=>state?.clients?.find(c=>c.id===clientId)||null;
  const sessionRequestId=s=>String(s?.requestId||s?.payment?.requestId||'');

  function currentRequest(c){
    if(!c)return null;
    try{
      const r=window.DiagnostikaRequests?.current?.(c);
      if(r)return r;
    }catch(_){}
    try{
      if(typeof requestId!=='undefined'&&requestId){
        const r=(c.requests||[]).find(x=>String(x.id)===String(requestId));
        if(r)return r;
      }
    }catch(_){}
    return (c.requests||[]).find(r=>String(r.id)===String(c.currentRequestId||''))||(c.requests||[])[0]||null;
  }

  function requestForSession(c,s){
    const id=sessionRequestId(s);
    return (c?.requests||[]).find(r=>String(r.id)===id)||null;
  }

  function requestName(c,s){
    return requestForSession(c,s)?.title||'Без связи с запросом';
  }

  function belongsTo(s,r){
    return !!r&&sessionRequestId(s)===String(r.id);
  }

  function numberedSessions(c){
    const sessions=Array.isArray(c?.sessions)?c.sessions:[];
    const chronological=sessions
      .map((s,index)=>({s,index,time:typeof sessionTimeValue==='function'?sessionTimeValue(s,index):new Date(s.date||0).getTime()||index}))
      .sort((a,b)=>a.time-b.time||a.index-b.index);
    chronological.forEach((item,i)=>item.number=i+1);
    return chronological.reverse();
  }

  function openEditor(c,s,number){
    if(typeof openSessionEditor!=='function') return;
    try{if(typeof selectedSessionId!=='undefined') selectedSessionId=s.id;}catch(_){}
    openSessionEditor(c,s,number);
  }

  function updateDashboardSummary(c,r,currentItems){
    const sum=dashboard.querySelector('#hdSummary');
    if(!sum)return;
    const boxes=[...sum.querySelectorAll('.hd-summary-box')];
    const byLabel=label=>boxes.find(box=>(box.querySelector('.hd-summary-label')?.textContent||'').trim().toLowerCase()===label.toLowerCase());
    const sessionsBox=byLabel('Сессии');
    if(sessionsBox){const v=sessionsBox.querySelector('.hd-summary-value');if(v)v.textContent=String(currentItems.length);}
    const lastBox=byLabel('Последняя сессия');
    if(lastBox){
      const v=lastBox.querySelector('.hd-summary-value');
      if(v)v.textContent=currentItems[0]?.s?.date||'—';
    }
    const reqBox=byLabel('Текущий запрос');
    if(reqBox&&r){const v=reqBox.querySelector('.hd-summary-value');if(v)v.textContent=r.title||'Не указан';}
  }

  function ensureArchiveDialog(){
    let dlg=document.querySelector('#hdSessionArchiveDialog');
    if(dlg)return dlg;
    dlg=document.createElement('dialog');
    dlg.id='hdSessionArchiveDialog';
    dlg.className='hd-session-archive-dialog';
    dlg.innerHTML=`
      <div class="hd-session-archive-window">
        <div class="hd-session-archive-head">
          <div><strong>АРХИВ СЕССИЙ</strong><div class="hd-session-archive-sub">Сессии по другим запросам клиента</div></div>
          <button type="button" class="tk-btn hd-session-archive-close">×</button>
        </div>
        <div class="hd-session-archive-list"></div>
      </div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('.hd-session-archive-close').onclick=()=>dlg.close();
    dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
    return dlg;
  }

  function renderArchive(){
    const c=getClient(),r=currentRequest(c),dlg=ensureArchiveDialog(),root=dlg.querySelector('.hd-session-archive-list');
    if(!c){root.innerHTML='<div class="hd-sessions-empty">Клиент не выбран.</div>';return;}
    const archived=numberedSessions(c).filter(item=>!belongsTo(item.s,r));
    root.innerHTML='';
    if(!archived.length){
      root.innerHTML='<div class="hd-sessions-empty">Сессий по другим запросам нет.</div>';
      return;
    }
    archived.forEach(({s,number})=>{
      const req=requestForSession(c,s);
      const paid=Boolean(s?.payment?.paid);
      const row=document.createElement('article');
      row.className='hd-session-archive-row';
      row.tabIndex=0;
      row.innerHTML=`
        <div class="hd-session-archive-main">
          <strong>Сессия №${number}</strong>
          <span>${esc(s.date||'—')}</span>
        </div>
        <div class="hd-session-archive-request">${esc(req?.title||'Без связи с запросом')}</div>
        <span class="hd-session-pay ${paid?'paid':'unpaid'}"><span class="hd-session-flag">⚑</span>${paid?'Оплачено':'Не оплачено'}</span>`;
      const open=()=>{dlg.close();openEditor(c,s,number);};
      row.onclick=open;
      row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};
      root.appendChild(row);
    });
  }

  function render(){
    const c=getClient();
    if(!c){section.hidden=true;return;}
    section.hidden=false;
    const r=currentRequest(c);
    const all=numberedSessions(c);
    const display=r?all.filter(item=>belongsTo(item.s,r)):[];
    const archived=all.filter(item=>!r||!belongsTo(item.s,r));

    count.textContent=r?(display.length?`Всего: ${display.length}`:'Сессий по текущему запросу пока нет'):'Нет текущего запроса';
    archiveBtn.textContent=`Архив сессий${archived.length?` (${archived.length})`:''}`;
    archiveBtn.hidden=!archived.length;
    list.innerHTML='';
    updateDashboardSummary(c,r,display);

    if(!r){
      list.innerHTML='<div class="hd-sessions-empty">Сначала выберите текущий запрос.</div>';
      return;
    }
    if(!display.length){
      list.innerHTML='<div class="hd-sessions-empty">По текущему запросу сессий пока нет.</div>';
      return;
    }

    display.forEach(({s,number})=>{
      const card=document.createElement('article');
      card.className='hd-session-card hd-session-card-openable';
      card.tabIndex=0;
      card.title='Открыть и редактировать сессию';
      const notes=String(s.notes||'').trim();
      const req=requestForSession(c,s);
      const showPayment=req?.payment?.mode==='session';
      const paid=Boolean(s?.payment?.paid);
      const paymentHtml=showPayment?`<span class="hd-session-pay ${paid?'paid':'unpaid'}"><span class="hd-session-flag">⚑</span>${paid?'Оплачено':'Не оплачено'}</span>`:'';
      card.innerHTML=`
        <div class="hd-session-top">
          <strong>Сессия №${number}</strong>
          <span class="hd-session-date">◷ ${esc(s.date||'—')}</span>
          <span class="hd-session-request">• ${esc(requestName(c,s))}</span>
          ${paymentHtml}
          <span class="hd-session-edit-hint">Редактировать</span>
        </div>
        ${notes?`<div class="hd-session-note-label">ЗАМЕТКА</div><div class="hd-session-note">${esc(notes)}</div>`:'<div class="hd-session-note hd-session-note-empty">Заметка не добавлена</div>'}
      `;
      card.addEventListener('click',e=>{
        if(e.target.closest('button,a,input,select,textarea,label')) return;
        openEditor(c,s,number);
      });
      card.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){e.preventDefault();openEditor(c,s,number);}
      });
      list.appendChild(card);
    });
  }

  archiveBtn.addEventListener('click',()=>{
    renderArchive();
    const dlg=ensureArchiveDialog();
    if(!dlg.open)dlg.showModal();
  });

  add.addEventListener('click',()=>{
    const c=getClient(),r=currentRequest(c);
    if(!c||!r)return;
    const beforeIds=new Set((c.sessions||[]).map(s=>s.id));
    const oldAdd=document.getElementById('addSessionBtn');
    if(oldAdd)oldAdd.click();
    setTimeout(()=>{
      const updated=getClient();if(!updated)return;
      const fresh=(updated.sessions||[]).find(s=>!beforeIds.has(s.id));
      if(fresh){
        if(!sessionRequestId(fresh)){fresh.requestId=r.id;try{if(typeof save==='function')save();}catch(_){}}
        const numbered=numberedSessions(updated).find(x=>x.s===fresh||x.s.id===fresh.id);
        render();
        if(numbered)openEditor(updated,fresh,numbered.number);
      }else render();
    },0);
  });

  document.addEventListener('click',e=>{
    if(e.target.closest('.hd-client-row,.hd-add-client,.request-current-btn,.request-resume-btn,.request-finish-btn'))setTimeout(render,20);
  },true);
  document.addEventListener('change',e=>{
    if(e.target?.id==='requestSelect')setTimeout(render,0);
  },true);
  document.addEventListener('close',e=>{
    if(e.target?.matches?.('dialog.session-edit-dialog'))setTimeout(render,0);
  },true);

  if(typeof renderClient==='function'){
    const prev=renderClient;
    if(!prev.__hdSessionsScoped){
      const wrapped=function(){const out=prev.apply(this,arguments);setTimeout(render,0);return out;};
      wrapped.__hdSessionsScoped=true;
      renderClient=wrapped;
    }
  }

  const hd=window.DiagnostikaHomeDashboard;
  if(hd?.refresh&&!hd.refresh.__hdSessionsScoped){
    const prev=hd.refresh;
    const wrapped=function(){const out=prev.apply(this,arguments);setTimeout(render,0);return out;};
    wrapped.__hdSessionsScoped=true;
    hd.refresh=wrapped;
  }

  const style=document.createElement('style');
  style.textContent=`
    .hd-sessions-section{width:min(760px,100%);margin-top:26px;text-align:left;border-top:1px solid #dbe7f4;padding-top:20px}
    .hd-sessions-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}
    .hd-sessions-title{font-size:20px;font-weight:800;color:#132747}
    .hd-sessions-count{margin-top:3px;font-size:12px;color:#8a9bb4}
    .hd-sessions-actions{display:flex;align-items:center;gap:8px}
    .hd-add-session,.hd-session-archive-btn{height:40px;padding:0 16px;font-size:13px}
    .hd-session-archive-btn{background:linear-gradient(#fff,#edf2f7)!important;color:#31536f!important;border:1px solid #c8d5e3!important}
    .hd-sessions-list{display:grid;gap:11px;width:100%}
    .hd-session-card{border:1px solid #d6e3f2;border-left:4px solid #6ea4ef;border-radius:11px;background:#fff;box-shadow:0 2px 8px rgba(31,71,122,.05);overflow:hidden;transition:.15s ease}
    .hd-session-card-openable{cursor:pointer}.hd-session-card-openable:hover{border-color:#9ec2f3;box-shadow:0 5px 14px rgba(31,71,122,.10);transform:translateY(-1px)}
    .hd-session-card-openable:focus{outline:3px solid rgba(47,124,246,.16);outline-offset:2px}
    .hd-session-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;background:#f5f9fe;color:#173154;font-size:13px}.hd-session-top strong{font-size:14px}
    .hd-session-date,.hd-session-request{padding:4px 9px;border:1px solid #dce8f5;border-radius:999px;background:#fff;color:#647b99;font-size:12px}
    .hd-session-pay{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;border:1px solid transparent;white-space:nowrap}.hd-session-pay.paid{background:#e9f8ef;color:#247a49;border-color:#bfe7ce}.hd-session-pay.unpaid{background:#fdecec;color:#b33a3a;border-color:#f1c3c3}.hd-session-flag{font-size:13px;line-height:1}
    .hd-session-edit-hint{margin-left:auto;color:#2f70d4;font-size:12px;font-weight:800}.hd-session-note-label{padding:11px 14px 0;color:#a17b55;font-size:10px;font-weight:800;letter-spacing:.08em}.hd-session-note{padding:7px 14px 14px;color:#243a58;font-size:13px;line-height:1.45;white-space:pre-wrap}.hd-session-note-empty{color:#9aa9bc;font-style:italic;padding-top:13px}.hd-sessions-empty{padding:22px;border:1px dashed #cfddec;border-radius:10px;text-align:center;color:#8a9ab3;background:#fbfdff;font-size:13px}
    .hd-session-archive-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}.hd-session-archive-dialog::backdrop{background:rgba(15,23,42,.44);backdrop-filter:blur(5px)}.hd-session-archive-window{width:min(720px,calc(100vw - 24px));max-height:86vh;overflow:auto;background:#f8fafc;border:1px solid #d5dee8;border-radius:14px;box-shadow:0 24px 65px rgba(15,23,42,.28);padding:18px;box-sizing:border-box}.hd-session-archive-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.hd-session-archive-head strong{font-size:19px;color:#26384b}.hd-session-archive-sub{margin-top:3px;font-size:12px;color:#7b8ba0}.hd-session-archive-close{width:36px;height:36px;border-radius:8px!important;padding:0!important}.hd-session-archive-list{display:grid;gap:8px}.hd-session-archive-row{display:grid;grid-template-columns:150px 1fr auto;gap:12px;align-items:center;padding:11px 12px;border:1px solid #dbe4ed;border-radius:9px;background:#fff;cursor:pointer}.hd-session-archive-row:hover{background:#f8fbff}.hd-session-archive-main{display:grid;gap:3px}.hd-session-archive-main span{font-size:12px;color:#718198}.hd-session-archive-request{font-size:13px;color:#334155}
    @media(max-width:820px){.hd-sessions-head{align-items:stretch;flex-direction:column}.hd-sessions-actions{width:100%}.hd-sessions-actions button{flex:1}.hd-session-edit-hint{width:100%;margin-left:0}.hd-session-archive-row{grid-template-columns:1fr}.hd-session-pay{justify-self:start}}
  `;
  document.head.appendChild(style);

  render();
})();
