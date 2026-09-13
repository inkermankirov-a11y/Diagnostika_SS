'use strict';

(() => {
  // БК и карточка клиента теперь независимы.
  // Сохраняем совместимый API, чтобы старые обработчики не ломались.
  window.__fcClientCardSyncReady = true;
  window.DiagnostikaFreeConsultationSync = {
    syncCurrent(){ /* intentionally disabled */ }
  };
})();
