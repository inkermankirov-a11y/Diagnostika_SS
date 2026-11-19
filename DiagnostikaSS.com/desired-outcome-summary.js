'use strict';

/* Client desired-outcome summary: local, deterministic, never sends client text to a service. */
(() => {
  if(window.DiagnostikaDesiredOutcomeSummary)return;

  const compact=s=>String(s||'').replace(/\s+/g,' ').trim();
  const clean=s=>compact(s).replace(/[.!?…,:;\s]+$/,'');
  const unique=values=>[...new Set(values.filter(Boolean))];

  function extractGoals(input){
    const text=compact(input);
    if(!text)return [];
    const goals=[],has=re=>re.test(text);

    if(has(/(?:мысл|воспоминан|переживан|чувств).{0,100}(?:муч|беспоко|навязчив|тревож|болезнен)|(?:мучител|навязчив).{0,60}мысл/i)){
      const relation=text.match(/(?:мысл\w*|чувств\w*).{0,45}?(?:о|об|к)\s+([А-ЯЁ][а-яё]{2,})/u);
      goals.push(relation?'Освободиться от мучительных мыслей о '+relation[1]:'Снизить тревожные и навязчивые мысли');
    }
    if(has(/(?:влюб|нов\w*\s+(?:интимн\w*\s+)?отношен|близост|раскрыва\w*\s+в\s+отношен)/i)){
      goals.push('Открыться новым отношениям и близости');
    }
    if(has(/(?:прилив сил|вернуть энерги|энерг|ярче|насыщенн|интерес к жизни|радост\w*\s+жизн)/i)){
      goals.push('Вернуть энергию и интерес к жизни');
    }
    if(has(/(?:режиссур|режисс[её]р)/i)){
      goals.push('Реализоваться в режиссуре');
    }else if(has(/(?:карьер|самореализ|професси|любим\w*\s+дел)/i)){
      goals.push('Реализоваться в профессии');
    }
    if(has(/(?:похуд|худет|снизить вес|снижени\w*\s+вес|лишн\w*\s+вес)/i)){
      goals.push('Снизить вес');
    }
    if(has(/(?:защищать себя|защит\w*\s+себя|личн\w*\s+границ|уверенн\w*\s+в\s+себе|отстаива\w*\s+себя)/i)){
      goals.push('Научиться защищать себя и свои границы');
    }
    if(has(/(?:смен\w*\s+партн[её]ра|улучшени\w*\s+(?:нынешн\w*\s+)?отношен|наладить отношен)/i)){
      goals.push('Определиться с дальнейшими отношениями');
    }
    if(has(/(?:выйти|уйти|выход|уход)\s+из\s+найма/i))goals.push('Выйти из найма');
    if(has(/интернет[- ]магазин/i))goals.push('Развивать интернет-магазин');
    if(has(/целительств/i))goals.push('Вернуться к целительству');
    if(has(/путешеств/i))goals.push('Больше путешествовать');
    if(has(/финансов\w*\s+(?:свобод|независим)/i))goals.push('Достичь финансовой независимости');

    if(goals.length)return unique(goals).slice(0,4);
    // Fall back to an intact meaningful clause; never cut a sentence at a word limit.
    const sentences=text.split(/(?<=[.!?])\s+/).map(clean).filter(Boolean);
    const meaningful=sentences.find(s=>s.split(/\s+/).length>=5&&!/^(?:клиент(?:ка)?\s+)?(?:хочет|желает)\.?$/i.test(s));
    if(!meaningful)return [];
    const clause=meaningful.split(/[;\n]/).map(clean).find(s=>s.split(/\s+/).length>=5)||meaningful;
    const stripped=clean(clause.replace(/^(?:клиент(?:ка)?\s+)?(?:хочет|желает)(?:\s*,?\s*чтобы)?\s+/i,''));
    if(!stripped||stripped.split(/\s+/).length<4)return [];
    // No fabricated aspiration when the wording cannot safely be summarized.
    return [stripped.length<=135?stripped:'Уточнить краткий результат в карточке'];
  }
  function fromText(text){
    return extractGoals(text).map((g,i)=>(i+1)+'. '+clean(g)).join('\n');
  }
  window.DiagnostikaDesiredOutcomeSummary=Object.freeze({fromText,extractGoals});
})();
