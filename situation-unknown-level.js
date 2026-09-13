'use strict';

(() => {
  if (window.DiagnostikaUnknownSituationLevel) return;

  try{
    if(typeof lvl==='function'){
      const baseLvl=lvl;
      lvl=function(v){
        if(v===null||v===undefined||String(v).trim()===''||v==='—')return '—';
        return baseLvl(v);
      };
    }
  }catch(_){}

  const editBtn=document.getElementById('editSituationBtn');
  if(editBtn){
    editBtn.onclick=()=>{
      const s=typeof situation==='function'?situation():null;
      if(!s)return;
      const n=prompt('Название ситуации',s.name||'');
      if(n!==null)s.name=n;
      const current=(s.level===null||s.level===undefined)?'':s.level;
      const l=prompt('Дискомфорт 1–10. Оставь пустым, если ещё не уточняли.',current);
      if(l!==null){
        const clean=String(l).trim();
        if(!clean){s.level=null;s.levelUnknown=true;}
        else{
          const num=Math.max(1,Math.min(10,Number(clean)||1));
          s.level=num;s.levelUnknown=false;
          if(String(s.comment||'').includes('Уровень дискомфорта не указан'))s.comment='';
        }
      }
      try{if(typeof save==='function')save();}catch(_){}
      try{if(typeof renderSituationList==='function')renderSituationList();}catch(_){}
    };
  }

  window.DiagnostikaUnknownSituationLevel=true;
})();
