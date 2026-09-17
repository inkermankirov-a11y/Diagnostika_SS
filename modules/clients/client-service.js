'use strict';

(() => {
  const platform = window.DiagnostikaPlatform;
  if (!platform) return;

  const services = platform.services || {};
  if (!platform.services) platform.services = services;
  if (services.clients) return;

  const EVENTS = Object.freeze({
    created: 'client:created',
    selected: 'client:selected',
    updated: 'client:updated',
    deleted: 'client:deleted',
    restored: 'client:restored'
  });

  function list() {
    try {
      const clients = platform.store?.clients?.();
      if (Array.isArray(clients)) return clients;
    } catch (_) {}
    try {
      return typeof state !== 'undefined' && Array.isArray(state?.clients) ? state.clients : [];
    } catch (_) {
      return [];
    }
  }

  function currentId() {
    try {
      return typeof clientId !== 'undefined' ? clientId : null;
    } catch (_) {
      return null;
    }
  }

  function findById(id) {
    if (id === undefined || id === null || id === '') return null;
    return list().find(item => item && String(item.id) === String(id)) || null;
  }

  function current() {
    const byId = findById(currentId());
    if (byId) return byId;
    try {
      return typeof client === 'function' ? client() : null;
    } catch (_) {
      return null;
    }
  }

  function emit(type, detail = {}) {
    if (!platform.events?.emit) return 0;
    return platform.events.emit(type, Object.freeze({
      ...detail,
      source: detail.source || 'client-service',
      emittedAt: detail.emittedAt || new Date().toISOString()
    }));
  }

  function select(id) {
    const target = findById(id);
    if (!target) return false;

    const previousClientId = currentId();
    try {
      clientId = target.id;
      requestId = null;
      situationId = null;
      selected = null;
    } catch (error) {
      console.error('[DiagnostikaPlatform] client selection failed', error);
      return false;
    }

    try {
      if (typeof renderClient === 'function') renderClient();
    } catch (error) {
      console.error('[DiagnostikaPlatform] client render failed after selection', error);
      return false;
    }

    if (String(previousClientId ?? '') !== String(target.id)) {
      emit(EVENTS.selected, {
        clientId: target.id,
        previousClientId: previousClientId ?? null
      });
    }
    return true;
  }

  services.clients = Object.freeze({
    events: EVENTS,
    list,
    current,
    currentId,
    findById,
    select
  });
})();
