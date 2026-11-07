'use strict';

(() => {
  if(window.__diagnostikaDiagnosisHelpIconsReady) return;
  window.__diagnostikaDiagnosisHelpIconsReady=true;

  const HELP={
    addBeliefBtn:'То, что клиент говорит о себе в первую очередь.',
    addFeelingBtn:'То, что клиент чувствует, когда активируется первичное убеждение.',
    addDeepBtn:'Скрытое, глубокое убеждение о себе, к которому приводит диагностика. Главная задача диагностики — выявить именно его.'
  };

  function enabled(){
    if(window.DiagnostikaHelpHints?.enabled) return !!window.DiagnostikaHelpHints.enabled();
    return localStorage.getItem('diagnostika-help-tooltips-enabled')==='1';
  }

  function tooltip(){
    let tip=document.getElementById('diagnosisHelpIconTooltip');
    if(tip) return tip;
    tip=document.createElement('div');
    tip.id='diagnosisHelpIconTooltip';
    tip.className='diagnosis-help-tooltip';
    tip.hidden=true;
    tip.setAttribute('role','tooltip');
    document.body.appendChild(tip);
    return tip;
  }

  function hide(){
    const tip=tooltip();
    tip.hidden=true;
    tip.textContent='';
    tip.removeAttribute('data-kind');
    tip.removeAttribute('data-placement');
    tip.style.removeProperty('--diagnosis-tip-arrow-x');
  }

  function show(trigger){
    if(!enabled()) return;
    const text=trigger.dataset.diagnosisHelp;
    if(!text) return;

    const tip=tooltip();
    tip.textContent=text;
    tip.dataset.kind=trigger.dataset.diagnosisKind||'';
    tip.hidden=false;

    requestAnimationFrame(()=>{
      const r=trigger.getBoundingClientRect();
      const t=tip.getBoundingClientRect();
      const gap=9;
      const margin=10;
      let left=r.left+(r.width-t.width)/2;
      left=Math.max(margin,Math.min(window.innerWidth-t.width-margin,left));
      let top=r.top-t.height-gap;
      let placement='top';

      if(top<margin){
        top=r.bottom+gap;
        placement='bottom';
      }

      const anchorX=Math.max(14,Math.min(t.width-14,r.left+r.width/2-left));
      tip.dataset.placement=placement;
      tip.style.setProperty('--diagnosis-tip-arrow-x',Math.round(anchorX)+'px');
      tip.style.left=Math.round(left)+'px';
      tip.style.top=Math.round(top)+'px';
    });
  }

  function ensureIcon(button,id,text){
    let icon=button.querySelector(':scope > .diagnosis-help-trigger');
    if(!icon){
      icon=document.createElement('span');
      icon.className='diagnosis-help-trigger';
      icon.textContent='?';
      icon.setAttribute('aria-label','Подсказка');
      button.appendChild(icon);

      icon.addEventListener('mouseenter',()=>show(icon));
      icon.addEventListener('mouseleave',hide);
      icon.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
      });
    }

    icon.dataset.diagnosisHelp=text;
    icon.dataset.diagnosisKind=id;
    return icon;
  }

  function sync(){
    const on=enabled();

    for(const [id,text] of Object.entries(HELP)){
      const button=document.getElementById(id);
      if(!button) continue;

      const icon=ensureIcon(button,id,text);
      icon.hidden=!on;
      button.classList.toggle('has-diagnosis-help',on);

      button.removeAttribute('data-diagnosis-help');
      button.removeAttribute('aria-description');
    }

    if(!on) hide();
  }

  window.addEventListener('diagnostika-help-hints-change',()=>setTimeout(sync,0));
  window.addEventListener('resize',hide);
  window.addEventListener('scroll',hide,true);

  const observer=new MutationObserver(()=>sync());
  observer.observe(document.body,{childList:true,subtree:true});

  setTimeout(sync,0);
})();
