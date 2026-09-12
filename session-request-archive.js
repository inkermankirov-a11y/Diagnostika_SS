'use strict';

(() => {
  const currentClient=()=>typeof client==='function'?client():null;
  const currentRequest=c=>{
    if(!c)return null;
    try{
      if(typeof request==='function'){
        const r=request();
        if(r)return r;
      }
    }catch(_){}
    try{
      if(typeof requestId!=='undefined'&&requestId){
        const r=(c.requests||[]).find(x=>String(x.id)===String(requestId));
        if(r)return r;
      }
    }catch(_){}
    try{
      const r=window.DiagnostikaRequests?.current?.(c);
      if(r)return r;
    }catch(_){}
    return (c.requests||[]).find(r=>String(r.id)===String(c.currentRequestId||''))||null;
  };
  const requestForSession=(c,s)=>{
    const rid=s?.requestId||s?.payment?.requestId||'';
    return (c?.requests||[]).find(r=>String(r.id)===String(rid))||null;
  };
  const sessionTime=(s,index)=>{
    try{return typeof sessionTimeValue==='function'?sessionTimeValue(s,index):(new Date(s?.date||s?.createdAt||0).getTime()||index);}catch(_){return index;}
  };
  const chronological=c=>(c?.sessions||[])
    .map((s,index)=>({s,index,time:sessionTime(s,index)}))
    .sort((a,b)=>a.time-b.time||a.index-b.index);
  const numberMap=c=>{
    const map=new Map();
    chronological(c).forEach((x,i)=>map.set(x.s,i+1));
    return map;
  };
  const belongs=(s,r)=>String(s?.requestId||s?.payment?.requestId||'')===String(r?.id||'');
  const fmtDate=v=>{if(!v)return '—';const p=String(v).slice(0,10).split('-');return p.length===3?`${p[2]}.${p[1]}.${p[0]}`:String(v);};

  const style=document.createElement('style');
  style.textContent=`
    .session-archive-btn{margin-left:8px!important;background:linear-gradient(#64748b,#475569)!important;color:#fff!important}
    .session-archive-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}
    .session-archive-dialog::backdrop{background:rgba(15,23,42,.44);backdrop-filter:blur(5px)}
    .session-archive-window{width:min(760px,calc(100vw - 24px));max-height:86vh;overflow:auto;background:#f8fafc;border:1px solid #d5dee8;border-radius:14px;box-shadow:0 24px 65px rgba(15,23,42,.28);padding:18px;box-sizing:border-box}
    .session-archive-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
    .session-archive-head strong{font-size:19px;color:#26384b}.session-archive-close{width:36px;height:36px;border-radius:8px!important;padding:0!important}
    .session-archive-list{display:grid;gap:8px}.session-archive-row{display:grid;grid-template-columns:90px 1fr auto;gap:12px;align-items:center;padding:11px 12px;border:1px solid #dbe4ed;border-radius:9px;background:#fff;cursor:pointer}
    .session-archive-row:hover{background:#f8fbff}.session-archive-num{font-weight:800;color:#26384b}.session-archive-meta{font-size:12px;color:#64748b;margin-top:3px}.session-archive-pay{font-size:11px;font-weight:800;border-radius:999px;padding:4px 8px;white-space:nowrap}.session-archive-pay.paid{background:#e9f8ef;color:#247a49;border:1px solid #bfe7ce}.session-archive-pay.unpaid{background:#fdecec;color:#b33a3a;border:1px solid #f1c3c3}.session-archive-empty{padding:18px;color:#94a3b8;text-align:center}
    @media(max-width:640px){.session-archive-row{grid-template-columns:1fr}.session-archive-pay{justify-self:start}}
  `;
  document.head.appendChild(style);

  function ensureArchiveDialog(){
    let dlg=document.querySelector('#sessionArchiveDialog');
    if(dlg)return dlg;
    dlg=document.createElement('dialog');
    dlg.id='sessionArchiveDialog';
    dlg.className='session-archive-dialog';
    dlg.innerHTML=`<div class="session-archive-window"><div class="session-archive-head"><strong>АРХИВ СЕССИЙ</strong><button type="button" class="tk-btn session-archive-close">×</button></div><div class="session-archive-list"></div></div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('.session-archive-close').onclick=()=>dlg.close();
    dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
    return dlg;
  }

  function archiveSessions(c,r){
    if(!c)return[];
    if(!r)return [...(c.sessions||[])];
    return (c.sessions||[]).filter(s=>!belongs(s,r));
  }

  function renderArchive(){
    const dlg=ensureArchiveDialog(),list=dlg.querySelector('.session-archive-list');
    const c=currentClient(),r=currentRequest(c);
    if(!c){list.innerHTML='<div class="session-archive-empty">Клиент не выбран.</div>';return;}
    const nums=numberMap(c);
    const rows=archiveSessions(c,r).slice().sort((a,b)=>sessionTime(b,0)-sessionTime(a,0));
    list.innerHTML='';
    if(!rows.length){list.innerHTML='<div class="session-archive-empty">Сессий по другим запросам нет.</div>';return;}
    rows.forEach(s=>{
      const req=requestForSession(c,s),paid=s?.payment?.paid===true;
      const row=document.createElement('div');
      row.className='session-archive-row';
      row.tabIndex=0;
      row.innerHTML=`<div class="session-archive-num">Сессия №${nums.get(s)||'—'}</div><div><div>${req?.title||'Без привязки к запросу'}</div><div class="session-archive-meta">${fmtDate(s.date)}${req?` · Запрос ${(c.requests||[]).indexOf(req)+1}`:''}</div></div><span class="session-archive-pay ${paid?'paid':'unpaid'}">${paid?'Оплачено':'Не оплачено'}</span>`;
      const open=()=>{
        dlg.close();
        if(typeof selectedSessionId!=='undefined')selectedSessionId=s.id;
        if(typeof openSessionEditor==='function')openSessionEditor(c,s,nums.get(s));
      };
      row.onclick=open;
      row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};
      list.appendChild(row);
    });
  }

  function ensureArchiveButton(){
    const head=document.querySelector('.sessions-head');
    if(!head)return null;
    let btn=head.querySelector('#sessionArchiveBtn');
    if(!btn){
      btn=document.createElement('button');
      btn.id='sessionArchiveBtn';
      btn.type='button';
      btn.className='tk-btn session-archive-btn';
      btn.onclick=()=>{renderArchive();ensureArchiveDialog().showModal();};
      head.appendChild(btn);
    }
    return btn;
  }

  function applyScope(){
    const c=currentClient(),root=document.querySelector('#sessionsList');
    if(!c||!root||!Array.isArray(c.sessions))return;
    const r=currentRequest(c),archive=archiveSessions(c,r),btn=ensureArchiveButton();
    if(btn)btn.textContent=`Архив сессий${archive.length?` (${archive.length})`:''}`;

    const ordered=[...chronological(c)].reverse().map(x=>x.s);
    const cards=[...root.querySelectorAll('.session-card')];
    cards.forEach((card,i)=>{
      const s=ordered[i];
      if(!s)return;
      if(!r||!belongs(s,r))card.remove();
    });

    const visibleCount=r?(c.sessions||[]).filter(s=>belongs(s,r)).length:0;
    root.querySelectorAll('.session-row').forEach((row,i)=>{
      const s=(c.sessions||[])[i];
      if(!r||!belongs(s,r))row.remove();
    });

    if(!visibleCount&&!root.querySelector('.session-card,.session-row')){
      root.innerHTML='<div style="color:#9CA3AF;padding:8px 0">Сессий по текущему запросу пока нет.</div>';
    }

    const home=document.querySelector('#clientHome');
    if(home){
      [...home.querySelectorAll('*')].forEach(el=>{
        if(el.children.length===0&&/^Всего:\s*\d+$/i.test((el.textContent||'').trim()))el.textContent=`Всего: ${visibleCount}`;
      });
    }
  }

  const previousRenderSessions=window.renderSessions;
  if(typeof previousRenderSessions==='function'){
    window.renderSessions=function(){
      const result=previousRenderSessions.apply(this,arguments);
      applyScope();
      return result;
    };
  }

  document.addEventListener('change',e=>{
    if(e.target?.id==='requestSelect')setTimeout(()=>{try{window.renderSessions?.();}catch(_){}},0);
  },true);

  document.addEventListener('close',e=>{
    if(e.target?.classList?.contains('session-edit-dialog'))setTimeout(()=>{try{window.renderSessions?.();}catch(_){}},0);
  },true);

  setTimeout(()=>{ensureArchiveButton();try{window.renderSessions?.();}catch(_){applyScope();}},0);
  window.DiagnostikaSessionArchive={refresh:()=>{try{window.renderSessions?.();}catch(_){applyScope();}},renderArchive};
})();
