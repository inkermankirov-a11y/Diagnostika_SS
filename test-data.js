'use strict';

(function(){
  const btn=document.getElementById('testFillBtn');
  if(!btn)return;

  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const n=(min,max)=>Math.floor(Math.random()*(max-min+1))+min;

  const names=['Анна Петрова','Мария Соколова','Елена Морозова','Ирина Волкова','Ольга Новикова','Алексей Смирнов','Михаил Орлов','Дмитрий Лебедев','Сергей Кузнецов','Андрей Попов'];
  const cities=['Киров','Москва','Казань','Санкт-Петербург','Нижний Новгород','Пермь','Самара','Екатеринбург','Тула','Ярославль'];
  const requests=['Страх проявляться и говорить о себе','Проблемы в отношениях и страх отвержения','Тревога из-за денег и будущего','Сложно отстаивать свои границы','Чувство собственной незначимости','Страх ошибок и критики'];
  const situations=['Нужно высказать своё мнение','Партнёр долго не отвечает','Надо позвонить новому клиенту','Кто-то критикует мою работу','Нужно попросить о помощи','Мне отказывают','Надо назвать цену за свою работу','Человек становится холоднее','Нужно выступить перед людьми'];
  const beliefs1=['Я недостаточно хорош','Со мной что-то не так','Я не имею права ошибаться','Меня не услышат','Я никому не нужен','Я слабый','Я хуже других','Меня отвергнут'];
  const feelings=['Страх','Стыд','Обида','Злость','Одиночество','Беспомощность','Вина','Разочарование'];
  const beliefs2=['Я незначимый','Я бесполезный','Я неудобный','Я один','Я недостойный любви','Я беззащитный','Я никому не важен','Я не справлюсь'];
  const instinctNames=['Бей / атаковать','Беги / убежать','Замри / спрятаться'];
  const results=['Спокойно говорить о своих потребностях и не бояться реакции','Сохранять уверенность, даже если другой человек недоволен','Спокойно действовать и не избегать контакта','Чувствовать свою ценность независимо от чужой оценки','Свободно проявляться и выдерживать возможный отказ'];

  function instinct(){return{id:uid(),name:pick(instinctNames),level:n(5,10),comment:'Тестовый инстинкт'}}
  function deep(){return{id:uid(),text:pick(beliefs2),level:n(6,10),comment:'Тестовое глубинное убеждение',instincts:[instinct()]}}
  function feeling(){return{id:uid(),text:pick(feelings),level:n(4,9),comment:'Тестовое вторичное чувство',deep:[deep(),deep()]}}
  function belief(){return{id:uid(),text:pick(beliefs1),level:n(5,10),comment:'Тестовое убеждение',feelings:[feeling(),feeling()]}}
  function situationObj(){return{id:uid(),name:pick(situations),level:n(5,10),comment:'Тестовая ситуация',result:pick(results),beliefs:[belief(),belief()]}}

  btn.onclick=()=>{
    const c=client();
    if(!c)return alert('Сначала выберите клиента.');

    const hasData=(c.name&&c.name!=='Новый клиент')||c.city||c.requests?.length||c.sessions?.length;
    if(hasData&&!confirm('ТЕСТ перезапишет данные текущего клиента и его диагностику. Продолжить?'))return;

    c.name=pick(names);
    c.city=pick(cities);
    c.age=n(24,52);
    c.birth='';
    c.vk='https://vk.com/test';
    c.telegram='https://t.me/test';
    c.max='https://max.ru/';
    c.photoData='';

    c.requests=[];
    const reqCount=n(1,2);
    for(let i=0;i<reqCount;i++){
      const r={id:uid(),title:pick(requests),situations:[]};
      const sitCount=n(2,3);
      for(let j=0;j<sitCount;j++)r.situations.push(situationObj());
      c.requests.push(r);
    }

    c.sessions=[
      {id:uid(),date:today(),requestId:c.requests[0]?.id||'',notes:'Тестовая сессия: первичная диагностика, выявление ключевых ситуаций и убеждений.'},
      {id:uid(),date:today(),requestId:c.requests[0]?.id||'',notes:'Тестовая сессия: работа с эмоциональной реакцией и глубинным убеждением.'}
    ];

    requestId=c.requests[0]?.id||null;
    situationId=c.requests[0]?.situations?.[0]?.id||null;
    selected=null;
    save();
    renderClient();
    mode='diagnosis';
    renderMode();
    alert('Тестовые данные заполнены.');
  };
})();
