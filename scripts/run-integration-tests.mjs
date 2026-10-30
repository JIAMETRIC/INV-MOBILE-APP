// Headless integration test: runs the REAL schema.ts SQL + repository code
// (db, settings, products, invoices, payments, drafts, dashboard, audit)
// compiled from the mobile app, against Node's built-in SQLite, with
// expo-sqlite / expo-secure-store / expo-crypto mocked.
// Run from mobile/: npm run test:integration
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import crypto from 'node:crypto';
import Module from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const outDir = path.join(root, '.tmp-integration');

// ---------- Expo module mocks ----------

class NodeSQLiteWrapper {
  // expo-sqlite serialises every statement onto one internal queue, so
  // interleaved async callers never interleave mid-transaction. Emulate that.
  constructor(db) {
    this.db = db;
    this.databasePath = ':memory:';
    this.queue = Promise.resolve();
  }
  enqueue(op) {
    const run = this.queue.then(op);
    this.queue = run.catch(() => {});
    return run;
  }
  execSync(sql) { this.db.exec(sql); }
  async execAsync(sql, ...params) {
    await this.enqueue(() => this.db.exec(interpolate(sql, normalize(params))));
  }
  async getFirstAsync(sql, ...params) {
    return this.enqueue(() => normalizeRow(this.db.prepare(sql).get(...normalize(params))) ?? null);
  }
  async getAllAsync(sql, ...params) {
    return this.enqueue(() => this.db.prepare(sql).all(...normalize(params)).map(normalizeRow));
  }
  async runAsync(sql, ...params) {
    return this.enqueue(() => {
      const r = this.db.prepare(sql).run(...normalize(params));
      // node:sqlite spells it lastInsertRowid (lowercase d); expo-sqlite uses lastInsertRowId
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    });
  }
  async withExclusiveTransactionAsync(fn) {
    // Mirror expo-sqlite: the JS callback runs against the open transaction
    // directly (NOT queued as one block — queuing would deadlock, since the
    // body's own statements queue behind it). Prior queued ops must finish
    // first; BEGIN/COMMIT/ROLLBACK are then enqueued ahead of those statements.
    await this.queue.catch(() => {});
    this.db.exec('BEGIN IMMEDIATE');
    let err = null;
    try {
      const body = fn();
      if (body && typeof body.then === 'function') await body;
    } catch (e) {
      err = e;
    }
    await this.enqueue(() => {
      if (err) { try { this.db.exec('ROLLBACK'); } catch { /* noop */ } }
      else this.db.exec('COMMIT');
    });
    if (err) throw err;
  }
  closeAsync() { return this.enqueue(() => this.db.close()); }
}

// execAsync supports variadic params in expo-sqlite; node:sqlite has no bind
// for exec, so substitute literals (tests only pass integers/strings).
function interpolate(sql, params) {
  let i = 0;
  return sql.replace(/\?/g, () => {
    const p = params[i++];
    return typeof p === 'number' ? String(p) : `'${String(p).replace(/'/g, "''")}'`;
  });
}

function normalize(params) {
  return params.map(p => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
}

// node:sqlite returns BigInt rowids and null-prototype objects; expo-sqlite
// returns plain objects with numbers. Normalise so repository code can't tell.
function normalizeRow(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === 'bigint' ? Number(v) : typeof v === 'boolean' ? (v ? 1 : 0) : v ?? null;
  }
  return out;
}

const sqliteMock = {
  openDatabaseAsync: async () => new NodeSQLiteWrapper(new DatabaseSync(':memory:')),
};

const store = new Map();
const secureStoreMock = {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockThisDeviceOnly',
  getItemAsync: async k => (store.has(k) ? store.get(k) : null),
  setItemAsync: async (k, v) => { store.set(k, v); },
};

const cryptoMock = {
  getRandomBytesAsync: async n => new Uint8Array(crypto.randomBytes(n)),
};

// xlsx.ts only needs these to write a file; the register test reads rows, not files.
const fileSystemMock = {
  File: class { create() {} writeSync() {} },
};
const pdfMock = { isWeb: false, docsDir: () => ({}), webBlobDownload: () => '' };

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'expo-sqlite') return sqliteMock;
  if (request === 'expo-secure-store') return secureStoreMock;
  if (request === 'expo-crypto') return cryptoMock;
  if (request === 'expo-file-system') return fileSystemMock;
  if (request === './pdf' && parent && /xlsx\.js$/.test(parent.filename)) return pdfMock;
  return origLoad.apply(this, arguments);
};

