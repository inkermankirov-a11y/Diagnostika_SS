'use strict';

(() => {
  const DATA = {
    ru: {
      title:'ВТОРИЧНЫЕ ЧУВСТВА',
      sub:'Отметь подходящие чувства. Для каждого укажи уровень и ответ клиента. Наведи на знак ? рядом с чувством — появится диагностический вопрос.',
      head:['ВЫБОР','ЧУВСТВО','УРОВЕНЬ','ОТВЕТ / УТОЧНЕНИЕ КЛИЕНТА'],
      answerPh:'Введите ответ / уточнение клиента',
      customPh:'Название чувства',
      add:'+ Своё чувство', cancel:'Отмена', save:'Сохранить выбранные',
      feelings:[
        ['Обида','К кому? Какой вы, когда это происходит? Есть ли вина или стыд?'],
        ['Злость','На кого? Какой вы, когда это происходит? Есть ли вина или стыд?'],
        ['Страх','Чего боитесь? Представьте, что это произошло. Какой вы себя чувствуете?'],
        ['Стыд','Страх осуждения. Кто осуждает? Какой вы себя чувствуете?'],
        ['Вина','Перед кем? Какой вы себя чувствуете, когда вас обвиняют? Обида на себя?'],
        ['Жалость к кому-либо','Каков этот человек в данный момент?'],
        ['Жалость к себе','Какой вы себя чувствуете, когда жалеете себя? Почему жалко себя?'],
        ['Чувство долга','Что будет, если не сделаете того, что должны?'],
        ['Несправедливость','Какой вы себя чувствуете, когда жизнь или люди несправедливы?'],
        ['Разочарование','В ком? Какой вы себя чувствуете?'],
        ['Грусть','Каким вы себя чувствуете, когда грустите?'],
        ['Боль','Каким вы себя чувствуете, когда испытываете боль?']
      ]
    },
    en: {
      title:'SECONDARY FEELINGS',
      sub:'Select the relevant feelings. For each one, set the level and enter the client’s answer. Hover over the ? next to a feeling to see the diagnostic question.',
      head:['SELECT','FEELING','LEVEL','CLIENT ANSWER / CLARIFICATION'],
      answerPh:'Enter the client’s answer / clarification',
      customPh:'Feeling name',
      add:'+ Custom feeling', cancel:'Cancel', save:'Save selected',
      feelings:[
        ['Resentment','Toward whom? What do you feel you are like when this happens? Is there guilt or shame?'],
        ['Anger','At whom? What do you feel you are like when this happens? Is there guilt or shame?'],
        ['Fear','What are you afraid of? Imagine it has happened. What do you feel you are like?'],
        ['Shame','Fear of judgment. Who is judging you? What do you feel you are like?'],
        ['Guilt','Toward whom? What do you feel you are like when you are blamed? Resentment toward yourself?'],
        ['Pity for someone','What is this person like at this moment?'],
        ['Self-pity','What do you feel you are like when you pity yourself? Why do you feel sorry for yourself?'],
        ['Sense of duty','What will happen if you do not do what you believe you must do?'],
        ['Injustice','What do you feel you are like when life or other people are unfair?'],
        ['Disappointment','In whom? What do you feel you are like?'],
        ['Sadness','What do you feel you are like when you are sad?'],
        ['Pain','What do you feel you are like when you experience pain?']
      ]
    },
    fr: {
      title:'ÉMOTIONS SECONDAIRES',
      sub:'Sélectionnez les émotions pertinentes. Pour chacune, indiquez le niveau et la réponse du client. Survolez le ? à côté d’une émotion pour afficher la question diagnostique.',
      head:['SÉLECTION','ÉMOTION','NIVEAU','RÉPONSE / PRÉCISION DU CLIENT'],
      answerPh:'Saisir la réponse / précision du client',
      customPh:'Nom de l’émotion',
      add:'+ Émotion personnalisée', cancel:'Annuler', save:'Enregistrer la sélection',
      feelings:[
        ['Ressentiment','Envers qui ? Comment vous sentez-vous être lorsque cela se produit ? Y a-t-il de la culpabilité ou de la honte ?'],
        ['Colère','Contre qui ? Comment vous sentez-vous être lorsque cela se produit ? Y a-t-il de la culpabilité ou de la honte ?'],
        ['Peur','De quoi avez-vous peur ? Imaginez que cela se soit produit. Comment vous sentez-vous être ?'],
        ['Honte','Peur du jugement. Qui vous juge ? Comment vous sentez-vous être ?'],
        ['Culpabilité','Envers qui ? Comment vous sentez-vous être lorsqu’on vous accuse ? Ressentiment envers vous-même ?'],
        ['Pitié pour quelqu’un','Comment est cette personne à ce moment-là ?'],
        ['Apitoiement sur soi','Comment vous sentez-vous être lorsque vous vous apitoyez sur vous-même ? Pourquoi avez-vous pitié de vous ?'],
        ['Sens du devoir','Que se passera-t-il si vous ne faites pas ce que vous pensez devoir faire ?'],
        ['Injustice','Comment vous sentez-vous être lorsque la vie ou les gens sont injustes ?'],
        ['Déception','En qui ? Comment vous sentez-vous être ?'],
        ['Tristesse','Comment vous sentez-vous être lorsque vous êtes triste ?'],
        ['Douleur','Comment vous sentez-vous être lorsque vous ressentez de la douleur ?']
      ]
    },
    de: {
      title:'SEKUNDÄRE GEFÜHLE',
      sub:'Wähle die passenden Gefühle aus. Gib für jedes Gefühl die Intensität und die Antwort des Klienten an. Fahre mit der Maus über das ? neben einem Gefühl, um die diagnostische Frage zu sehen.',
      head:['AUSWAHL','GEFÜHL','STUFE','ANTWORT / PRÄZISIERUNG DES KLIENTEN'],
      answerPh:'Antwort / Präzisierung des Klienten eingeben',
      customPh:'Name des Gefühls',
      add:'+ Eigenes Gefühl', cancel:'Abbrechen', save:'Auswahl speichern',
      feelings:[
        ['Gekränktheit','Gegen wen? Wie erleben Sie sich selbst, wenn das passiert? Gibt es Schuld oder Scham?'],
        ['Wut','Auf wen? Wie erleben Sie sich selbst, wenn das passiert? Gibt es Schuld oder Scham?'],
        ['Angst','Wovor haben Sie Angst? Stellen Sie sich vor, es ist passiert. Wie erleben Sie sich selbst?'],
        ['Scham','Angst vor Verurteilung. Wer verurteilt Sie? Wie erleben Sie sich selbst?'],
        ['Schuld','Wem gegenüber? Wie erleben Sie sich selbst, wenn man Ihnen Vorwürfe macht? Sind Sie sich selbst gegenüber gekränkt?'],
        ['Mitleid mit jemandem','Wie ist diese Person in diesem Moment?'],
        ['Selbstmitleid','Wie erleben Sie sich selbst, wenn Sie Mitleid mit sich haben? Warum tun Sie sich selbst leid?'],
        ['Pflichtgefühl','Was passiert, wenn Sie nicht tun, was Sie Ihrer Meinung nach tun müssen?'],
        ['Ungerechtigkeit','Wie erleben Sie sich selbst, wenn das Leben oder andere Menschen ungerecht sind?'],
        ['Enttäuschung','Von wem? Wie erleben Sie sich selbst?'],
        ['Traurigkeit','Wie erleben Sie sich selbst, wenn Sie traurig sind?'],
        ['Schmerz','Wie erleben Sie sich selbst, wenn Sie Schmerz empfinden?']
      ]
    },
    it: {
      title:'EMOZIONI SECONDARIE',
      sub:'Seleziona le emozioni pertinenti. Per ciascuna indica il livello e la risposta del cliente. Passa il mouse sul ? accanto a un’emozione per vedere la domanda diagnostica.',
      head:['SELEZIONE','EMOZIONE','LIVELLO','RISPOSTA / CHIARIMENTO DEL CLIENTE'],
      answerPh:'Inserisci la risposta / il chiarimento del cliente',
      customPh:'Nome dell’emozione',
      add:'+ Emozione personalizzata', cancel:'Annulla', save:'Salva selezionati',
      feelings:[
        ['Risentimento','Verso chi? Come ti senti rispetto a te stesso quando succede? Ci sono senso di colpa o vergogna?'],
        ['Rabbia','Verso chi? Come ti senti rispetto a te stesso quando succede? Ci sono senso di colpa o vergogna?'],
        ['Paura','Di cosa hai paura? Immagina che sia successo. Come ti senti rispetto a te stesso?'],
        ['Vergogna','Paura del giudizio. Chi ti giudica? Come ti senti rispetto a te stesso?'],
        ['Senso di colpa','Verso chi? Come ti senti rispetto a te stesso quando vieni accusato? Risentimento verso te stesso?'],
        ['Pietà per qualcuno','Com’è questa persona in questo momento?'],
        ['Autocommiserazione','Come ti senti rispetto a te stesso quando provi pietà per te? Perché ti dispiace per te stesso?'],
        ['Senso del dovere','Cosa succederà se non fai ciò che ritieni di dover fare?'],
        ['Ingiustizia','Come ti senti rispetto a te stesso quando la vita o le persone sono ingiuste?'],
        ['Delusione','Verso chi? Come ti senti rispetto a te stesso?'],
        ['Tristezza','Come ti senti rispetto a te stesso quando sei triste?'],
        ['Dolore','Come ti senti rispetto a te stesso quando provi dolore?']
      ]
    }
  };

  function lang(){
    const l=window.DiagnostikaI18n?.language || localStorage.getItem('diagnostika-ui-language') || 'en';
    return DATA[l] ? l : 'en';
  }

  function apply(){
    const dialog=document.querySelector('.feeling-builder-dialog');
    if(!dialog) return;
    const d=DATA[lang()];

    const title=dialog.querySelector('.feeling-builder-title');
    const sub=dialog.querySelector('.feeling-builder-sub');
    if(title) title.textContent=d.title;
    if(sub) sub.textContent=d.sub;

    const heads=[...dialog.querySelectorAll('.feeling-list-head > div')];
    d.head.forEach((text,i)=>{if(heads[i]) heads[i].textContent=text;});

    const rows=[...dialog.querySelectorAll('.feeling-select-row')];
    rows.forEach((row,i)=>{
      const answer=row.querySelector('.feeling-answer');
      if(answer) answer.placeholder=d.answerPh;
      const custom=row.querySelector('.feeling-custom-name');
      if(custom){custom.placeholder=d.customPh;return;}
      if(i>=d.feelings.length) return;
      const [name,question]=d.feelings[i];
      const nameEl=row.querySelector('.feeling-name');
      const help=row.querySelector('.feeling-question-help');
      if(nameEl) nameEl.textContent=name;
      if(help){
        help.dataset.question=question;
        help.setAttribute('aria-label',question);
        help.title=question;
      }
    });

    const add=dialog.querySelector('.feeling-add-custom');
    const cancel=dialog.querySelector('.feeling-builder-cancel');
    const save=dialog.querySelector('.feeling-builder-save');
    if(add) add.textContent=d.add;
    if(cancel) cancel.textContent=d.cancel;
    if(save) save.textContent=d.save;
  }

  document.addEventListener('click',e=>{
    if(e.target.closest('.language-option')) setTimeout(apply,0);
    if(e.target.closest('#addFeelingBtn,.feeling-editor-inline button')) setTimeout(apply,0);
  },true);

  const observer=new MutationObserver(()=>{
    if(document.querySelector('.feeling-builder-dialog')) requestAnimationFrame(apply);
  });
  observer.observe(document.body,{childList:true,subtree:true});

  if(window.DiagnostikaI18n?.setLanguage){
    const original=window.DiagnostikaI18n.setLanguage.bind(window.DiagnostikaI18n);
    window.DiagnostikaI18n.setLanguage=(l)=>{original(l);setTimeout(apply,0);};
  }

  apply();
})();
