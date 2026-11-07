'use strict';

(() => {
  const platform = window.DiagnostikaPlatform;
  if (!platform || platform.runtime) return;

  const VERSION = '15A';
  const REQUIRED_MODULES = Object.freeze([
    'clients','requests','diagnosis','sessions','files','export','calendar','payments','ai'
  ]);
  const REQUIRED_APIS = Object.freeze([
    'clients','requests','diagnosis','sessions','files','export','calendar','payments','ai','roles'
  ]);
  const REQUIRED_SERVICES = Object.freeze([
    'clients','requests','diagnosis','sessions','files','export','calendar','payments','ai'
  ]);
  const EXPECTED_VERSIONS = Object.freeze({
    db: '14D',
    api: '13D',
    access: '11D',
    modules: '11D'
  });

  let lastReport = null;

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  function buildId() {
    return document.querySelector('meta[name="diagnostika-build"]')?.content || null;
  }

  function moduleState(id) {
    const record = platform.modules?.get?.(id);
    if (!record) return Object.freeze({ id, status: 'missing', allowed: false, ready: false });
    const ready = record.allowed === false
      ? record.status === 'blocked'
      : record.status === 'started';
    return Object.freeze({
      id,
      status: record.status,
      allowed: record.allowed !== false,
      desired: record.desired === true,
      ready
    });
  }

  function apiState(id) {
    const health = platform.api?.health?.(id);
    if (!health) return Object.freeze({ id, status: 'missing', ready: false });
    return Object.freeze({
      id,
      status: health.status,
      ready: health.ready === true || health.status === 'blocked',
      version: health.version || null,
      missingMethods: Object.freeze([...(health.missingMethods || [])])
    });
  }

  function inspect() {
    const issues = [];
    const role = platform.access?.currentRole?.() || null;
    const modules = REQUIRED_MODULES.map(moduleState);
    const apis = REQUIRED_APIS.map(apiState);
    const services = REQUIRED_SERVICES.map(id => Object.freeze({
      id,
      ready: Boolean(platform.services?.[id])
    }));

    const versions = Object.freeze({
      core: platform.version || null,
      db: platform.db?.version || null,
      api: platform.api?.version || null,
      access: platform.access?.version || null,
      modules: platform.modules?.version || null
    });

    if (platform.status !== 'ready') issues.push(`core-status:${platform.status || 'missing'}`);
    if (versions.db !== EXPECTED_VERSIONS.db) issues.push(`db-version:${versions.db || 'missing'}`);
    if (versions.api !== EXPECTED_VERSIONS.api) issues.push(`api-version:${versions.api || 'missing'}`);
    if (versions.access !== EXPECTED_VERSIONS.access) issues.push(`access-version:${versions.access || 'missing'}`);
    if (versions.modules !== EXPECTED_VERSIONS.modules) issues.push(`modules-version:${versions.modules || 'missing'}`);
    if (platform.db?.health?.().ready !== true) issues.push('db-unavailable');

    for (const row of services) if (!row.ready) issues.push(`service:${row.id}`);
    for (const row of modules) if (!row.ready) issues.push(`module:${row.id}:${row.status}`);
    for (const row of apis) if (!row.ready) issues.push(`api:${row.id}:${row.status}`);

    const apiSummary = platform.api?.ready?.() || null;
    if (!apiSummary?.ready) issues.push('api-registry-unhealthy');

    const report = Object.freeze({
      version: VERSION,
      status: issues.length ? 'unhealthy' : 'ready',
      ready: issues.length === 0,
      checkedAt: new Date().toISOString(),
      build: buildId(),
      role,
      versions,
      db: platform.db?.health?.() || null,
      apiSummary,
      modules: Object.freeze(modules),
      apis: Object.freeze(apis),
      services: Object.freeze(services),
      issues: Object.freeze(issues)
    });

    lastReport = report;
    return report;
  }

  async function settle(timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    try { await platform.ready; } catch (_) {}
    try { await window.DiagnostikaRoles?.settled?.(); } catch (_) {}

    while (Date.now() < deadline) {
      const report = inspect();
      if (report.ready) return report;
      await delay(50);
    }
    return inspect();
  }

  async function refresh(options = {}) {
    const report = await settle(Number(options.timeoutMs) || 10000);
    platform.events?.emit(report.ready ? 'runtime:ready' : 'runtime:unhealthy', {
      version: VERSION,
      role: report.role,
      build: report.build,
      issues: [...report.issues],
      source: options.source || 'runtime-refresh'
    });
    return report;
  }

  const runtime = Object.freeze({
    version: VERSION,
    requiredModules: REQUIRED_MODULES,
    requiredApis: REQUIRED_APIS,
    requiredServices: REQUIRED_SERVICES,
    expectedVersions: EXPECTED_VERSIONS,
    inspect,
    health: () => lastReport || inspect(),
    refresh,
    ready: refresh({ source: 'runtime-bootstrap' })
  });

  platform.runtime = runtime;
  window.DiagnostikaRuntime = runtime;
})();