// ---------- compile app sources ----------

execFileSync('npx', ['tsc', '--ignoreConfig',
  'src/data/db.ts', 'src/data/settingsRepo.ts',
  'src/data/productsRepo.ts', 'src/data/invoicesRepo.ts', 'src/data/paymentsRepo.ts',
  'src/data/draftsRepo.ts', 'src/data/dashboardRepo.ts', 'src/data/auditRepo.ts',
  'src/data/syncRepo.ts', 'src/export/xlsx.ts',
  // rootDir is the project, not src/: pdf.ts imports modules/whatsapp-share.
  '--outDir', outDir, '--rootDir', '.', '--module', 'nodenext', '--moduleResolution', 'nodenext',
  '--target', 'es2022', '--skipLibCheck', '--esModuleInterop'], { stdio: 'inherit', shell: true });

const out = (...p) => path.join(outDir, 'src', ...p);
const db = require(out('data', 'db.js'));
const dbCore = require(out('data', 'dbCore.js'));
const syncRepo = require(out('data', 'syncRepo.js'));
const settingsRepo = require(out('data', 'settingsRepo.js'));
const productsRepo = require(out('data', 'productsRepo.js'));
const invoicesRepo = require(out('data', 'invoicesRepo.js'));
const paymentsRepo = require(out('data', 'paymentsRepo.js'));
const draftsRepo = require(out('data', 'draftsRepo.js'));
const dashboardRepo = require(out('data', 'dashboardRepo.js'));
const money = require(out('data', 'money.js'));

// ---------- scenario ----------

let failed = 0;
const pending = [];
process.on('unhandledRejection', e => {
  failed++;
  console.log('FAIL unhandled rejection -', e && e.message ? e.message : e);
});
const t = async (name, fn) => {
  const run = (async () => {
    try { await fn(); console.log('PASS', name); }
    catch (e) { failed++; console.log('FAIL', name, '-', e.message); }
  })();
  pending.push(run);
  return run;
};

const baseParty = {
  party_name: 'Acme Co', party_address: '12 Trichur Rd', party_city: 'Tirupur',
  party_pincode: '641607', party_mobile: '999', party_email: '',
};

const formFor = (lines, discountPercent = 0, party = baseParty) => ({
  party, invoiceDate: '2026-10-20', dueDate: '2026-11-03',
  discountPercent, lines, notes: 'test', hasShipping: false,
  ship: { ship_name: '', ship_address: '', ship_city: '', ship_pincode: '' },
});

const mkLine = (sno, desc, qty, unitPaise, productId = null) => ({
  sno, product_id: productId, description: desc, qty,
  unit_paise: unitPaise, line_paise: money.linePaise(qty, unitPaise),
});

await t('DB opens, migrates, seeds meta singleton', async () => {
  const d = await db.getDb();
  assert.ok(d);
  assert.equal((await d.getFirstAsync('PRAGMA user_version')).user_version, 9);
  const s = await settingsRepo.getSettings();
  assert.equal(s.invoice_prefix, 'INV-');
  assert.equal(s.next_seq, 1);
});

await t('encryption key stored in mocked Keystore on first open', async () => {
  assert.ok(store.get('db_key_v1'));
  assert.equal(store.get('db_key_v1').length, 64); // 32 bytes hex
});

await t('no clients/GST/items tables or columns remain in schema', async () => {
  const d = await db.getDb();
  const tables = await d.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'table'");
  for (const gone of ['clients', 'items']) {
    assert.ok(!tables.some(r => r.name === gone), `${gone} table should be gone`);
  }
  assert.ok(tables.some(r => r.name === 'products'), 'products table should exist');
  assert.ok(tables.some(r => r.name === 'restocks'), 'restocks table should exist (v4)');
  const cols = await d.getAllAsync('PRAGMA table_info(invoices)');
  for (const banned of ['client_id', 'tax_type', 'cgst_paise', 'sgst_paise', 'igst_paise',
    'taxable_paise', 'party_gstin', 'party_state_code', 'ship_gstin']) {
    assert.ok(!cols.some(c => c.name === banned), `invoices.${banned} should be gone`);
  }
  const lineCols = await d.getAllAsync('PRAGMA table_info(invoice_items)');
  for (const banned of ['style_code', 'uom']) {
    assert.ok(!lineCols.some(c => c.name === banned), `invoice_items.${banned} should be gone`);
  }
  const nameCols = new Set((await d.getAllAsync('PRAGMA table_info(products)')).map(c => c.name));
  for (const want of ['name', 'size', 'unit_paise', 'stock_qty']) {
    assert.ok(nameCols.has(want), `products.${want} should exist`);
  }
});

