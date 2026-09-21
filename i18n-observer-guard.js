'use strict';

(() => {
  const NativeMutationObserver = window.MutationObserver;
  if (!NativeMutationObserver || window.__diagnostikaObserverGuardInstalled) return;
  window.__diagnostikaObserverGuardInstalled = true;

  const FRAME_MS = 50;
  const hubs = new Map();
  const stats = {
    sharedNativeObserversCreated: 0,
    sharedNativeCallbacks: 0,
    sharedRecords: 0,
    deliveredCallbacks: 0
  };

  function sharedKey(target, options = {}) {
    if (target !== document.body) return null;
    if (options.childList !== true || options.subtree !== true) return null;
    if (options.attributes || options.characterData) return null;
    return 'body:childList+subtree';
  }

  function ensureHub(key, target, options) {
    let hub = hubs.get(key);
    if (hub) return hub;

    hub = {
      subscribers: new Set(),
      observer: null
    };
    hub.observer = new NativeMutationObserver(records => {
      stats.sharedNativeCallbacks += 1;
      stats.sharedRecords += records?.length || 0;
      for (const subscriber of [...hub.subscribers]) subscriber._enqueue(records);
    });
    hub.observer.observe(target, options);
    hubs.set(key, hub);
    stats.sharedNativeObserversCreated += 1;
    return hub;
  }

  function releaseHub(key, subscriber) {
    const hub = hubs.get(key);
    if (!hub) return;
    hub.subscribers.delete(subscriber);
    if (!hub.subscribers.size) {
      hub.observer.disconnect();
      hubs.delete(key);
    }
  }

  class SafeMutationObserver {
    constructor(callback) {
      if (typeof callback !== 'function') throw new TypeError('MutationObserver callback must be a function');
      this._callback = callback;
      this._pending = [];
      this._timer = null;
      this._observer = null;
      this._sharedKey = null;
      this._registrations = [];
    }

    _enqueue(records) {
      if (records?.length) this._pending.push(...records);
      if (this._timer) return;
      this._timer = setTimeout(() => {
        this._timer = null;
        const batch = this._pending.splice(0);
        if (!batch.length) return;
        stats.deliveredCallbacks += 1;
        try {
          this._callback(batch, this);
        } catch (err) {
          console.error('MutationObserver callback error:', err);
        }
      }, FRAME_MS);
    }

    _ensureNative() {
      if (this._observer) return this._observer;
      this._observer = new NativeMutationObserver(records => this._enqueue(records));
      return this._observer;
    }

    _leaveShared() {
      if (!this._sharedKey) return;
      releaseHub(this._sharedKey, this);
      this._sharedKey = null;
    }

    observe(target, options = {}) {
      const existing = this._registrations.findIndex(row => row.target === target);
      const registration = { target, options: { ...options } };
      if (existing >= 0) this._registrations[existing] = registration;
      else this._registrations.push(registration);

      const key = this._registrations.length === 1 ? sharedKey(target, options) : null;
      if (key && !this._observer) {
        if (this._sharedKey && this._sharedKey !== key) this._leaveShared();
        const hub = ensureHub(key, target, options);
        hub.subscribers.add(this);
        this._sharedKey = key;
        return;
      }

      if (this._sharedKey) {
        this._leaveShared();
        const observer = this._ensureNative();
        for (const row of this._registrations) observer.observe(row.target, row.options);
        return;
      }

      this._ensureNative().observe(target, options);
    }

    disconnect() {
      if (this._timer) clearTimeout(this._timer);
      this._timer = null;
      this._pending.length = 0;
      this._registrations.length = 0;
      this._leaveShared();
      this._observer?.disconnect();
    }

    takeRecords() {
      if (this._sharedKey) {
        const hub = hubs.get(this._sharedKey);
        const fresh = hub?.observer?.takeRecords?.() || [];
        if (fresh.length) {
          for (const subscriber of [...(hub?.subscribers || [])]) {
            if (subscriber === this) subscriber._pending.push(...fresh);
            else subscriber._enqueue(fresh);
          }
        }
      } else {
        const native = this._observer?.takeRecords?.() || [];
        if (native.length) this._pending.push(...native);
      }
      return this._pending.splice(0);
    }
  }

  window.MutationObserver = SafeMutationObserver;
  window.DiagnostikaObserverGuard = Object.freeze({
    version: '19A',
    stats: () => Object.freeze({
      sharedHubs: hubs.size,
      sharedSubscribers: [...hubs.values()].reduce((sum, hub) => sum + hub.subscribers.size, 0),
      sharedNativeObserversCreated: stats.sharedNativeObserversCreated,
      sharedNativeCallbacks: stats.sharedNativeCallbacks,
      sharedRecords: stats.sharedRecords,
      deliveredCallbacks: stats.deliveredCallbacks
    })
  });
})();
