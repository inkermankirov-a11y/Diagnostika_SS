'use strict';

(() => {
  if(window.DiagnostikaHeaderFlipClock?.ready===true)return;

  const appHeader=document.querySelector('.app-header');
  const headerButtons=appHeader?.querySelector('.header-buttons');
  if(!appHeader||!headerButtons)return;

  function buildPanel(unit){
    const panel=document.createElement('div');
    panel.className='header-flip-panel';
    panel.dataset.unit=unit;
    panel.innerHTML='<div class="header-flip-top">00</div><div class="header-flip-bottom">00</div><div class="header-flip-fold-top">00</div><div class="header-flip-fold-bottom">00</div>';
    return panel;
  }

  const wrap=document.createElement('div');
  wrap.id='headerFlipClockWrap';
  wrap.className='header-flip-clock-wrap';
  wrap.setAttribute('role','timer');
  wrap.setAttribute('aria-live','off');

  const clock=document.createElement('div');
  clock.className='header-flip-clock';
  clock.title='Текущее время';

  const hours=buildPanel('hours');
  const minutes=buildPanel('minutes');
  const colon=document.createElement('span');
  colon.className='header-flip-colon';
  colon.textContent=':';

  clock.append(hours,colon,minutes);
  wrap.appendChild(clock);
  appHeader.insertBefore(wrap,headerButtons);

  function setStatic(panel,value){
    panel.querySelector('.header-flip-top').textContent=value;
    panel.querySelector('.header-flip-bottom').textContent=value;
    panel.querySelector('.header-flip-fold-top').textContent=value;
    panel.querySelector('.header-flip-fold-bottom').textContent=value;
    panel.dataset.value=value;
  }

  function flip(panel,next){
    const current=panel.dataset.value??next;
    if(current===next)return;

    const top=panel.querySelector('.header-flip-top');
    const bottom=panel.querySelector('.header-flip-bottom');
    const foldTop=panel.querySelector('.header-flip-fold-top');
    const foldBottom=panel.querySelector('.header-flip-fold-bottom');

    foldTop.textContent=current;
    foldBottom.textContent=next;
    top.textContent=next;
    bottom.textContent=current;

    panel.classList.remove('is-flipping');
    void panel.offsetWidth;
    panel.classList.add('is-flipping');

    setTimeout(()=>{
      bottom.textContent=next;
      panel.dataset.value=next;
    },240);

    setTimeout(()=>{
      panel.classList.remove('is-flipping');
      setStatic(panel,next);
    },520);
  }

  function parts(){
    const now=new Date();
    return {
      hours:String(now.getHours()).padStart(2,'0'),
      minutes:String(now.getMinutes()).padStart(2,'0')
    };
  }

  function update(initial=false){
    const value=parts();
    if(initial){
      setStatic(hours,value.hours);
      setStatic(minutes,value.minutes);
    }else{
      flip(hours,value.hours);
      flip(minutes,value.minutes);
    }
    wrap.setAttribute('aria-label','Текущее время '+value.hours+':'+value.minutes);
  }

  update(true);
  let lastMinute=new Date().getMinutes();
  const timer=setInterval(()=>{
    const minute=new Date().getMinutes();
    if(minute===lastMinute)return;
    lastMinute=minute;
    update(false);
  },1000);

  window.DiagnostikaHeaderFlipClock=Object.freeze({
    ready:true,
    refresh:()=>update(false),
    element:()=>wrap,
    destroy:()=>clearInterval(timer)
  });
})();