await t('catalog seed: one product row per name (v5)', async () => {
  const all = await productsRepo.listProducts();
  assert.equal(all.length, 12);
  const hoodies = await productsRepo.listProducts('Hoodie');
  assert.equal(hoodies.length, 1);
  assert.equal(hoodies[0].size, '');
});

let hoodieL;
await t('product CRUD + name UNIQUE guard', async () => {
  // The seed already ships "Hoodie": exercise the update path on it…
  hoodieL = (await productsRepo.listProducts('Hoodie'))[0];
  hoodieL = await productsRepo.upsertProduct({
    name: 'Hoodie', unit_paise: 550000, stock_qty: 40,
  }, hoodieL.id);
  assert.equal(hoodieL.stock_qty, 40);
  assert.equal(hoodieL.unit_paise, 550000);
  // …then a fresh insert that collides case-insensitively must reject.
  let rejected = false;
  try {
    await productsRepo.upsertProduct({ name: 'hoodie', unit_paise: 1, stock_qty: 1 });
  } catch {
    rejected = true;
  }
  assert.ok(rejected, 'duplicate name must reject (case-insensitive)');
  const again = await productsRepo.getProduct(hoodieL.id);
  assert.equal(again.unit_paise, 550000); // rollback left the DB usable, original intact
});

await t('restock adds to balance, re-prices, and writes ledger history', async () => {
  const polo = (await productsRepo.listProducts('Polo T-Shirt'))
    .find(p => p.name === 'Polo T-Shirt');
  await productsRepo.restockProduct(polo.id, 50, 70000, 'Lot A');
  let row = await productsRepo.getProduct(polo.id);
  assert.equal(row.stock_qty, 50);
  assert.equal(row.unit_paise, 70000);
  assert.equal(row.avl_qty, 50);
  // Omitting the price must keep the current one.
  await productsRepo.restockProduct(polo.id, 10, 0, 'Lot B');
  // Editor overwrites are logged as deltas so Stock = Σ ledger rows.
  row = await productsRepo.getProduct(polo.id);
  await productsRepo.upsertProduct(
    { name: row.name, unit_paise: row.unit_paise, stock_qty: 55 }, row.id);
  const hist = await productsRepo.listRestocks(polo.id);
  assert.equal(hist.length, 3);
  assert.equal(hist[0].kind, 'edit');
  assert.equal(hist[0].delta, -5);
  assert.equal(hist[0].stock_after, 55);
  assert.equal(hist[1].kind, 'restock');
  assert.equal(hist[1].delta, 10);
  assert.equal(hist[1].unit_paise, 70000, 'price kept when no new price given');
  assert.equal(hist[2].note, 'Lot A');
  row = await productsRepo.getProduct(polo.id);
  assert.equal(row.stock_qty, 55);
  assert.equal(hist.reduce((s, h) => s + h.delta, 0), row.stock_qty, 'ledger sums to balance');
  // Deleting the product cascades its ledger away.
  await productsRepo.deleteProduct(polo.id);
  assert.equal((await productsRepo.listRestocks(polo.id)).length, 0);
});

let inv1;
await t('issue invoice #1: atomic numbering + stored totals match integer math', async () => {
  const lines = [mkLine(1, 'Junior Shorts', 100, 15000), mkLine(2, 'Mini Pants', 2, 20000)];
  const totals = money.computeTotals(lines, 10);
  inv1 = await invoicesRepo.saveInvoice(formFor(lines, 10), totals, {});
  assert.equal(inv1.invoiceNo, 'INV-001');
  const s = await settingsRepo.getSettings();
  assert.equal(s.next_seq, 2);
  const stored = await invoicesRepo.getInvoice(inv1.invoiceId);
  assert.equal(stored.gross_paise, 1540000);       // 1,54,000.00
  assert.equal(stored.discount_paise, 154000);
  // net 1,38,600.00 exactly → whole rupees, no round-off
  assert.equal(stored.total_paise, 1386000);
  assert.equal(stored.round_off_paise, 0);
  assert.match(stored.amount_in_words, /^Rupees .+ Only$/);
  assert.equal((await invoicesRepo.getLines(inv1.invoiceId)).length, 2);
});

