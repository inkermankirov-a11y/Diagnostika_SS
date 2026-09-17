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

  function legacySave() {
    try {
      if (typeof save !== 'function') return false;
      save();
      return true;
    } catch (error) {
      console.error('[DiagnostikaPlatform] legacy save failed', error);
      return false;
    }
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

  platform.store = Object.freeze({ state: stateRef, clients, currentClient, currentClientId, legacySave, snapshot });
})();
