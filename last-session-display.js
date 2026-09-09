'use strict';

(() => {
  function formatSessionDate(value){
    if(!value) return '—';
    const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m) return `${m[3]}.${m[2]}.${m[1]}`;
    const d=new Date(value);
    if(Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('ru-RU');
  }

  function updateLastSessionDate(){
    const el=document.querySelector('#clientLastSession');
    if(!el) return;
    const c=typeof client==='function'?client():null;
    if(!c){
      el.textContent='Последняя сессия: —';
      return;
    }
    const sessions=Array.isArray(c.sessions)?c.sessions:[];
    if(!sessions.length){
      el.textContent='Последняя сессия: —';
      return;
    }
    const dated=sessions
      .map((s,index)=>({s,index,time:Date.parse(s.date||s.createdAt||s.savedAt||'')}))
      .filter(x=>Number.isFinite(x.time))
      .sort((a,b)=>b.time-a.time||b.index-a.index);
    const latest=dated[0]?.s || sessions[sessions.length-1];
    el.textContent=`Последняя сессия: ${formatSessionDate(latest.date||latest.createdAt||latest.savedAt)}`;
  }

  if(typeof renderSessions==='function'){
    const originalRenderSessions=renderSessions;
    renderSessions=function(){
      const result=originalRenderSessions.apply(this,arguments);
      updateLastSessionDate();
      return result;
    };
  }

  if(typeof renderClient==='function'){
    const originalRenderClient=renderClient;
    renderClient=function(){
      const result=originalRenderClient.apply(this,arguments);
      updateLastSessionDate();
      return result;
    };
  }

  updateLastSessionDate();
})();