await t('issue invoice #2: rupee round-off half-up', async () => {
  const lines = [mkLine(1, 'Junior Shorts', 3, 1575)];
  const totals = money.computeTotals(lines, 0);
  const res = await invoicesRepo.saveInvoice(
    formFor(lines, 0, { ...baseParty, party_name: 'Delhi Trader' }),
    totals, {},
  );
  assert.equal(res.invoiceNo, 'INV-002');
  const stored = await invoicesRepo.getInvoice(res.invoiceId);
  // raw 47.25 → Math.round half-up = 47.00, round-off -0.25
  assert.equal(stored.gross_paise, 4725);
  assert.equal(stored.total_paise, 4700);
  assert.equal(stored.round_off_paise, -25);
});

await t('edit invoice keeps its number and replaces lines', async () => {
  const lines = [mkLine(1, 'Hoodie - L', 50, 15000, hoodieL.id)];
  const totals = money.computeTotals(lines, 0);
  const res = await invoicesRepo.saveInvoice(formFor(lines), totals, {
    invoiceId: inv1.invoiceId, invoiceNo: 'INV-001',
  });
  assert.equal(res.invoiceNo, 'INV-001');
  const storedLines = await invoicesRepo.getLines(inv1.invoiceId);
  assert.equal(storedLines.length, 1);
  const stored = await invoicesRepo.getInvoice(inv1.invoiceId);
  assert.equal(stored.total_paise, totals.total);
  // line kept its product link
  assert.equal((await invoicesRepo.getLines(inv1.invoiceId))[0].product_id, hoodieL.id);
});

await t('draft autosave round-trip (save → update → reload payload)', async () => {
  const form = formFor([mkLine(1, 'Junior Shorts', 4, 15000)]);
  const totals = money.computeTotals(form.lines, 0);
  const id = await draftsRepo.saveDraft(null, { form, invoiceNo: 'INV-003' }, totals.total);
  const again = await draftsRepo.saveDraft(id, { form, invoiceNo: 'INV-003' }, totals.total);
  assert.equal(again, id);
  const d = await draftsRepo.getDraft(id);
  assert.equal(d.draft_no, 'DRAFT-001');
  assert.equal(d.items_count, 1);
  assert.deepEqual(JSON.parse(d.payload_json).form.party.party_name, 'Acme Co');
  await draftsRepo.deleteDraft(id);
  assert.equal((await draftsRepo.listDrafts()).length, 0);
});

await t('payments: partial then paid status transitions', async () => {
  const stored = await invoicesRepo.getInvoice(inv1.invoiceId);
  const half = Math.floor(stored.total_paise / 2);
  await paymentsRepo.recordPayment({
    payment_date: '2026-10-21', party_name: 'Acme Co',
    invoiceIds: [inv1.invoiceId], mode: 'Cash', reference_no: '', amount_paise: half, remarks: 'x',
  });
  assert.equal((await invoicesRepo.getInvoice(inv1.invoiceId)).status, 'partial');
  await paymentsRepo.recordPayment({
    payment_date: '2026-10-22', party_name: 'Acme Co',
    invoiceIds: [inv1.invoiceId], mode: 'UPI', reference_no: '',
    amount_paise: stored.total_paise - half, remarks: 'close',
  });
  assert.equal((await invoicesRepo.getInvoice(inv1.invoiceId)).status, 'paid');
  assert.equal(await paymentsRepo.paidPaiseForInvoice(inv1.invoiceId), stored.total_paise);
});

await t('sold = non-void invoice lines; avl = stock − sold', async () => {
  // INV-001 now carries 50 of hoodieL (edit test). Add a product-linked void.
  const lines = [mkLine(1, 'Hoodie - L', 25, 15000, hoodieL.id)];
  const totals = money.computeTotals(lines, 0);
  const res = await invoicesRepo.saveInvoice(
    formFor(lines, 0, { ...baseParty, party_name: 'Delhi Trader' }), totals, {},
  );
  let row = await productsRepo.getProduct(hoodieL.id);
  assert.equal(row.sold_qty, 75);
  assert.equal(row.avl_qty, 40 - 75); // oversell goes negative on purpose
  await invoicesRepo.setStatus(res.invoiceId, 'void');
  row = await productsRepo.getProduct(hoodieL.id);
  assert.equal(row.sold_qty, 50, 'void lines must not count as sold');
  assert.equal(row.avl_qty, -10);
});

