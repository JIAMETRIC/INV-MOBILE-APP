// Headless integration test: runs the REAL schema.ts SQL + repository code
// (db, settings, products, invoices, payments, drafts, dashboard, audit)
// compiled from the mobile app, against Node's built-in SQLite, with
// expo-sqlite / expo-secure-store / expo-crypto mocked.
// Run from mobile/: npm run test:integration
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
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
  'src/export/xlsx.ts',
  '--outDir', outDir, '--rootDir', 'src', '--module', 'nodenext', '--moduleResolution', 'nodenext',
  '--target', 'es2022', '--skipLibCheck', '--esModuleInterop'], { stdio: 'inherit', shell: true });

const db = require(path.join(outDir, 'data', 'db.js'));
const settingsRepo = require(path.join(outDir, 'data', 'settingsRepo.js'));
const productsRepo = require(path.join(outDir, 'data', 'productsRepo.js'));
const invoicesRepo = require(path.join(outDir, 'data', 'invoicesRepo.js'));
const paymentsRepo = require(path.join(outDir, 'data', 'paymentsRepo.js'));
const draftsRepo = require(path.join(outDir, 'data', 'draftsRepo.js'));
const dashboardRepo = require(path.join(outDir, 'data', 'dashboardRepo.js'));
const money = require(path.join(outDir, 'data', 'money.js'));

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
  assert.equal((await d.getFirstAsync('PRAGMA user_version')).user_version, 4);
  const s = await settingsRepo.getSettings();
  assert.equal(s.invoice_prefix, 'PRE-');
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

await t('catalog seed: 12 names x 5 sizes = 60 product rows', async () => {
  const all = await productsRepo.listProducts();
  assert.equal(all.length, 60);
  const hoodies = await productsRepo.listProducts('Hoodie');
  assert.equal(hoodies.length, 5);
  assert.deepEqual(hoodies.map(p => p.size), ['L', 'M', 'S', 'XL', 'XXL']); // case-insensitive name order, size alpha
});

let hoodieL;
await t('product CRUD + name+size UNIQUE guard', async () => {
  // The seed already ships "Hoodie · L" — exercise the update path on it…
  hoodieL = (await productsRepo.listProducts('Hoodie')).find(p => p.size === 'L');
  hoodieL = await productsRepo.upsertProduct({
    name: 'Hoodie', size: 'L', unit_paise: 550000, stock_qty: 40,
  }, hoodieL.id);
  assert.equal(hoodieL.stock_qty, 40);
  assert.equal(hoodieL.unit_paise, 550000);
  // …then a fresh insert that collides case-insensitively must reject.
  let rejected = false;
  try {
    await productsRepo.upsertProduct({ name: 'hoodie', size: 'l', unit_paise: 1, stock_qty: 1 });
  } catch {
    rejected = true;
  }
  assert.ok(rejected, 'duplicate name+size must reject (case-insensitive)');
  const again = await productsRepo.getProduct(hoodieL.id);
  assert.equal(again.unit_paise, 550000); // rollback left the DB usable, original intact
});

await t('restock adds to balance, re-prices, and writes ledger history', async () => {
  const polo = (await productsRepo.listProducts('Polo T-Shirt'))
    .find(p => p.name === 'Polo T-Shirt' && p.size === 'M');
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
    { name: row.name, size: row.size, unit_paise: row.unit_paise, stock_qty: 55 }, row.id);
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
  assert.equal(inv1.invoiceNo, 'PRE-001');
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
  assert.equal(res.invoiceNo, 'PRE-002');
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
    invoiceId: inv1.invoiceId, invoiceNo: 'PRE-001',
  });
  assert.equal(res.invoiceNo, 'PRE-001');
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
  const id = await draftsRepo.saveDraft(null, { form, invoiceNo: 'PRE-003' }, totals.total);
  const again = await draftsRepo.saveDraft(id, { form, invoiceNo: 'PRE-003' }, totals.total);
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
  // PRE-001 now carries 50 of hoodieL (edit test). Add a product-linked void.
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
  assert.equal(k.invoiceCount, 2); // PRE-001 paid, PRE-002 issued; voids excluded
  const aging = await dashboardRepo.getAging();
  assert.equal(aging.length, 1);
  assert.equal(aging[0].invoice_no, 'PRE-002');
  // PRE-001 (50) + void PRE-003 (25) + void PRE-004 (1): voids never count.
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
  assert.equal(tot.soldQty >= 50, true, 'PRE-001 hoodie lines count as sold');
});

await t('delete + syncNextSeq never moves the sequence backwards', async () => {
  const before = await settingsRepo.getSettings();
  assert.equal(before.next_seq, 5); // 001..004 allocated
  const rows = await invoicesRepo.listInvoices({ search: 'PRE-003' });
  await invoicesRepo.deleteInvoice(rows[0].id);
  // Cascade removed the voided PRE-003 lines; sold stays at the 50 issued on PRE-001.
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
  assert.equal(res.invoiceNo, 'PRE-005');
});

await t('audit trail records and reads back actions', async () => {
  const auditRepo = require(path.join(outDir, 'data', 'auditRepo.js'));
  await auditRepo.logAudit('invoice.issue', 'invoice', 'PRE-001');
  await auditRepo.logAudit('product.upsert', 'product', 1);
  await auditRepo.logAudit('payment.record', 'invoice', 'PRE-001');
  await auditRepo.logAudit('invoice.void', 'invoice', 'PRE-003');
  await auditRepo.logAudit('invoice.delete', 'invoice', 'PRE-003');
  const rows = await auditRepo.recentAudit(50);
  const actions = new Set(rows.map(r => r.action));
  for (const a of ['invoice.issue', 'product.upsert', 'payment.record', 'invoice.void', 'invoice.delete']) {
    assert.ok(actions.has(a), `missing audit action ${a}`);
  }
});

await t('consolidated register: one row per invoice, one per line item', async () => {
  const xlsx = require(path.join(outDir, 'export', 'xlsx.js'));
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

rmSync(outDir, { recursive: true, force: true });
console.log(failed ? `${failed} integration test(s) failed` : 'All integration tests passed.');
process.exit(failed ? 1 : 0);
