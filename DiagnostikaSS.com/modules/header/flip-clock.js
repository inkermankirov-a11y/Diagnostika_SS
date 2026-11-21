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

  const animations=new WeakMap();
  function cancelFlip(panel){
    const timers=animations.get(panel);
    if(timers)for(const id of timers)clearTimeout(id);
    animations.delete(panel);panel.classList.remove('is-flipping');
  }
  function setStatic(panel,value){
    cancelFlip(panel);
    panel.querySelector('.header-flip-top').textContent=value;
    panel.querySelector('.header-flip-bottom').textContent=value;
    panel.querySelector('.header-flip-fold-top').textContent=value;
    panel.querySelector('.header-flip-fold-bottom').textContent=value;
    panel.dataset.value=value;
  }

  function flip(panel,next){
    const current=panel.dataset.value??next;
    if(current===next&&!animations.has(panel))return;
    cancelFlip(panel);

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

    const first=setTimeout(()=>{
      bottom.textContent=next;
      panel.dataset.value=next;
    },240);

    const second=setTimeout(()=>setStatic(panel,next),520);
    animations.set(panel,[first,second]);
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

  // The display has minute precision: there is no need for 60 one-second polls.
  // Re-align from wall time each tick; never accumulate interval drift.
  let timer=null,destroyed=false;
  function schedule(){
    clearTimeout(timer);timer=null;
    if(destroyed||document.hidden)return;
    const now=new Date();
    const delay=60000-now.getSeconds()*1000-now.getMilliseconds();
    timer=setTimeout(()=>{timer=null;if(!destroyed&&!document.hidden){update(false);schedule();}},Math.max(10,delay+10));
  }
  function resync(){
    if(destroyed)return;
    update(true);schedule();
  }
  function onVisibility(){
    if(document.hidden){clearTimeout(timer);timer=null;cancelFlip(hours);cancelFlip(minutes);}
    else resync();
  }
  update(true);schedule();
  document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('focus',resync);
  window.addEventListener('pageshow',resync);
  window.DiagnostikaHeaderFlipClock=Object.freeze({
    ready:true,
    refresh:()=>{if(!destroyed){update(true);schedule();}},
    element:()=>wrap,
    destroy:()=>{
      destroyed=true;clearTimeout(timer);timer=null;cancelFlip(hours);cancelFlip(minutes);
      document.removeEventListener('visibilitychange',onVisibility);
      window.removeEventListener('focus',resync);window.removeEventListener('pageshow',resync);
    }
  });
})();
