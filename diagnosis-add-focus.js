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
      if(!s) return alert('Сначала выбери или добавь ситуацию.');
      const b=newBelief();
      const arr=s.beliefs||(s.beliefs=[]);
      arr.push(b);
      selected={type:'belief',obj:b,parent:s,index:arr.length-1};
      if(typeof save==='function') save();
      if(typeof renderTree==='function') renderTree();
      focusEditor();
    };
  }

  const addFeeling=document.querySelector('#addFeelingBtn');
  if(addFeeling){
    addFeeling.onclick=()=>{
      if(selected?.type!=='belief') return alert('Сначала выбери Убеждение 1.');
      const parent=selected.obj;
      const arr=parent.feelings||(parent.feelings=[]);
      const f=newFeeling();
      arr.push(f);
      selected={type:'feeling',obj:f,parent,index:arr.length-1};
      if(typeof save==='function') save();
      if(typeof renderTree==='function') renderTree();
      focusEditor();
    };
  }

  const addDeep=document.querySelector('#addDeepBtn');
  if(addDeep){
    addDeep.onclick=()=>{
      if(selected?.type!=='feeling') return alert('Сначала выбери вторичное чувство.');
      const parent=selected.obj;
      const arr=parent.deep||(parent.deep=[]);
      const d=newDeep();
      arr.push(d);
      selected={type:'deep',obj:d,parent,index:arr.length-1};
      if(typeof save==='function') save();
      if(typeof renderTree==='function') renderTree();
      focusEditor();
    };
  }
})();
