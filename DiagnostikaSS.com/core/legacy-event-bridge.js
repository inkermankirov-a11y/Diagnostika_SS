'use strict';

(() => {
  const platform = window.DiagnostikaPlatform;
  if (!platform || platform.legacyEvents) return;

  const pending = [];

  function nowIso() {
    return new Date().toISOString();
  }

  function dispatch(type, detail = {}) {
    const eventType = String(type || '').trim();
    if (!eventType) return 0;
    const payload = Object.freeze({ ...detail, emittedAt: nowIso() });
    const bus = platform.events;
    if (bus?.emit) return bus.emit(eventType, payload);
    pending.push([eventType, payload]);
    return 0;
  }

  function flush() {
    const bus = platform.events;
    if (!bus?.emit) return 0;
    let count = 0;
    while (pending.length) {
      const [type, detail] = pending.shift();
      count += bus.emit(type, detail);
    }
    return count;
  }

  window.addEventListener('diagnostika:platform-core-ready', flush);

  const api = Object.freeze({
    emit: dispatch,
    flush
  });

  platform.legacyEvents = api;
  window.DiagnostikaLegacyEvents = api;
})();
