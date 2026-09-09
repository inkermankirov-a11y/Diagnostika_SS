'use strict';

(() => {
  const btn=document.querySelector('#saveHistoryBtn');
  if(!btn) return;

  btn.onclick=function(){
    const c=typeof client==='function'?client():null;
    if(!c) return alert('Сначала выбери клиента.');

    const snapshot={
      clientId,
      requestId,
      situationId,
      selected,
      mode,
      selectedSessionId:typeof selectedSessionId!=='undefined'?selectedSessionId:null,
      pageX:window.scrollX,
      pageY:window.scrollY,
      activeId:document.activeElement?.id||null
    };

    const scrolls=[...document.querySelectorAll('.client-home,.diagnostics-left,.center-panel,.right-panel,.left-panel')]
      .map(el=>({el,top:el.scrollTop,left:el.scrollLeft}));

    const r=typeof request==='function'?request():null;
    const s=typeof situation==='function'?situation():null;

    if(!Array.isArray(c.history)) c.history=[];
    c.history.push({
      id:typeof uid==='function'?uid():String(Date.now()),
      createdAt:new Date().toISOString(),
      requestId:r?.id||'',
      requestTitle:r?.title||'',
      situationId:s?.id||'',
      situationTitle:s?.name||'',
      situationLevel:s?.level??null,
      situationResult:s?.result||''
    });

    if(typeof save==='function') save();

    clientId=snapshot.clientId;
    requestId=snapshot.requestId;
    situationId=snapshot.situationId;
    selected=snapshot.selected;
    mode=snapshot.mode;
    if(typeof selectedSessionId!=='undefined') selectedSessionId=snapshot.selectedSessionId;

    const old=btn.textContent;
    btn.textContent='Сохранено';
    setTimeout(()=>{btn.textContent=old;},1200);

    requestAnimationFrame(()=>{
      scrolls.forEach(x=>{x.el.scrollTop=x.top;x.el.scrollLeft=x.left;});
      window.scrollTo(snapshot.pageX,snapshot.pageY);
      if(snapshot.activeId){
        const active=document.getElementById(snapshot.activeId);
        if(active && typeof active.focus==='function') active.focus({preventScroll:true});
      }
    });
  };
})();
