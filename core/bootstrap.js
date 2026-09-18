'use strict';

(() => {
  if (window.DiagnostikaPlatform?.ready) return;

  const platform = window.DiagnostikaPlatform || {
    version: '0.2.0',
    status: 'loading',
    bootstrappedAt: null
  };
  window.DiagnostikaPlatform = platform;

  const parts = [
    ['events', 'core/event-bus.js?v=20260917-core02a'],
    ['modules', 'core/module-registry.js?v=20260917-core02a'],
    ['store', 'core/store-bridge.js?v=20260917-core02a'],
    ['access', 'core/access-control.js?v=20260917-core02a'],
    ['legacyEvents', 'core/legacy-event-bridge.js?v=20260918-sessions4c'],
    ['paymentEvents', 'core/payment-event-bridge.js?v=20260918-core02b']
  ];

  function loadPart(name, src) {
    if (platform[name]) return Promise.resolve();

    const selector = `script[data-diagnostika-core-part="${name}"]`;
    const existing = document.querySelector(selector);
    if (existing) {
      return new Promise((resolve, reject) => {
        if (platform[name]) return resolve();
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`CORE part failed: ${name}`)), { once: true });
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.diagnostikaCorePart = name;
      script.onload = () => {
        if (!platform[name]) return reject(new Error(`CORE part did not initialize: ${name}`));
        resolve();
      };
      script.onerror = () => reject(new Error(`CORE part failed to load: ${name}`));
      document.body.appendChild(script);
    });
  }

  async function boot() {
    for (const [name, src] of parts) await loadPart(name, src);
    platform.status = 'ready';
    platform.bootstrappedAt = Date.now();
    platform.events.emit('core:ready', { version: platform.version });
    window.dispatchEvent(new CustomEvent('diagnostika:platform-core-ready', {
      detail: { version: platform.version }
    }));
    return platform;
  }

  platform.ready = boot().catch(error => {
    platform.status = 'error';
    console.error('[DiagnostikaPlatform] CORE 0.2 failed to initialize', error);
    window.dispatchEvent(new CustomEvent('diagnostika:platform-core-error', { detail: { error } }));
    return platform;
  });
})();