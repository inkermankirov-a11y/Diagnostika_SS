'use strict';

(() => {
  // Public boundary for entering diagnosis from the new UI. Legacy state changes stay encapsulated here.
  if (window.DiagnostikaDiagnosis?.open) return;

  function currentClient(){
    return typeof client === 'function' ? client() : null;
  }

  function showChooser(){
    const launch = document.querySelector('#diagnosisLaunchDialog');
    if (launch && !launch.open) launch.showModal();
  }

  function open(){
    const c = currentClient();
    if (!c) {
      if (window.AppDialog?.alert) window.AppDialog.alert('Сначала выберите клиента.','Диагностика');
      else window.alert('Сначала выберите клиента.');
      return false;
    }

    if (typeof mode !== 'undefined' && mode === 'diagnosis') {
      showChooser();
      return true;
    }

    const r = window.DiagnostikaRequests?.current?.(c) || null;
    if (!r) {
      showChooser();
      return false;
    }

    requestId = r.id;
    situationId = r.situations?.[0]?.id || null;
    selected = null;
    mode = 'diagnosis';
    c.lastDiagnosisRequestId = r.id;

    if (typeof save === 'function') save();
    if (typeof renderRequests === 'function') renderRequests();
    if (typeof renderMode === 'function') renderMode();
    return true;
  }

  window.DiagnostikaDiagnosis = Object.freeze({open});
})();
