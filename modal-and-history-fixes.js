'use strict';

(() => {
  const btn=document.querySelector('#saveHistoryBtn');
  if(!btn || typeof btn.onclick!=='function') return;

  const original=btn.onclick;
  btn.onclick=function(e){
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

    const result=original.call(this,e);

    clientId=snapshot.clientId;
    requestId=snapshot.requestId;
    situationId=snapshot.situationId;
    selected=snapshot.selected;
    mode=snapshot.mode;
    if(typeof selectedSessionId!=='undefined') selectedSessionId=snapshot.selectedSessionId;

    requestAnimationFrame(()=>{
      scrolls.forEach(x=>{x.el.scrollTop=x.top;x.el.scrollLeft=x.left;});
      window.scrollTo(snapshot.pageX,snapshot.pageY);
      if(snapshot.activeId){
        const active=document.getElementById(snapshot.activeId);
        if(active && typeof active.focus==='function') active.focus({preventScroll:true});
      }
    });

    return result;
  };
})();
