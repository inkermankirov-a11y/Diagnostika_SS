'use strict';

(() => {
  const platform = window.DiagnostikaPlatform;
  if (!platform || platform.events) return;

  const listeners = new Map();

  function on(type, handler) {
    if (typeof type !== 'string' || !type.trim()) throw new TypeError('Event type is required.');
    if (typeof handler !== 'function') throw new TypeError('Event handler must be a function.');
    const key = type.trim();
    const bucket = listeners.get(key) || new Set();
    bucket.add(handler);
    listeners.set(key, bucket);
    return () => off(key, handler);
  }

  function once(type, handler) {
    let unsubscribe = null;
    const wrapped = detail => {
      unsubscribe?.();
      handler(detail);
    };
    unsubscribe = on(type, wrapped);
    return unsubscribe;
  }

  function off(type, handler) {
    const bucket = listeners.get(type);
    if (!bucket) return false;
    const removed = bucket.delete(handler);
    if (!bucket.size) listeners.delete(type);
    return removed;
  }

  function emit(type, detail) {
    const bucket = listeners.get(type);
    if (!bucket?.size) return 0;
    const handlers = [...bucket];
    for (const handler of handlers) {
      try {
        handler(detail);
      } catch (error) {
        console.error(`[DiagnostikaPlatform] event handler failed: ${type}`, error);
      }
    }
    return handlers.length;
  }

  platform.events = Object.freeze({ on, once, off, emit });
})();
