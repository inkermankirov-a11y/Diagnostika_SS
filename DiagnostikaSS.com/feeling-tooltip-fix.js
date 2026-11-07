'use strict';

(() => {
  const tip=document.createElement('div');
  tip.id='floatingFeelingTooltip';
  tip.style.cssText=`
    position:fixed;
    z-index:999999;
    max-width:340px;
    padding:9px 11px;
    border-radius:8px;
    background:#26364a;
    color:#fff;
    font-size:12px;
    line-height:1.4;
    box-shadow:0 10px 28px rgba(15,23,42,.28);
    pointer-events:none;
    opacity:0;
    visibility:hidden;
    transition:opacity .10s ease;
  `;
  document.body.appendChild(tip);

  let active=null;

  function place(el){
    const rect=el.getBoundingClientRect();
    const margin=10;
    tip.style.left='0px';
    tip.style.top='0px';
    tip.style.opacity='0';
    tip.style.visibility='hidden';
    requestAnimationFrame(()=>{
      const w=tip.offsetWidth;
      const h=tip.offsetHeight;
      let left=rect.left+rect.width/2-w/2;
      left=Math.max(margin,Math.min(window.innerWidth-w-margin,left));
      let top=rect.top-h-9;
      if(top<margin) top=rect.bottom+9;
      tip.style.left=Math.round(left)+'px';
      tip.style.top=Math.round(top)+'px';
      tip.style.visibility='visible';
      tip.style.opacity='1';
    });
  }

  function show(el){
    const text=(el?.dataset?.question||'').trim();
    if(!text)return;
    active=el;
    tip.textContent=text;
    place(el);
  }

  function hide(){
    active=null;
    tip.style.opacity='0';
    tip.style.visibility='hidden';
  }

  document.addEventListener('mouseover',e=>{
    const el=e.target.closest?.('.feeling-question-help');
    if(el) show(el);
  });
  document.addEventListener('mouseout',e=>{
    const el=e.target.closest?.('.feeling-question-help');
    if(el && !el.contains(e.relatedTarget)) hide();
  });
  document.addEventListener('focusin',e=>{
    const el=e.target.closest?.('.feeling-question-help');
    if(el) show(el);
  });
  document.addEventListener('focusout',e=>{
    if(e.target.closest?.('.feeling-question-help')) hide();
  });
  window.addEventListener('scroll',()=>{if(active)place(active)},true);
  window.addEventListener('resize',()=>{if(active)place(active)});
})();
