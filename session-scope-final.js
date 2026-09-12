'use strict';

(() => {
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const currentClient=()=>{
    try{return state?.clients?.find(c=>String(c.id)===String(clientId))||null;}catch(_){return null;}
  };
  const sessionTime=(s,index)=>{
    try{return typeof sessionTimeValue==='function'?sessionTimeValue(s,index):(new Date(s?.date||s?.createdAt||0).getTime()||index);}catch(_){return index;}
  };
  const chronological=c=>(c?.sessions||[]).map((s,index)=>({s,index,time:sessionTime(s,index)})).sort((a,b)=>a.time-b.time||a.index-b.index);
  const requestForSession=(c,s)=>{
    const rid=s?.requestId||s?.payment?.requestId||'';
    return (c?.requests||[]).find(r=>String(r.id)===String(rid))||null;
  };
  const belongs=(s,r)=>String(s?.requestId||s?.payment?.requestId||'')===String(r?.id||'');

  function requestFromVisibleSummary(c){
    const boxes=[...document.querySelectorAll('.hd-summary-box')];
    for(const box of boxes){
      const label=(box.querySelector('.hd-summary-label')?.textContent||'').trim().toLowerCase();
      if(!label.includes('текущий запрос'))continue;
      const title=(box.querySelector('.hd-summary-value')?.textContent||'').trim();
      const match=(c?.requests||[]).find(r=>String(r.title||'').trim()===title);
      if(match)return match;
    }
    return null;
  }

  function activeRequest(c){
    if(!c)return null;
    const visible=requestFromVisibleSummary(c);if(visible)return visible;
    try{if(typeof requestId!=='undefined'&&requestId){const r=(c.requests||[]).find(x=>String(x.id)===String(requestId));if(r)return r;}}catch(_){}
    try{const r=window.DiagnostikaRequests?.current?.(c);if(r)return r;}catch(_){}
    return (c.requests||[]).find(r=>String(r.id)===String(c.currentRequestId||''))
      ||(c.requests||[]).find(r=>r.status==='active'||r.status==='resumed')
      ||(c.requests||[])[0]
      ||null;
  }

  function sessionByDisplayedNumber(c,n){
    const arr=chronological(c);
    return arr[n-1]?.s||null;
  }

  function extractSessionNumber(card){
    const text=card.querySelector('.session-card-title')?.textContent||card.textContent||'';
    const m=text.match(/Сессия\s*№\s*(\d+)/i);
    return m?Number(m[1]):0;
  }

  function ensureArchiveDialog(){
    let dlg=document.getElementById('sessionArchiveFinalDialog');
    if(dlg)return dlg;
    dlg=document.createElement('dialog');
    dlg.id='sessionArchiveFinalDialog';
    dlg.className='payment-dialog';
    dlg.innerHTML=`<div class="payment-window" style="width:min(760px,calc(100vw - 24px))"><div class="payment-head"><strong>АРХИВ СЕССИЙ</strong><button type="button" class="payment-x">×</button></div><div id="sessionArchiveFinalList" style="display:grid;gap:8px"></div><div class="payment-footer"><button type="button" class="tk-btn session-archive-final-close">Закрыть</button></div></div>`;
    document.body.appendChild(dlg);
    const close=()=>dlg.close();
    dlg.querySelector('.payment-x').onclick=close;
    dlg.querySelector('.session-archive-final-close').onclick=close;
    dlg.addEventListener('click',e=>{if(e.target===dlg)close();});
    return dlg;
  }

  function renderArchive(){
    const c=currentClient(),r=activeRequest(c),dlg=ensureArchiveDialog(),root=dlg.querySelector('#sessionArchiveFinalList');
    if(!c||!root)return;
    const nums=new Map();chronological(c).forEach((x,i)=>nums.set(x.s,i+1));
    const rows=(c.sessions||[]).filter(s=>!r||!belongs(s,r)).slice().sort((a,b)=>sessionTime(b,0)-sessionTime(a,0));
    root.innerHTML='';
    if(!rows.length){root.innerHTML='<div style="padding:14px;color:#94a3b8">Сессий по другим запросам нет.</div>';return;}
    rows.forEach(s=>{
      const req=requestForSession(c,s),paid=s?.payment?.paid===true,row=document.createElement('div');
      row.className='all-payment-row';
      row.style.gridTemplateColumns='110px 1fr auto';
      row.style.cursor='pointer';
      row.innerHTML=`<strong>Сессия №${nums.get(s)||'—'}</strong><div><div>${esc(req?.title||'Без привязки к запросу')}</div><div class="all-payment-meta">${esc(s.date||'—')}${req?` · Запрос ${(c.requests||[]).indexOf(req)+1}`:''}</div></div><span class="pay-chip ${paid?'paid':'unpaid'}">${paid?'Оплачено':'Не оплачено'}</span>`;
      row.onclick=()=>{dlg.close();try{selectedSessionId=s.id;}catch(_){};try{openSessionEditor(c,s,nums.get(s));}catch(_){}};
      root.appendChild(row);
    });
  }

  function ensureArchiveButton(){
    const add=document.getElementById('addSessionBtn');
    const head=add?.parentElement||document.querySelector('.sessions-head');
    if(!head)return null;
    let btn=document.getElementById('sessionArchiveFinalBtn');
    if(!btn){
      btn=document.createElement('button');
      btn.id='sessionArchiveFinalBtn';btn.type='button';btn.className='tk-btn';btn.style.marginLeft='8px';btn.textContent='Архив сессий';
      btn.onclick=()=>{renderArchive();ensureArchiveDialog().showModal();};
      head.appendChild(btn);
    }
    return btn;
  }

  function updateCounters(c,r,visible){
    document.querySelectorAll('.hd-summary-box').forEach(box=>{
      const label=(box.querySelector('.hd-summary-label')?.textContent||'').trim().toLowerCase();
      const value=box.querySelector('.hd-summary-value');
      if(label==='сессии'&&value)value.textContent=String(visible.length);
      if(label.includes('последняя сессия')&&value){
        const last=visible.slice().sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')))[0];
        value.textContent=last?.date||'—';
      }
    });
    const home=document.getElementById('clientHome');
    home?.querySelectorAll('*').forEach(el=>{
      if(el.children.length===0&&/^Всего:\s*\d+$/i.test((el.textContent||'').trim()))el.textContent=`Всего: ${visible.length}`;
    });
  }

  function sync(){
    const c=currentClient(),root=document.getElementById('sessionsList');
    if(!c||!root)return;
    const r=activeRequest(c);
    const visible=r?(c.sessions||[]).filter(s=>belongs(s,r)):[];
    const archive=r?(c.sessions||[]).filter(s=>!belongs(s,r)):[...(c.sessions||[])];
    const btn=ensureArchiveButton();if(btn)btn.textContent=`Архив сессий${archive.length?` (${archive.length})`:''}`;

    root.querySelectorAll('.session-card').forEach(card=>{
      const n=extractSessionNumber(card),s=n?sessionByDisplayedNumber(c,n):null;
      card.style.display=s&&r&&belongs(s,r)?'':'none';
    });
    root.querySelectorAll('.session-row').forEach((row,i)=>{
      const s=(c.sessions||[])[i];row.style.display=s&&r&&belongs(s,r)?'':'none';
    });
    updateCounters(c,r,visible);
  }

  let queued=false;
  const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync();});};
  const root=document.getElementById('sessionsList');
  if(root)new MutationObserver(queue).observe(root,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target?.id==='requestSelect')setTimeout(queue,0);},true);
  document.addEventListener('click',e=>{if(e.target?.closest?.('#hdClientList,#addSessionBtn,.session-edit-dialog'))setTimeout(queue,0);},true);
  setTimeout(queue,0);setTimeout(queue,250);
  window.DiagnostikaSessionScopeFinal={refresh:queue,renderArchive};
})();