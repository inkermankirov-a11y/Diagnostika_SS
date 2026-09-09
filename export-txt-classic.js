'use strict';

(() => {
  const btn=document.querySelector('#exportTxtBtn');
  if(!btn) return;

  const W=60;
  const top='╔'+'═'.repeat(W)+'╗';
  const bottom='╚'+'═'.repeat(W)+'╝';
  const line='═'.repeat(W);
  const thin='─'.repeat(W);
  const boxTop='┌'+'─'.repeat(W);
  const boxBottom='└'+'─'.repeat(W);

  function padBox(text){
    const s=String(text||'');
    const width=Math.max(0,W-s.length);
    const left=Math.floor(width/2);
    const right=width-left;
    return '║'+' '.repeat(left)+s+' '.repeat(right)+'║';
  }

  function level(v){
    return typeof lvl==='function'?lvl(v):Math.max(1,Math.min(10,Number(v)||1));
  }

  function currentDateTime(){
    const d=new Date();
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

  function commentLine(prefix,comment){
    const text=String(comment||'').trim();
    return text?`${prefix}Комментарий: ${text}\n`:'';
  }

  function exportSituation(s,si){
    let t='';
    t+=`${top}\n${padBox(`СИТУАЦИЯ ${si+1}: ${s.name||'Без названия'}`)}\n${bottom}\n`;
    t+=`Дискомфорт: ${level(s.level)}/10\n`;
    if(String(s.comment||'').trim()) t+=`Комментарий: ${String(s.comment).trim()}\n`;
    t+='\n';

    (s.beliefs||[]).forEach((b,bi)=>{
      t+=`${boxTop}\n│ ПЕРВ. УБЕЖДЕНИЕ ${bi+1}: ${b.text||''}\n${boxBottom}\n`;
      t+=`  Уровень: ${level(b.level)}/10\n`;
      t+=commentLine('  ',b.comment);
      t+='\n';

      (b.feelings||[]).forEach((f,fi)=>{
        t+=`  ┌─ ВТОР. ЧУВСТВО ${fi+1}: ${f.text||''}\n`;
        t+=`  │  Уровень: ${level(f.level)}/10\n`;
        t+=commentLine('  │  ',f.comment);
        if(String(f.comment||'').trim()) t+='  │\n';

        (f.deep||[]).forEach((d,di)=>{
          t+=`  │  ┌─ ВТОР. УБЕЖДЕНИЕ ${di+1}: ${d.text||''}\n`;
          t+=`  │  │  Уровень: ${level(d.level)}/10\n`;
          if(String(d.comment||'').trim()) t+=`  │  │  Комментарий: ${String(d.comment).trim()}\n`;

          (d.instincts||[]).forEach((x,ii)=>{
            t+=`          ┌─ ИНСТИНКТ ${ii+1}: ${x.name||''}\n`;
            t+=`          │  Уровень: ${level(x.level)}/10\n`;
            if(String(x.comment||'').trim()) t+=`          │  Комментарий: ${String(x.comment).trim()}\n`;
            t+=`          └────────────────────────────────────\n`;
          });
          t+=`  │  └────────────────────────────────────\n`;
        });
        t+=`  └────────────────────────────────────────\n\n`;
      });
      t+='\n';
    });

    t+=`  ★ ЖЕЛАЕМЫЙ РЕЗУЛЬТАТ СИТУАЦИИ\n`;
    t+=`  ──────────────────────────────────────────\n`;
    t+=`  ${s.result||''}\n\n`;
    return t;
  }

  btn.onclick=()=>{
    const c=typeof client==='function'?client():null;
    const r=typeof request==='function'?request():null;
    if(!c) return alert('Сначала выбери клиента.');
    if(!r) return alert('Сначала выбери запрос диагностики.');

    const dt=currentDateTime();
    const phone=c.phone||'';
    const email=c.email||'';
    const lesson=Math.max(1,Array.isArray(c.sessions)?c.sessions.length:0);

    let t='';
    t+=`${top}\n${padBox('ПСИХОЛОГИЧЕСКАЯ ДИАГНОСТИКА')}\n${bottom}\n\n`;
    t+=`КЛИЕНТ: ${c.name||''}\n`;
    t+=`ТЕЛЕФОН: ${phone}\n`;
    t+=`E-MAIL: ${email}\n`;
    t+=`ЗАНЯТИЕ №: ${lesson}\n`;
    t+=`ДАТА: ${dt.display}\n\n`;
    t+=`ОБЩИЙ ЗАПРОС\n${thin}\n${r.title||''}\n\n`;

    const situations=Array.isArray(r.situations)?r.situations:[];
    if(!situations.length){
      t+='СИТУАЦИИ НЕ ДОБАВЛЕНЫ\n\n';
    }else{
      situations.forEach((s,i)=>{t+=exportSituation(s,i);});
    }
    t+=`${line}\n`;

    const safeName=String(c.name||'Клиент').replace(/[<>:"/\\|?*]/g,'_').trim()||'Клиент';
    const filename=`${safeName}_${dt.file}_диагностика.txt`;
    if(typeof download==='function') download(filename,t,'text/plain;charset=utf-8');
  };
})();
