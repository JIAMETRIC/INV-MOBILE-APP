// Tables only the desktop host has, next to the shared app schema (src/data/schema.ts).
import crypto from 'node:crypto';
import os from 'node:os';
import type { SyncDb } from '../../src/sync/protocol';

export const HOST_SQL = `
-- seq: the last change number handed out (every synced row's server_seq).
CREATE TABLE IF NOT EXISTS host_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  seq INTEGER NOT NULL DEFAULT 0,
  host_id TEXT NOT NULL,
  host_name TEXT NOT NULL DEFAULT '',
  series_count INTEGER NOT NULL DEFAULT 0
);

-- A paired phone. key seals its requests; series is its invoice letter.
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  key TEXT NOT NULL,
  series TEXT NOT NULL,
  app_version TEXT NOT NULL DEFAULT '',
  paired_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT '',
  last_ip TEXT NOT NULL DEFAULT '',
  revoked INTEGER NOT NULL DEFAULT 0
);

-- One QR code: usable once, until expires_at (ms since epoch).
CREATE TABLE IF NOT EXISTS pairings (
  pid TEXT PRIMARY KEY,
  secret TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Admin page A5: every push and pull.
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('pair', 'push', 'pull')),
  rows_in INTEGER NOT NULL DEFAULT 0,
  rows_out INTEGER NOT NULL DEFAULT 0,
  rejects_json TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sync_log_at ON sync_log(at);
`;

export interface HostInfo { host_id: string; host_name: string }

export async function ensureHostSchema(db: SyncDb): Promise<HostInfo> {
  await db.execAsync(HOST_SQL);
  await db.runAsync(
    'INSERT OR IGNORE INTO host_state (id, host_id, host_name) VALUES (1, ?, ?)',
    crypto.randomBytes(16).toString('hex'), os.hostname());
  const r = await db.getFirstAsync<HostInfo>('SELECT host_id, host_name FROM host_state WHERE id = 1');
  if (!r) throw new Error('host_state missing');
  return r;
}
