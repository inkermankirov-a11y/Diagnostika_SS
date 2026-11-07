'use strict';

(() => {
  const shell=()=>window.DiagnostikaPlatform?.shell||null;
  const panel=()=>document.querySelector('#strongVuPanel');
  const list=()=>document.querySelector('#strongVuList');
  const more=()=>document.querySelector('#strongVuMore');
  let expanded=false;

  function cleanText(value){
    return String(value??'').trim().replace(/\s+/g,' ');
  }

  function normalizeVu(value){
    return cleanText(value)
      .toLocaleLowerCase('ru-RU')
      .replace(/^[«"'“”„]+|[»"'“”„]+$/g,'')
      .replace(/^я[\s,:;.!?—–-]+/u,'')
      .trim();
  }

  // One source of truth for the visible Strong VU column and hypothesis input.
  function collectForRequest(request){
    if(!request)return[];
    const groups=new Map();

    (request.situations||[]).forEach((situation,situationIndex)=>{
      (situation.beliefs||[]).forEach(belief=>{
        if(!cleanText(belief?.text))return;
        (belief.feelings||[]).forEach(feeling=>{
          if(!cleanText(feeling?.text))return;
          (feeling.deep||[]).forEach(deep=>{
            const text=cleanText(deep?.text);
            if(!text)return;
            const key=normalizeVu(text);
            if(!key)return;
            const level=Math.max(1,Math.min(10,Number(deep?.level)||5));
            const occurrence={
              text,
              level,
              deepId:deep.id,
              beliefId:belief.id,
              feelingId:feeling.id,
              situationId:situation.id,
              situationIndex
            };
            const group=groups.get(key)||{key,count:0,maxLevel:0,occurrences:[],displayText:text};
            group.count+=1;
            group.maxLevel=Math.max(group.maxLevel,level);
            group.occurrences.push(occurrence);
            if(level>=group.maxLevel)group.displayText=text;
            groups.set(key,group);
          });
        });
      });
    });

    return [...groups.values()]
      .filter(group=>group.maxLevel>=6)
      .map(group=>{
        group.occurrences.sort((a,b)=>b.level-a.level||a.situationIndex-b.situationIndex);
        group.target=group.occurrences[0];
        return group;
      })
      .sort((a,b)=>{
        const ar=a.count>1?1:0;
        const br=b.count>1?1:0;
        return br-ar||b.count-a.count||b.maxLevel-a.maxLevel||a.displayText.localeCompare(b.displayText,'ru');
      });
  }

  function collect(){
    return collectForRequest(shell()?.currentRequest?.());
  }

  async function openGroup(group){
    const target=group?.target;
    if(!target)return;
    const action=()=>{
      const api=shell();
      if(!api)return;
      api.selectSituation?.(target.situationId);
      api.renderDiagnosis?.();
      setTimeout(()=>{
        window.DiagnostikaFeelingCollapse?.openDeep?.(target.deepId);
        api.selectDiagnosisElement?.('deep',target.deepId);
        api.renderDiagnosisTree?.();
        requestAnimationFrame(()=>{
          document.querySelector(`#tree .tree-row.deep[data-element-id="${CSS.escape(String(target.deepId))}"]`)?.scrollIntoView?.({block:'center',behavior:'smooth'});
        });
      },0);
    };
    const guard=window.DiagnostikaEditorGuard;
    if(guard?.beforeLeave)await guard.beforeLeave(action);
    else action();
  }

  function render(){
    const root=panel();
    const target=list();
    const moreBtn=more();
    if(!root||!target||!moreBtn)return;

    const groups=collect();
    target.innerHTML='';
    const visible=expanded?groups:groups.slice(0,7);

    if(!groups.length){
      const empty=document.createElement('div');
      empty.className='strong-vu-empty';
      empty.textContent='Пока нет ВУ с уровнем 6 и выше.';
      target.appendChild(empty);
    }else{
      visible.forEach(group=>{
        const row=document.createElement('button');
        row.type='button';
        row.className='strong-vu-row'+(group.count>1?' is-repeat':'');
        row.dataset.deepId=String(group.target?.deepId??'');
        row.title=group.count>1
          ? `Повторяется ${group.count} раза. Открыть самое сильное ВУ.`
          : 'Открыть ВУ в дереве';

        const tag=document.createElement('span');
        tag.className='strong-vu-tag';
        tag.textContent='ВУ';

        const text=document.createElement('span');
        text.className='strong-vu-text';
        text.textContent=group.displayText;

        const level=document.createElement('span');
        level.className='strong-vu-level';
        level.textContent=String(group.maxLevel);

        row.append(tag,text,level);
        if(group.count>1){
          const count=document.createElement('span');
          count.className='strong-vu-count';
          count.textContent='×'+group.count;
          row.appendChild(count);
        }else{
          const spacer=document.createElement('span');
          spacer.setAttribute('aria-hidden','true');
          row.appendChild(spacer);
        }

        row.onclick=()=>openGroup(group);
        target.appendChild(row);
      });
    }

    const hiddenCount=Math.max(0,groups.length-7);
    moreBtn.hidden=hiddenCount===0;
    if(hiddenCount){
      moreBtn.textContent=expanded?'Свернуть':'Показать ещё '+hiddenCount;
      root.classList.toggle('is-expanded',expanded);
    }else{
      root.classList.remove('is-expanded');
    }

    root.dataset.count=String(groups.length);
    root.dataset.repeatCount=String(groups.filter(group=>group.count>1).length);
    document.dispatchEvent(new CustomEvent('diagnostika:strong-vu-rendered',{
      detail:{count:groups.length,repeats:groups.filter(group=>group.count>1).length}
    }));
  }

  more()?.addEventListener('click',()=>{
    expanded=!expanded;
    render();
  });

  window.DiagnostikaStrongVuSummary=Object.freeze({collectForRequest});

  document.addEventListener('diagnostika:diagnosis-tree-rendered',render);
  document.addEventListener('diagnostika:diagnosis-editor-rendered',render);
  document.addEventListener('diagnostika:mode-rendered',render);
  render();
})();
