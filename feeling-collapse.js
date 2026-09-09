'use strict';

(() => {
  const expandedBeliefs = new Set();

  const style = document.createElement('style');
  style.textContent = `
    .feeling-group-toggle{
      height:30px;
      display:flex;
      align-items:center;
      gap:8px;
      padding:0 14px 0 28px;
      border-bottom:1px solid rgba(0,0,0,.05);
      background:#fff3bf;
      color:#6d5a00;
      font-weight:700;
      cursor:pointer;
      user-select:none;
      transition:background .14s ease,transform .14s ease,box-shadow .14s ease;
    }
    .feeling-group-toggle:hover{
      background:#ffe99a;
      box-shadow:inset 0 0 0 1px rgba(170,125,0,.12);
    }
    .feeling-group-toggle:active{transform:translateY(1px)}
    .feeling-group-arrow{
      width:16px;
      text-align:center;
      font-size:12px;
      transition:transform .14s ease;
    }
    .feeling-group-count{
      margin-left:auto;
      min-width:24px;
      padding:2px 7px;
      border-radius:999px;
      background:rgba(122,91,0,.11);
      text-align:center;
      font-size:11px;
    }
  `;
  document.head.appendChild(style);

  function applyFeelingCollapse(){
    const root=document.querySelector('#tree');
    const s=typeof situation==='function'?situation():null;
    if(!root||!s) return;

    root.querySelectorAll('.feeling-group-toggle').forEach(el=>el.remove());

    const rows=[...root.querySelectorAll('.tree-row')];
    const primaryRows=rows.filter(row=>row.classList.contains('primary'));

    primaryRows.forEach((primaryRow,index)=>{
      const belief=(s.beliefs||[])[index];
      if(!belief) return;

      const beliefId=belief.id||String(index);
      const feelings=Array.isArray(belief.feelings)?belief.feelings:[];
      const isExpanded=expandedBeliefs.has(beliefId);

      let node=primaryRow.nextElementSibling;
      const childRows=[];
      while(node && !node.classList.contains('primary')){
        if(node.classList.contains('tree-row')) childRows.push(node);
        node=node.nextElementSibling;
      }

      childRows.forEach(row=>{row.style.display=isExpanded?'':'none';});

      if(!feelings.length) return;

      const toggle=document.createElement('div');
      toggle.className='feeling-group-toggle';
      toggle.innerHTML=`<span class="feeling-group-arrow">${isExpanded?'▼':'▶'}</span><span>Вторичные чувства</span><span class="feeling-group-count">${feelings.length}</span>`;
      toggle.title=isExpanded?'Свернуть вторичные чувства':'Развернуть вторичные чувства';
      toggle.onclick=()=>{
        if(expandedBeliefs.has(beliefId)) expandedBeliefs.delete(beliefId);
        else expandedBeliefs.add(beliefId);
        applyFeelingCollapse();
      };
      primaryRow.insertAdjacentElement('afterend',toggle);
    });
  }

  if(typeof renderTree==='function'){
    const originalRenderTree=renderTree;
    renderTree=function(){
      const result=originalRenderTree.apply(this,arguments);
      applyFeelingCollapse();
      return result;
    };
    applyFeelingCollapse();
  }
})();
