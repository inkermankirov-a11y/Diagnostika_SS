'use strict';

(() => {
  const button = document.getElementById('testFillBtn');
  const host = String(location.hostname || '').toLowerCase();
  const enabled = host === 'localhost' || host === '127.0.0.1' || host === '::1';

  if (!enabled) {
    button?.remove();
    window.DiagnostikaDevTools = Object.freeze({ enabled: false, ready: Promise.resolve(false) });
    return;
  }

  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  window.DiagnostikaDevTools = Object.freeze({ enabled: true, ready });

  const script = document.createElement('script');
  script.src = 'test-data.js?v=20260921-hardening19a';
  script.async = false;
  script.dataset.diagnostikaDevTools = '1';
  script.onload = () => {
    if (button) button.hidden = false;
    resolveReady(true);
  };
  script.onerror = () => {
    button?.remove();
    rejectReady(new Error('dev-tools-load-failed'));
  };
  document.body.appendChild(script);
})();
