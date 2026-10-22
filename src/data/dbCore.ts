import * as SQLite from 'expo-sqlite';
import { getKeyHex } from './dbKey';
import { SCHEMA_SQL, SCHEMA_VERSION, productSeedSql } from './schema';

const DB_NAME = 'invoices.db';

export async function openDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  const key = await getKeyHex();
  if (key) {
    // Must run before any other statement under SQLCipher.
    await db.execAsync(`PRAGMA key = "x'${key}'";`);
  }
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return db;
}

async function createSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);
  await db.execAsync(`INSERT OR IGNORE INTO meta (id) VALUES (1);`);
  await db.execAsync(productSeedSql());
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  let forceDrop = false;
  if (version === SCHEMA_VERSION) {
    const probe = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) c FROM sqlite_master WHERE name IN ('products', 'restocks')`);
    if (probe?.c === 2) return;
    // wa-sqlite/OPFS persisted user_version from an earlier migration whose
    // CREATE statements never landed, so the version flag lies. Rebuild and
    // wipe — table state is as untrustworthy as the version number.
    console.warn('[migrate] user_version says', version, 'but core tables missing — forcing rebuild');
    forceDrop = true;
  }
  await db.execAsync('BEGIN');
  try {
    if (version > 0 || forceDrop) {
      // Clean rebuild (approved for the v2 GST/Clients removal, kept for the
      // v3 Products rename): the old schema is incompatible and only test
      // data exists, so wipe every table child-first instead of migrating rows.
      for (const t of ['backup_logs', 'audit_logs', 'drafts', 'payments',
        'invoice_items', 'invoices', 'restocks', 'products', 'items', 'clients', 'meta']) {
        await db.execAsync(`DROP TABLE IF EXISTS ${t};`);
      }
    }
    await createSchema(db);
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDb().then(async db => {
      try {
        await migrate(db);
      } catch (e) {
        // Never swallow: a half-applied migration must be visible while the
        // schema is still evolving (v2/v3 clean rebuilds).
        console.error('DB migration failed:', e);
        throw e;
      }
      return db;
    }).catch(e => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

export async function closeDb(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (pending) (await pending).closeAsync();
}

export async function checkpointAndClose(): Promise<void> {
  const db = await getDb();
  await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
  await closeDb();
}
