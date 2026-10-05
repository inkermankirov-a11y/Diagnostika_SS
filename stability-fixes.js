'use strict';

(() => {
  function normalizeClientMap() {
    if (typeof renderSessions === 'function') renderSessions();
  }

  // Окно запуска диагностики: удаление запроса должно быть только
  // в списке «Предыдущие запросы», где пользователь видит выбранный запрос.
  const deleteFromLaunch = document.querySelector('#diagDeleteBtn');
  if (deleteFromLaunch) deleteFromLaunch.remove();

  // После подключения всех переопределений сразу перерисовываем карту клиента
  // финальной версией renderSessions. Поэтому открытие/сохранение карточки
  // больше не меняет внешний вид списка сессий.
  normalizeClientMap();

  const cardDialog = document.querySelector('#clientCardDialog');
  if (cardDialog) {
    cardDialog.addEventListener('close', normalizeClientMap);
  }

  // Берём build из адреса страницы: так динамический модуль чата
  // не застревает в браузерном кеше при проверке новой сборки.
  let pageBuild='';
  try{pageBuild=new URL(location.href).searchParams.get('build')||'';}catch(_){ }
  const moduleVersion=encodeURIComponent(pageBuild||'20260915-live');

  // client-ai-chat-view сейчас подключён из index.html. Оставляем этот
  // загрузчик только как fallback для старых/встраиваемых страниц и не создаём дубль.
  const clientAiChatViewPresent=[...document.scripts].some(script=>{
    const src=script.getAttribute('src')||'';
    return /(?:^|\/)client-ai-chat-view[.]js(?:[?#]|$)/.test(src);
  });
  if (!clientAiChatViewPresent) {
    const aiChatView = document.createElement('script');
    aiChatView.src = `client-ai-chat-view.js?v=${moduleVersion}`;
    aiChatView.dataset.clientAiChatView = '1';
    aiChatView.onerror=()=>console.error('Не удалось загрузить client-ai-chat-view.js');
    document.body.appendChild(aiChatView);
  }
})();
