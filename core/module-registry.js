'use strict';

(() => {
  const platform = window.DiagnostikaPlatform;
  if (!platform || platform.modules) return;

  const registry = new Map();

  function normalize(definition) {
    if (!definition || typeof definition !== 'object') throw new TypeError('Module definition is required.');
    const id = String(definition.id || '').trim();
    if (!id) throw new TypeError('Module id is required.');
    if (typeof definition.init !== 'function') throw new TypeError(`Module ${id} must provide init().`);
    return {
      id,
      roles: Array.isArray(definition.roles) ? [...definition.roles] : [],
      init: definition.init,
      destroy: typeof definition.destroy === 'function' ? definition.destroy : async () => {},
      status: 'registered',
      instance: null
    };
  }

  function register(definition) {
    const record = normalize(definition);
    if (registry.has(record.id)) throw new Error(`Module already registered: ${record.id}`);
    registry.set(record.id, record);
    platform.events?.emit('module:registered', { id: record.id, roles: [...record.roles] });
    return record.id;
  }

  async function start(id, context = {}) {
    const record = registry.get(id);
    if (!record) throw new Error(`Unknown module: ${id}`);
    if (record.status === 'started') return record.instance;
    if (record.status === 'starting') return record.instance;

    record.status = 'starting';
    try {
      record.instance = await record.init({ platform, ...context });
      record.status = 'started';
      platform.events?.emit('module:started', { id });
      return record.instance;
    } catch (error) {
      record.status = 'error';
      platform.events?.emit('module:error', { id, error });
      throw error;
    }
  }

  async function stop(id, context = {}) {
    const record = registry.get(id);
    if (!record) return false;
    if (record.status !== 'started' && record.status !== 'error') return false;
    try {
      await record.destroy({ platform, instance: record.instance, ...context });
    } finally {
      record.instance = null;
      record.status = 'stopped';
      platform.events?.emit('module:stopped', { id });
    }
    return true;
  }

  function get(id) {
    const record = registry.get(id);
    if (!record) return null;
    return Object.freeze({ id: record.id, roles: [...record.roles], status: record.status, instance: record.instance });
  }

  function list() {
    return [...registry.values()].map(record => ({
      id: record.id,
      roles: [...record.roles],
      status: record.status
    }));
  }

  platform.modules = Object.freeze({ register, start, stop, get, list });
})();
