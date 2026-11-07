'use strict';

(() => {
  if (window.DiagnostikaRequests?.moduleAware === true) return;

  const EVENT_NAMES = Object.freeze({
    created: 'request:created',
    selected: 'request:selected',
    updated: 'request:updated',
    activated: 'request:activated',
    completed: 'request:completed',
    resumed: 'request:resumed',
    deleted: 'request:deleted'
  });

  function apiAllowed() {
    const registry = window.DiagnostikaPlatform?.api;
    return !registry || registry.allowed('requests') !== false;
  }

  function service() {
    if (!apiAllowed()) return null;
    return window.DiagnostikaPlatform?.requests
      || window.DiagnostikaPlatform?.services?.requests
      || null;
  }

  function call(method, fallback, ...args) {
    const fn = service()?.[method];
    return typeof fn === 'function' ? fn(...args) : fallback;
  }

  function list(clientRef) { return call('list', [], clientRef); }
  function get(id, clientRef) { return call('get', null, id, clientRef); }
  function current(clientRef) { return call('current', null, clientRef); }
  function currentId(clientRef) { return call('currentId', null, clientRef); }
  function active(clientRef) { return call('active', null, clientRef); }
  function activeId(clientRef) { return call('activeId', null, clientRef); }
  function viewed(clientRef) { return call('viewed', null, clientRef); }
  function viewedId(clientRef) { return call('viewedId', null, clientRef); }
  function view(id, options = {}) { return call('view', false, id, options); }
  function activate(id, options = {}) { return call('activate', false, id, options); }
  function select(id, options = {}) { return activate(id, options); }
  function create(data = {}, options = {}) { return call('create', null, data, options); }
  function update(id, changes = {}, options = {}) { return call('update', null, id, changes, options); }
  function complete(id, options = {}) { return call('complete', null, id, options); }
  function resume(id, options = {}) { return call('resume', null, id, options); }
  function remove(id, options = {}) { return call('remove', null, id, options); }
  function requestNumber(clientRef, requestRef) { return call('requestNumber', 0, clientRef, requestRef); }
  function refresh() { return call('refresh', false); }

  window.DiagnostikaRequests=Object.freeze({
    version:'3A',
    moduleAware:true,
    events: service()?.events || EVENT_NAMES,
    list,
    get,
    current,
    currentId,
    active,
    activeId,
    viewed,
    viewedId,
    view,
    select,
    activate,
    create,
    update,
    complete,
    resume,
    remove,
    requestNumber,
    refresh
  });
})();
