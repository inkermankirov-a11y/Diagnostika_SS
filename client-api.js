'use strict';

(() => {
  if (window.DiagnostikaClients?.moduleAware === true) return;

  const EVENT_NAMES = Object.freeze({
    created: 'client:created',
    selected: 'client:selected',
    updated: 'client:updated',
    deleted: 'client:deleted',
    restored: 'client:restored',
    purged: 'client:purged'
  });
  const PIN_LIMIT = 10;

  function apiAllowed() {
    const registry = window.DiagnostikaPlatform?.api;
    return !registry || registry.allowed('clients') !== false;
  }

  function service() {
    if (!apiAllowed()) return null;
    return window.DiagnostikaPlatform?.clients
      || window.DiagnostikaPlatform?.services?.clients
      || null;
  }

  function call(method, fallback, ...args) {
    const fn = service()?.[method];
    return typeof fn === 'function' ? fn(...args) : fallback;
  }

  function list() { return call('list', []); }
  function current() { return call('current', null); }
  function currentId() { return call('currentId', null); }
  function findById(id) { return call('findById', null, id); }
  function select(id, options = {}) { return call('select', false, id, options); }
  function create(data = {}, options = {}) { return call('create', null, data, options); }
  function update(id, changes = {}, options = {}) { return call('update', null, id, changes, options); }
  function trashList() { return call('trashList', []); }
  function findDeletedById(id) { return call('findDeletedById', null, id); }
  function remove(id, options = {}) { return call('remove', null, id, options); }
  function restore(id, options = {}) { return call('restore', null, id, options); }
  function purge(id, options = {}) { return call('purge', false, id, options); }
  function pinnedIds() { return call('pinnedIds', []); }
  function isPinned(id) { return call('isPinned', false, id); }
  function pin(id, options = {}) {
    return call('pin', Object.freeze({ ok: false, reason: 'service-unavailable', limit: PIN_LIMIT }), id, options);
  }
  function unpin(id, options = {}) {
    return call('unpin', Object.freeze({ ok: false, reason: 'service-unavailable', limit: PIN_LIMIT }), id, options);
  }

  // Temporary UI-shell bridge. Client data/state mutation stays inside ClientService.
  function openDatabase() {
    if (!apiAllowed()) return false;
    const open = window.openDatabase;
    if (typeof open !== 'function') return false;
    open();
    return true;
  }

  const api = Object.freeze({
    version: '2B2',
    moduleAware: true,
    events: service()?.events || EVENT_NAMES,
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
    purge,
    pinLimit: PIN_LIMIT,
    pinnedIds,
    isPinned,
    pin,
    unpin,
    openDatabase
  });

  window.DiagnostikaClients = api;

  // Old dialog button remains in markup, but creation now always goes through ClientService.
  const addButton = document.querySelector('#dialogAddClientBtn');
  if (addButton) {
    addButton.onclick = () => {
      const created = create({}, { source: 'client-database-create' });
      if (!created) return;
      const dialog = document.querySelector('#clientDialog');
      if (dialog?.open) dialog.close();
    };
  }
})();
