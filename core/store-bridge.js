'use strict';

(() => {
  const platform = window.DiagnostikaPlatform;
  if (!platform || platform.store) return;

  function stateRef() {
    try {
      return typeof state !== 'undefined' ? state : null;
    } catch (_) {
      return null;
    }
  }

  function clients() {
    const currentState = stateRef();
    return Array.isArray(currentState?.clients) ? currentState.clients : [];
  }

  function currentClient() {
    try {
      const viaApi = window.DiagnostikaClients?.current?.();
      if (viaApi) return viaApi;
    } catch (_) {}
    try {
      return typeof client === 'function' ? client() : null;
    } catch (_) {
      return null;
    }
  }

  function currentClientId() {
    try {
      const viaApi = window.DiagnostikaClients?.currentId?.();
      if (viaApi !== undefined && viaApi !== null) return viaApi;
    } catch (_) {}
    try {
      return typeof clientId !== 'undefined' ? clientId : null;
    } catch (_) {
      return null;
    }
  }

  function persist(options = {}) {
    const currentState = stateRef();
    if (!currentState) return false;

    try {
      const db = platform.db || window.DiagnostikaDB;
      if (!db?.writeState) {
        console.error('[DiagnostikaPlatform] database persistence unavailable');
        return false;
      }
      return db.writeState(currentState, {
        source: options.source || 'store-persist'
      }) === true;
    } catch (error) {
      console.error('[DiagnostikaPlatform] database persistence failed', error);
      return false;
    }
  }

  function legacySave(options = {}) {
    return persist({
      ...options,
      source: options.source || 'store-legacy-save'
    });
  }

  function snapshot() {
    const source = stateRef();
    if (!source) return null;
    try {
      if (typeof structuredClone === 'function') return structuredClone(source);
      return JSON.parse(JSON.stringify(source));
    } catch (_) {
      return null;
    }
  }

  platform.store = Object.freeze({ state: stateRef, clients, currentClient, currentClientId, persist, legacySave, snapshot });
})();