await t('void lifecycle + KPIs exclude void, FY scoping works', async () => {
  const lines = [mkLine(1, 'Hoodie - L', 1, 15000, hoodieL.id)];
  const totals = money.computeTotals(lines, 0);
  const res = await invoicesRepo.saveInvoice(
    formFor(lines, 0, { ...baseParty, party_name: 'Delhi Trader' }), totals, {},
  );
  await invoicesRepo.setStatus(res.invoiceId, 'void');
  const k = await dashboardRepo.getKpis();
  assert.equal(k.invoiceCount, 2); // INV-001 paid, INV-002 issued; voids excluded
  const aging = await dashboardRepo.getAging();
  assert.equal(aging.length, 1);
  assert.equal(aging[0].invoice_no, 'INV-002');
  // INV-001 (50) + void INV-003 (25) + void INV-004 (1): voids never count.
  const row = await productsRepo.getProduct(hoodieL.id);
  assert.equal(row.sold_qty, 50);
  assert.equal(row.avl_qty, -10);
});

await t('stock totals match the per-product rows', async () => {
  const all = await productsRepo.listProducts();
  const sum = k => all.reduce((n, p) => n + p[k], 0);
  const tot = await productsRepo.getStockTotals();
  assert.equal(tot.stockQty, sum('stock_qty'));
  assert.equal(tot.soldQty, sum('sold_qty'));
  assert.equal(tot.avlQty, sum('avl_qty'));
  assert.equal(tot.soldQty >= 50, true, 'INV-001 hoodie lines count as sold');
});

await t('delete + syncNextSeq never moves the sequence backwards', async () => {
  const before = await settingsRepo.getSettings();
  assert.equal(before.next_seq, 5); // 001..004 allocated
  const rows = await invoicesRepo.listInvoices({ search: 'INV-003' });
  await invoicesRepo.deleteInvoice(rows[0].id);
  // Cascade removed the voided INV-003 lines; sold stays at the 50 issued on INV-001.
  const row = await productsRepo.getProduct(hoodieL.id);
  assert.equal(row.sold_qty, 50);
  await settingsRepo.syncNextSeq();
  const after = await settingsRepo.getSettings();
  // Math.max(next_seq, maxSuffix+1) rule: deleting the newest invoice must NOT
  // free its number, otherwise a re-issue could collide with exported PDFs.
  assert.equal(after.next_seq, 5);
  const lines = [mkLine(1, 'x', 1, 100)];
  const totals = money.computeTotals(lines, 0);
  const res = await invoicesRepo.saveInvoice(formFor(lines), totals, {});
  assert.equal(res.invoiceNo, 'INV-005');
});

await t('audit trail records and reads back actions', async () => {
  const auditRepo = require(out('data', 'auditRepo.js'));
  await auditRepo.logAudit('invoice.issue', 'invoice', 'INV-001');
  await auditRepo.logAudit('product.upsert', 'product', 1);
  await auditRepo.logAudit('payment.record', 'invoice', 'INV-001');
  await auditRepo.logAudit('invoice.void', 'invoice', 'INV-003');
  await auditRepo.logAudit('invoice.delete', 'invoice', 'INV-003');
  const rows = await auditRepo.recentAudit(50);
  const actions = new Set(rows.map(r => r.action));
  for (const a of ['invoice.issue', 'product.upsert', 'payment.record', 'invoice.void', 'invoice.delete']) {
    assert.ok(actions.has(a), `missing audit action ${a}`);
  }
});

await t('consolidated register: one row per invoice, one per line item', async () => {
  const xlsx = require(out('export', 'xlsx.js'));
  // A 3-line invoice: before the fix it was listed 3 times on the register.
  const lines = [mkLine(1, 'a', 1, 100), mkLine(2, 'b', 2, 200), mkLine(3, 'c', 3, 300)];
  const { invoiceNo } = await invoicesRepo.saveInvoice(formFor(lines), money.computeTotals(lines, 0), {});
  const { register, lineItems } = await xlsx.collectRegisterRows();
  const d = await db.getDb();
  const inv = await d.getFirstAsync('SELECT COUNT(*) AS n FROM invoices');
  const items = await d.getFirstAsync('SELECT COUNT(*) AS n FROM invoice_items');
  assert.equal(register.length, inv.n, 'register rows = invoices');
  assert.equal(new Set(register.map(r => r[0])).size, inv.n, 'no invoice listed twice');
  assert.equal(lineItems.length, items.n, 'line-item rows = invoice_items');
  assert.equal(register.filter(r => r[0] === invoiceNo).length, 1, 'multi-line invoice listed once');
  assert.equal(lineItems.filter(r => r[0] === invoiceNo).length, 3);
});

