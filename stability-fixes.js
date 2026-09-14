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

  // Берём build из адреса страницы: так новые вспомогательные модули
  // не застревают в браузерном кеше при проверке новой сборки.
  let pageBuild='';
  try{pageBuild=new URL(location.href).searchParams.get('build')||'';}catch(_){ }
  const moduleVersion=encodeURIComponent(pageBuild||'20260914-live');

  // Компактный режим анкет: без перетаскивания и кнопок смены порядка.
  if (!document.querySelector('script[data-questionnaire-compact-lock]')) {
    const questionnaireCompact = document.createElement('script');
    questionnaireCompact.src = `questionnaire-compact-lock.js?v=${moduleVersion}`;
    questionnaireCompact.dataset.questionnaireCompactLock = '1';
    document.body.appendChild(questionnaireCompact);
  }

  // Улучшения AI-чата: разворачивание в крупную область экрана и
  // прокрутка к началу нового ответа, а не к его концу.
  if (!document.querySelector('script[data-client-ai-chat-view]')) {
    const aiChatView = document.createElement('script');
    aiChatView.src = `client-ai-chat-view.js?v=${moduleVersion}`;
    aiChatView.dataset.clientAiChatView = '1';
    aiChatView.onerror=()=>console.error('Не удалось загрузить client-ai-chat-view.js');
    document.body.appendChild(aiChatView);
  }
})();
