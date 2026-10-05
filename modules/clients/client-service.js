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
    purged: 'client:purged',
    archived: 'client:archived',
    unarchived: 'client:unarchived'
  });
  const PIN_LIMIT = 10;

  function list() {
    const clients = platform.store?.clients?.();
    return Array.isArray(clients) ? clients : [];
  }

  function currentId() {
    return platform.shell?.currentClientId?.() ?? null;
  }

  function stateRef() {
    return platform.store?.state?.() || null;
  }

  function pinnedIds() {
    const root = stateRef();
    if (!root) return [];
    const active = new Map(list().filter(item => item?.id != null).map(item => [String(item.id), item.id]));
    const raw = Array.isArray(root.pinnedClientIds) ? root.pinnedClientIds : [];
    const seen = new Set();
    const out = [];
    for (const value of raw) {
      const key = String(value);
      if (seen.has(key) || !active.has(key)) continue;
      seen.add(key);
      out.push(active.get(key));
      if (out.length >= PIN_LIMIT) break;
    }
    return out;
  }

  function isPinned(id) {
    if (id === undefined || id === null || id === '') return false;
    const key = String(id);
    return pinnedIds().some(value => String(value) === key);
  }

  function pin(id, options = {}) {
    const target = findById(id);
    const root = stateRef();
    if (!target || !root) return Object.freeze({ ok: false, reason: 'missing', limit: PIN_LIMIT });

    const current = pinnedIds();
    const key = String(target.id);
    const alreadyPinned = current.some(value => String(value) === key);
    if (!alreadyPinned && current.length >= PIN_LIMIT) {
      return Object.freeze({ ok: false, reason: 'limit', limit: PIN_LIMIT, pinnedIds: Object.freeze([...current]) });
    }

    const next = [target.id, ...current.filter(value => String(value) !== key)].slice(0, PIN_LIMIT);
    if (alreadyPinned && String(current[0] ?? '') === key) {
      return Object.freeze({ ok: true, changed: false, clientId: target.id, limit: PIN_LIMIT, pinnedIds: Object.freeze([...current]) });
    }

    const hadState = Array.isArray(root.pinnedClientIds);
    const before = hadState ? [...root.pinnedClientIds] : null;
    root.pinnedClientIds = next;

    if (!persist()) {
      if (hadState) root.pinnedClientIds = before;
      else delete root.pinnedClientIds;
      return Object.freeze({ ok: false, reason: 'persist', limit: PIN_LIMIT });
    }

    emit(EVENTS.updated, {
      clientId: target.id,
      fields: ['pinnedClientIds'],
      change: 'pinned',
      source: options.source || 'client-service-pin'
    });

    return Object.freeze({ ok: true, changed: true, clientId: target.id, limit: PIN_LIMIT, pinnedIds: Object.freeze([...next]) });
  }

  function unpin(id, options = {}) {
    const target = findById(id);
    const root = stateRef();
    if (!target || !root) return Object.freeze({ ok: false, reason: 'missing', limit: PIN_LIMIT });

    const current = pinnedIds();
    const key = String(target.id);
    if (!current.some(value => String(value) === key)) {
      return Object.freeze({ ok: true, changed: false, clientId: target.id, limit: PIN_LIMIT, pinnedIds: Object.freeze([...current]) });
    }

    const hadState = Array.isArray(root.pinnedClientIds);
    const before = hadState ? [...root.pinnedClientIds] : null;
    const next = current.filter(value => String(value) !== key);
    root.pinnedClientIds = next;

    if (!persist()) {
      if (hadState) root.pinnedClientIds = before;
      else delete root.pinnedClientIds;
      return Object.freeze({ ok: false, reason: 'persist', limit: PIN_LIMIT });
    }

    emit(EVENTS.updated, {
      clientId: target.id,
      fields: ['pinnedClientIds'],
      change: 'unpinned',
      source: options.source || 'client-service-unpin'
    });

    return Object.freeze({ ok: true, changed: true, clientId: target.id, limit: PIN_LIMIT, pinnedIds: Object.freeze([...next]) });
  }

  function ensureArchiveState(options = {}) {
    const root = stateRef();
    if (!root) return null;

    let changed = false;
    if (!Array.isArray(root.archivedClients)) {
      root.archivedClients = [];
      changed = true;
    }

    const archiveIds = new Set((root.archivedClients || []).map(item => item?.id).filter(Boolean).map(String));
    const activeIds = new Set(list().map(item => item?.id).filter(Boolean).map(String));
    const deletedIds = new Set((root.deletedClients || []).map(item => item?.id).filter(Boolean).map(String));
    const tombstones = new Set((root.deletedClientTombstones || []).filter(Boolean).map(String));
    const seen = new Set();
    const filtered = [];

    for (const item of root.archivedClients) {
      if (!item?.id) continue;
      const key = String(item.id);
      if (seen.has(key) || activeIds.has(key) || deletedIds.has(key) || tombstones.has(key)) {
        changed = true;
        continue;
      }
      seen.add(key);
      filtered.push(item);
    }

    if (filtered.length !== root.archivedClients.length) {
      root.archivedClients = filtered;
      changed = true;
    }

    if (changed && options.persist !== false) persist();
    return { root, archivedClients: root.archivedClients };
  }

  function archiveList() {
    const archive = ensureArchiveState();
    if (!archive) return [];
    return clone(archive.archivedClients) || [];
  }

  function findArchivedById(id) {
    if (id === undefined || id === null || id === '') return null;
    return archiveList().find(item => item && String(item.id) === String(id)) || null;
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
      return !blocked.has(key) && !activeIds.has(key) && !archiveIds.has(key);
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
    return findById(currentId());
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
      return platform.store?.persist?.({ source: 'client-service-persist' }) === true;
    } catch (error) {
      console.error('[DiagnostikaPlatform] client persistence failed', error);
      return false;
    }
  }

  function render() {
    return platform.shell?.renderClient?.() === true;
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
    const base = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2),
      name: 'Новый клиент',
      city: '',
      age: '',
      ageAuto: false,
      birth: '',
      birthTime: '',
      photoData: '',
      photoSourceData: '',
      photoCrop: { x: 50, y: 50, zoom: 1 },
      vk: '',
      telegram: '',
      max: '',
      sessions: [],
      requests: []
    };

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
    const requests = Array.isArray(target.requests) ? target.requests : [];
    const preferredRequestId = target.currentRequestId ?? target.lastDiagnosisRequestId ?? null;
    const preferredExists = preferredRequestId != null && requests.some(item => item && String(item.id) === String(preferredRequestId));
    const nextRequestId = preferredExists ? preferredRequestId : (requests[0]?.id ?? null);
    if (platform.shell?.selectClient?.(target.id, { requestId: nextRequestId }) !== true) {
      console.error('[DiagnostikaPlatform] client selection failed');
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
    if (findById(created.id) || findArchivedById(created.id)) return null;

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

  function archive(id, options = {}) {
    const clients = list();
    const index = clients.findIndex(item => item && String(item.id) === String(id));
    if (index < 0) return null;

    const archiveState = ensureArchiveState({ persist: false });
    if (!archiveState) return null;

    const activeBefore = clone(clients) || [];
    const archivedBefore = clone(archiveState.archivedClients) || [];
    const pinnedBefore = Array.isArray(archiveState.root.pinnedClientIds) ? [...archiveState.root.pinnedClientIds] : null;
    const previousClientId = currentId();
    const previousNavigation = platform.shell?.navigationSnapshot?.() || null;

    const target = clients[index];
    const stored = clone(target) || {};
    stored.archivedAt = new Date().toISOString();

    archiveState.root.archivedClients = archiveState.archivedClients.filter(item => item && String(item.id) !== String(id));
    archiveState.root.archivedClients.push(stored);
    if (Array.isArray(archiveState.root.pinnedClientIds)) {
      archiveState.root.pinnedClientIds = archiveState.root.pinnedClientIds.filter(value => String(value) !== String(id));
    }
    clients.splice(index, 1);

    let replacementCreated = false;
    let selectionChanged = false;

    if (!clients.length) {
      const replacement = freshClient();
      clients.push(replacement);
      if (platform.shell?.selectClient?.(replacement.id, { requestId: null, mode: 'card' }) !== true) {
        clients.splice(0, clients.length, ...activeBefore);
        archiveState.root.archivedClients = archivedBefore;
        if (pinnedBefore) archiveState.root.pinnedClientIds = pinnedBefore;
        platform.shell?.restoreNavigation?.(previousNavigation);
        return null;
      }
      replacementCreated = true;
      selectionChanged = String(previousClientId ?? '') !== String(replacement.id);
    } else {
      const currentStillExists = clients.some(item => item && String(item.id) === String(previousClientId));
      if (!currentStillExists) {
        const replacement = clients[Math.min(index, clients.length - 1)];
        if (platform.shell?.selectClient?.(replacement?.id ?? null, { requestId: null, mode: 'card' }) !== true) {
          clients.splice(0, clients.length, ...activeBefore);
          archiveState.root.archivedClients = archivedBefore;
          if (pinnedBefore) archiveState.root.pinnedClientIds = pinnedBefore;
          platform.shell?.restoreNavigation?.(previousNavigation);
          return null;
        }
        selectionChanged = String(previousClientId ?? '') !== String(replacement?.id ?? '');
      }
    }

    if (!persist()) {
      clients.splice(0, clients.length, ...activeBefore);
      archiveState.root.archivedClients = archivedBefore;
      if (pinnedBefore) archiveState.root.pinnedClientIds = pinnedBefore;
      else delete archiveState.root.pinnedClientIds;
      platform.shell?.restoreNavigation?.(previousNavigation);
      return null;
    }

    if (options.render !== false) render();

    const selectedClientId = currentId();
    emit(EVENTS.archived, {
      clientId: target.id,
      selectedClientId,
      replacementCreated,
      source: options.source || 'client-service-archive'
    });

    if (selectionChanged && selectedClientId) {
      emit(EVENTS.selected, {
        clientId: selectedClientId,
        previousClientId: previousClientId ?? null,
        reason: 'client-archived',
        source: options.source || 'client-service-archive'
      });
    }

    return Object.freeze({
      clientId: target.id,
      selectedClientId,
      replacementCreated
    });
  }

  function unarchive(id, options = {}) {
    const archiveState = ensureArchiveState({ persist: false });
    if (!archiveState) return null;

    const index = archiveState.archivedClients.findIndex(item => item && String(item.id) === String(id));
    if (index < 0 || findById(id)) return null;

    const clients = list();
    const stored = clone(archiveState.archivedClients[index]) || {};
    const restored = clone(stored) || {};
    delete restored.archivedAt;

    archiveState.archivedClients.splice(index, 1);
    clients.push(restored);

    if (!persist()) {
      clients.pop();
      archiveState.archivedClients.splice(index, 0, stored);
      return null;
    }

    emit(EVENTS.unarchived, {
      clientId: restored.id,
      source: options.source || 'client-service-unarchive'
    });

    if (options.select === true) {
      select(restored.id, {
        source: options.selectSource || options.source || 'client-service-unarchive',
        render: options.render
      });
    } else if (options.render !== false) {
      render();
    }

    return restored;
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
    const previousNavigation = platform.shell?.navigationSnapshot?.() || null;

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
      if (platform.shell?.selectClient?.(replacement.id, { requestId: null, mode: 'card' }) !== true) return null;
      replacementCreated = true;
      selectionChanged = String(previousClientId ?? '') !== String(replacement.id);
    } else {
      const currentStillExists = clients.some(item => item && String(item.id) === String(previousClientId));
      if (!currentStillExists) {
        const replacement = clients[Math.min(index, clients.length - 1)];
        if (platform.shell?.selectClient?.(replacement?.id ?? null, { requestId: null, mode: 'card' }) !== true) return null;
        selectionChanged = String(previousClientId ?? '') !== String(replacement?.id ?? '');
      }
    }

    if (!persist()) {
      clients.splice(0, clients.length, ...activeBefore);
      trash.root.deletedClients = deletedBefore;
      trash.root.deletedClientTombstones = tombstonesBefore;
      platform.shell?.restoreNavigation?.(previousNavigation);
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
    const archived = clone(trash.deletedClients[index]) || {};
    const restored = clone(archived) || {};
    delete restored.deletedAt;

    trash.deletedClients.splice(index, 1);
    trash.root.deletedClientTombstones = trash.tombstones.filter(item => String(item) !== String(id));
    clients.push(restored);

    if (!persist()) {
      clients.pop();
      trash.deletedClients.splice(index, 0, archived);
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
    archiveList,
    findArchivedById,
    archive,
    unarchive,
    trashList,
    findDeletedById,
    remove,
    restore,
    purge,
    pinLimit: PIN_LIMIT,
    pinnedIds,
    isPinned,
    pin,
    unpin
  });
})();
