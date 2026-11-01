'use strict';

(() => {
  if(window.DiagnostikaHypothesisClarity)return;

  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const quoteValue=value=>clean(value).replace(/^[«"'“„\s]+|[»"'”\s]+$/g,'').replace(/[.!?]+$/,'').trim().replace(/^я(?=\s|$)/u,'Я');
  const key=value=>quoteValue(value).toLocaleLowerCase('ru-RU').replace(/^я[\s,:;.!?—–-]+/u,'').trim();
  const isGenericRequest=value=>/^(новый запрос|запрос(?:\s*№?\s*\d+)?|без названия)$/iu.test(clean(value));

  function candidates(data){
    const grouped=new Map();
    const add=(raw,level,count,branches)=>{
      const name=quoteValue(raw),id=key(name);
      if(!id||!name)return;
      const prev=grouped.get(id)||{name,count:0,level:0,branches:[]};
      prev.count+=Math.max(1,Number(count)||1);
      prev.level=Math.max(prev.level,Number(level)||0);
      prev.branches.push(...branches);
      grouped.set(id,prev);
    };
    if(Array.isArray(data?.сильные_ВУ)&&data.сильные_ВУ.length){
      for(const g of data.сильные_ВУ){
        add(g?.убеждение,g?.максимальный_уровень,g?.повторений,
          (Array.isArray(g?.ветки)?g.ветки:[]).map(b=>({
            situation:clean(b?.ситуация),
            perception:clean(b?.первичное_убеждение),
            feeling:clean(b?.вторичное_чувство),
            level:Number(b?.уровень_ВУ)||0
          })));
      }
    }else{
      // Older diagnoses can have deep beliefs without a Strong-VU summary.
      for(const s of data?.ситуации||[]){
        for(const b of s?.первичные_убеждения||[]){
          for(const f of b?.вторичные_чувства||[]){
            for(const d of f?.вторичные_убеждения||[]){
              add(d?.убеждение_или_самоопределение,d?.уровень,1,[{
                situation:clean(s?.ситуация),
                perception:clean(b?.убеждение),
                feeling:clean(f?.чувство_или_реакция),
                level:Number(d?.уровень)||0
              }]);
            }
          }
        }
      }
    }
    return [...grouped.values()]
      .sort((a,b)=>b.count-a.count||b.level-a.level||a.name.localeCompare(b.name,'ru'));
  }

  function chooseFocus(data){
    const strongest=candidates(data)[0];
    if(!strongest)return null;
    const branches=strongest.branches.slice().sort((a,b)=>
      (Number(!!b.situation)+Number(!!b.perception))-(Number(!!a.situation)+Number(!!a.perception))
      ||b.level-a.level);
    const primary=branches[0]||{};
    const situation=primary.situation||clean((data?.ситуации||[])[0]?.ситуация);
    // Feelings belong to the same underlying situation and first belief,
    // never to unrelated branches from another part of the diagnosis.
    const selected=branches.filter(b=>b.situation===primary.situation&&b.perception===primary.perception);
    const feelings=[];
    for(const branch of selected){
      const f=quoteValue(branch.feeling);
      if(f&&!feelings.some(existing=>key(existing)===key(f)))feelings.push(f);
      if(feelings.length===4)break;
    }
    return {
      belief:strongest.name,
      situation,
      perception:primary.perception,
      feelings,
      originalRequest:clean(data?.исходный_запрос?.формулировка),
      repeatCount:strongest.count
    };
  }

  function joinFeelings(values){
    if(values.length<=1)return values[0]||'';
    return values.slice(0,-1).join(', ')+' и '+values[values.length-1];
  }

  function format(data,addressMode='ty'){
    const focus=chooseFocus(data);
    const mode=['ty','vy','third'].includes(addressMode)?addressMode:'ty';
    const address={
      ty:{intro:'В основе твоего запроса может лежать глубинное убеждение',perception:'В этот момент ты можешь воспринимать себя так',feeling:'В этот момент ты можешь замечать у себя такие чувства, как',request:'Так может проявляться твой исходный запрос'},
      vy:{intro:'В основе вашего запроса может лежать глубинное убеждение',perception:'В этот момент вы можете воспринимать себя так',feeling:'В этот момент вы можете замечать у себя такие чувства, как',request:'Так может проявляться ваш исходный запрос'},
      third:{intro:'В основе запроса клиента может лежать глубинное убеждение',perception:'В этот момент клиент может воспринимать себя так',feeling:'В этот момент у клиента могут возникать такие чувства, как',request:'Так может проявляться исходный запрос клиента'}
    }[mode];
    if(!focus){
      const expanded='В данных этого запроса пока не выявлено глубинного убеждения, на котором можно обоснованно построить гипотезу. Нужно уточнить, как клиент воспринимает себя в конкретной ситуации, и зафиксировать его слова в диагностике.';
      return {expanded,short:'Недостаточно данных для обоснованной гипотезы.',focus:null};
    }
    const belief=quoteValue(focus.belief);
    const clauses=[address.intro+': «'+belief+'».'];
    if(focus.situation)clauses.push('Это убеждение может проявляться в ситуации: «'+quoteValue(focus.situation)+'».');
    if(focus.perception&&key(focus.perception)!==key(belief))
      clauses.push(address.perception+': «'+quoteValue(focus.perception)+'».');
    if(focus.feelings.length)clauses.push(address.feeling+' '+joinFeelings(focus.feelings)+'.');
    if(focus.originalRequest&&!isGenericRequest(focus.originalRequest))
      clauses.push(address.request+': «'+quoteValue(focus.originalRequest)+'».');
    const short='Возможная основа запроса — убеждение «'+belief+'»'+(focus.situation?' в ситуации «'+quoteValue(focus.situation)+'»':'')+'.';
    return {expanded:clauses.join(' '),short,focus};
  }

  function formatReply(data,addressMode){
    const result=format(data,addressMode);
    return 'РАСШИРЕННАЯ ГИПОТЕЗА:\n'+result.expanded+'\n\nКОРОТКАЯ ГИПОТЕЗА:\n'+result.short;
  }

  window.DiagnostikaHypothesisClarity=Object.freeze({chooseFocus,format,formatReply});
})();
