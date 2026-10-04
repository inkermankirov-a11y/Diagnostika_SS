'use strict';

(() => {
  if(window.__diagnostikaDiagnosisHelpIconsV3Ready) return;
  window.__diagnostikaDiagnosisHelpIconsV3Ready=true;

  const HELP={
    addBeliefBtn:'То, что клиент говорит о себе в первую очередь.',
    addFeelingBtn:'То, что клиент чувствует, когда активируется первичное убеждение.',
    addDeepBtn:'Скрытое, глубокое убеждение о себе, к которому приводит диагностика. Главная задача диагностики — выявить именно его.'
  };

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

  function show(icon){
    if(!icon?.matches(':hover')) return;

    const text=icon.dataset.diagnosisHelp;
    if(!text) return;

    const tip=tooltip();
    tip.textContent=text;
    tip.dataset.kind=icon.dataset.diagnosisKind||'';
    tip.hidden=false;

    requestAnimationFrame(()=>{
      if(!icon.matches(':hover')) return;

      const r=icon.getBoundingClientRect();
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
      tip.hidden=false;
    });
  }

  function bind(icon){
    if(icon.dataset.diagnosisHelpV3Bound==='1') return;
    icon.dataset.diagnosisHelpV3Bound='1';

    icon.addEventListener('mouseenter',()=>setTimeout(()=>show(icon),0));
    icon.addEventListener('mouseleave',hide);

    icon.addEventListener('mousedown',event=>{
      event.preventDefault();
      event.stopPropagation();
    });

    icon.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
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
    }

    icon.dataset.diagnosisHelp=text;
    icon.dataset.diagnosisKind=id;
    icon.hidden=false;
    bind(icon);
    return icon;
  }

  function sync(){
    for(const [id,text] of Object.entries(HELP)){
      const button=document.getElementById(id);
      if(!button) continue;

      ensureIcon(button,id,text);
      button.classList.add('has-diagnosis-help');

      // Old hover implementation must not attach the tooltip to the whole button.
      button.removeAttribute('data-diagnosis-help');
      button.removeAttribute('aria-description');
    }
  }

  window.addEventListener('diagnostika-help-hints-change',()=>setTimeout(sync,0));
  window.addEventListener('resize',hide);

  const observer=new MutationObserver(()=>sync());
  observer.observe(document.body,{childList:true,subtree:true});

  setTimeout(sync,0);
})();
