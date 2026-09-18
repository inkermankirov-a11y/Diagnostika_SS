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

  function persist() {
    try {
      if (typeof save === 'function') {
        save();
        return true;
      }
    } catch (error) {
      console.error('[DiagnostikaPlatform] client persistence failed', error);
    }
    return false;
  }

  function render() {
    try {
      if (typeof renderClient === 'function') renderClient();
      return true;
    } catch (error) {
      console.error('[DiagnostikaPlatform] client render failed', error);
      return false;
    }
  }

  function clone(value) {
    if (value === undefined) return undefined;
    try {
      if (typeof structuredClone === 'function') return structuredClone(value);
    } catch (_) {}
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }

  function freshClient(data = {}) {
    let base = null;
    try {
      if (typeof newClient === 'function') base = newClient();
    } catch (_) {}
    if (!base) {
      base = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2),
        name: 'Новый клиент',
        city: '',
        age: '',
        birth: '',
        photoData: '',
        vk: '',
        telegram: '',
        max: '',
        sessions: [],
        requests: []
      };
    }

    const incoming = clone(data) || {};
    const created = { ...base, ...incoming };
    if (!created.id) created.id = base.id;
    if (!created.name) created.name = 'Новый клиент';
    if (!Array.isArray(created.sessions)) created.sessions = [];
    if (!Array.isArray(created.requests)) created.requests = [];
    return created;
  }

  function select(id, options = {}) {
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

    if (options.render !== false && !render()) return false;

    if (String(previousClientId ?? '') !== String(target.id)) {
      emit(EVENTS.selected, {
        clientId: target.id,
        previousClientId: previousClientId ?? null,
        source: options.source || 'client-service'
      });
    }
    return true;
  }

  function create(data = {}, options = {}) {
    const created = freshClient(data);
    if (findById(created.id)) return null;

    const clients = list();
    if (!Array.isArray(clients)) return null;
    clients.push(created);

    if (!persist()) {
      const index = clients.indexOf(created);
      if (index >= 0) clients.splice(index, 1);
      return null;
    }

    emit(EVENTS.created, {
      clientId: created.id,
      source: options.source || 'client-service'
    });

    if (options.select !== false) {
      if (!select(created.id, {
        source: options.selectSource || options.source || 'client-service-create',
        render: options.render
      })) return null;
    } else if (options.render === true) {
      render();
    }

    return created;
  }

  function update(id, changes = {}, options = {}) {
    const target = findById(id);
    if (!target || !changes || typeof changes !== 'object') return null;

    const patch = clone(changes) || {};
    delete patch.id;
    Object.assign(target, patch);

    if (!persist()) return null;
    if (options.render !== false) render();

    emit(EVENTS.updated, {
      clientId: target.id,
      fields: Object.keys(patch),
      source: options.source || 'client-service'
    });

    return target;
  }

  services.clients = Object.freeze({
    events: EVENTS,
    list,
    current,
    currentId,
    findById,
    select,
    create,
    update
  });
})();
