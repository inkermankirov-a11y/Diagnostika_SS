'use strict';

(() => {
  const shell=()=>window.DiagnostikaPlatform?.shell||null;
  const currentClient=()=>window.DiagnostikaClients?.current?.()||null;
  const currentRequest=()=>shell()?.currentRequest?.()||null;
  const currentSituation=()=>shell()?.currentSituation?.()||null;
  const selection=()=>shell()?.currentSelection?.()||null;
  const afterGuard=async action=>{const guard=window.DiagnostikaEditorGuard;if(guard?.beforeLeave)return guard.beforeLeave(action);action();return true;};
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
    addBelief.onclick=async()=>{
      await afterGuard(()=>{
      const s=currentSituation();
      const c=currentClient();
      const r=currentRequest();
      const api=window.DiagnostikaDiagnosis;
      if(!s) return alert('Сначала выбери или добавь ситуацию.');
      if(!c||!r||!api?.moduleAware)return;
      const b=api.addBelief(s.id,{}, {client:c,requestId:r.id,source:'diagnosis-ui-belief-add',render:false});
      if(!b)return;
      shell()?.selectDiagnosisElement?.('belief',b.id);
      shell()?.renderDiagnosisTree?.();
      focusEditor();
      });
    };
  }

  const addFeeling=document.querySelector('#addFeelingBtn');
  if(addFeeling){
    addFeeling.onclick=async()=>{
      await afterGuard(()=>{
      const selected=selection();
      if(selected?.type!=='belief') return alert('Сначала выбери первичное убеждение.');
      const c=currentClient();
      const r=currentRequest();
      const api=window.DiagnostikaDiagnosis;
      if(!c||!r||!api?.moduleAware)return;
      const f=api.addFeeling(selected.obj.id,{}, {client:c,requestId:r.id,source:'diagnosis-ui-feeling-add',render:false});
      if(!f)return;
      shell()?.selectDiagnosisElement?.('feeling',f.id);
      shell()?.renderDiagnosisTree?.();
      focusEditor();
      });
    };
  }

  const addDeep=document.querySelector('#addDeepBtn');
  if(addDeep){
    addDeep.onclick=async()=>{
      await afterGuard(()=>{
      const selected=selection();
      if(selected?.type!=='feeling') return alert('Сначала выбери вторичное чувство.');
      const c=currentClient();
      const r=currentRequest();
      const api=window.DiagnostikaDiagnosis;
      if(!c||!r||!api?.moduleAware)return;
      const d=api.addDeep(selected.obj.id,{}, {client:c,requestId:r.id,source:'diagnosis-ui-deep-add',render:false});
      if(!d)return;
      shell()?.selectDiagnosisElement?.('deep',d.id);
      shell()?.renderDiagnosisTree?.();
      focusEditor();
      });
    };
  }
})();
