'use strict';

(() => {
  const platform = window.DiagnostikaPlatform || {
    version: '0.2.0',
    status: 'preloading',
    bootstrappedAt: null
  };
  window.DiagnostikaPlatform = platform;
  if (platform.db) return;

  const VERSION = '14D';
  const BACKEND = 'localStorage';
  const STATE_KEY = 'diagnostika-web-v1';
  const SCHEMA_VERSION = 4;
  const EVENTS = Object.freeze({
    read: 'db:read',
    written: 'db:written',
    removed: 'db:removed',
    error: 'db:error'
  });

  function emit(type, detail = {}) {
    try {
      platform.events?.emit?.(type, Object.freeze({
        ...detail,
        source: detail.source || 'database-core',
        emittedAt: detail.emittedAt || new Date().toISOString()
      }));
    } catch (_) {}
  }

  function createLocalStorageBackend() {
    function storageRef() {
      try {
        return window.localStorage || null;
      } catch (_) {
        return null;
      }
    }

    function available() {
      const storage = storageRef();
      if (!storage) return false;
      const key = '__diagnostika_db_probe__';
      try {
        storage.setItem(key, '1');
        storage.removeItem(key);
        return true;
      } catch (_) {
        return false;
      }
    }

    function readRaw(key) {
      const storage = storageRef();
      if (!storage) return { ok: false, reason: 'storage-unavailable', value: null };
      try {
        return { ok: true, value: storage.getItem(key) };
      } catch (error) {
        return { ok: false, reason: 'read-failed', error, value: null };
      }
    }

    function writeRaw(key, raw) {
      const storage = storageRef();
      if (!storage) return { ok: false, reason: 'storage-unavailable' };
      try {
        storage.setItem(key, raw);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          reason: error?.name === 'QuotaExceededError' ? 'quota-exceeded' : 'write-failed',
          error
        };
      }
    }

    function removeRaw(key) {
      const storage = storageRef();
      if (!storage) return { ok: false, reason: 'storage-unavailable' };
      try {
        storage.removeItem(key);
        return { ok: true };
      } catch (error) {
        return { ok: false, reason: 'remove-failed', error };
      }
    }

    return Object.freeze({
      name: BACKEND,
      synchronous: true,
      available,
      readRaw,
      writeRaw,
      removeRaw
    });
  }

  const backend = createLocalStorageBackend();

  function available() {
    return backend.available();
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

  function validKey(key) {
    return typeof key === 'string' && key.trim().length > 0;
  }

  function read(key, fallback = null, options = {}) {
    if (!validKey(key)) return clone(fallback);

    const result = backend.readRaw(key);
    if (!result.ok) {
      emit(EVENTS.error, {
        operation: 'read',
        key,
        reason: result.reason,
        name: result.error?.name || undefined,
        source: options.source
      });
      return clone(fallback);
    }

    if (result.value === null) return clone(fallback);

    try {
      const value = JSON.parse(result.value);
      emit(EVENTS.read, { operation: 'read', key, source: options.source });
      return value;
    } catch (error) {
      emit(EVENTS.error, {
        operation: 'read',
        key,
        reason: 'invalid-json',
        name: error?.name || 'Error',
        source: options.source
      });
      return clone(fallback);
    }
  }

  function write(key, value, options = {}) {
    if (!validKey(key)) return false;

    let raw;
    try {
      raw = JSON.stringify(value);
    } catch (error) {
      emit(EVENTS.error, {
        operation: 'write',
        key,
        reason: 'serialize-failed',
        name: error?.name || 'Error',
        source: options.source
      });
      return false;
    }

    if (raw === undefined) {
      emit(EVENTS.error, {
        operation: 'write',
        key,
        reason: 'unsupported-value',
        source: options.source
      });
      return false;
    }

    const result = backend.writeRaw(key, raw);
    if (!result.ok) {
      emit(EVENTS.error, {
        operation: 'write',
        key,
        reason: result.reason,
        name: result.error?.name || undefined,
        source: options.source
      });
      return false;
    }

    emit(EVENTS.written, { operation: 'write', key, source: options.source });
    return true;
  }

  function remove(key, options = {}) {
    if (!validKey(key)) return false;

    const result = backend.removeRaw(key);
    if (!result.ok) {
      emit(EVENTS.error, {
        operation: 'remove',
        key,
        reason: result.reason,
        name: result.error?.name || undefined,
        source: options.source
      });
      return false;
    }

    emit(EVENTS.removed, { operation: 'remove', key, source: options.source });
    return true;
  }

  function validState(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.clients));
  }

  function readState(options = {}) {
    const value = read(STATE_KEY, null, {
      ...options,
      source: options.source || 'database-read-state'
    });
    if (value === null) return null;
    if (validState(value)) return value;

    emit(EVENTS.error, {
      operation: 'read-state',
      key: STATE_KEY,
      reason: 'invalid-state-shape',
      source: options.source || 'database-read-state'
    });
    return null;
  }

  function writeState(value, options = {}) {
    if (!validState(value)) {
      emit(EVENTS.error, {
        operation: 'write-state',
        key: STATE_KEY,
        reason: 'invalid-state-shape',
        source: options.source || 'database-write-state'
      });
      return false;
    }

    return write(STATE_KEY, value, {
      ...options,
      source: options.source || 'database-write-state'
    });
  }

  function health() {
    const ready = available();
    return Object.freeze({
      status: ready ? 'ready' : 'unavailable',
      ready,
      version: VERSION,
      backend: backend.name,
      backendSynchronous: backend.synchronous,
      stateKey: STATE_KEY,
      schemaVersion: SCHEMA_VERSION
    });
  }

  const db = Object.freeze({
    version: VERSION,
    backend: backend.name,
    stateKey: STATE_KEY,
    schemaVersion: SCHEMA_VERSION,
    events: EVENTS,
    available,
    read,
    write,
    remove,
    readState,
    writeState,
    validState,
    health
  });

  platform.db = db;
  window.DiagnostikaDB = db;
})();
