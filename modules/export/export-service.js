'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform)return;

  const services=platform.services||{};
  if(!platform.services)platform.services=services;
  if(services.export)return;

  const EVENTS=Object.freeze({
    generated:'export:generated',
    downloaded:'export:downloaded'
  });

  const W=60;
  const top='╔'+'═'.repeat(W)+'╗';
  const bottom='╚'+'═'.repeat(W)+'╝';
  const line='═'.repeat(W);
  const thin='─'.repeat(W);
  const boxTop='┌'+'─'.repeat(W);
  const boxBottom='└'+'─'.repeat(W);

  function emit(type,detail={}){
    if(!platform.events?.emit)return 0;
    return platform.events.emit(type,Object.freeze({
      ...detail,
      source:detail.source||'export-service',
      emittedAt:detail.emittedAt||new Date().toISOString()
    }));
  }

  function safeName(value,fallback='Клиент'){
    const s=String(value||'').replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').trim().replace(/[. ]+$/g,'');
    return s||fallback;
  }

  function level(value){
    const n=Number(value)||1;
    return Math.max(1,Math.min(10,n));
  }

  function dateTime(value){
    let d=value instanceof Date?new Date(value.getTime()):new Date(value||Date.now());
    if(Number.isNaN(d.getTime()))d=new Date();
    const dd=String(d.getDate()).padStart(2,'0');
    const mm=String(d.getMonth()+1).padStart(2,'0');
    const yyyy=d.getFullYear();
    const hh=String(d.getHours()).padStart(2,'0');
    const mi=String(d.getMinutes()).padStart(2,'0');
    return {
      display:`${dd}.${mm}.${yyyy} ${hh}:${mi}`,
      file:`${yyyy}-${mm}-${dd}_${hh}-${mi}`
    };
  }

  function padBox(text){
    const s=String(text||'');
    const width=Math.max(0,W-s.length);
    const left=Math.floor(width/2);
    const right=width-left;
    return '║'+' '.repeat(left)+s+' '.repeat(right)+'║';
  }

  function commentLine(prefix,comment){
    const text=String(comment||'').trim();
    return text?`${prefix}Комментарий: ${text}\n`:'';
  }

  function situationText(s,si){
    let t='';
    t+=`${top}\n${padBox(`СИТУАЦИЯ ${si+1}: ${s?.name||'Без названия'}`)}\n${bottom}\n`;
    t+=`Дискомфорт: ${level(s?.level)}/10\n`;
    if(String(s?.comment||'').trim())t+=`Комментарий: ${String(s.comment).trim()}\n`;
    t+='\n';

    (s?.beliefs||[]).forEach((b,bi)=>{
      t+=`${boxTop}\n│ ПЕРВ. УБЕЖДЕНИЕ ${bi+1}: ${b?.text||''}\n${boxBottom}\n`;
      t+=`  Уровень: ${level(b?.level)}/10\n`;
      t+=commentLine('  ',b?.comment);
      t+='\n';

      (b?.feelings||[]).forEach((f,fi)=>{
        t+=`  ┌─ ВТОР. ЧУВСТВО ${fi+1}: ${f?.text||''}\n`;
        t+=`  │  Уровень: ${level(f?.level)}/10\n`;
        t+=commentLine('  │  ',f?.comment);
        if(String(f?.comment||'').trim())t+='  │\n';

        (f?.deep||[]).forEach((d,di)=>{
          t+=`  │  ┌─ ВТОР. УБЕЖДЕНИЕ ${di+1}: ${d?.text||''}\n`;
          t+=`  │  │  Уровень: ${level(d?.level)}/10\n`;
          if(String(d?.comment||'').trim())t+=`  │  │  Комментарий: ${String(d.comment).trim()}\n`;

          (d?.instincts||[]).forEach((x,ii)=>{
            t+=`          ┌─ ИНСТИНКТ ${ii+1}: ${x?.name||''}\n`;
            t+=`          │  Уровень: ${level(x?.level)}/10\n`;
            if(String(x?.comment||'').trim())t+=`          │  Комментарий: ${String(x.comment).trim()}\n`;
            t+='          └────────────────────────────────────\n';
          });
          t+='  │  └────────────────────────────────────\n';
        });
        t+='  └────────────────────────────────────────\n\n';
      });
      t+='\n';
    });

    t+='  ★ ЖЕЛАЕМЫЙ РЕЗУЛЬТАТ СИТУАЦИИ\n';
    t+='  ──────────────────────────────────────────\n';
    t+=`  ${s?.result||''}\n\n`;
    return t;
  }

  function diagnosisTxt(client,request,options={}){
    if(!client||!request)return null;
    const dt=dateTime(options.date);
    const lesson=Math.max(1,Array.isArray(client.sessions)?client.sessions.length:0);

    let text='';
    text+=`${top}\n${padBox('ПСИХОЛОГИЧЕСКАЯ ДИАГНОСТИКА')}\n${bottom}\n\n`;
    text+=`КЛИЕНТ: ${client.name||''}\n`;
    text+=`ТЕЛЕФОН: ${client.phone||''}\n`;
    text+=`E-MAIL: ${client.email||''}\n`;
    text+=`ЗАНЯТИЕ №: ${lesson}\n`;
    text+=`ДАТА: ${dt.display}\n\n`;
    text+=`ОБЩИЙ ЗАПРОС\n${thin}\n${request.title||''}\n\n`;

    const situations=Array.isArray(request.situations)?request.situations:[];
    if(!situations.length)text+='СИТУАЦИИ НЕ ДОБАВЛЕНЫ\n\n';
    else situations.forEach((s,i)=>{text+=situationText(s,i);});
    text+=`${line}\n`;

    const payload=Object.freeze({
      kind:'diagnosis-txt',
      filename:`${safeName(client.name)}_${dt.file}_диагностика.txt`,
      mimeType:'text/plain;charset=utf-8',
      text
    });
    emit(EVENTS.generated,{
      kind:payload.kind,
      filename:payload.filename,
      clientId:client.id||null,
      requestId:request.id||null,
      source:options.source||'export-diagnosis-txt'
    });
    return payload;
  }

  function stateBackup(state,options={}){
    if(!state||typeof state!=='object')return null;
    const dt=dateTime(options.date);
    const day=dt.file.slice(0,10);
    const payload=Object.freeze({
      kind:'state-backup-json',
      filename:options.filename||`diagnostika-backup-${day}.json`,
      mimeType:'application/json;charset=utf-8',
      text:JSON.stringify(state,null,2)
    });
    emit(EVENTS.generated,{
      kind:payload.kind,
      filename:payload.filename,
      source:options.source||'export-state-backup'
    });
    return payload;
  }

  services.export=Object.freeze({
    version:'10D',
    events:EVENTS,
    safeName,
    dateTime,
    situationText,
    diagnosisTxt,
    stateBackup
  });
})();