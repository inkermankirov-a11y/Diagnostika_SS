import assert from 'node:assert/strict';
import fs from 'node:fs';

const sync=fs.readFileSync('storage-simple-sync.js','utf8');
const settings=fs.readFileSync('settings-menu.js','utf8');

assert.ok(sync.includes("DELETED_LEDGER_KEY='diagnostika-storage-deleted-client-ids-v1'"),'deletion ledger missing');
assert.ok(sync.includes('filterDeletedFromClientSet'), 'deleted-client filter missing');
assert.ok(sync.includes('seedDeletedLedger(state)'), 'sync does not seed deletion ledger');
assert.ok(sync.includes('latestDeletedAt(state)'), 'deletion timestamp is not part of freshness');
assert.ok(sync.includes("events.on('client:deleted'"), 'client deletion event not tracked');
assert.ok(sync.includes("events.on('client:restored'"), 'client restore event not tracked');
assert.ok(sync.includes("events.on('client:purged'"), 'client purge event not tracked');
assert.ok(sync.includes('rememberDeletedClient(detail?.clientId)'), 'deleted client is not persisted in ledger');
assert.ok(sync.includes('forgetDeletedClient(detail?.clientId)'), 'restored client is not removed from ledger');
assert.ok(sync.includes('merged=filterDeletedFromClientSet(merged,deletedIds)'), 'merged state can still resurrect deleted clients');
assert.ok(settings.includes('storage-simple-sync.js?v=20261002-delete-sync-1'),'storage sync cache key not bumped');

console.log('STORAGE_DELETION_SYNC_AUDIT_OK');
