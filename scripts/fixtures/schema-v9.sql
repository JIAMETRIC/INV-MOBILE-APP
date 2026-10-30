-- Schema v9 exactly as shipped in build 5 (commit f9ddb86): SCHEMA_SQL, then SYNC_SQL. For the v9 -> v10 migration test.
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
-- host_id / host_name: the desktop this phone is paired with (host_url empty = not paired).
CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  device_id TEXT NOT NULL DEFAULT '',
  applying INTEGER NOT NULL DEFAULT 0,
  host_url TEXT NOT NULL DEFAULT '',
  last_pull_seq INTEGER NOT NULL DEFAULT 0,
  last_sync_at TEXT NOT NULL DEFAULT '',
  user_uid TEXT NOT NULL DEFAULT '',
  host_id TEXT NOT NULL DEFAULT '',
  host_name TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS backup_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'db',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO sync_state (id, device_id) VALUES (1, lower(hex(randomblob(16))));

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_uid ON products(uid);
CREATE INDEX IF NOT EXISTS idx_products_dirty ON products(dirty);
-- New local rows get a uid, this device as origin and the signed-in user as
-- created_by. Rows from the host arrive with uid and origin set, so the WHEN skips them.
CREATE TRIGGER IF NOT EXISTS trg_products_ins AFTER INSERT ON products
WHEN NEW.uid IS NULL OR NEW.origin_device = ''
BEGIN
  UPDATE products SET
    uid = COALESCE(NEW.uid, lower(hex(randomblob(16)))),
    origin_device = CASE WHEN NEW.origin_device = ''
      THEN COALESCE((SELECT device_id FROM sync_state WHERE id = 1), '') ELSE NEW.origin_device END,
    created_by = CASE WHEN NEW.created_by = ''
      THEN COALESCE((SELECT user_uid FROM sync_state WHERE id = 1), '') ELSE NEW.created_by END
  WHERE id = NEW.id;
END;
-- Any local edit marks the row for the next push. An update that changes
-- dirty itself (the sync engine clearing it) is left alone.
CREATE TRIGGER IF NOT EXISTS trg_products_upd AFTER UPDATE ON products
WHEN NEW.dirty = OLD.dirty AND COALESCE((SELECT applying FROM sync_state WHERE id = 1), 0) = 0
BEGIN
  UPDATE products SET dirty = 1, rev = rev + 1 WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_products_del AFTER DELETE ON products
WHEN OLD.uid IS NOT NULL AND COALESCE((SELECT applying FROM sync_state WHERE id = 1), 0) = 0
BEGIN
  INSERT OR REPLACE INTO sync_tombstones (tbl, uid) VALUES ('products', OLD.uid);
END;

CREATE UNIQUE INDEX IF NOT EXISTS uq_restocks_uid ON restocks(uid);
CREATE INDEX IF NOT EXISTS idx_restocks_dirty ON restocks(dirty);
-- New local rows get a uid, this device as origin and the signed-in user as
-- created_by. Rows from the host arrive with uid and origin set, so the WHEN skips them.
CREATE TRIGGER IF NOT EXISTS trg_restocks_ins AFTER INSERT ON restocks
WHEN NEW.uid IS NULL OR NEW.origin_device = ''
BEGIN
  UPDATE restocks SET
    uid = COALESCE(NEW.uid, lower(hex(randomblob(16)))),
    origin_device = CASE WHEN NEW.origin_device = ''
      THEN COALESCE((SELECT device_id FROM sync_state WHERE id = 1), '') ELSE NEW.origin_device END,
    created_by = CASE WHEN NEW.created_by = ''
      THEN COALESCE((SELECT user_uid FROM sync_state WHERE id = 1), '') ELSE NEW.created_by END
  WHERE id = NEW.id;
END;
-- Any local edit marks the row for the next push. An update that changes
-- dirty itself (the sync engine clearing it) is left alone.
CREATE TRIGGER IF NOT EXISTS trg_restocks_upd AFTER UPDATE ON restocks
WHEN NEW.dirty = OLD.dirty AND COALESCE((SELECT applying FROM sync_state WHERE id = 1), 0) = 0
BEGIN
  UPDATE restocks SET dirty = 1, rev = rev + 1 WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_restocks_del AFTER DELETE ON restocks
WHEN OLD.uid IS NOT NULL AND COALESCE((SELECT applying FROM sync_state WHERE id = 1), 0) = 0
BEGIN
  INSERT OR REPLACE INTO sync_tombstones (tbl, uid) VALUES ('restocks', OLD.uid);
END;

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_uid ON invoices(uid);
CREATE INDEX IF NOT EXISTS idx_invoices_dirty ON invoices(dirty);
-- New local rows get a uid, this device as origin and the signed-in user as
-- created_by. Rows from the host arrive with uid and origin set, so the WHEN skips them.
CREATE TRIGGER IF NOT EXISTS trg_invoices_ins AFTER INSERT ON invoices
WHEN NEW.uid IS NULL OR NEW.origin_device = ''
BEGIN
  UPDATE invoices SET
    uid = COALESCE(NEW.uid, lower(hex(randomblob(16)))),
    origin_device = CASE WHEN NEW.origin_device = ''
      THEN COALESCE((SELECT device_id FROM sync_state WHERE id = 1), '') ELSE NEW.origin_device END,
    created_by = CASE WHEN NEW.created_by = ''
      THEN COALESCE((SELECT user_uid FROM sync_state WHERE id = 1), '') ELSE NEW.created_by END
  WHERE id = NEW.id;
