'use strict';

(() => {
  const NativeMutationObserver = window.MutationObserver;
  if (!NativeMutationObserver || window.__diagnostikaObserverGuardInstalled) return;
  window.__diagnostikaObserverGuardInstalled = true;

  window.MutationObserver = class SafeMutationObserver {
    constructor(callback) {
      let blockedUntil = 0;
      let scheduled = false;
      this._observer = new NativeMutationObserver((records, observer) => {
        const now = performance.now();
        if (now < blockedUntil || scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          const runAt = performance.now();
          if (runAt < blockedUntil) return;
          blockedUntil = runAt + 180;
          try {
            callback(records, observer);
          } catch (err) {
            console.error('MutationObserver callback error:', err);
          }
        });
      });
    }
    observe(...args) { return this._observer.observe(...args); }
    disconnect() { return this._observer.disconnect(); }
    takeRecords() { return this._observer.takeRecords(); }
  };
})();
