import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e?.stack||e)));

await page.goto('http://127.0.0.1:8000/',{waitUntil:'load'});
await page.waitForFunction(()=>window.DiagnostikaFreeConsultationSync && window.DiagnostikaClientCard,{timeout:10000});

const result=await page.evaluate(()=>{
  const c=newClient();
  c.id='consult-sync-audit';
  c.name='Наталья Полонская';
  c.questionnaires=[{
    id:'q-audit',
    externalId:'submission-123',
    source:'manual',
    receivedAt:new Date().toISOString(),
    profile:{name:'Наталья Полонская'},
    answers:{'Вопрос':'Ответ'},
    raw:{submissionId:'submission-123'},
    isPrimary:true
  }];
  c.freeConsultation={
    pain:'Мне трудно спокойно говорить о своих потребностях',
    manifestations:'В отношениях и при сложных разговорах',
    impact:'Замолкаю и потом долго переживаю',
    tried:'Пыталась заранее готовить разговор и обсуждала с близкими',
    worked:'Помогает заранее записать главную мысль',
    didntHelp:'Попытка просто терпеть и ждать не помогла',
    desired:'Спокойно говорить о своих потребностях',
    whyNow:'Ситуация стала повторяться чаще',
    lifeAfter:'Стану увереннее обозначать свои границы',
    aiResult:{
      mainRequest:'Хочу спокойно говорить о своих потребностях и не замыкаться в сложном разговоре.',
      shortRequests:[{title:'Замыкаюсь в сложном разговоре',priority:100}],
      rationale:'Клиент прямо описывает замыкание во время сложных разговоров.',
      desiredResult:'Спокойно обозначать свои потребности и границы без последующего длительного переживания.',
      clarifyingQuestions:['В какой момент разговора становится труднее всего?'],
      situations:['Когда я начинаю сложный разговор с близким человеком']
    }
  };
  state.clients=[c];
  clientId=c.id;
  requestId=null;
  situationId=null;
  selected=null;
  save();
  renderClient();

  window.DiagnostikaFreeConsultationSync.repairQuestionnaireSources();
  window.DiagnostikaFreeConsultationSync.syncCurrent();

  const first={
    source:c.questionnaires[0].source,
    initialProblem:c.initialProblem,
    mainRequest:c.mainRequest,
    tried:c.tried,
    worked:c.worked,
    didntHelp:c.didntHelp,
    desiredOutcome:c.desiredOutcome,
    notes:c.clientNotes||''
  };

  c.mainRequest='РУЧНАЯ ПРАВКА СПЕЦИАЛИСТА';
  c.clientNotes=(c.clientNotes||'')+'\n\nМоя ручная заметка.';
  c.freeConsultation.aiResult={
    ...c.freeConsultation.aiResult,
    mainRequest:'НОВАЯ АВТОМАТИЧЕСКАЯ ФОРМУЛИРОВКА',
    rationale:'Обновлённое обоснование ИИ.'
  };
  window.DiagnostikaFreeConsultationSync.syncCurrent();

  const second={
    mainRequest:c.mainRequest,
    notes:c.clientNotes||'',
    autoBlocks:(String(c.clientNotes||'').match(/=== БЕСПЛАТНАЯ КОНСУЛЬТАЦИЯ \/ ИИ ===/g)||[]).length
  };
  return {first,second};
});

await page.evaluate(()=>window.DiagnostikaClientCard.openExisting());
await page.waitForSelector('#clientCardDialog[open] #ccWorked');
const cardWorked=await page.locator('#ccWorked').inputValue();

await page.locator('#ccFreeConsultBtn').click();
await page.waitForSelector('#freeConsultationDialog[open] .fc-worked');
const consultationWorked=await page.locator('.fc-worked').inputValue();

function assert(condition,message){if(!condition)throw new Error(message);}
assert(result.first.source==='yandex','Автоматическая анкета с externalId не была исправлена с manual на автоматический источник.');
assert(result.first.initialProblem==='Мне трудно спокойно говорить о своих потребностях','Исходный запрос не синхронизирован.');
assert(result.first.mainRequest.startsWith('Хочу спокойно говорить'),'Ключевой запрос не синхронизирован из ИИ.');
assert(result.first.tried.includes('заранее готовить'),'Предыдущие попытки не синхронизированы.');
assert(result.first.worked.includes('записать главную мысль'),'Что сработало не синхронизировано.');
assert(result.first.didntHelp.includes('терпеть'),'Что не сработало не синхронизировано.');
assert(result.first.desiredOutcome.includes('потребности и границы'),'Желаемый результат не синхронизирован.');
assert(result.first.notes.includes('Где проявляется'),'Рабочие заметки не получили дополнительный контекст.');
assert(result.first.notes.includes('Обоснование ИИ'),'Рабочие заметки не получили анализ ИИ.');
assert(result.second.mainRequest==='РУЧНАЯ ПРАВКА СПЕЦИАЛИСТА','Повторная синхронизация затёрла ручную правку.');
assert(result.second.notes.includes('Моя ручная заметка.'),'Повторная синхронизация затёрла ручную заметку.');
assert(result.second.notes.includes('Обновлённое обоснование ИИ.'),'Авто-блок заметок не обновился.');
assert(result.second.autoBlocks===1,'Авто-блок рабочих заметок задублировался.');
assert(cardWorked==='Помогает заранее записать главную мысль','Поле «Что сработало» отсутствует/не заполнено в карточке клиента.');
assert(consultationWorked==='Помогает заранее записать главную мысль','Поле «Что сработало» отсутствует/не заполнено в бесплатной консультации.');
assert(errors.length===0,`Ошибки страницы: ${errors.join(' | ')}`);

console.log('CONSULT_CARD_SYNC_AUDIT_SUCCESS');
await browser.close();
