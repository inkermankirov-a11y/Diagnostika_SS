'use strict';

(() => {
  const flagClass={en:'flag-gb',ru:'flag-ru',fr:'flag-fr',de:'flag-de',it:'flag-it'};

  const style=document.createElement('style');
  style.textContent=`
    .country-flag{display:inline-block;width:24px;height:16px;flex:0 0 24px;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.16);overflow:hidden;background-size:100% 100%!important;background-repeat:no-repeat!important}
    .language-btn .country-flag{width:26px;height:18px;flex-basis:26px}
    .flag-ru{background:linear-gradient(to bottom,#fff 0 33.333%,#1c57a5 33.333% 66.666%,#d52b1e 66.666% 100%)}
    .flag-fr{background:linear-gradient(to right,#0055a4 0 33.333%,#fff 33.333% 66.666%,#ef4135 66.666% 100%)}
    .flag-de{background:linear-gradient(to bottom,#000 0 33.333%,#dd0000 33.333% 66.666%,#ffce00 66.666% 100%)}
    .flag-it{background:linear-gradient(to right,#009246 0 33.333%,#fff 33.333% 66.666%,#ce2b37 66.666% 100%)}
    .flag-gb{
      background-color:#012169;
      background-image:
        linear-gradient(33deg,transparent 43%,#fff 43% 48%,#c8102e 48% 52%,#fff 52% 57%,transparent 57%),
        linear-gradient(-33deg,transparent 43%,#fff 43% 48%,#c8102e 48% 52%,#fff 52% 57%,transparent 57%),
        linear-gradient(to right,transparent 38%,#fff 38% 62%,transparent 62%),
        linear-gradient(to bottom,transparent 34%,#fff 34% 66%,transparent 66%),
        linear-gradient(to right,transparent 44%,#c8102e 44% 56%,transparent 56%),
        linear-gradient(to bottom,transparent 42%,#c8102e 42% 58%,transparent 58%);
    }
    .language-option{grid-template-columns:30px 34px 1fr!important}
  `;
  document.head.appendChild(style);

  function makeFlag(lang){
    const span=document.createElement('span');
    span.className=`country-flag ${flagClass[lang]||'flag-gb'}`;
    span.setAttribute('aria-hidden','true');
    return span;
  }

  function decorateOptions(){
    document.querySelectorAll('.language-option').forEach(option=>{
      const lang=option.dataset.lang||'en';
      const first=option.firstElementChild;
      if(first && !first.classList.contains('country-flag')) first.replaceWith(makeFlag(lang));
    });
  }

  function decorateButton(){
    const btn=document.querySelector('.language-btn');
    if(!btn) return;
    const lang=window.DiagnostikaI18n?.language||'en';
    const code=lang.toUpperCase();
    btn.innerHTML='';
    btn.append(makeFlag(lang));
    const codeSpan=document.createElement('span');
    codeSpan.textContent=code;
    btn.append(codeSpan);
  }

  function decorate(){decorateOptions();decorateButton();}
  decorate();

  const root=document.querySelector('.language-switcher');
  if(root){
    const obs=new MutationObserver(()=>requestAnimationFrame(decorate));
    obs.observe(root,{childList:true,subtree:true});
    root.addEventListener('click',()=>setTimeout(decorate,0));
  }
})();
