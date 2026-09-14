'use strict';

(() => {
  const NativeMutationObserver = window.MutationObserver;
  if (!NativeMutationObserver || window.__diagnostikaObserverGuardInstalled) return;
  window.__diagnostikaObserverGuardInstalled = true;

  const FRAME_MS = 50;

  window.MutationObserver = class SafeMutationObserver {
    constructor(callback) {
      this._pending = [];
      this._timer = null;
      this._observer = new NativeMutationObserver((records, observer) => {
        if (records?.length) this._pending.push(...records);
        if (this._timer) return;
        this._timer = setTimeout(() => {
          this._timer = null;
          const batch = this._pending.splice(0);
          try {
            callback(batch, observer);
          } catch (err) {
            console.error('MutationObserver callback error:', err);
          }
        }, FRAME_MS);
      });
    }
    observe(...args) { return this._observer.observe(...args); }
    disconnect() {
      if (this._timer) clearTimeout(this._timer);
      this._timer = null;
      this._pending.length = 0;
      return this._observer.disconnect();
    }
    takeRecords() {
      const native = this._observer.takeRecords();
      if (native?.length) this._pending.push(...native);
      return this._pending.splice(0);
    }
  };
})();
