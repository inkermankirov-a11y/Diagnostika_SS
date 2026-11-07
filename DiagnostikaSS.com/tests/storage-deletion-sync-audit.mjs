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
assert.ok(sync.includes("events.on('client:archived'"), 'client archive event not tracked');
assert.ok(sync.includes("events.on('client:unarchived'"), 'client unarchive event not tracked');
assert.ok(sync.includes('base.archivedClients=(p.archivedClients||[])'), 'folder sync does not preserve archive membership');
assert.ok(sync.includes('rememberDeletedClient(detail?.clientId)'), 'deleted client is not persisted in ledger');
assert.ok(sync.includes('forgetDeletedClient(detail?.clientId)'), 'restored client is not removed from ledger');
assert.ok(sync.includes('merged=filterDeletedFromClientSet(merged,deletedIds)'), 'merged state can still resurrect deleted clients');
assert.ok(settings.includes('storage-simple-sync.js?v=20261005-client-archive-1'),'storage sync cache key not bumped');
assert.ok(sync.includes('removeClientFoldersByIds'),'permanent client folder cleanup missing');
assert.ok(sync.includes("removeEntry(name,{recursive:true})"),'client folder is not removed recursively');
assert.ok(sync.includes('permanentDeletedIds(state)'),'permanent-delete tombstones are not swept during sync');
assert.ok(sync.includes('purgeClientFromConnectedStorage(detail?.clientId)'),'permanent delete does not remove connected folder immediately');
assert.ok(sync.includes("AppDialog.alert(\`Клиентов в базе: \${result.count}.\`,'Синхронизация завершена')"),'sync completion dialog is still verbose');
assert.equal(sync.includes('Проверено папок клиентов:'),false,'verbose folder count returned');
assert.equal(sync.includes('Уникальных client.json:'),false,'verbose client.json count returned');

console.log('STORAGE_DELETION_SYNC_AUDIT_OK');
