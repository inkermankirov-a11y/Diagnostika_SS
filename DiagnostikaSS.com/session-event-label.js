'use strict';
/* One event-title resolver for client beacons and the upcoming-events board.
   Calendar metadata is authoritative. A linked client session is a fallback
   for older calendar records that only have the generic title "Сессия". */
(() => {
  if(window.DiagnostikaSessionEventLabel)return;
  const sessionTitle=/^сессия(?:\s*№\s*(\d+))?$/i;
  function validNumber(n){
    const v=Number(n);
    return Number.isSafeInteger(v)&&v>0?v:null;
  }
  function isSession(e){
    const type=String(e?.type||'').trim();
    const title=String(e?.title||'').trim();
    return sessionTitle.test(type)||sessionTitle.test(title);
  }
  function numberFromTitle(text){
    const match=String(text||'').trim().match(sessionTitle);
    return match&&match[1]?validNumber(match[1]):null;
  }
  function linkedSession(e,c){
    const sessions=Array.isArray(c?.sessions)?c.sessions:[];
    if(!sessions.length)return null;
    const eventId=String(e?.id||'').trim();
    const sessionId=String(e?.sessionId||'').trim();
    if(sessionId){
      const matched=sessions.find(s=>String(s?.id||'')===sessionId);
      if(matched)return matched;
    }
    if(eventId){
      const matched=sessions.find(s=>String(s?.calendarEventId||'')===eventId);
      if(matched)return matched;
    }
    // Legacy events occasionally lack linkage. Only infer a match when
    // client, date, time and (if present) request identify exactly one session.
    const date=String(e?.date||'').slice(0,10);
    const time=String(e?.time||'').slice(0,5);
    if(!date||!time)return null;
    const candidates=sessions.filter(s=>
      (s?.planned===true||s?.status==='planned')&&
      String(s.scheduledDate||s.plannedDate||s.date||'').slice(0,10)===date&&
      String(s.scheduledTime||'').slice(0,5)===time&&
      (!e?.requestId||String(s.requestId||'')===String(e.requestId))
    );
    return candidates.length===1?candidates[0]:null;
  }
  function ordinalForSession(session,c){
    const sessions=Array.isArray(c?.sessions)?c.sessions:[];
    const rows=sessions.map((s,index)=>({
      s,index,
      date:String(s?.scheduledDate||s?.plannedDate||s?.date||'').slice(0,10),
      time:String(s?.scheduledTime||'').slice(0,5)
    })).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.index-b.index);
    let number=0;
    for(const row of rows){
      const type=String(row.s?.appointmentType||row.s?.calendarTitle||'Сессия').trim();
      if(!sessionTitle.test(type))continue;
      number++;
      if(row.s===session||String(row.s?.id||'')===String(session.id))return number;
    }
    return null;
  }
  function sessionNumber(e,c){
    if(!isSession(e))return null;
    const primary=validNumber(e?.sessionNumber);
    if(primary)return primary;
    const titleNumber=numberFromTitle(e?.title)||numberFromTitle(e?.type);
    if(titleNumber)return titleNumber;
    const session=linkedSession(e,c);
    if(!session)return null;
    const explicit=validNumber(session.sessionNumber)||
      numberFromTitle(session.calendarTitle);
    return explicit||ordinalForSession(session,c);
  }
  function title(e,c){
    if(!isSession(e))return String(e?.title||e?.type||'Запись').trim()||'Запись';
    const number=sessionNumber(e,c);
    return number?'Сессия №'+number:'Сессия';
  }
  window.DiagnostikaSessionEventLabel=Object.freeze({title,sessionNumber,isSession});
})();
