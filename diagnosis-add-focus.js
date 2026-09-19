'use strict';

(() => {
  function focusEditor(){
    requestAnimationFrame(()=>{
      const input=document.querySelector('#editorText');
      if(input){
        input.focus({preventScroll:true});
        if(typeof input.select==='function') input.select();
      }
    });
  }

  const addBelief=document.querySelector('#addBeliefBtn');
  if(addBelief){
    addBelief.onclick=()=>{
      const s=typeof situation==='function'?situation():null;
      const c=typeof client==='function'?client():null;
      const r=typeof request==='function'?request():null;
      const api=window.DiagnostikaDiagnosis;
      if(!s) return alert('Сначала выбери или добавь ситуацию.');
      if(!c||!r||!api?.moduleAware)return;
      const b=api.addBelief(s.id,{}, {client:c,requestId:r.id,source:'diagnosis-ui-belief-add',render:false});
      if(!b)return;
      if(typeof selectDiagnosisElementById==='function')selectDiagnosisElementById('belief',b.id);
      if(typeof renderTree==='function') renderTree();
      focusEditor();
    };
  }

  const addFeeling=document.querySelector('#addFeelingBtn');
  if(addFeeling){
    addFeeling.onclick=()=>{
      if(selected?.type!=='belief') return alert('Сначала выбери Убеждение 1.');
      const c=typeof client==='function'?client():null;
      const r=typeof request==='function'?request():null;
      const api=window.DiagnostikaDiagnosis;
      if(!c||!r||!api?.moduleAware)return;
      const f=api.addFeeling(selected.obj.id,{}, {client:c,requestId:r.id,source:'diagnosis-ui-feeling-add',render:false});
      if(!f)return;
      if(typeof selectDiagnosisElementById==='function')selectDiagnosisElementById('feeling',f.id);
      if(typeof renderTree==='function') renderTree();
      focusEditor();
    };
  }

  const addDeep=document.querySelector('#addDeepBtn');
  if(addDeep){
    addDeep.onclick=()=>{
      if(selected?.type!=='feeling') return alert('Сначала выбери вторичное чувство.');
      const c=typeof client==='function'?client():null;
      const r=typeof request==='function'?request():null;
      const api=window.DiagnostikaDiagnosis;
      if(!c||!r||!api?.moduleAware)return;
      const d=api.addDeep(selected.obj.id,{}, {client:c,requestId:r.id,source:'diagnosis-ui-deep-add',render:false});
      if(!d)return;
      if(typeof selectDiagnosisElementById==='function')selectDiagnosisElementById('deep',d.id);
      if(typeof renderTree==='function') renderTree();
      focusEditor();
    };
  }
})();
