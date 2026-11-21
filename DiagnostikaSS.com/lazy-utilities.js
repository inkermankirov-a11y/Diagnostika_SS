'use strict';
(()=>{
  if(window.DiagnostikaLazyUtilities)return;
  const loads=new Map();
  const text=(key)=>({
    ru:{retry:'Повторить',failure:'Не удалось загрузить компонент. Повторите попытку.'},
    en:{retry:'Retry',failure:'Could not load component. Try again.'},
    fr:{retry:'Réessayer',failure:'Impossible de charger le composant. Réessayez.'},
    de:{retry:'Erneut versuchen',failure:'Komponente konnte nicht geladen werden. Erneut versuchen.'},
    it:{retry:'Riprova',failure:'Impossibile caricare il componente. Riprova.'}
  }[window.DiagnostikaI18n?.language||'ru']||{})[key]||key;
  function load(src,ready){
    if(ready())return Promise.resolve();
    if(loads.has(src))return loads.get(src);
    const p=new Promise((resolve,reject)=>{
      const el=document.createElement('script');
      el.src=src;el.async=true;el.dataset.lazyUtility='1';
      el.onload=()=>{if(ready())resolve();else{el.remove();reject(Error('Module not initialized: '+src));}};
      el.onerror=()=>{el.remove();reject(Error('Module load failed: '+src));};
      document.head.appendChild(el);
    });
    loads.set(src,p);p.catch(()=>loads.delete(src));return p;
  }
  const about=()=>load('about-program.js?v=20261121-perf4',()=>!!window.DiagnostikaAboutProgram);
  async function calculator(){
    // The digit guard must be registered before any calculator key is usable.
    await load('calculator-digit-grouping.js?v=20261121-perf6',()=>!!window.DiagnostikaCalculatorDigitGrouping);
    await load('currency-calculator-direct.js?v=20261121-perf6',()=>!!window.DiagnostikaDirectCalculator);
    window.DiagnostikaDirectCalculator.refresh();
    window.DiagnostikaCalculatorDigitGrouping.refresh();
  }
  const css=document.createElement('style');css.textContent=`    .about-program-btn{width:100%!important;min-width:0!important;height:42px!important;margin:5px 0 0!important;border:1px solid #d4dde7!important;border-radius:8px!important;background:#f8fafc!important;color:#334155!important;font-weight:800!important;box-shadow:none!important}
    .about-program-btn:hover{background:#eef3f8!important}
    .about-program-divider{height:1px;background:#e2e8f0;margin:5px 2px 1px}`;document.head.appendChild(css);
  function install(){
    const panel=document.querySelector('#settingsPanel');if(!panel)return false;
    if(panel.querySelector('#aboutProgramBtn'))return true;
    const divider=document.createElement('div');divider.className='about-program-divider';
    const btn=document.createElement('button');btn.type='button';btn.id='aboutProgramBtn';btn.className='tk-btn about-program-btn';btn.textContent='ℹ О программе';
    panel.append(divider,btn);
    btn.addEventListener('click',async()=>{
      btn.disabled=true;btn.setAttribute('aria-busy','true');
      try{await about();window.DiagnostikaAboutProgram.open();}
      catch(e){alert(text('failure'));}
      finally{btn.disabled=false;btn.removeAttribute('aria-busy');}
    });
    return true;
  }
  if(!install()){
    const observer=new MutationObserver(()=>{if(install())observer.disconnect();});
    observer.observe(document.body,{childList:true,subtree:true});
  }
  window.DiagnostikaLazyUtilities=Object.freeze({calculator,text});
})();
