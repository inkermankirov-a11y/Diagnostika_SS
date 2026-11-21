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
  const localeTemplates={"en":{"intro":["Your request may be rooted in","Your request may be rooted in","The client’s request may be rooted in"],"belief":["a core belief: ","core beliefs: "],"example":["This belief may appear in the situation","For example, one of these may appear in the situation"],"perception":["At that moment, you may see yourself as","At that moment, you may see yourself as","At that moment, the client may see themselves as"],"feelings":["You may also notice feelings such as","You may also notice feelings such as","The client may also notice feelings such as"],"request":["This may relate to your original request","This may relate to your original request","This may relate to the original request"],"short":"Possible underlying factors — ","in":" in the situation ","and":" and ","empty":"The assessment does not yet identify sufficiently strong core beliefs for a supported hypothesis. Clarify the client's self-perception in a specific situation and record it in the assessment.","emptyShort":"Insufficient data for a supported hypothesis."},"fr":{"intro":["Ta demande pourrait reposer sur","Votre demande pourrait reposer sur","La demande de la personne pourrait reposer sur"],"belief":["une croyance profonde : ","des croyances profondes : "],"example":["Cette croyance pourrait se manifester dans la situation","Par exemple, l’une d’elles pourrait se manifester dans la situation"],"perception":["À ce moment, tu peux te percevoir ainsi","À ce moment, vous pouvez vous percevoir ainsi","À ce moment, la personne peut se percevoir ainsi"],"feelings":["Tu peux aussi remarquer des sentiments tels que","Vous pouvez aussi remarquer des sentiments tels que","La personne peut aussi remarquer des sentiments tels que"],"request":["Cela pourrait être lié à ta demande initiale","Cela pourrait être lié à votre demande initiale","Cela pourrait être lié à la demande initiale"],"short":"Facteurs sous-jacents possibles — ","in":" dans la situation ","and":" et ","empty":"Les données ne révèlent pas encore de croyances profondes suffisamment fortes pour étayer une hypothèse. Précisez la perception de soi dans une situation concrète et notez-la dans l’évaluation.","emptyShort":"Données insuffisantes pour étayer une hypothèse."},"de":{"intro":["Deinem Anliegen könnte","Ihrem Anliegen könnte","Dem Anliegen der Person könnte"],"belief":["eine tiefe Überzeugung zugrunde liegen: ","mehr als eine tiefe Überzeugung zugrunde liegen: "],"example":["Diese Überzeugung könnte sich in folgender Situation zeigen","Eine davon könnte sich beispielsweise in folgender Situation zeigen"],"perception":["In diesem Moment könntest du dich so wahrnehmen","In diesem Moment könnten Sie sich so wahrnehmen","In diesem Moment könnte die Person sich so wahrnehmen"],"feelings":["Dabei könnten bei dir Gefühle auftreten wie","Dabei könnten bei Ihnen Gefühle auftreten wie","Dabei könnten Gefühle auftreten wie"],"request":["Das könnte mit deinem ursprünglichen Anliegen zusammenhängen","Das könnte mit Ihrem ursprünglichen Anliegen zusammenhängen","Das könnte mit dem ursprünglichen Anliegen zusammenhängen"],"short":"Mögliche Grundlage des Anliegens — ","in":" in der Situation ","and":" und ","empty":"Die Diagnostik zeigt noch keine ausreichend starken tiefen Überzeugungen für eine begründete Hypothese. Klären Sie die Selbstwahrnehmung in einer konkreten Situation und dokumentieren Sie diese.","emptyShort":"Nicht genügend Daten für eine begründete Hypothese."},"it":{"intro":["Alla base della tua richiesta potrebbe esserci","Alla base della sua richiesta potrebbe esserci","Alla base della richiesta della persona potrebbe esserci"],"belief":["una convinzione profonda: ","più di una convinzione profonda: "],"example":["Questa convinzione potrebbe manifestarsi nella situazione","Per esempio, una di queste potrebbe manifestarsi nella situazione"],"perception":["In quel momento potresti percepirti così","In quel momento potrebbe percepirsi così","In quel momento la persona potrebbe percepirsi così"],"feelings":["Potresti anche notare sentimenti come","Potrebbe anche notare sentimenti come","La persona potrebbe anche notare sentimenti come"],"request":["Questo potrebbe essere collegato alla tua richiesta iniziale","Questo potrebbe essere collegato alla sua richiesta iniziale","Questo potrebbe essere collegato alla richiesta iniziale"],"short":"Possibili fattori alla base della richiesta — ","in":" nella situazione ","and":" e ","empty":"La valutazione non rivela ancora convinzioni profonde abbastanza forti per un’ipotesi fondata. Chiarire la percezione di sé in una situazione concreta e registrarla nella valutazione.","emptyShort":"Dati insufficienti per un’ipotesi fondata."}};
  function formatLocalized(focus,mode,lang){
    const t=localeTemplates[lang],a=mode==='vy'?1:mode==='third'?2:0;
    if(!focus)return {expanded:t.empty,short:t.emptyShort,focus:null};
    const quote=s=>'«'+quoteValue(s)+'»', labels=focus.beliefs.map(b=>quote(b.text)), plural=labels.length>1;
    const join=v=>v.length>1?v.slice(0,-1).join(', ')+t.and+v[v.length-1]:(v[0]||'');
    const clauses=[t.intro[a]+' '+t.belief[Number(plural)]+join(labels)+'.'];
    if(focus.situation)clauses.push(t.example[Number(plural)]+': '+quote(focus.situation)+'.');
    if(focus.perception&&!focus.beliefs.some(b=>key(b.text)===key(focus.perception)))clauses.push(t.perception[a]+': '+quote(focus.perception)+'.');
    if(focus.feelings.length)clauses.push(t.feelings[a]+' '+join(focus.feelings)+'.');
    if(focus.originalRequest&&!isGenericRequest(focus.originalRequest))clauses.push(t.request[a]+': '+quote(focus.originalRequest)+'.');
    return {expanded:clauses.join(' '),short:t.short+join(labels)+(focus.situation?t.in+quote(focus.situation):'')+'.',focus};
  }
  function format(data,addressMode='ty'){
    const focus=chooseFocus(data);
    const mode=['ty','vy','third'].includes(addressMode)?addressMode:'ty';
    const lang=window.DiagnostikaI18n?.language||'ru';if(localeTemplates[lang])return formatLocalized(focus,mode,lang);
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