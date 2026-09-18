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
    restored: 'client:restored',
    purged: 'client:purged'
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

  function stateRef() {
    try {
      return typeof state !== 'undefined' && state && typeof state === 'object' ? state : null;
    } catch (_) {
      return null;
    }
  }

  function ensureTrashState(options = {}) {
    const root = stateRef();
    if (!root) return null;

    let changed = false;
    if (!Array.isArray(root.deletedClients)) {
      root.deletedClients = [];
      changed = true;
    }
    if (!Array.isArray(root.deletedClientTombstones)) {
      root.deletedClientTombstones = [];
      changed = true;
    }

    const blocked = new Set(root.deletedClientTombstones.filter(Boolean).map(String));
    const activeIds = new Set(list().map(item => item?.id).filter(Boolean).map(String));
    const filtered = root.deletedClients.filter(item => {
      if (!item?.id) return false;
      const key = String(item.id);
      return !blocked.has(key) && !activeIds.has(key);
    });

    if (filtered.length !== root.deletedClients.length) {
      root.deletedClients = filtered;
      changed = true;
    }

    if (changed && options.persist !== false) persist();
    return {
      root,
      deletedClients: root.deletedClients,
      tombstones: root.deletedClientTombstones
    };
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

  function trashList() {
    const trash = ensureTrashState();
    if (!trash) return [];
    return clone(trash.deletedClients) || [];
  }

  function findDeletedById(id) {
    if (id === undefined || id === null || id === '') return null;
    return trashList().find(item => item && String(item.id) === String(id)) || null;
  }

  function remove(id, options = {}) {
    const clients = list();
    const index = clients.findIndex(item => item && String(item.id) === String(id));
    if (index < 0) return null;

    const trash = ensureTrashState({ persist: false });
    if (!trash) return null;

    const activeBefore = clone(clients) || [];
    const deletedBefore = clone(trash.deletedClients) || [];
    const tombstonesBefore = [...trash.tombstones];
    const previousClientId = currentId();
    let previousRequestId = null;
    let previousSituationId = null;
    let previousSelected = null;
    let previousMode = null;

    try {
      previousRequestId = typeof requestId !== 'undefined' ? requestId : null;
      previousSituationId = typeof situationId !== 'undefined' ? situationId : null;
      previousSelected = typeof selected !== 'undefined' ? selected : null;
      previousMode = typeof mode !== 'undefined' ? mode : null;
    } catch (_) {}

    const target = clients[index];
    const archived = clone(target) || {};
    archived.deletedAt = new Date().toISOString();

    trash.root.deletedClients = trash.deletedClients.filter(item => item && String(item.id) !== String(id));
    trash.root.deletedClients.push(archived);
    trash.root.deletedClientTombstones = trash.tombstones.filter(item => String(item) !== String(id));
    clients.splice(index, 1);

    let replacementCreated = false;
    let selectionChanged = false;

    if (!clients.length) {
      const replacement = freshClient();
      clients.push(replacement);
      try { clientId = replacement.id; } catch (_) {}
      replacementCreated = true;
      selectionChanged = String(previousClientId ?? '') !== String(replacement.id);
    } else {
      const currentStillExists = clients.some(item => item && String(item.id) === String(previousClientId));
      if (!currentStillExists) {
        const replacement = clients[Math.min(index, clients.length - 1)];
        try { clientId = replacement?.id ?? null; } catch (_) {}
        selectionChanged = String(previousClientId ?? '') !== String(replacement?.id ?? '');
      }
    }

    if (selectionChanged) {
      try {
        requestId = null;
        situationId = null;
        selected = null;
        mode = 'card';
      } catch (_) {}
    }

    if (!persist()) {
      clients.splice(0, clients.length, ...activeBefore);
      trash.root.deletedClients = deletedBefore;
      trash.root.deletedClientTombstones = tombstonesBefore;
      try {
        clientId = previousClientId;
        requestId = previousRequestId;
        situationId = previousSituationId;
        selected = previousSelected;
        mode = previousMode;
      } catch (_) {}
      return null;
    }

    if (options.render !== false) render();

    const selectedClientId = currentId();
    emit(EVENTS.deleted, {
      clientId: target.id,
      selectedClientId,
      replacementCreated,
      source: options.source || 'client-service'
    });

    if (selectionChanged && selectedClientId) {
      emit(EVENTS.selected, {
        clientId: selectedClientId,
        previousClientId: previousClientId ?? null,
        reason: 'client-deleted',
        source: options.source || 'client-service'
      });
    }

    return Object.freeze({
      clientId: target.id,
      selectedClientId,
      replacementCreated
    });
  }

  function restore(id, options = {}) {
    const trash = ensureTrashState({ persist: false });
    if (!trash) return null;

    const index = trash.deletedClients.findIndex(item => item && String(item.id) === String(id));
    if (index < 0) return null;
    if (trash.tombstones.some(item => String(item) === String(id))) return null;
    if (findById(id)) return null;

    const clients = list();
    const restored = clone(trash.deletedClients[index]) || {};
    delete restored.deletedAt;

    trash.deletedClients.splice(index, 1);
    trash.root.deletedClientTombstones = trash.tombstones.filter(item => String(item) !== String(id));
    clients.push(restored);

    if (!persist()) {
      clients.pop();
      trash.deletedClients.splice(index, 0, { ...restored, deletedAt: new Date().toISOString() });
      return null;
    }

    emit(EVENTS.restored, {
      clientId: restored.id,
      source: options.source || 'client-service'
    });

    if (options.select === true) {
      select(restored.id, {
        source: options.selectSource || options.source || 'client-service-restore',
        render: options.render
      });
    } else if (options.render !== false) {
      render();
    }

    return restored;
  }

  function purge(id, options = {}) {
    const trash = ensureTrashState({ persist: false });
    if (!trash) return false;

    const index = trash.deletedClients.findIndex(item => item && String(item.id) === String(id));
    if (index < 0) return false;

    const removed = trash.deletedClients[index];
    trash.deletedClients.splice(index, 1);
    if (!trash.tombstones.some(item => String(item) === String(id))) {
      trash.root.deletedClientTombstones.push(id);
    }

    if (!persist()) {
      trash.deletedClients.splice(index, 0, removed);
      trash.root.deletedClientTombstones = trash.root.deletedClientTombstones.filter(item => String(item) !== String(id));
      return false;
    }

    emit(EVENTS.purged, {
      clientId: id,
      source: options.source || 'client-service'
    });

    return true;
  }

  services.clients = Object.freeze({
    events: EVENTS,
    list,
    current,
    currentId,
    findById,
    select,
    create,
    update,
    trashList,
    findDeletedById,
    remove,
    restore,
    purge
  });
})();
