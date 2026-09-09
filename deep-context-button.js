'use strict';

(() => {
  const style=document.createElement('style');
  style.textContent=`
    .context-add-deep-wrap{margin:2px 0 8px;display:flex;align-items:center}
    .context-add-deep-btn{border:1px solid #2f5fc5!important;background:linear-gradient(#5f8df0,#3f69d9)!important;color:#fff!important;border-radius:8px!important;padding:8px 13px!important;font-weight:700!important;cursor:pointer!important;box-shadow:0 3px 8px rgba(47,95,197,.22)!important;transition:transform .12s ease,box-shadow .12s ease,filter .12s ease!important}
    .context-add-deep-btn:hover{transform:translateY(-1px)!important;filter:brightness(1.05);box-shadow:0 5px 12px rgba(47,95,197,.28)!important}
    .context-add-deep-btn:active{transform:translateY(1px)!important;box-shadow:0 2px 5px rgba(47,95,197,.20)!important}
  `;
  document.head.appendChild(style);

  function refreshContextDeepButton(){
    const inline=document.querySelector('#feelingEditorInline');
    let wrap=document.querySelector('#contextAddDeepWrap');
    const show=typeof selected!=='undefined' && selected?.type==='feeling' && inline;

    if(!show){
      if(wrap)wrap.remove();
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
        if(typeof selected==='undefined' || selected?.type!=='feeling')return;
        const feeling=selected.obj;
        const arr=feeling.deep||(feeling.deep=[]);
        const deep=typeof newDeep==='function'?newDeep():{id:(typeof uid==='function'?uid():Date.now()+''),text:'',level:5,comment:'',instincts:[]};
        arr.push(deep);
        selected={type:'deep',obj:deep,parent:feeling,index:arr.length-1};
        if(typeof save==='function')save();
        if(typeof renderTree==='function')renderTree();
        setTimeout(()=>{
          const editor=document.querySelector('#editorText');
          if(editor){editor.focus();editor.setSelectionRange(editor.value.length,editor.value.length);}
        },0);
      };
      wrap.appendChild(btn);
      inline.insertAdjacentElement('beforebegin',wrap);
    }
  }

  if(typeof renderEditor==='function'){
    const previousRenderEditor=renderEditor;
    renderEditor=function(){
      const result=previousRenderEditor.apply(this,arguments);
      refreshContextDeepButton();
      return result;
    };
  }

  refreshContextDeepButton();
})();
