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
})();
