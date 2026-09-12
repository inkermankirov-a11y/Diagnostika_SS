'use strict';

(() => {
  const dashboard=document.querySelector('.home-dashboard');
  if(!dashboard||document.querySelector('.hd-sessions-section')) return;

  const features=dashboard.querySelector('.hd-features');
  if(features) features.remove();

  const summary=dashboard.querySelector('#hdSummary');
  const host=dashboard.querySelector('.hd-main-inner');
  if(!host) return;

  const section=document.createElement('section');
  section.className='hd-sessions-section';
  section.innerHTML=`
    <div class="hd-sessions-head">
      <div>
        <div class="hd-sessions-title">Сессии</div>
        <div id="hdSessionsCount" class="hd-sessions-count"></div>
      </div>
      <button id="hdAddSession" class="hd-primary hd-add-session" type="button">＋ Добавить сессию</button>
    </div>
    <div id="hdSessionsList" class="hd-sessions-list"></div>
  `;
  if(summary) summary.insertAdjacentElement('afterend',section); else host.appendChild(section);

  const list=section.querySelector('#hdSessionsList');
  const count=section.querySelector('#hdSessionsCount');
  const add=section.querySelector('#hdAddSession');

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const getClient=()=>state?.clients?.find(c=>c.id===clientId)||null;

  function requestName(c,id){
    if(!id) return 'Без связи с запросом';
    return c?.requests?.find(r=>r.id===id)?.title||'Без связи с запросом';
  }

  function render(){
    const c=getClient();
    if(!c){section.hidden=true;return;}
    section.hidden=false;
    const sessions=Array.isArray(c.sessions)?c.sessions:[];
    count.textContent=sessions.length?`Всего: ${sessions.length}`:'Сессий пока нет';
    list.innerHTML='';

    if(!sessions.length){
      list.innerHTML='<div class="hd-sessions-empty">У этого клиента пока нет сессий.</div>';
      return;
    }

    sessions.slice().reverse().forEach((s,reverseIndex)=>{
      const originalIndex=sessions.length-1-reverseIndex;
      const card=document.createElement('article');
      card.className='hd-session-card';
      const notes=String(s.notes||'').trim();
      card.innerHTML=`
        <div class="hd-session-top">
          <strong>Сессия №${originalIndex+1}</strong>
          <span class="hd-session-date">◷ ${esc(s.date||'—')}</span>
          <span class="hd-session-request">• ${esc(requestName(c,s.requestId))}</span>
        </div>
        ${notes?`<div class="hd-session-note-label">ЗАМЕТКА</div><div class="hd-session-note">${esc(notes)}</div>`:'<div class="hd-session-note hd-session-note-empty">Заметка не добавлена</div>'}
      `;
      list.appendChild(card);
    });
  }

  add.addEventListener('click',()=>{
    const oldAdd=document.getElementById('addSessionBtn');
    if(oldAdd){oldAdd.click();setTimeout(render,0);}
  });

  document.addEventListener('click',e=>{
    if(e.target.closest('.hd-client-row,.hd-add-client')) setTimeout(render,20);
  },true);

  if(typeof renderClient==='function'){
    const prev=renderClient;
    if(!prev.__hdSessionsPatched){
      const wrapped=function(){const out=prev.apply(this,arguments);setTimeout(render,0);return out;};
      wrapped.__hdSessionsPatched=true;
      renderClient=wrapped;
    }
  }

  const style=document.createElement('style');
  style.textContent=`
    .hd-sessions-section{width:min(760px,100%);margin-top:26px;text-align:left;border-top:1px solid #dbe7f4;padding-top:20px}
    .hd-sessions-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}
    .hd-sessions-title{font-size:20px;font-weight:800;color:#132747}
    .hd-sessions-count{margin-top:3px;font-size:12px;color:#8a9bb4}
    .hd-add-session{height:40px;padding:0 16px;font-size:13px}
    .hd-sessions-list{display:grid;gap:11px;width:100%}
    .hd-session-card{border:1px solid #d6e3f2;border-left:4px solid #6ea4ef;border-radius:11px;background:#fff;box-shadow:0 2px 8px rgba(31,71,122,.05);overflow:hidden}
    .hd-session-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;background:#f5f9fe;color:#173154;font-size:13px}
    .hd-session-top strong{font-size:14px}
    .hd-session-date,.hd-session-request{padding:4px 9px;border:1px solid #dce8f5;border-radius:999px;background:#fff;color:#647b99;font-size:12px}
    .hd-session-note-label{padding:11px 14px 0;color:#a17b55;font-size:10px;font-weight:800;letter-spacing:.08em}
    .hd-session-note{padding:7px 14px 14px;color:#243a58;font-size:13px;line-height:1.45;white-space:pre-wrap}
    .hd-session-note-empty{color:#9aa9bc;font-style:italic;padding-top:13px}
    .hd-sessions-empty{padding:22px;border:1px dashed #cfddec;border-radius:10px;text-align:center;color:#8a9ab3;background:#fbfdff;font-size:13px}
    @media(max-width:820px){.hd-sessions-head{align-items:stretch;flex-direction:column}.hd-add-session{width:100%}}
  `;
  document.head.appendChild(style);
  render();
})();
