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

// v4 -> v5: one product per name. Each name keeps its lowest id; the other size
// rows' invoice lines and restock ledger move onto it, and their stock is added
// to it. Sold stays right because it is summed from invoice lines by product_id.
async function mergeSizeRows(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    await db.execAsync(`
      DROP INDEX IF EXISTS uq_products_name_size;
      CREATE TEMP TABLE IF NOT EXISTS product_merge AS
        SELECT p.id AS old_id,
               (SELECT MIN(k.id) FROM products k WHERE lower(k.name) = lower(p.name)) AS keep_id
        FROM products p;
      UPDATE products SET stock_qty = (
        SELECT SUM(s.stock_qty) FROM products s
        WHERE lower(s.name) = lower(products.name)
      ) WHERE id IN (SELECT keep_id FROM product_merge WHERE old_id = keep_id);
      UPDATE invoice_items SET product_id = (
        SELECT keep_id FROM product_merge WHERE old_id = invoice_items.product_id
      ) WHERE product_id IN (SELECT old_id FROM product_merge WHERE old_id <> keep_id);
      UPDATE restocks SET product_id = (
        SELECT keep_id FROM product_merge WHERE old_id = restocks.product_id
      ) WHERE product_id IN (SELECT old_id FROM product_merge WHERE old_id <> keep_id);
      DELETE FROM products WHERE id IN (SELECT old_id FROM product_merge WHERE old_id <> keep_id);
      UPDATE products SET size = '';
      DROP TABLE product_merge;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_products_name ON products(name COLLATE NOCASE);
    `);
    await db.execAsync('PRAGMA user_version = 5;');
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

// v5 -> v6: the invoice prefix moves from PRE- to INV-. A custom prefix is left alone.
async function renamePrefix(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    await db.execAsync(`
      UPDATE meta SET invoice_prefix = 'INV-' WHERE invoice_prefix = 'PRE-';
      PRAGMA user_version = 6;
    `);
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

// v6 -> v7: invoice lines get a size column (existing lines have none, so it is '').
async function addLineSize(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    await db.execAsync(`
      ALTER TABLE invoice_items ADD COLUMN size TEXT NOT NULL DEFAULT '';
      PRAGMA user_version = 7;
    `);
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

// v7 -> v8: invoices get a payment mode (existing invoices are Cash).
async function addPaymentMode(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    await db.execAsync(`
      ALTER TABLE invoices ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'Cash';
      PRAGMA user_version = ${SCHEMA_VERSION};
    `);
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version === 4) {
    await mergeSizeRows(db);
    version = 5;
  }
  if (version === 5) {
    await renamePrefix(db);
    version = 6;
  }
  if (version === 6) {
    await addLineSize(db);
    version = 7;
  }
  if (version === 7) {
    await addPaymentMode(db);
    version = SCHEMA_VERSION;
  }
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
