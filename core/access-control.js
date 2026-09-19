'use strict';

(() => {
  const platform = window.DiagnostikaPlatform;
  if (!platform || platform.access) return;

  const roles = Object.freeze({
    specialist: 'specialist',
    client: 'client',
    admin: 'admin'
  });

  const grants = Object.freeze({
    specialist: Object.freeze(['specialist:*', 'shared:*']),
    client: Object.freeze(['client:*', 'shared:*']),
    admin: Object.freeze(['*'])
  });

  let runtimeRole = roles.specialist;
  let revision = 0;
  let reconcileQueue = Promise.resolve([]);

  function isKnownRole(role) {
    return Object.values(roles).includes(role);
  }

  function currentRole() {
    return runtimeRole;
  }

  function roleRevision() {
    return revision;
  }

  function matches(grant, permission) {
    if (grant === '*') return true;
    if (grant === permission) return true;
    if (grant.endsWith(':*')) return permission.startsWith(grant.slice(0, -1));
    return false;
  }

  function permissions(role = currentRole()) {
    return [...(grants[role] || [])];
  }

  function can(permission, role = currentRole()) {
    const requested = String(permission || '').trim();
    if (!requested || !isKnownRole(role)) return false;
    return (grants[role] || []).some(grant => matches(grant, requested));
  }

  function moduleAllowed(moduleRoles, role = currentRole()) {
    if (!isKnownRole(role)) return false;
    const allowed = Array.isArray(moduleRoles)
      ? moduleRoles.map(String).map(x => x.trim()).filter(Boolean)
      : [];
    if (!allowed.length) return true;
    return allowed.includes(role);
  }

  function requirePermission(permission, role = currentRole()) {
    if (can(permission, role)) return true;
    const error = new Error(`Access denied for permission: ${permission}`);
    error.name = 'DiagnostikaAccessDeniedError';
    error.role = role;
    error.permission = permission;
    throw error;
  }

  function requireModule(moduleId, moduleRoles, role = currentRole()) {
    if (moduleAllowed(moduleRoles, role)) return true;
    const error = new Error(`Role ${role} cannot access module: ${moduleId}`);
    error.name = 'DiagnostikaAccessDeniedError';
    error.role = role;
    error.moduleId = String(moduleId || '');
    throw error;
  }

  function setRuntimeRole(role, options = {}) {
    if (!isKnownRole(role)) throw new Error(`Unknown role: ${role}`);
    const previous = runtimeRole;
    if (previous === role) return runtimeRole;

    runtimeRole = role;
    revision += 1;

    const detail = Object.freeze({
      previous,
      role,
      revision,
      source: options.source || 'access-control'
    });

    platform.events?.emit('access:role-changed', detail);

    reconcileQueue = reconcileQueue
      .catch(() => [])
      .then(async () => {
        if (runtimeRole !== role || revision !== detail.revision) return [];
        const result = await platform.modules?.reconcileAccess?.(role, {
          source: detail.source,
          revision: detail.revision
        });
        if (runtimeRole === role && revision === detail.revision) {
          platform.events?.emit('access:role-settled', {
            role,
            revision: detail.revision,
            source: detail.source
          });
        }
        return result || [];
      })
      .catch(error => {
        console.error('[DiagnostikaPlatform] role reconciliation failed', error);
        platform.events?.emit('access:reconcile-error', {
          role,
          revision: detail.revision,
          error,
          source: detail.source
        });
        throw error;
      });

    return runtimeRole;
  }

  function whenSettled() {
    return reconcileQueue.catch(() => []);
  }

  platform.access = Object.freeze({
    version: '11D',
    roles,
    currentRole,
    roleRevision,
    whenSettled,
    isKnownRole,
    permissions,
    can,
    moduleAllowed,
    requirePermission,
    requireModule,
    setRuntimeRole
  });
})();