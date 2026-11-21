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
    ['modules', 'core/module-registry.js?v=20260919-roles11d'],
    ['store', 'core/store-bridge.js?v=20260919-db14d&cleanup=23c'],
    ['shell', 'core/shell-bridge.js?v=20260929-modular24a'],
    ['db', 'core/database.js?v=20260919-db14d'],
    ['access', 'core/access-control.js?v=20260919-roles11d'],
    ['api', 'core/api-registry.js?v=20260919-api13d'],
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

  // Fetch independent files in parallel, but keep the original execution order.
  // Skip already declared deferred scripts to avoid duplicate URL/version requests.
  function warmCoreParts() {
    for (const [name, src] of parts) {
      if (platform[name] || document.querySelector('script[data-diagnostika-core-part="'+name+'"]')) continue;
      const link = document.createElement('link');
      link.rel = 'preload'; link.as = 'script'; link.href = src;
      link.dataset.diagnostikaCorePreload = name;
      document.head.appendChild(link);
    }
  }

  async function boot() {
    warmCoreParts();
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