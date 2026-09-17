'use strict';

(() => {
  const platform = window.DiagnostikaPlatform;
  if (!platform || platform.paymentEvents) return;

  const EVENT_TYPES = Object.freeze([
    'payment:updated',
    'payment:added',
    'payment:deleted',
    'session-payment:updated'
  ]);
  const allowed = new Set(EVENT_TYPES);
  const pending = [];
  const num = value => {
    const parsed = Number(String(value ?? '').replace(/[\s\u00A0\u202F]/g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const clone = value => {
    try { return JSON.parse(JSON.stringify(value ?? null)); }
    catch (_) { return null; }
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function requestPaymentMeta(client, request) {
    const p = request?.payment && typeof request.payment === 'object' ? request.payment : {};
    return {
      mode: p.mode || '',
      total: num(p.total),
      currency: p.currency || client?.currency || 'RUB',
      sessionAmount: num(p.sessionAmount),
      sessionDiscount: num(p.sessionDiscount)
    };
  }

  function normalizePaymentRecord(payment) {
    return {
      id: payment?.id == null ? null : String(payment.id),
      date: payment?.date || '',
      amount: num(payment?.amount),
      note: payment?.note || '',
      receiptUrl: payment?.receiptUrl || '',
      sessionId: payment?.sessionId == null ? null : String(payment.sessionId),
      source: payment?.source || ''
    };
  }

  function normalizeSessionPayment(session) {
    const p = session?.payment && typeof session.payment === 'object' ? session.payment : {};
    return {
      paid: p.paid === true,
      amount: num(p.amount),
      receiptUrl: p.receiptUrl || '',
      note: p.note || '',
      paidAt: p.paidAt || '',
      sessionDate: p.sessionDate || '',
      requestId: p.requestId || session?.requestId || null,
      manualAmount: p.manualAmount === true,
      baseAmount: num(p.baseAmount),
      discountSnapshot: num(p.discountSnapshot)
    };
  }

  function currentClients() {
    try {
      if (typeof state !== 'undefined' && Array.isArray(state?.clients)) return state.clients;
    } catch (_) {}
    try {
      const clients = platform.store?.clients?.();
      if (Array.isArray(clients)) return clients;
    } catch (_) {}
    return [];
  }

  function capture() {
    const requests = new Map();
    const sessions = new Map();

    for (const client of currentClients()) {
      const clientId = client?.id == null ? null : String(client.id);
      if (!clientId) continue;

      for (const request of Array.isArray(client.requests) ? client.requests : []) {
        const requestId = request?.id == null ? null : String(request.id);
        if (!requestId) continue;
        const records = new Map();
        const payments = Array.isArray(request?.payment?.payments) ? request.payment.payments : [];
        payments.forEach((payment, index) => {
          const normalized = normalizePaymentRecord(payment);
          const key = normalized.id || `@${index}`;
          records.set(key, normalized);
        });
        requests.set(`${clientId}:${requestId}`, {
          clientId,
          requestId,
          meta: requestPaymentMeta(client, request),
          records
        });
      }

      for (const session of Array.isArray(client.sessions) ? client.sessions : []) {
        const sessionId = session?.id == null ? null : String(session.id);
        if (!sessionId) continue;
        sessions.set(`${clientId}:${sessionId}`, {
          clientId,
          sessionId,
          requestId: session?.requestId || session?.payment?.requestId || null,
          payment: normalizeSessionPayment(session)
        });
      }
    }

    return { requests, sessions };
  }

  function meaningfulSessionPayment(payment) {
    return !!(
      payment?.paid || num(payment?.amount) > 0 || payment?.receiptUrl || payment?.note ||
      payment?.paidAt || payment?.sessionDate || payment?.manualAmount || num(payment?.baseAmount) > 0
    );
  }

  function meaningfulRequestPayment(snapshot) {
    if (!snapshot) return false;
    const meta = snapshot.meta || {};
    return snapshot.records?.size > 0 || !!meta.mode || num(meta.total) > 0 ||
      num(meta.sessionAmount) > 0 || num(meta.sessionDiscount) > 0 || meta.currency !== 'RUB';
  }

  function deliver(type, detail = {}) {
    if (!allowed.has(type)) return 0;
    const payload = Object.freeze({ ...detail, source: detail.source || 'payment-persistence' });
    const legacy = window.DiagnostikaLegacyEvents;
    if (legacy?.emit) return legacy.emit(type, payload);
    const bus = platform.events;
    if (bus?.emit) {
      return bus.emit(type, Object.freeze({ ...payload, emittedAt: new Date().toISOString() }));
    }
    pending.push([type, payload]);
    return 0;
  }

  function flush() {
    if (!window.DiagnostikaLegacyEvents?.emit && !platform.events?.emit) return 0;
    let count = 0;
    const queued = pending.splice(0);
    for (const [type, detail] of queued) count += deliver(type, detail);
    return count;
  }

  function diffRequests(before, after, out) {
    const keys = new Set([...before.keys(), ...after.keys()]);
    for (const key of keys) {
      const prev = before.get(key);
      const next = after.get(key);

      if (!prev && next) {
        if (!meaningfulRequestPayment(next)) continue;
        for (const record of next.records.values()) {
          out.push(['payment:added', {
            clientId: next.clientId,
            requestId: next.requestId,
            paymentId: record.id,
            amount: record.amount,
            payment: clone(record)
          }]);
        }
        if (!same(requestPaymentMeta({}, {}), next.meta)) {
          out.push(['payment:updated', {
            clientId: next.clientId,
            requestId: next.requestId,
            paymentId: null,
            change: 'settings',
            before: null,
            after: clone(next.meta)
          }]);
        }
        continue;
      }

      if (prev && !next) {
        for (const record of prev.records.values()) {
          out.push(['payment:deleted', {
            clientId: prev.clientId,
            requestId: prev.requestId,
            paymentId: record.id,
            amount: record.amount,
            payment: clone(record)
          }]);
        }
        continue;
      }

      if (!same(prev.meta, next.meta)) {
        out.push(['payment:updated', {
          clientId: next.clientId,
          requestId: next.requestId,
          paymentId: null,
          change: 'settings',
          before: clone(prev.meta),
          after: clone(next.meta)
        }]);
      }

      const recordKeys = new Set([...prev.records.keys(), ...next.records.keys()]);
      for (const recordKey of recordKeys) {
        const oldRecord = prev.records.get(recordKey);
        const newRecord = next.records.get(recordKey);
        if (!oldRecord && newRecord) {
          out.push(['payment:added', {
            clientId: next.clientId,
            requestId: next.requestId,
            paymentId: newRecord.id,
            amount: newRecord.amount,
            payment: clone(newRecord)
          }]);
        } else if (oldRecord && !newRecord) {
          out.push(['payment:deleted', {
            clientId: prev.clientId,
            requestId: prev.requestId,
            paymentId: oldRecord.id,
            amount: oldRecord.amount,
            payment: clone(oldRecord)
          }]);
        } else if (!same(oldRecord, newRecord)) {
          out.push(['payment:updated', {
            clientId: next.clientId,
            requestId: next.requestId,
            paymentId: newRecord.id,
            change: 'record',
            before: clone(oldRecord),
            after: clone(newRecord),
            amount: newRecord.amount
          }]);
        }
      }
    }
  }

  function diffSessions(before, after, out) {
    const keys = new Set([...before.keys(), ...after.keys()]);
    for (const key of keys) {
      const prev = before.get(key);
      const next = after.get(key);
      if (!prev && next) {
        if (!meaningfulSessionPayment(next.payment)) continue;
        out.push(['session-payment:updated', {
          clientId: next.clientId,
          requestId: next.requestId || next.payment?.requestId || null,
          sessionId: next.sessionId,
          before: null,
          after: clone(next.payment),
          paid: next.payment?.paid === true,
          amount: num(next.payment?.amount)
        }]);
        continue;
      }
      if (prev && !next) {
        if (!meaningfulSessionPayment(prev.payment)) continue;
        out.push(['session-payment:updated', {
          clientId: prev.clientId,
          requestId: prev.requestId || prev.payment?.requestId || null,
          sessionId: prev.sessionId,
          before: clone(prev.payment),
          after: null,
          removed: true,
          paid: false,
          amount: 0
        }]);
        continue;
      }
      if (!same(prev.payment, next.payment)) {
        out.push(['session-payment:updated', {
          clientId: next.clientId,
          requestId: next.requestId || next.payment?.requestId || null,
          sessionId: next.sessionId,
          before: clone(prev.payment),
          after: clone(next.payment),
          paid: next.payment?.paid === true,
          amount: num(next.payment?.amount)
        }]);
      }
    }
  }

  let snapshot = capture();

  function detectAndEmit(source = 'payment-persistence') {
    const next = capture();
    const events = [];
    diffRequests(snapshot.requests, next.requests, events);
    diffSessions(snapshot.sessions, next.sessions, events);
    snapshot = next;
    for (const [type, detail] of events) deliver(type, { ...detail, source });
    return events.length;
  }

  function wrapSave() {
    if (typeof save !== 'function') return false;
    if (save.__diagnostikaPaymentEventsWrapped) return true;
    const original = save;
    function paymentAwareSave(...args) {
      const result = original.apply(this, args);
      detectAndEmit('save');
      return result;
    }
    Object.defineProperty(paymentAwareSave, '__diagnostikaPaymentEventsWrapped', { value: true });
    try { save = paymentAwareSave; } catch (_) { return false; }
    try { window.save = paymentAwareSave; } catch (_) {}
    return true;
  }

  const api = Object.freeze({
    types: EVENT_TYPES,
    emit: deliver,
    flush,
    resync() { snapshot = capture(); return true; },
    detect: detectAndEmit
  });

  platform.paymentEvents = api;
  window.DiagnostikaPaymentEvents = api;
  wrapSave();
  window.addEventListener('diagnostika:platform-core-ready', flush);
})();
