'use strict';

(() => {
  const PREFIX={
    ru:'Запрос',
    en:'Request',
    fr:'Demande',
    de:'Anliegen',
    it:'Richiesta'
  };

  function currentLang(){
    const lang=window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'en';
    return PREFIX[lang]?lang:'en';
  }

  function relabel(){
    const select=document.querySelector('#requestSelect');
    if(!select) return;
    const prefix=PREFIX[currentLang()];
    [...select.options].forEach((option,index)=>{
      option.textContent=`${prefix} ${index+1}`;
    });
  }

  const select=document.querySelector('#requestSelect');
  if(select){
    new MutationObserver(relabel).observe(select,{childList:true});
    select.addEventListener('change',()=>setTimeout(relabel,0));
  }

  const oldSetLanguage=window.DiagnostikaI18n?.setLanguage;
  if(oldSetLanguage && !oldSetLanguage.__requestLabelsPatched){
    const wrapped=function(lang){
      const result=oldSetLanguage.call(this,lang);
      setTimeout(relabel,0);
      return result;
    };
    wrapped.__requestLabelsPatched=true;
    window.DiagnostikaI18n.setLanguage=wrapped;
  }

  relabel();
  setTimeout(relabel,0);
})();