END;
-- Any local edit marks the row for the next push. An update that changes
-- dirty itself (the sync engine clearing it) is left alone.
CREATE TRIGGER IF NOT EXISTS trg_invoices_upd AFTER UPDATE ON invoices
WHEN NEW.dirty = OLD.dirty AND COALESCE((SELECT applying FROM sync_state WHERE id = 1), 0) = 0
BEGIN
  UPDATE invoices SET dirty = 1, rev = rev + 1 WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_invoices_del AFTER DELETE ON invoices
WHEN OLD.uid IS NOT NULL AND COALESCE((SELECT applying FROM sync_state WHERE id = 1), 0) = 0
BEGIN
  INSERT OR REPLACE INTO sync_tombstones (tbl, uid) VALUES ('invoices', OLD.uid);
END;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_uid ON payments(uid);
CREATE INDEX IF NOT EXISTS idx_payments_dirty ON payments(dirty);
-- New local rows get a uid, this device as origin and the signed-in user as
-- created_by. Rows from the host arrive with uid and origin set, so the WHEN skips them.
CREATE TRIGGER IF NOT EXISTS trg_payments_ins AFTER INSERT ON payments
WHEN NEW.uid IS NULL OR NEW.origin_device = ''
BEGIN
  UPDATE payments SET
    uid = COALESCE(NEW.uid, lower(hex(randomblob(16)))),
    origin_device = CASE WHEN NEW.origin_device = ''
      THEN COALESCE((SELECT device_id FROM sync_state WHERE id = 1), '') ELSE NEW.origin_device END,
    created_by = CASE WHEN NEW.created_by = ''
      THEN COALESCE((SELECT user_uid FROM sync_state WHERE id = 1), '') ELSE NEW.created_by END
  WHERE id = NEW.id;
END;
-- Any local edit marks the row for the next push. An update that changes
-- dirty itself (the sync engine clearing it) is left alone.
CREATE TRIGGER IF NOT EXISTS trg_payments_upd AFTER UPDATE ON payments
WHEN NEW.dirty = OLD.dirty AND COALESCE((SELECT applying FROM sync_state WHERE id = 1), 0) = 0
BEGIN
  UPDATE payments SET dirty = 1, rev = rev + 1 WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_payments_del AFTER DELETE ON payments
WHEN OLD.uid IS NOT NULL AND COALESCE((SELECT applying FROM sync_state WHERE id = 1), 0) = 0
BEGIN
  INSERT OR REPLACE INTO sync_tombstones (tbl, uid) VALUES ('payments', OLD.uid);
END;

CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_logs_uid ON audit_logs(uid);
CREATE INDEX IF NOT EXISTS idx_audit_logs_dirty ON audit_logs(dirty);
-- New local rows get a uid, this device as origin and the signed-in user as
-- created_by. Rows from the host arrive with uid and origin set, so the WHEN skips them.
CREATE TRIGGER IF NOT EXISTS trg_audit_logs_ins AFTER INSERT ON audit_logs
WHEN NEW.uid IS NULL OR NEW.origin_device = ''
BEGIN
  UPDATE audit_logs SET
    uid = COALESCE(NEW.uid, lower(hex(randomblob(16)))),
    origin_device = CASE WHEN NEW.origin_device = ''
      THEN COALESCE((SELECT device_id FROM sync_state WHERE id = 1), '') ELSE NEW.origin_device END,
    created_by = CASE WHEN NEW.created_by = ''
      THEN COALESCE((SELECT user_uid FROM sync_state WHERE id = 1), '') ELSE NEW.created_by END
  WHERE id = NEW.id;
END;
-- Any local edit marks the row for the next push. An update that changes
-- dirty itself (the sync engine clearing it) is left alone.
CREATE TRIGGER IF NOT EXISTS trg_audit_logs_upd AFTER UPDATE ON audit_logs
WHEN NEW.dirty = OLD.dirty AND COALESCE((SELECT applying FROM sync_state WHERE id = 1), 0) = 0
BEGIN
  UPDATE audit_logs SET dirty = 1, rev = rev + 1 WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_audit_logs_del AFTER DELETE ON audit_logs
WHEN OLD.uid IS NOT NULL AND COALESCE((SELECT applying FROM sync_state WHERE id = 1), 0) = 0
BEGIN
  INSERT OR REPLACE INTO sync_tombstones (tbl, uid) VALUES ('audit_logs', OLD.uid);
END;
CREATE TRIGGER IF NOT EXISTS trg_meta_upd AFTER UPDATE OF name, subtitle, address, city, pincode, pan, contact, email, bank_name, bank_branch, bank_ac_no, bank_ifsc, upi_id ON meta
WHEN NEW.dirty = OLD.dirty AND COALESCE((SELECT applying FROM sync_state WHERE id = 1), 0) = 0
BEGIN
  UPDATE meta SET dirty = 1, rev = rev + 1 WHERE id = NEW.id;
END;
