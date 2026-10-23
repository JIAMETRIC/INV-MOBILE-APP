// Mobile SQLite schema, ported from desktop database/schema.sql.
// v2: GST and Clients features removed — no tax columns, no clients table,
// no HSN codes; invoices carry a free-text party snapshot instead.
// v3: Items renamed to Products — one row per Name+Size, style codes and
// categories dropped; Sold derives from invoice lines, Avl = Stock − Sold.
// v4: Restock ledger — `restocks` table records every stock delta (restock
// receipts and editor corrections); products.stock_qty stays the balance.
// v5: Products are names only — one row per name, no size. The v4 size rows
// are merged into one row per name (dbCore.mergeSizeRows keeps the data).
// Old v1/v2/v3 databases are wiped and rebuilt (see dbCore.migrate).

export const SCHEMA_VERSION = 5;

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
  invoice_prefix TEXT NOT NULL DEFAULT 'PRE-',
  next_seq INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sl_no INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT '',
  unit_paise INTEGER NOT NULL DEFAULT 0,
  stock_qty REAL NOT NULL DEFAULT 0,
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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS backup_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'db',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
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
  const rows = PRODUCT_SEED_NAMES.map((name, i) => `(${i + 1}, '${name}', 0, 0)`);
  return `INSERT OR IGNORE INTO products (sl_no, name, unit_paise, stock_qty) VALUES ${rows.join(',')};`;
}
