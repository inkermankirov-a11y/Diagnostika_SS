'use strict';

(() => {
  const KEY='diagnostika-ui-language';
  const LANGS={
    en:{flag:'🇬🇧',code:'EN',name:'English'},
    ru:{flag:'🇷🇺',code:'RU',name:'Русский'},
    fr:{flag:'🇫🇷',code:'FR',name:'Français'},
    de:{flag:'🇩🇪',code:'DE',name:'Deutsch'},
    it:{flag:'🇮🇹',code:'IT',name:'Italiano'}
  };

  const T={
    en:{
      'Психологическая диагностика':'Psychological Assessment','База клиентов':'Clients','Хранилище':'Storage','ТЕСТ':'TEST','Сохранить в историю':'Save to history','Сохранить TXT':'Save TXT','КЛИЕНТ':'CLIENT','Фото':'Photo','ФИО':'Full name','Город':'City','Возраст':'Age','Сохранить данные':'Save data','← Назад к карте прогресса':'← Back to progress map','РАБОТА С КЛИЕНТОМ':'CLIENT WORK','Карточка клиента':'Client card','Диагностика':'Assessment','ЗАПРОСЫ КЛИЕНТА':'CLIENT REQUESTS','+ Добавить запрос':'+ Add request','Удалить запрос':'Delete request','ОБЩИЙ ЗАПРОС':'MAIN REQUEST','СИТУАЦИИ':'SITUATIONS','+ Добавить':'+ Add','Изменить':'Edit','Удалить':'Delete','Подсказки — первичные убеждения':'Hints — Primary beliefs','КАРТА КЛИЕНТА':'CLIENT MAP','Выберите клиента':'Select a client','Последняя сессия: —':'Last session: —','Здесь будет история работы и прогресс клиента.':'Client work history and progress will appear here.','СЕССИИ':'SESSIONS','+ Добавить сессию':'+ Add session','Выберите ситуацию':'Select a situation','+ Первичное убеждение':'+ Primary belief','+ Вторичные чувства':'+ Secondary feelings','+ Вторичное убеждение':'+ Secondary belief','РЕДАКТОР':'EDITOR','Элемент не выбран':'No item selected','Уровень 1–10':'Level 1–10','Комментарий / уточнение':'Comment / clarification','Сохранить элемент':'Save item','Сохранить первичное убеждение':'Save primary belief','Сохранить вторичное чувство':'Save secondary feeling','Сохранить вторичное убеждение':'Save secondary belief','Сохранить инстинкт':'Save instinct','ИНСТИНКТЫ — только для вторичного убеждения':'INSTINCTS — for belief 2 only','+ Добавить инстинкт':'+ Add instinct','★ ЖЕЛАЕМЫЙ РЕЗУЛЬТАТ СИТУАЦИИ':'★ DESIRED SITUATION OUTCOME','Сохранить результат':'Save outcome','+ Новый клиент':'+ New client','Закрыть':'Close','Вторичные чувства':'Secondary feelings','Редактировать список':'Edit list','Первичные убеждения':'Primary beliefs','Вторичные убеждения':'Secondary beliefs','Подсказки':'Hints','Отмена':'Cancel','Сохранить выбранные':'Save selected','+ Своё чувство':'+ Custom feeling','Выбор':'Select','Чувство':'Feeling','Ответ / уточнение клиента':'Client answer / clarification','Первичное убеждение':'Primary belief','Вторичное чувство':'Secondary feeling','Вторичное убеждение':'Secondary belief','Инстинкт':'Instinct','Сессий пока нет.':'No sessions yet.'
    },
    fr:{
      'Психологическая диагностика':'Évaluation psychologique','База клиентов':'Clients','Хранилище':'Stockage','ТЕСТ':'TEST','Сохранить в историю':'Enregistrer dans l’historique','Сохранить TXT':'Enregistrer TXT','КЛИЕНТ':'CLIENT','Фото':'Photo','ФИО':'Nom complet','Город':'Ville','Возраст':'Âge','Сохранить данные':'Enregistrer','← Назад к карте прогресса':'← Retour à la progression','РАБОТА С КЛИЕНТОМ':'TRAVAIL AVEC LE CLIENT','Карточка клиента':'Fiche client','Диагностика':'Évaluation','ЗАПРОСЫ КЛИЕНТА':'DEMANDES DU CLIENT','+ Добавить запрос':'+ Ajouter une demande','Удалить запрос':'Supprimer la demande','ОБЩИЙ ЗАПРОС':'DEMANDE PRINCIPALE','СИТУАЦИИ':'SITUATIONS','+ Добавить':'+ Ajouter','Изменить':'Modifier','Удалить':'Supprimer','Подсказки — первичные убеждения':'Aides — Croyances primaires','КАРТА КЛИЕНТА':'CARTE CLIENT','Выберите клиента':'Sélectionnez un client','Последняя сессия: —':'Dernière séance : —','Здесь будет история работы и прогресс клиента.':'L’historique et la progression du client apparaîtront ici.','СЕССИИ':'SÉANCES','+ Добавить сессию':'+ Ajouter une séance','Выберите ситуацию':'Sélectionnez une situation','+ Первичное убеждение':'+ Croyance primaire','+ Вторичные чувства':'+ Émotions secondaires','+ Вторичное убеждение':'+ Croyance secondaire','РЕДАКТОР':'ÉDITEUR','Элемент не выбран':'Aucun élément sélectionné','Уровень 1–10':'Niveau 1–10','Комментарий / уточнение':'Commentaire / précision','Сохранить элемент':'Enregistrer','Сохранить первичное убеждение':'Enregistrer la croyance primaire','Сохранить вторичное чувство':'Enregistrer l’émotion secondaire','Сохранить вторичное убеждение':'Enregistrer la croyance secondaire','Сохранить инстинкт':'Enregistrer l’instinct','ИНСТИНКТЫ — только для вторичного убеждения':'INSTINCTS — uniquement pour croyance 2','+ Добавить инстинкт':'+ Ajouter un instinct','★ ЖЕЛАЕМЫЙ РЕЗУЛЬТАТ СИТУАЦИИ':'★ RÉSULTAT SOUHAITÉ','Сохранить результат':'Enregistrer le résultat','+ Новый клиент':'+ Nouveau client','Закрыть':'Fermer','Вторичные чувства':'Émotions secondaires','Редактировать список':'Modifier la liste','Первичные убеждения':'Croyances primaires','Вторичные убеждения':'Croyances secondaires','Подсказки':'Aides','Отмена':'Annuler','Сохранить выбранные':'Enregistrer la sélection','+ Своё чувство':'+ Émotion personnalisée','Выбор':'Sélection','Чувство':'Émotion','Ответ / уточнение клиента':'Réponse / précision du client','Первичное убеждение':'Croyance primaire','Вторичное чувство':'Émotion secondaire','Вторичное убеждение':'Croyance secondaire','Инстинкт':'Instinct','Сессий пока нет.':'Aucune séance.'
    },
    de:{
      'Психологическая диагностика':'Psychologische Diagnostik','База клиентов':'Klienten','Хранилище':'Speicher','ТЕСТ':'TEST','Сохранить в историю':'In Verlauf speichern','Сохранить TXT':'TXT speichern','КЛИЕНТ':'KLIENT','Фото':'Foto','ФИО':'Vollständiger Name','Город':'Stadt','Возраст':'Alter','Сохранить данные':'Daten speichern','← Назад к карте прогресса':'← Zurück zum Fortschritt','РАБОТА С КЛИЕНТОМ':'ARBEIT MIT DEM KLIENTEN','Карточка клиента':'Klientenkarte','Диагностика':'Diagnostik','ЗАПРОСЫ КЛИЕНТА':'ANLIEGEN DES KLIENTEN','+ Добавить запрос':'+ Anliegen hinzufügen','Удалить запрос':'Anliegen löschen','ОБЩИЙ ЗАПРОС':'HAUPTANLIEGEN','СИТУАЦИИ':'SITUATIONEN','+ Добавить':'+ Hinzufügen','Изменить':'Bearbeiten','Удалить':'Löschen','Подсказки — первичные убеждения':'Hinweise — Primäre Überzeugungen','КАРТА КЛИЕНТА':'KLIENTENKARTE','Выберите клиента':'Klient auswählen','Последняя сессия: —':'Letzte Sitzung: —','Здесь будет история работы и прогресс клиента.':'Hier erscheinen Verlauf und Fortschritt des Klienten.','СЕССИИ':'SITZUNGEN','+ Добавить сессию':'+ Sitzung hinzufügen','Выберите ситуацию':'Situation auswählen','+ Первичное убеждение':'+ Primäre Überzeugung','+ Вторичные чувства':'+ Sekundäre Gefühle','+ Вторичное убеждение':'+ Sekundäre Überzeugung','РЕДАКТОР':'EDITOR','Элемент не выбран':'Kein Element ausgewählt','Уровень 1–10':'Stufe 1–10','Комментарий / уточнение':'Kommentar / Präzisierung','Сохранить элемент':'Element speichern','Сохранить первичное убеждение':'Primäre Überzeugung speichern','Сохранить вторичное чувство':'Sekundäres Gefühl speichern','Сохранить вторичное убеждение':'Sekundäre Überzeugung speichern','Сохранить инстинкт':'Instinkt speichern','ИНСТИНКТЫ — только для вторичного убеждения':'INSTINKTE — nur für Sekundäre Überzeugung','+ Добавить инстинкт':'+ Instinkt hinzufügen','★ ЖЕЛАЕМЫЙ РЕЗУЛЬТАТ СИТУАЦИИ':'★ GEWÜNSCHTES ERGEBNIS','Сохранить результат':'Ergebnis speichern','+ Новый клиент':'+ Neuer Klient','Закрыть':'Schließen','Вторичные чувства':'Sekundäre Gefühle','Редактировать список':'Liste bearbeiten','Первичные убеждения':'Primäre Überzeugungen','Вторичные убеждения':'Sekundäre Überzeugungen','Подсказки':'Hinweise','Отмена':'Abbrechen','Сохранить выбранные':'Auswahl speichern','+ Своё чувство':'+ Eigenes Gefühl','Выбор':'Auswahl','Чувство':'Gefühl','Ответ / уточнение клиента':'Antwort / Präzisierung des Klienten','Первичное убеждение':'Primäre Überzeugung','Вторичное чувство':'Sekundäres Gefühl','Вторичное убеждение':'Sekundäre Überzeugung','Инстинкт':'Instinkt','Сессий пока нет.':'Noch keine Sitzungen.'
    },
    it:{
      'Психологическая диагностика':'Valutazione psicologica','База клиентов':'Clienti','Хранилище':'Archivio','ТЕСТ':'TEST','Сохранить в историю':'Salva nella cronologia','Сохранить TXT':'Salva TXT','КЛИЕНТ':'CLIENTE','Фото':'Foto','ФИО':'Nome completo','Город':'Città','Возраст':'Età','Сохранить данные':'Salva dati','← Назад к карте прогресса':'← Torna alla mappa dei progressi','РАБОТА С КЛИЕНТОМ':'LAVORO CON IL CLIENTE','Карточка клиента':'Scheda cliente','Диагностика':'Valutazione','ЗАПРОСЫ КЛИЕНТА':'RICHIESTE DEL CLIENTE','+ Добавить запрос':'+ Aggiungi richiesta','Удалить запрос':'Elimina richiesta','ОБЩИЙ ЗАПРОС':'RICHIESTA PRINCIPALE','СИТУАЦИИ':'SITUAZIONI','+ Добавить':'+ Aggiungi','Изменить':'Modifica','Удалить':'Elimina','Подсказки — первичные убеждения':'Suggerimenti — Convinzioni primarie','КАРТА КЛИЕНТА':'MAPPA CLIENTE','Выберите клиента':'Seleziona un cliente','Последняя сессия: —':'Ultima sessione: —','Здесь будет история работы и прогресс клиента.':'Qui appariranno la cronologia e i progressi del cliente.','СЕССИИ':'SESSIONI','+ Добавить сессию':'+ Aggiungi sessione','Выберите ситуацию':'Seleziona una situazione','+ Первичное убеждение':'+ Convinzione primaria','+ Вторичные чувства':'+ Emozioni secondarie','+ Вторичное убеждение':'+ Convinzione secondaria','РЕДАКТОР':'EDITOR','Элемент не выбран':'Nessun elemento selezionato','Уровень 1–10':'Livello 1–10','Комментарий / уточнение':'Commento / chiarimento','Сохранить элемент':'Salva elemento','Сохранить первичное убеждение':'Salva convinzione primaria','Сохранить вторичное чувство':'Salva emozione secondaria','Сохранить вторичное убеждение':'Salva convinzione secondaria','Сохранить инстинкт':'Salva istinto','ИНСТИНКТЫ — только для вторичного убеждения':'ISTINTI — solo per convinzione 2','+ Добавить инстинкт':'+ Aggiungi istinto','★ ЖЕЛАЕМЫЙ РЕЗУЛЬТАТ СИТУАЦИИ':'★ RISULTATO DESIDERATO','Сохранить результат':'Salva risultato','+ Новый клиент':'+ Nuovo cliente','Закрыть':'Chiudi','Вторичные чувства':'Emozioni secondarie','Редактировать список':'Modifica elenco','Первичные убеждения':'Convinzioni primarie','Вторичные убеждения':'Convinzioni secondarie','Подсказки':'Suggerimenti','Отмена':'Annulla','Сохранить выбранные':'Salva selezionati','+ Своё чувство':'+ Emozione personalizzata','Выбор':'Selezione','Чувство':'Emozione','Ответ / уточнение клиента':'Risposta / chiarimento del cliente','Первичное убеждение':'Convinzione primaria','Вторичное чувство':'Emozione secondaria','Вторичное убеждение':'Convinzione secondaria','Инстинкт':'Istinto','Сессий пока нет.':'Nessuna sessione.'
    }
  };

  let current=localStorage.getItem(KEY)||'en';
  if(!LANGS[current]) current='en';

  const sourceText=new WeakMap();
  const sourcePlaceholder=new WeakMap();
  const sourceTitle=new WeakMap();
  let translating=false;

  function tr(text){
    if(current==='ru') return text;
    return T[current]?.[text]||text;
  }

  function translateElement(el){
    if(!(el instanceof Element)) return;
    if(el.closest?.('.language-menu,.language-switcher')) return;

    for(const node of el.childNodes){
      if(node.nodeType!==Node.TEXT_NODE) continue;
      const raw=(sourceText.get(node)??node.nodeValue).trim();
      if(!raw || !Object.prototype.hasOwnProperty.call(T.en,raw)) continue;
      if(!sourceText.has(node)) sourceText.set(node,raw);
      const before=node.nodeValue;
      const leading=before.match(/^\s*/)?.[0]||'';
      const trailing=before.match(/\s*$/)?.[0]||'';
      node.nodeValue=leading+tr(raw)+trailing;
    }

    if(el.matches('input,textarea')){
      const ph=sourcePlaceholder.get(el)??el.getAttribute('placeholder');
      if(ph && Object.prototype.hasOwnProperty.call(T.en,ph)){
        if(!sourcePlaceholder.has(el)) sourcePlaceholder.set(el,ph);
        el.setAttribute('placeholder',tr(ph));
      }
    }
    const title=sourceTitle.get(el)??el.getAttribute('title');
    if(title && Object.prototype.hasOwnProperty.call(T.en,title)){
      if(!sourceTitle.has(el)) sourceTitle.set(el,title);
      el.setAttribute('title',tr(title));
    }

    el.querySelectorAll?.('*').forEach(child=>translateElement(child));
  }

  function applyLanguage(){
    translating=true;
    document.documentElement.lang=current;
    translateElement(document.body);
    updateButton();
    requestAnimationFrame(()=>{translating=false;});
  }

  const style=document.createElement('style');
  style.textContent=`
    .language-switcher{position:relative;display:flex;align-items:center}
    .language-btn{width:58px!important;min-width:58px!important;height:42px;padding:0!important;border:1px solid #3d4f66!important;border-radius:9px!important;background:linear-gradient(#5d7188,#405268)!important;color:#fff!important;font-weight:800!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:4px!important;box-shadow:0 3px 8px rgba(30,41,59,.22)!important}
    .language-btn:hover{transform:translateY(-1px)!important;filter:brightness(1.08)}
    .language-btn:active{transform:translateY(1px)!important}
    .language-menu{position:absolute;right:0;top:calc(100% + 7px);z-index:5000;width:175px;padding:6px;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 14px 35px rgba(15,23,42,.22);display:none}
    .language-menu.open{display:grid;gap:3px}
    .language-option{width:100%;border:0!important;border-radius:7px!important;background:#fff!important;color:#243447!important;padding:8px 9px!important;display:grid!important;grid-template-columns:26px 34px 1fr;align-items:center;text-align:left;cursor:pointer;box-shadow:none!important}
    .language-option:hover{background:#edf4ff!important;transform:none!important}
    .language-option.active{background:#e5efff!important;color:#2459a9!important;font-weight:700}
  `;
  document.head.appendChild(style);

  const wrap=document.createElement('div');
  wrap.className='language-switcher';
  wrap.innerHTML=`<button type="button" class="language-btn" aria-label="Language"></button><div class="language-menu"></div>`;
  const btn=wrap.querySelector('.language-btn');
  const menu=wrap.querySelector('.language-menu');

  Object.entries(LANGS).forEach(([key,meta])=>{
    const option=document.createElement('button');
    option.type='button'; option.className='language-option'; option.dataset.lang=key;
    option.innerHTML=`<span>${meta.flag}</span><strong>${meta.code}</strong><span>${meta.name}</span>`;
    option.onclick=()=>{
      current=key;localStorage.setItem(KEY,current);menu.classList.remove('open');applyLanguage();
    };
    menu.appendChild(option);
  });

  function updateButton(){
    const l=LANGS[current];btn.innerHTML=`<span>${l.flag}</span><span>${l.code}</span>`;
    menu.querySelectorAll('.language-option').forEach(x=>x.classList.toggle('active',x.dataset.lang===current));
  }

  btn.onclick=e=>{e.stopPropagation();menu.classList.toggle('open');};
  document.addEventListener('click',e=>{if(!wrap.contains(e.target))menu.classList.remove('open');});

  const exportBtn=document.querySelector('#exportTxtBtn');
  if(exportBtn?.parentElement) exportBtn.insertAdjacentElement('afterend',wrap);
  else document.querySelector('.header-buttons')?.appendChild(wrap);

  const observer=new MutationObserver(records=>{
    if(translating) return;
    translating=true;
    records.forEach(r=>r.addedNodes.forEach(n=>{
      if(n.nodeType===Node.ELEMENT_NODE) translateElement(n);
    }));
    requestAnimationFrame(()=>{translating=false;});
  });
  observer.observe(document.body,{childList:true,subtree:true});

  window.DiagnostikaI18n={get language(){return current;},setLanguage(lang){if(LANGS[lang]){current=lang;localStorage.setItem(KEY,lang);applyLanguage();}},translate:tr};
  applyLanguage();
})();
