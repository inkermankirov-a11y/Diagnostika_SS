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
      const c=typeof client==='function'?client():null;
      const r=typeof request==='function'?request():null;
      const s=typeof situation==='function'?situation():null;
      const api=window.DiagnostikaDiagnosis;
      if(!c||!r||!s||!api?.moduleAware)return;
      const changes={};
      const n=prompt('Название ситуации',s.name||'');
      if(n!==null)changes.name=n;
      const current=(s.level===null||s.level===undefined)?'':s.level;
      const l=prompt('Дискомфорт 1–10. Оставь пустым, если ещё не уточняли.',current);
      if(l!==null){
        const clean=String(l).trim();
        if(!clean){changes.level=null;changes.levelUnknown=true;}
        else{
          changes.level=Math.max(1,Math.min(10,Number(clean)||1));
          changes.levelUnknown=false;
          if(String(s.comment||'').includes('Уровень дискомфорта не указан'))changes.comment='';
        }
      }
      if(!Object.keys(changes).length)return;
      if(!api.updateSituation(s.id,changes,{client:c,requestId:r.id,source:'diagnosis-ui-situation-edit',render:false}))return;
      selected=null;
      try{if(typeof renderSituationList==='function')renderSituationList();}catch(_){}
    };
  }

  window.DiagnostikaUnknownSituationLevel=true;
})();
