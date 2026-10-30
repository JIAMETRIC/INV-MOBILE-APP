// Mobile SQLite schema, ported from desktop database/schema.sql.
// v2: GST and Clients features removed — no tax columns, no clients table,
// no HSN codes; invoices carry a free-text party snapshot instead.
// v3: Items renamed to Products — one row per Name+Size, style codes and
// categories dropped; Sold derives from invoice lines, Avl = Stock − Sold.
// v4: Restock ledger — `restocks` table records every stock delta (restock
// receipts and editor corrections); products.stock_qty stays the balance.
// v5: Products are names only — one row per name, no size. The v4 size rows
// are merged into one row per name (dbCore.mergeSizeRows keeps the data).
// v6: invoice prefix is INV- (was PRE-); existing settings rows are switched too.
// v7: invoice lines carry a size (S, M, L, XL, XXL, XXXL) picked on the invoice.
// v8: invoices carry a payment mode (Cash or UPI).
// v9: sync-ready (LAN_SYNC). Synced tables carry uid / dirty / rev / server_seq /
// origin_device / created_by, filled and maintained by the triggers in SYNC_SQL; deletes
// leave a row in sync_tombstones; payments link invoices through
// payment_invoices instead of the invoice_ids CSV; Stock = Σ restocks.delta.
// Old v1/v2/v3 databases are wiped and rebuilt (see dbCore.migrate).