// ---------- v9 sync bookkeeping (LAN_SYNC) ----------

const setApplying = async on => (await db.getDb()).runAsync('UPDATE sync_state SET applying = ? WHERE id = 1', on ? 1 : 0);

const SYNCED = ['products', 'restocks', 'invoices', 'payments', 'audit_logs'];

await t('v9: every row has a uid and this device as origin, and starts dirty', async () => {
  const d = await db.getDb();
  const { device_id } = await syncRepo.getSyncState();
  assert.match(device_id, /^[0-9a-f]{32}$/);
  for (const tbl of SYNCED) {
    const rows = await d.getAllAsync(`SELECT uid, origin_device, dirty FROM ${tbl}`);
    assert.ok(rows.length > 0, `${tbl} has rows by now`);
    assert.equal(new Set(rows.map(r => r.uid)).size, rows.length, `${tbl} uids are unique`);
    for (const r of rows) {
      assert.match(r.uid, /^[0-9a-f]{32}$/, `${tbl} uid filled`);
      assert.equal(r.origin_device, device_id, `${tbl} origin is this device`);
      assert.equal(r.dirty, 1, `${tbl} new rows wait for the first push`);
    }
  }
});

await t('v9: a local edit marks a pushed row dirty again; host-applied writes do not', async () => {
  const d = await db.getDb();
  // Simulate a finished push: the engine clears dirty (that update changes dirty, so no trigger).
  await d.runAsync('UPDATE products SET dirty = 0, server_seq = 1 WHERE id = ?', hoodieL.id);
  let row = await d.getFirstAsync('SELECT dirty, rev FROM products WHERE id = ?', hoodieL.id);
  assert.equal(row.dirty, 0);
  const rev = row.rev;
  await productsRepo.upsertProduct({ name: 'Hoodie', unit_paise: 560000, stock_qty: 40 }, hoodieL.id);
  row = await d.getFirstAsync('SELECT dirty, rev FROM products WHERE id = ?', hoodieL.id);
  assert.equal(row.dirty, 1, 'price edit must be pushed');
  assert.ok(row.rev > rev, 'rev bumps so a stale ack cannot clear a newer edit');
  // A row written from a pull stays clean.
  await d.runAsync('UPDATE products SET dirty = 0 WHERE id = ?', hoodieL.id);
  await setApplying(true);
  await d.runAsync('UPDATE products SET unit_paise = 570000 WHERE id = ?', hoodieL.id);
  await setApplying(false);
  row = await d.getFirstAsync('SELECT dirty FROM products WHERE id = ?', hoodieL.id);
  assert.equal(row.dirty, 0);
});

await t('v9: company details sync, invoice numbering does not', async () => {
  const d = await db.getDb();
  await d.runAsync('UPDATE meta SET dirty = 0 WHERE id = 1');
  const lines = [mkLine(1, 'x', 1, 100)];
  await invoicesRepo.saveInvoice(formFor(lines), money.computeTotals(lines, 0), {});
  assert.equal((await d.getFirstAsync('SELECT dirty FROM meta')).dirty, 0, 'next_seq is per device');
  await settingsRepo.updateSettings({ invoice_prefix: 'INV-' });
  assert.equal((await d.getFirstAsync('SELECT dirty FROM meta')).dirty, 0, 'prefix is per device');
  await settingsRepo.updateSettings({ name: 'Barathy Garments' });
  assert.equal((await d.getFirstAsync('SELECT dirty FROM meta')).dirty, 1, 'company name goes to the host');
});

await t('v9: deletes leave tombstones (not for host-applied deletes)', async () => {
  const d = await db.getDb();
  const lines = [mkLine(1, 'gone', 1, 100)];
  const res = await invoicesRepo.saveInvoice(formFor(lines), money.computeTotals(lines, 0), {});
  const { uid } = await d.getFirstAsync('SELECT uid FROM invoices WHERE id = ?', res.invoiceId);
  const before = (await syncRepo.pendingChanges()).deletes;
  await invoicesRepo.deleteInvoice(res.invoiceId);
  const tomb = await d.getFirstAsync("SELECT * FROM sync_tombstones WHERE tbl = 'invoices' AND uid = ?", uid);
  assert.ok(tomb, 'tombstone written');
  assert.equal((await syncRepo.pendingChanges()).deletes, before + 1);
  const other = await invoicesRepo.saveInvoice(formFor(lines), money.computeTotals(lines, 0), {});
  await setApplying(true);
  await invoicesRepo.deleteInvoice(other.invoiceId);
  await setApplying(false);
  assert.equal((await syncRepo.pendingChanges()).deletes, before + 1, 'a delete from the host is not echoed back');
});

