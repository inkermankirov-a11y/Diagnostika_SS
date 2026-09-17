'use strict';

(() => {
  const platform = window.DiagnostikaPlatform;
  if (!platform || platform.legacyEvents) return;

  const pending = [];
  const sessionSnapshots = new Map();

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

  function sessionsOf(client) {
    return Array.isArray(client?.sessions) ? client.sessions : [];
  }

  function sessionFingerprint(session) {
    try {
      return JSON.stringify(session);
    } catch (_) {
      return String(session?.id || '');
    }
  }

  function captureClientSessions(client) {
    if (!client?.id) return new Map();
    const snapshot = new Map();
    for (const session of sessionsOf(client)) {
      if (!session?.id) continue;
      snapshot.set(String(session.id), sessionFingerprint(session));
    }
    sessionSnapshots.set(String(client.id), snapshot);
    return snapshot;
  }

  function captureAllSessions() {
    let clients = [];
    try {
      clients = platform.store?.clients?.() || [];
    } catch (_) {}
    for (const client of clients) captureClientSessions(client);
  }

  function detectSessionChanges() {
    let client = null;
    try {
      client = platform.store?.currentClient?.() || null;
    } catch (_) {}
    if (!client?.id) return;

    const clientKey = String(client.id);
    const before = sessionSnapshots.get(clientKey) || new Map();
    const after = new Map();

    for (const session of sessionsOf(client)) {
      if (!session?.id) continue;
      const sessionKey = String(session.id);
      const fingerprint = sessionFingerprint(session);
      after.set(sessionKey, fingerprint);

      if (!before.has(sessionKey)) {
        dispatch('session:created', {
          clientId: client.id,
          sessionId: session.id,
          requestId: session.requestId || session.payment?.requestId || null,
          source: 'legacy-session-store'
        });
      } else if (before.get(sessionKey) !== fingerprint) {
        dispatch('session:updated', {
          clientId: client.id,
          sessionId: session.id,
          requestId: session.requestId || session.payment?.requestId || null,
          source: 'legacy-session-store'
        });
      }
    }

    sessionSnapshots.set(clientKey, after);
  }

  document.addEventListener('diagnostika:sessions-changed', detectSessionChanges);
  window.addEventListener('diagnostika:platform-core-ready', flush);

  const api = Object.freeze({
    emit: dispatch,
    flush,
    resyncSessions: captureAllSessions
  });

  platform.legacyEvents = api;
  window.DiagnostikaLegacyEvents = api;
  captureAllSessions();
})();
