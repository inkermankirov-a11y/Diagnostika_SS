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

    const roles = Array.isArray(definition.roles)
      ? [...new Set(definition.roles.map(String).map(x => x.trim()).filter(Boolean))]
      : [];

    return {
      id,
      roles,
      init: definition.init,
      destroy: typeof definition.destroy === 'function' ? definition.destroy : async () => {},
      status: 'registered',
      instance: null,
      desired: false,
      lastError: null
    };
  }

  function currentRole() {
    return platform.access?.currentRole?.() || 'specialist';
  }

  function allowed(record, role = currentRole()) {
    if (!record) return false;
    if (platform.access?.moduleAllowed) return platform.access.moduleAllowed(record.roles, role);
    if (!record.roles.length) return true;
    return record.roles.includes(role);
  }

  function accessError(record, role = currentRole()) {
    const error = new Error(`Role ${role} cannot access module: ${record.id}`);
    error.name = 'DiagnostikaAccessDeniedError';
    error.role = role;
    error.moduleId = record.id;
    return error;
  }

  function register(definition) {
    const record = normalize(definition);
    if (registry.has(record.id)) throw new Error(`Module already registered: ${record.id}`);
    registry.set(record.id, record);
    platform.events?.emit('module:registered', {
      id: record.id,
      roles: [...record.roles],
      role: currentRole(),
      allowed: allowed(record)
    });
    return record.id;
  }

  async function start(id, context = {}) {
    const record = registry.get(id);
    if (!record) throw new Error(`Unknown module: ${id}`);

    record.desired = context.desired !== false;

    const role = currentRole();
    if (!allowed(record, role)) {
      record.status = 'blocked';
      record.lastError = accessError(record, role);
      platform.events?.emit('module:access-denied', {
        id: record.id,
        role,
        roles: [...record.roles],
        source: context.source || 'module-start'
      });
      throw record.lastError;
    }

    if (record.status === 'started') return record.instance;
    if (record.status === 'starting') return record.instance;

    record.status = 'starting';
    record.lastError = null;
    try {
      record.instance = await record.init({ platform, ...context, role });
      record.status = 'started';
      platform.events?.emit('module:started', { id, role });
      return record.instance;
    } catch (error) {
      record.status = 'error';
      record.lastError = error;
      platform.events?.emit('module:error', { id, role, error });
      throw error;
    }
  }

  async function stop(id, context = {}) {
    const record = registry.get(id);
    if (!record) return false;

    if (context.preserveDesired !== true) record.desired = false;

    if (!['started', 'error', 'starting'].includes(record.status)) {
      if (record.status === 'blocked' && context.preserveDesired !== true) record.status = 'stopped';
      return false;
    }

    try {
      await record.destroy({ platform, instance: record.instance, ...context });
    } finally {
      record.instance = null;
      record.status = 'stopped';
      platform.events?.emit('module:stopped', {
        id,
        role: currentRole(),
        reason: context.reason || 'manual'
      });
    }
    return true;
  }

  async function reconcileAccess(role = currentRole(), context = {}) {
    const results = [];
    const expectedRevision = context.revision;

    const superseded = () => {
      if (currentRole() !== role) return true;
      if (expectedRevision === undefined || expectedRevision === null) return false;
      return platform.access?.roleRevision?.() !== expectedRevision;
    };

    for (const record of registry.values()) {
      if (superseded()) break;
      const isAllowed = allowed(record, role);

      if (!isAllowed) {
        if (['started', 'starting', 'error'].includes(record.status)) {
          await stop(record.id, {
            preserveDesired: true,
            reason: 'role-change',
            source: context.source || 'access-reconcile'
          });
        }
        if (record.desired) record.status = 'blocked';
        results.push({ id: record.id, allowed: false, status: record.status });
        continue;
      }

      if (record.desired && ['blocked', 'stopped', 'registered'].includes(record.status)) {
        if (superseded()) break;
        try {
          await start(record.id, {
            desired: true,
            source: context.source || 'access-reconcile'
          });
        } catch (error) {
          results.push({ id: record.id, allowed: true, status: record.status, error });
          continue;
        }
      }

      results.push({ id: record.id, allowed: true, status: record.status });
    }

    platform.events?.emit('module:access-reconciled', {
      role,
      source: context.source || 'access-reconcile',
      results: results.map(x => ({ id: x.id, allowed: x.allowed, status: x.status }))
    });

    return results;
  }

  function get(id) {
    const record = registry.get(id);
    if (!record) return null;
    return Object.freeze({
      id: record.id,
      roles: [...record.roles],
      status: record.status,
      instance: record.instance,
      desired: record.desired,
      allowed: allowed(record),
      lastError: record.lastError || null
    });
  }

  function list() {
    return [...registry.values()].map(record => Object.freeze({
      id: record.id,
      roles: [...record.roles],
      status: record.status,
      desired: record.desired,
      allowed: allowed(record)
    }));
  }

  platform.modules = Object.freeze({
    version: '11D',
    register,
    start,
    stop,
    reconcileAccess,
    get,
    list
  });
})();