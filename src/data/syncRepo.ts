import { getDb } from './db';
import { SYNC_TABLES, type SyncTable } from './schema';

// Sync bookkeeping (LAN_SYNC). The schema triggers do the change tracking;
// this file only reads it. The push / pull engine is built on top in Phase 4.

export interface SyncState {
  device_id: string;
  host_url: string;
  last_pull_seq: number;
  last_sync_at: string;
}

export async function getSyncState(): Promise<SyncState> {
  const db = await getDb();
  const row = await db.getFirstAsync<SyncState>(
    'SELECT device_id, host_url, last_pull_seq, last_sync_at FROM sync_state WHERE id = 1');
  if (!row) throw new Error('sync_state row missing');
  return row;
}

export type PendingCounts = Record<SyncTable | 'meta' | 'deletes', number>;

// Rows waiting for the next push, per table: drives the "pending" sync dot.
export async function pendingChanges(): Promise<PendingCounts> {
  const db = await getDb();
  const out = {} as PendingCounts;
  for (const t of [...SYNC_TABLES, 'meta'] as const) {
    const row = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) c FROM ${t} WHERE dirty = 1`);
    out[t] = row?.c ?? 0;
  }
  const del = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) c FROM sync_tombstones WHERE dirty = 1');
  out.deletes = del?.c ?? 0;
  return out;
}