await t('v9: payments link invoices through payment_invoices', async () => {
  const d = await db.getDb();
  const lines = [mkLine(1, 'p', 1, 1000)];
  const a = await invoicesRepo.saveInvoice(formFor(lines), money.computeTotals(lines, 0), {});
  const b = await invoicesRepo.saveInvoice(formFor(lines), money.computeTotals(lines, 0), {});
  const p = await paymentsRepo.recordPayment({
    payment_date: '2026-10-30', party_name: 'Acme Co', invoiceIds: [a.invoiceId, b.invoiceId],
    mode: 'UPI', reference_no: '', amount_paise: 2000, remarks: '',
  });
  const links = await d.getAllAsync('SELECT invoice_id FROM payment_invoices WHERE payment_id = ? ORDER BY invoice_id', p.id);
  assert.deepEqual(links.map(l => l.invoice_id), [a.invoiceId, b.invoiceId]);
  assert.equal(await paymentsRepo.paidPaiseForInvoice(a.invoiceId), 2000);
  assert.equal((await invoicesRepo.getInvoice(b.invoiceId)).status, 'paid');
});

await t('v9: new rows record the signed-in user; host rows keep theirs', async () => {
  const d = await db.getDb();
  await d.runAsync("UPDATE sync_state SET user_uid = 'user-ravi' WHERE id = 1");
  const lines = [mkLine(1, 'who', 1, 100)];
  const res = await invoicesRepo.saveInvoice(formFor(lines), money.computeTotals(lines, 0), {});
  await paymentsRepo.recordPayment({
    payment_date: '2026-10-30', party_name: 'Acme Co', invoiceIds: [res.invoiceId],
    mode: 'Cash', reference_no: '', amount_paise: 100, remarks: '',
  });
  const polo = (await productsRepo.listProducts('Hoodie'))[0];
  await productsRepo.restockProduct(polo.id, 1, 0, 'by Ravi');
  await settingsRepo.updateSettings({ city: 'Tirupur' });
  for (const [tbl, where] of [
    ['invoices', `id = ${res.invoiceId}`], ['payments', 'id = (SELECT MAX(id) FROM payments)'],
    ['restocks', 'id = (SELECT MAX(id) FROM restocks)'], ['audit_logs', 'id = (SELECT MAX(id) FROM audit_logs)'],
  ]) {
    const r = await d.getFirstAsync(`SELECT created_by FROM ${tbl} WHERE ${where}`);
    assert.equal(r.created_by, 'user-ravi', `${tbl}.created_by`);
  }
  // A row pulled from the host already names its device and user.
  await d.runAsync(`INSERT INTO audit_logs (action, entity_type, uid, origin_device, created_by)
    VALUES ('invoice.issue', 'invoice', 'host-row-1', 'phone-b', 'user-anu')`);
  const host = await d.getFirstAsync("SELECT created_by, origin_device FROM audit_logs WHERE uid = 'host-row-1'");
  assert.deepEqual(host, { created_by: 'user-anu', origin_device: 'phone-b' });
  await d.runAsync("UPDATE sync_state SET user_uid = '' WHERE id = 1");
});

await t('v9: settings saves and voids are logged', async () => {
  const auditRepo = require(out('data', 'auditRepo.js'));
  await settingsRepo.updateSettings({ upi_id: 'barathy@upi' });
  let rows = await auditRepo.recentAudit(5);
  assert.equal(rows[0].action, 'settings.update');
  const lines = [mkLine(1, 'v', 1, 100)];
  const res = await invoicesRepo.saveInvoice(formFor(lines), money.computeTotals(lines, 0), {});
  await invoicesRepo.setStatus(res.invoiceId, 'void');
  rows = await auditRepo.recentAudit(5);
  assert.equal(rows[0].action, 'invoice.void');
  assert.equal(rows[0].entity_id, res.invoiceNo);
  assert.equal(rows[0].origin_device, (await syncRepo.getSyncState()).device_id);
  // Saving nothing logs nothing.
  const before = (await auditRepo.recentAudit(1))[0].id;
  await settingsRepo.updateSettings({});
  assert.equal((await auditRepo.recentAudit(1))[0].id, before);
});

