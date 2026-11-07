'use strict';

(() => {
  // Тестовый вход Яндекс Формы проверяется напрямую через /webhook-test/ в n8n.
  // Сайт оставляем без дополнительного DOM-наблюдателя, чтобы исключить зависания.
  window.__formIntegrationsTestModeReady = true;
})();
