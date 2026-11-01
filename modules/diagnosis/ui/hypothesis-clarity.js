'use strict';

(() => {
  if(window.DiagnostikaHypothesisClarity)return;

  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const quoteValue=value=>clean(value).replace(/^[«"'“„\s]+|[»"'”\s]+$/g,'').replace(/[.!?]+$/,'').trim().replace(/^я(?=\s|$)/u,'Я');
  const genderOf=value=>{
    const v=clean(value).toLocaleLowerCase('ru-RU');
    if(['женский','жен','жен.','female','woman','f','ж'].includes(v))return 'female';
    if(['мужской','муж','муж.','male','man','m','м'].includes(v))return 'male';
    return '';
  };
  const adjectivePairs=[
    ['недостоин','недостойна'],['достоин','достойна'],
    ['неуверен','неуверена'],['уверен','уверена'],['неважен','неважна'],
    ['важен','важна'],['нужен','нужна'],['не нужен','не нужна'],
    ['должен','должна'],['способен','способна'],
    ['неспособен','неспособна'],['виноват','виновата'],
    ['одинок','одинока'],['готов','готова'],['счастлив','счастлива'],
    ['несчастлив','несчастлива'],['устал','устала'],
    ['незначим','незначима'],['значим','значима'],
    ['беспомощен','беспомощна'],['привлекателен','привлекательна'],
    ['непривлекателен','непривлекательна'],
    ['страшен','страшна'],['силён','сильна'],['силен','сильна'],
    ['неудачник','неудачница'],['хороший','хорошая'],
    ['плохой','плохая'],['чужой','чужая'],['пустой','пустая'],
    ['больной','больная'],['смешной','смешная']
  ];
  const maleToFemale=new Map(adjectivePairs);
  const femaleToMale=new Map(adjectivePairs.map(([m,f])=>[f,m]));
  // Preserve existing words not recognized as self-descriptions: no guessed
  // names, pronouns, diagnoses or third-party facts.
  function inflectBelief(raw,gender){
    const value=quoteValue(raw);
    if(!value||!gender)return value;
    return value.replace(/[А-ЯЁа-яё]+/gu,word=>{
      const lower=word.toLocaleLowerCase('ru-RU');
      const table=gender==='female'?maleToFemale:femaleToMale;
      let next=table.get(lower);
      if(!next){
        if(gender==='female'){
          if(lower.endsWith('ый'))next=lower.slice(0,-2)+'ая';
          else if(lower.endsWith('ий'))next=lower.slice(0,-2)+'яя';
          else if(lower.endsWith('ой'))next=lower.slice(0,-2)+'ая';
        }else{
          if(lower.endsWith('яя'))next=lower.slice(0,-2)+'ий';
          else if(lower.endsWith('ая'))next=lower.slice(0,-2)+'ый';
        }
      }
      if(!next||next===lower)return word;
      return word[0]===word[0].toUpperCase()?next[0].toUpperCase()+next.slice(1):next;
    });
  }

  // Normalize grammatical gender for deduplication. The same self-belief,
  // recorded in different gender forms, must count as one repeated belief.
  const key=value=>inflectBelief(value,'female')
    .toLocaleLowerCase('ru-RU').replace(/^я[\s,:;.!?—–-]+/u,'').trim();
  const isGenericRequest=value=>/^(новый запрос|запрос(?:\s*№?\s*\d+)?|без названия)$/iu.test(clean(value));
  function groupCandidates(data){
    const grouped=new Map();
    const add=(raw,level,count,branches)=>{
      const name=quoteValue(raw),id=key(name);
      if(!id||!name)return;
      const magnitude=Number(level);
      const prev=grouped.get(id)||{name,count:0,level:0,branches:[]};
      prev.count+=Math.max(1,Number(count)||1);
      if(Number.isFinite(magnitude))prev.level=Math.max(prev.level,magnitude);
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
      // Older diagnoses without a Strong-VU summary: use only explicit,
      // high-intensity deep beliefs. Never elevate a level 1-5 into "strong".
      for(const s of data?.ситуации||[]){
        for(const b of s?.первичные_убеждения||[]){
          for(const f of b?.вторичные_чувства||[]){
            for(const d of f?.вторичные_убеждения||[]){
              if(!(Number(d?.уровень)>=6))continue;
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
    // A strong *positive* self-statement (e.g. "Я благородный") is not
    // a harsh limiting core belief merely because its level is high.
    const isPositiveSelfStatement=value=>{
      const v=clean(value).toLocaleLowerCase('ru-RU');
      const negative=/(^|\s)не(?:\s|$)|беспом|беспол|недост|незнач|неувер|неспособ|слаб|плох|никч|ничтож|неудач|ущерб|жалк|одинок|чуж|виноват|никому|нелюб|несчастлив|нужен\s+никому/u;
      const positive=/благород|хорош|сильн|досто|успеш|способ|нужн|любим|ценн|полезн|важн|значим|уверен|счастлив|умею|могу|справлюсь/u;
      return !negative.test(v)&&positive.test(v);
    };
    return [...grouped.values()].filter(g=>g.level>=6&&!isPositiveSelfStatement(g.name))
      .sort((a,b)=>{
        // Both intensity and recurrence matter. A repeated level-9 belief can
        // outrank an isolated level-10 belief, without allowing low levels in.
        const score=g=>g.level*10+Math.min(g.count,5)*3;
        return score(b)-score(a)||b.level-a.level||b.count-a.count||a.name.localeCompare(b.name,'ru');
      });
  }
  function chooseFocus(data){
    const ranked=groupCandidates(data);
    if(!ranked.length)return null;
    const gender=genderOf(data?.клиент?.пол??data?.клиент?.gender);
    const beliefs=ranked.slice(0,3).map(g=>({
      text:inflectBelief(g.name,gender),
      repeatCount:g.count,
      level:g.level
    }));
    // A situation must be linked to one of the selected beliefs, not
    // presented as proof that all three beliefs arise in that same situation.
    const contextual=ranked.slice(0,3).find(g=>g.branches.some(b=>b.situation||b.perception));
    const branches=(contextual?.branches||[]).slice()
      .sort((a,b)=>(Number(!!b.situation)+Number(!!b.perception))-(Number(!!a.situation)+Number(!!a.perception))
        ||b.level-a.level);
    const primary=branches[0]||{};
    const situation=primary.situation||clean((data?.ситуации||[])[0]?.ситуация);
    const associated=branches.filter(b=>b.situation===primary.situation&&b.perception===primary.perception);
    const feelings=[];
    for(const branch of associated){
      const feeling=quoteValue(branch.feeling);
      if(feeling&&!feelings.some(prev=>key(prev)===key(feeling)))feelings.push(feeling);
      if(feelings.length===4)break;
    }
    return {
      beliefs,
      belief:beliefs[0].text, // Compatibility for older consumers.
      repeatCount:beliefs[0].repeatCount,
      gender,
      situation,
      perception:inflectBelief(primary.perception,gender),
      feelings,
      originalRequest:clean(data?.исходный_запрос?.формулировка)
    };
  }
  function joinNatural(values){
    if(values.length<=1)return values[0]||'';
    return values.slice(0,-1).join(', ')+' и '+values[values.length-1];
  }
  function format(data,addressMode='ty'){
    const focus=chooseFocus(data);
    const mode=['ty','vy','third'].includes(addressMode)?addressMode:'ty';
    const gender=focus?.gender||genderOf(data?.клиент?.пол??data?.клиент?.gender);
    const address={
      ty:{intro:'В основе твоего запроса',perception:'В этот момент ты можешь воспринимать себя так',
        feeling:'При этом ты можешь замечать у себя такие чувства, как',
        request:'Так может проявляться твой исходный запрос'},
      vy:{intro:'В основе вашего запроса',perception:'В этот момент вы можете воспринимать себя так',
        feeling:'При этом вы можете замечать у себя такие чувства, как',
        request:'Так может проявляться ваш исходный запрос'},
      third:gender==='female'?{
        intro:'В основе запроса клиентки',perception:'В этот момент она может воспринимать себя так',
        feeling:'При этом она может замечать у себя такие чувства, как',
        request:'Так может проявляться её исходный запрос'
      }:gender==='male'?{
        intro:'В основе запроса клиента',perception:'В этот момент он может воспринимать себя так',
        feeling:'При этом он может замечать у себя такие чувства, как',
        request:'Так может проявляться его исходный запрос'
      }:{
        intro:'В основе запроса человека',perception:'В этот момент человек может воспринимать себя так',
        feeling:'При этом могут возникать такие чувства, как',
        request:'Так может проявляться исходный запрос'
      }
    }[mode];
    if(!focus){
      return {
        expanded:'В данных этого запроса пока не выявлено достаточно сильных глубинных убеждений для обоснованной гипотезы. Нужно уточнить, как человек воспринимает себя в конкретной ситуации, и зафиксировать это в диагностике.',
        short:'Недостаточно данных для обоснованной гипотезы.',
        focus:null
      };
    }
    const labels=focus.beliefs.map(b=>'«'+b.text+'»');
    const plural=labels.length>1;
    const clauses=[
      address.intro+(plural?' могут лежать глубинные убеждения: ':' может лежать глубинное убеждение: ')+joinNatural(labels)+'.'
    ];
    if(focus.situation)clauses.push((plural?'Например, одно из них может':'Это убеждение может')+
      ' проявляться в ситуации: «'+quoteValue(focus.situation)+'».');
    if(focus.perception&&!focus.beliefs.some(b=>key(b.text)===key(focus.perception)))
      clauses.push(address.perception+': «'+quoteValue(focus.perception)+'».');
    if(focus.feelings.length)clauses.push(address.feeling+' '+joinNatural(focus.feelings)+'.');
    if(focus.originalRequest&&!isGenericRequest(focus.originalRequest))
      clauses.push(address.request+': «'+quoteValue(focus.originalRequest)+'».');
    const short='Возможная основа запроса — '+(plural?'убеждения ':'убеждение ')+joinNatural(labels)+
      (focus.situation?' в ситуации «'+quoteValue(focus.situation)+'»':'')+'.';
    return {expanded:clauses.join(' '),short,focus};
  }
  function formatReply(data,addressMode){
    const result=format(data,addressMode);
    return 'РАСШИРЕННАЯ ГИПОТЕЗА:\n'+result.expanded+'\n\nКОРОТКАЯ ГИПОТЕЗА:\n'+result.short;
  }
  window.DiagnostikaHypothesisClarity=Object.freeze({genderOf,inflectBelief,chooseFocus,format,formatReply});
})();