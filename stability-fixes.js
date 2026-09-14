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

  // Компактный режим анкет: без перетаскивания и кнопок смены порядка.
  // Загружается отдельным модулем, чтобы не трогать данные самих анкет.
  if (!document.querySelector('script[data-questionnaire-compact-lock]')) {
    const questionnaireCompact = document.createElement('script');
    questionnaireCompact.src = 'questionnaire-compact-lock.js?v=20260914-1';
    questionnaireCompact.dataset.questionnaireCompactLock = '1';
    document.body.appendChild(questionnaireCompact);
  }
})();
