'use strict';

(() => {
  const shell=()=>window.DiagnostikaPlatform?.shell||null;
  const currentClient=()=>window.DiagnostikaClients?.current?.()||null;
  const currentRequest=()=>shell()?.currentRequest?.()||null;
  const currentSituation=()=>shell()?.currentSituation?.()||null;
  const selection=()=>shell()?.currentSelection?.()||null;
  // Состояние раскрытия хранится только в памяти страницы.
  // После обновления/повторной загрузки всё снова свернуто.
  const expandedFeelings = new Set();

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

    .tree-row.feeling{position:relative}
    .feeling-child-toggle{
      width:20px;
      height:20px;
      flex:0 0 20px;
      display:grid;
      place-items:center;
      margin-left:-20px;
      margin-right:3px;
      border:0!important;
      border-radius:5px!important;
      padding:0!important;
      background:transparent!important;
      color:inherit!important;
      box-shadow:none!important;
      font-size:11px!important;
      font-weight:800!important;
      line-height:1!important;
      cursor:pointer!important;
      transition:background .12s ease,transform .12s ease!important;
    }
    .feeling-child-toggle:hover{
      background:rgba(122,91,0,.12)!important;
      transform:none!important;
      box-shadow:none!important;
    }
    .feeling-child-toggle:active{transform:scale(.92)!important}
    .feeling-child-toggle.no-children{visibility:hidden;pointer-events:none}

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

  function feelingKey(belief, beliefIndex, feeling, feelingIndex){
    const beliefId=belief?.id||`belief-${beliefIndex}`;
    const feelingId=feeling?.id||`feeling-${feelingIndex}`;
    return `${beliefId}::${feelingId}`;
  }

  function syncTreeRowHeights(root){
    if(!root)return;
    requestAnimationFrame(()=>{
      root.querySelectorAll('.tree-row').forEach(row=>{
        const label=row.querySelector('.tree-row-label');
        if(!label||getComputedStyle(row).display==='none')return;
        row.style.setProperty('height','auto','important');
        const labelHeight=Math.ceil(label.getBoundingClientRect().height||label.scrollHeight||0);
        const min=Math.max(30,labelHeight+12);
        row.style.setProperty('min-height',min+'px','important');
      });
    });
  }

  function findFeelingContext(feelingId){
    const s=currentSituation();
    if(!s)return null;
    for(let bi=0;bi<(s.beliefs||[]).length;bi++){
      const belief=s.beliefs[bi];
      for(let fi=0;fi<(belief.feelings||[]).length;fi++){
        const feeling=belief.feelings[fi];
        if(String(feeling?.id)===String(feelingId))return{belief,beliefIndex:bi,feeling,feelingIndex:fi};
      }
    }
    return null;
  }

  function findDeepContext(deepId){
    const s=currentSituation();
    if(!s)return null;
    for(let bi=0;bi<(s.beliefs||[]).length;bi++){
      const belief=s.beliefs[bi];
      for(let fi=0;fi<(belief.feelings||[]).length;fi++){
        const feeling=belief.feelings[fi];
        const deep=(feeling.deep||[]).find(item=>String(item?.id)===String(deepId));
        if(deep)return{belief,beliefIndex:bi,feeling,feelingIndex:fi,deep};
      }
    }
    return null;
  }

  function expandOnly(ctx){
    if(!ctx)return false;
    const beliefId=ctx.belief?.id||String(ctx.beliefIndex);
    const prefix=`${beliefId}::`;
    [...expandedFeelings].forEach(key=>{if(key.startsWith(prefix))expandedFeelings.delete(key);});
    expandedFeelings.add(feelingKey(ctx.belief,ctx.beliefIndex,ctx.feeling,ctx.feelingIndex));
    return true;
  }

  function openFeeling(feelingId){
    const ctx=findFeelingContext(feelingId);
    if(!expandOnly(ctx))return false;
    applyFeelingCollapse();
    return true;
  }

  function openDeep(deepId){
    const ctx=findDeepContext(deepId);
    if(!expandOnly(ctx))return false;
    applyFeelingCollapse();
    requestAnimationFrame(()=>{
      document.querySelector(`#tree .tree-row.deep[data-element-id="${CSS.escape(String(deepId))}"]`)?.scrollIntoView?.({block:'nearest'});
    });
    return true;
  }

  function applyFeelingCollapse(){
    const root=document.querySelector('#tree');
    const s=currentSituation();
    if(!root||!s)return;

    root.querySelectorAll('.feeling-group-toggle').forEach(el=>el.remove());
    root.querySelectorAll('.feeling-child-toggle').forEach(el=>el.remove());

    const rows=[...root.querySelectorAll('.tree-row')];
    rows.forEach(row=>{
      row.style.display='';
      if(row.classList.contains('deep')||row.classList.contains('instinct'))row.style.display='none';
    });

    const selected=selection();
    if(selected?.type==='deep'){
      const ctx=findDeepContext(selected.obj?.id);
      if(ctx)expandOnly(ctx);
    }else if(selected?.type==='instinct'){
      for(const belief of (s.beliefs||[])){
        for(const feeling of (belief.feelings||[])){
          const deep=(feeling.deep||[]).find(d=>(d.instincts||[]).some(x=>String(x?.id)===String(selected.obj?.id)));
          if(deep){const ctx=findDeepContext(deep.id);if(ctx)expandOnly(ctx);}
        }
      }
    }

    const feelingRows=rows.filter(row=>row.classList.contains('feeling'));
    feelingRows.forEach(feelingRow=>{
      const ctx=findFeelingContext(feelingRow.dataset.elementId);
      if(!ctx)return;
      const key=feelingKey(ctx.belief,ctx.beliefIndex,ctx.feeling,ctx.feelingIndex);
      const isExpanded=expandedFeelings.has(key);

      const children=[];
      let node=feelingRow.nextElementSibling;
      while(node && !node.classList.contains('feeling') && !node.classList.contains('primary')){
        if(node.classList.contains('tree-row'))children.push(node);
        node=node.nextElementSibling;
      }
      const hasVisibleDeep=children.some(row=>row.classList.contains('deep'));

      const arrow=document.createElement('button');
      arrow.type='button';
      arrow.className='feeling-child-toggle'+(hasVisibleDeep?'':' no-children');
      arrow.textContent=isExpanded?'▼':'▶';
      arrow.title=isExpanded?'Свернуть ВУ и инстинкты':'Развернуть ВУ и инстинкты';
      arrow.setAttribute('aria-label',arrow.title);
      arrow.onclick=e=>{
        e.preventDefault();
        e.stopPropagation();
        if(!hasVisibleDeep)return;
        if(expandedFeelings.has(key))expandedFeelings.delete(key);
        else expandOnly(ctx);
        applyFeelingCollapse();
      };
      feelingRow.prepend(arrow);

      children.forEach(child=>{child.style.display=isExpanded?'':'none';});
    });

    syncTreeRowHeights(root);
  }

  function updateContextDeepButton(){
    const inline=document.querySelector('#feelingEditorInline');
    let wrap=document.querySelector('#contextAddDeepWrap');
    const selected=selection();
    const show=selected?.type==='feeling'&&inline;

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
      btn.textContent='+ Вторичное убеждение';
      btn.title='Добавить глубинное убеждение к выбранному вторичному чувству';
      btn.onclick=()=>{
        const selected=selection();
        if(selected?.type!=='feeling')return;
        const feeling=selected.obj;
        const c=currentClient();
        const r=currentRequest();
        const api=window.DiagnostikaDiagnosis;
        if(!c||!r||!api?.moduleAware)return;
        const deep=api.addDeep(feeling.id,{}, {client:c,requestId:r.id,source:'diagnosis-ui-deep-add',render:false});
        if(!deep)return;

        // При добавлении нового Убеждения 2 автоматически раскрываем
        // именно текущее вторичное чувство, чтобы новый элемент был виден.
        const s=currentSituation();
        if(s){
          (s.beliefs||[]).forEach((belief,bi)=>{
            const liveFeeling=(belief.feelings||[]).find(x=>String(x.id)===String(feeling.id));
            const fi=(belief.feelings||[]).indexOf(liveFeeling);
            if(fi>=0){
              expandOnly({belief,beliefIndex:bi,feeling:liveFeeling,feelingIndex:fi});
            }
          });
        }

        shell()?.selectDiagnosisElement?.('deep',deep.id);
        shell()?.renderDiagnosisTree?.();
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

  window.DiagnostikaFeelingCollapse=Object.freeze({
    openFeeling,
    openDeep,
    refresh:applyFeelingCollapse
  });

  document.addEventListener('diagnostika:diagnosis-tree-rendered',applyFeelingCollapse);
  document.addEventListener('diagnostika:diagnosis-editor-rendered',updateContextDeepButton);
  applyFeelingCollapse();
  updateContextDeepButton();
})();