await t('v9: Stock always equals the restock ledger', async () => {
  const d = await db.getDb();
  const drift = await d.getAllAsync(`SELECT p.name FROM products p
    WHERE abs(p.stock_qty - COALESCE((SELECT SUM(delta) FROM restocks r WHERE r.product_id = p.id), 0)) > 1e-9`);
  assert.deepEqual(drift, []);
});

await t('v8 -> v9 migration keeps the data and ends like a fresh v9 build', async () => {
  const w = new NodeSQLiteWrapper(new DatabaseSync(':memory:'));
  w.execSync(readFileSync(path.join(root, 'scripts', 'fixtures', 'schema-v8.sql'), 'utf8'));
  w.execSync(`
    INSERT INTO meta (id) VALUES (1);
    INSERT INTO products (id, name, unit_paise, stock_qty) VALUES (1, 'Hoodie', 50000, 30), (2, 'Polo', 40000, 5);
    INSERT INTO restocks (product_id, kind, delta, stock_after) VALUES (1, 'restock', 30, 30);
    INSERT INTO invoices (id, invoice_no, invoice_date, party_name, total_paise)
      VALUES (1, 'INV-001', '2026-10-01', 'A', 1000), (12, 'INV-012', '2026-10-02', 'B', 2000);
    INSERT INTO payments (id, payment_date, invoice_ids, mode, amount_paise)
      VALUES (1, '2026-10-03', '1,12', 'Cash', 3000), (2, '2026-10-03', '12', 'UPI', 500), (3, '2026-10-03', '99', 'UPI', 1);
    INSERT INTO audit_logs (action, entity_type, entity_id) VALUES ('invoice.issue', 'invoice', 'INV-001');
    PRAGMA user_version = 8;`);
  await dbCore.migrate(w);
  assert.equal((await w.getFirstAsync('PRAGMA user_version')).user_version, 9);
  assert.equal((await w.getFirstAsync('SELECT COUNT(*) c FROM invoices')).c, 2, 'invoices kept');
  const st = await w.getFirstAsync('SELECT device_id FROM sync_state');
  for (const tbl of SYNCED) {
    const bad = await w.getAllAsync(`SELECT id FROM ${tbl} WHERE uid IS NULL OR dirty <> 1 OR origin_device <> ?`, st.device_id);
    assert.deepEqual(bad, [], `${tbl}: uid, dirty and origin set on old rows`);
  }
  const ledger = await w.getAllAsync('SELECT product_id, SUM(delta) s, COUNT(*) n FROM restocks GROUP BY product_id ORDER BY product_id');
  assert.deepEqual(ledger, [{ product_id: 1, s: 30, n: 1 }, { product_id: 2, s: 5, n: 1 }], 'only the drifted product gets a correcting row');
  const links = await w.getAllAsync('SELECT payment_id, invoice_id FROM payment_invoices ORDER BY payment_id, invoice_id');
  assert.deepEqual(links, [
    { payment_id: 1, invoice_id: 1 }, { payment_id: 1, invoice_id: 12 }, { payment_id: 2, invoice_id: 12 },
  ], 'CSV split; unknown invoice 99 dropped');
  // Triggers are live after the upgrade.
  await w.runAsync("INSERT INTO products (name) VALUES ('New')");
  assert.match((await w.getFirstAsync("SELECT uid FROM products WHERE name = 'New'")).uid, /^[0-9a-f]{32}$/);
  // Same columns, indexes and triggers as a fresh v9 database.
  const fresh = await db.getDb();
  const shape = async conn => {
    const objs = await conn.getAllAsync(
      "SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name");
    const cols = {};
    for (const o of objs.filter(x => x.type === 'table')) {
      cols[o.name] = (await conn.getAllAsync(`PRAGMA table_info(${o.name})`)).map(c => c.name).sort();
    }
    return { objs, cols };
  };
  assert.deepEqual(await shape(w), await shape(fresh));
  // A second open is a no-op.
  await dbCore.migrate(w);
  assert.equal((await w.getFirstAsync('SELECT COUNT(*) c FROM payment_invoices')).c, 3);
});

rmSync(outDir, { recursive: true, force: true });
console.log(failed ? `${failed} integration test(s) failed` : 'All integration tests passed.');
process.exit(failed ? 1 : 0);
