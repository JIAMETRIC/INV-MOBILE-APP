// Daily copy of the host database: <dataDir>/backups/host-YYYY-MM-DD.db, the last KEEP kept.
import fs from 'node:fs';
import path from 'node:path';
import type { SyncDb } from '../../src/sync/protocol';

export const KEEP = 30;

export async function dailyBackup(db: SyncDb, dataDir: string, today = new Date()): Promise<string | null> {
  const dir = path.join(dataDir, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `host-${today.toISOString().slice(0, 10)}.db`);
  if (fs.existsSync(file)) return null;
  // VACUUM INTO writes a clean, consistent copy while the database stays open.
  await db.execAsync(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const old = fs.readdirSync(dir).filter(f => /^host-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
  for (const f of old.slice(0, Math.max(0, old.length - KEEP))) fs.rmSync(path.join(dir, f));
  return file;
}
