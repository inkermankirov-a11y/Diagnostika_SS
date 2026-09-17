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
    specialist: ['specialist:*', 'shared:*'],
    client: ['client:*', 'shared:*'],
    admin: ['*']
  });

  let runtimeRole = roles.specialist;

  function currentRole() {
    return runtimeRole;
  }

  function setRuntimeRole(role) {
    if (!Object.values(roles).includes(role)) throw new Error(`Unknown role: ${role}`);
    const previous = runtimeRole;
    runtimeRole = role;
    if (previous !== role) platform.events?.emit('access:role-changed', { previous, role });
    return runtimeRole;
  }

  function matches(grant, permission) {
    if (grant === '*') return true;
    if (grant === permission) return true;
    if (grant.endsWith(':*')) return permission.startsWith(grant.slice(0, -1));
    return false;
  }

  function can(permission, role = currentRole()) {
    const requested = String(permission || '').trim();
    if (!requested) return false;
    const roleGrants = grants[role] || [];
    return roleGrants.some(grant => matches(grant, requested));
  }

  platform.access = Object.freeze({ roles, currentRole, setRuntimeRole, can });
})();