export const SCHEMA_VERSION = 9;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Tirupur',
  pincode TEXT NOT NULL DEFAULT '641 607',
  pan TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',
  bank_branch TEXT NOT NULL DEFAULT '',
  bank_ac_no TEXT NOT NULL DEFAULT '',
  bank_ifsc TEXT NOT NULL DEFAULT '',
  upi_id TEXT NOT NULL DEFAULT '',
  invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
  next_seq INTEGER NOT NULL DEFAULT 1,
  dirty INTEGER NOT NULL DEFAULT 0,
  rev INTEGER NOT NULL DEFAULT 0,
  server_seq INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sl_no INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT '',
  unit_paise INTEGER NOT NULL DEFAULT 0,
  stock_qty REAL NOT NULL DEFAULT 0,
  uid TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  rev INTEGER NOT NULL DEFAULT 0,
  server_seq INTEGER,
  origin_device TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_name ON products(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS restocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('restock','edit')),
  delta REAL NOT NULL,
  stock_after REAL NOT NULL,
  unit_paise INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  uid TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  rev INTEGER NOT NULL DEFAULT 0,
  server_seq INTEGER,
  origin_device TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_restocks_product ON restocks(product_id, id);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('draft','issued','partial','paid','void')),
  invoice_date TEXT NOT NULL,
  due_date TEXT,
  party_name TEXT NOT NULL,
  party_address TEXT NOT NULL DEFAULT '',
  party_city TEXT NOT NULL DEFAULT '',
  party_pincode TEXT NOT NULL DEFAULT '',
  party_mobile TEXT NOT NULL DEFAULT '',
  party_email TEXT NOT NULL DEFAULT '',
  gross_paise INTEGER NOT NULL DEFAULT 0,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  discount_paise INTEGER NOT NULL DEFAULT 0,
  round_off_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL DEFAULT 0,
  amount_in_words TEXT NOT NULL DEFAULT '',
  upi_id TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  has_shipping INTEGER NOT NULL DEFAULT 0,
  ship_name TEXT NOT NULL DEFAULT '',
  ship_address TEXT NOT NULL DEFAULT '',
  ship_city TEXT NOT NULL DEFAULT '',
  ship_pincode TEXT NOT NULL DEFAULT '',
  payment_mode TEXT NOT NULL DEFAULT 'Cash',
  uid TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  rev INTEGER NOT NULL DEFAULT 0,
  server_seq INTEGER,
  origin_device TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invoices_no ON invoices(invoice_no);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_party ON invoices(party_name);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sno INTEGER NOT NULL,
  product_id INTEGER REFERENCES products(id),
  description TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  qty REAL NOT NULL DEFAULT 0,
  unit_paise INTEGER NOT NULL DEFAULT 0,
  line_paise INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_inv ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_date TEXT NOT NULL,
  party_name TEXT NOT NULL DEFAULT '',
  invoice_ids TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL,
  reference_no TEXT NOT NULL DEFAULT '',
  amount_paise INTEGER NOT NULL DEFAULT 0,
  remarks TEXT NOT NULL DEFAULT '',
  uid TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  rev INTEGER NOT NULL DEFAULT 0,
  server_seq INTEGER,
  origin_device TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- Which invoices a payment settles (replaces matching the invoice_ids CSV,
-- which is still written for display and old backups).
CREATE TABLE IF NOT EXISTS payment_invoices (
  payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  PRIMARY KEY (payment_id, invoice_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_invoices_inv ON payment_invoices(invoice_id);

CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_no TEXT UNIQUE NOT NULL,
  party_name TEXT NOT NULL DEFAULT '',
  total_paise INTEGER NOT NULL DEFAULT 0,
  items_count INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_drafts_updated ON drafts(updated_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  details_json TEXT NOT NULL DEFAULT '',
  uid TEXT,
  dirty INTEGER NOT NULL DEFAULT 1,
  rev INTEGER NOT NULL DEFAULT 0,
  server_seq INTEGER,
  origin_device TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- A deleted synced row, so the host (and other phones) learn about the delete.
CREATE TABLE IF NOT EXISTS sync_tombstones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tbl TEXT NOT NULL,
  uid TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 1,
  server_seq INTEGER,
  deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tbl, uid)
);

-- This device's sync identity and progress. applying = 1 while rows that came
-- from the host are written, so the triggers don't mark them dirty again.
-- user_uid is the signed-in user: new rows record it in created_by.
CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  device_id TEXT NOT NULL DEFAULT '',
  applying INTEGER NOT NULL DEFAULT 0,
  host_url TEXT NOT NULL DEFAULT '',
  last_pull_seq INTEGER NOT NULL DEFAULT 0,
  last_sync_at TEXT NOT NULL DEFAULT '',
  user_uid TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS backup_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'db',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// Tables whose rows are exchanged with the host. Invoice lines travel inside
// their invoice and payment links inside their payment, so they are not listed.
// audit_logs goes up so the desktop's Activity log (A3) sees every device.
export const SYNC_TABLES = ['products', 'restocks', 'invoices', 'payments', 'audit_logs'] as const;
export type SyncTable = typeof SYNC_TABLES[number];

// Company details the host owns. invoice_prefix and next_seq stay per device
// (each device has its own invoice series), so editing them never syncs.
const META_SYNC_COLS = [
  'name', 'subtitle', 'address', 'city', 'pincode', 'pan', 'contact', 'email',
  'bank_name', 'bank_branch', 'bank_ac_no', 'bank_ifsc', 'upi_id',
];

const NOT_APPLYING = `COALESCE((SELECT applying FROM sync_state WHERE id = 1), 0) = 0`;

// The seeded catalog's uids come from the names ('p' + hex of the lower-cased
// name), so every device seeds the same 12 products under the same uids and
// the host sees one catalog. Products made later get random uids; the same
// name made on two devices is merged by name when the second one pulls.
export const productUidSql = (name: string) => `'p' || lower(hex(lower(trim(${name}))))`;
export const SEED_NAMES_SQL = () => PRODUCT_SEED_NAMES.map(n => `'${n.toLowerCase()}'`).join(', ');

function tableSyncSql(t: SyncTable): string {
  return `
CREATE UNIQUE INDEX IF NOT EXISTS uq_${t}_uid ON ${t}(uid);
CREATE INDEX IF NOT EXISTS idx_${t}_dirty ON ${t}(dirty);
-- New local rows get a uid, this device as origin and the signed-in user as
-- created_by. Rows from the host arrive with uid and origin set, so the WHEN skips them.
CREATE TRIGGER IF NOT EXISTS trg_${t}_ins AFTER INSERT ON ${t}
WHEN NEW.uid IS NULL OR NEW.origin_device = ''
BEGIN
  UPDATE ${t} SET
    uid = COALESCE(NEW.uid, lower(hex(randomblob(16)))),
    origin_device = CASE WHEN NEW.origin_device = ''
      THEN COALESCE((SELECT device_id FROM sync_state WHERE id = 1), '') ELSE NEW.origin_device END,
    created_by = CASE WHEN NEW.created_by = ''
      THEN COALESCE((SELECT user_uid FROM sync_state WHERE id = 1), '') ELSE NEW.created_by END
  WHERE id = NEW.id;
END;
-- Any local edit marks the row for the next push. An update that changes
-- dirty itself (the sync engine clearing it) is left alone.
CREATE TRIGGER IF NOT EXISTS trg_${t}_upd AFTER UPDATE ON ${t}
WHEN NEW.dirty = OLD.dirty AND ${NOT_APPLYING}
BEGIN
  UPDATE ${t} SET dirty = 1, rev = rev + 1 WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_${t}_del AFTER DELETE ON ${t}
WHEN OLD.uid IS NOT NULL AND ${NOT_APPLYING}
BEGIN
  INSERT OR REPLACE INTO sync_tombstones (tbl, uid) VALUES ('${t}', OLD.uid);
END;`;
}

// Indexes on the v9 columns, the change-tracking triggers and the sync_state
// row. Run after SCHEMA_SQL on a fresh build and at the end of the v8 -> v9
// migration, so both paths end with the same database.
export const SYNC_SQL = `
INSERT OR IGNORE INTO sync_state (id, device_id) VALUES (1, lower(hex(randomblob(16))));
${SYNC_TABLES.map(tableSyncSql).join('\n')}
CREATE TRIGGER IF NOT EXISTS trg_meta_upd AFTER UPDATE OF ${META_SYNC_COLS.join(', ')} ON meta
WHEN NEW.dirty = OLD.dirty AND ${NOT_APPLYING}
BEGIN
  UPDATE meta SET dirty = 1, rev = rev + 1 WHERE id = NEW.id;
END;
`;

export const PRODUCT_SEED_NAMES = [
  'Round Neck T-Shirt - IMP',
  'Round Neck T-Shirt',
  'Drop Shoulder T-Shirt',
  'Acid Wash T-Shirt',
  'Polo T-Shirt - IMP',
  'Polo T-Shirt',
  'Hoodie',
  'Track Pant - IMP',
  'Track Pant Cotton',
  'Track Pant Sports',
  'Full Hand T-Shirt - IMP',
  'Full Hand T-Shirt',
];

// Catalog skeleton seeded on every fresh schema build: one row per name with
// zero price/stock, so the Products table and invoice picker open pre-filled.
export function productSeedSql(): string {
  const rows = PRODUCT_SEED_NAMES.map((name, i) => `(${productUidSql(`'${name}'`)}, ${i + 1}, '${name}', 0, 0)`);
  return `INSERT OR IGNORE INTO products (uid, sl_no, name, unit_paise, stock_qty) VALUES ${rows.join(',')};`;
}
