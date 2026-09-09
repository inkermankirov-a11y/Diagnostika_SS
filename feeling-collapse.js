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
    .context-add-deep-wrap{
      margin:2px 0 8px;
      display:flex;
      align-items:center;
    }
    .context-add-deep-btn{
      border:1px solid #2f5fc5!important;
      background:linear-gradient(#5f8df0,#3f69d9)!important;
      color:#fff!important;
      border-radius:8px!important;
      padding:8px 13px!important;
      font-weight:700!important;
      cursor:pointer!important;
      box-shadow:0 3px 8px rgba(47,95,197,.22)!important;
      transition:transform .12s ease,box-shadow .12s ease,filter .12s ease!important;
    }
    .context-add-deep-btn:hover{
      transform:translateY(-1px)!important;
      filter:brightness(1.05);
      box-shadow:0 5px 12px rgba(47,95,197,.28)!important;
    }
    .context-add-deep-btn:active{
      transform:translateY(1px)!important;
      box-shadow:0 2px 5px rgba(47,95,197,.20)!important;
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

  function updateContextDeepButton(){
    const inline=document.querySelector('#feelingEditorInline');
    let wrap=document.querySelector('#contextAddDeepWrap');
    const show=typeof selected!=='undefined' && selected?.type==='feeling' && inline;

    if(!show){
      if(wrap) wrap.remove();
      return;
    }

    if(!wrap){
      wrap=document.createElement('div');
      wrap.id='contextAddDeepWrap';
      wrap.className='context-add-deep-wrap';

      const btn=document.createElement('button');
      btn.type='button';
      btn.className='context-add-deep-btn';
      btn.textContent='+ Убеждение 2';
      btn.title='Добавить глубинное убеждение к выбранному вторичному чувству';
      btn.onclick=()=>{
        if(typeof selected==='undefined' || selected?.type!=='feeling') return;
        const feeling=selected.obj;
        const arr=feeling.deep||(feeling.deep=[]);
        const deep=typeof newDeep==='function'
          ? newDeep()
          : {id:(typeof uid==='function'?uid():String(Date.now())),text:'',level:5,comment:'',instincts:[]};
        arr.push(deep);
        selected={type:'deep',obj:deep,parent:feeling,index:arr.length-1};
        if(typeof save==='function') save();
        if(typeof renderTree==='function') renderTree();
        setTimeout(()=>{
          const editor=document.querySelector('#editorText');
          if(editor){
            editor.focus();
            editor.setSelectionRange(editor.value.length,editor.value.length);
          }
        },0);
      };
      wrap.appendChild(btn);
      inline.insertAdjacentElement('beforebegin',wrap);
    }
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

  if(typeof renderEditor==='function'){
    const originalRenderEditor=renderEditor;
    renderEditor=function(){
      const result=originalRenderEditor.apply(this,arguments);
      updateContextDeepButton();
      return result;
    };
    updateContextDeepButton();
  }
})();
